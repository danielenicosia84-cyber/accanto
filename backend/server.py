import os
import logging
import uuid
import json
import re
import base64
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Annotated

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, UploadFile, File, Form, Header, Query
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response as StarletteResponse
from pydantic import BaseModel, Field, EmailStr, BeforeValidator
from bson import ObjectId
import bcrypt
import jwt

from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType, ImageContent

from core import db, client, DEMO_EMAIL, ADMIN_EMAIL, JWT_SECRET, JWT_ALGORITHM, now_iso, create_access_token, get_current_user, require_not_demo, is_owner
from storage import put_object, get_object, init_storage, APP_NAME
from plans import TRIAL_DAYS
from billing import router as billing_router, require_upload, require_ai, require_profile_slot, record_ai_usage
from admin import router as admin_router
from ai import ai_text, SYSTEM_PROMPT, AI_MODEL, EMERGENT_LLM_KEY
from care import router as care_router, profile_out
from seed import seed_rich_data
from legal import router as legal_router, consent_payload

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("dopo")

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(str)]

class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    accept_terms: bool = False
    accept_health: bool = False
    accept_disclaimer: bool = False

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class ProfileInput(BaseModel):
    name: str
    relation: str = ""
    color: str = "#2D6A4F"

class TermInput(BaseModel):
    term: str
    lang: str = "it"

class LangInput(BaseModel):
    lang: str = "it"

class ReminderInput(BaseModel):
    profile_id: str
    title: str
    due_date: Optional[str] = None
    due_label: str = ""
    document_id: Optional[str] = None

class ReminderUpdate(BaseModel):
    done: bool

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def public_user(user: dict) -> dict:
    return {"id": str(user["_id"]), "email": user["email"], "name": user.get("name", ""), "is_demo": user.get("email") == DEMO_EMAIL, "is_owner": is_owner(user)}

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------
def build_file_part(data: bytes, ext: str):
    ext = ext.lower()
    if ext == "pdf":
        tmp = f"/tmp/{uuid.uuid4()}.pdf"
        Path(tmp).write_bytes(data)
        return FileContentWithMimeType(mime_type="application/pdf", file_path=tmp), tmp
    b64 = base64.b64encode(data).decode("utf-8")
    return ImageContent(image_base64=b64), None

def extract_json(text: str) -> dict:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if m:
        text = m.group(1)
    else:
        m = re.search(r"(\{.*\})", text, re.DOTALL)
        if m:
            text = m.group(1)
    try:
        return json.loads(text)
    except Exception:
        return {}

async def analyze_document(data: bytes, ext: str, lang: str) -> dict:
    lang_name = "italiano" if lang == "it" else "English"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"analyze-{uuid.uuid4()}", system_message=SYSTEM_PROMPT).with_model(*AI_MODEL)
    part, tmp = build_file_part(data, ext)
    prompt = (
        f"Oggi e' {today}. Leggi questo documento sanitario (puo' essere un referto, lettera di dimissione, ricetta o altro). "
        f"Rispondi SOLO con un oggetto JSON valido, in lingua {lang_name}, con questa struttura esatta:\n"
        "{\n"
        '  "title": "titolo breve del documento (max 6 parole)",\n'
        '  "category": "una tra: Referto, Lettera di dimissione, Ricetta, Esame, Altro",\n'
        '  "summary": "spiegazione in parole semplici del contenuto, 3-6 frasi, SENZA diagnosi ne valutazioni di gravita",\n'
        '  "key_terms": [{"term": "termine medico trovato", "meaning": "significato in parole semplici"}],\n'
        '  "deadlines": [{"title": "cosa fare (es. controllo, visita, esame)", "timeframe": "testo cosi come appare (es. entro 30 giorni)", "due_date": "YYYY-MM-DD oppure null se non calcolabile"}]\n'
        "}\n"
        "Includi massimo 6 key_terms e solo scadenze realmente presenti nel testo. Se non ci sono scadenze, usa lista vuota. "
        "Non aggiungere testo fuori dal JSON."
    )
    try:
        resp = await chat.send_message(UserMessage(text=prompt, file_contents=[part]))
    finally:
        if tmp:
            try:
                os.remove(tmp)
            except OSError:
                pass
    result = extract_json(resp if isinstance(resp, str) else str(resp))
    result.setdefault("title", "Documento")
    result.setdefault("category", "Altro")
    result.setdefault("summary", "")
    result.setdefault("key_terms", [])
    result.setdefault("deadlines", [])
    return result

# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(payload: RegisterInput, response: Response):
    email = payload.email.lower()
    consents = consent_payload(payload.accept_terms, payload.accept_health, payload.accept_disclaimer)
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email gia' registrata")
    doc = {"email": email, "password_hash": hash_password(payload.password), "name": payload.name, "created_at": now_iso(), "consents": consents,
           "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)).isoformat()}
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    token = create_access_token(str(res.inserted_id), email)
    set_auth_cookie(response, token)
    return {"user": public_user(doc), "token": token}

@api_router.post("/auth/login")
async def login(payload: LoginInput, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o password non corretti")
    token = create_access_token(str(user["_id"]), email)
    set_auth_cookie(response, token)
    return {"user": public_user(user), "token": token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": public_user(user)}

# ---------------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------------
@api_router.get("/profiles")
async def list_profiles(user: dict = Depends(get_current_user)):
    docs = await db.profiles.find({"user_id": str(user["_id"]), "is_deleted": {"$ne": True}}).sort("created_at", 1).to_list(100)
    return [profile_out(p) for p in docs]

@api_router.post("/profiles")
async def create_profile(payload: ProfileInput, user: dict = Depends(get_current_user)):
    await require_profile_slot(user)
    doc = {"user_id": str(user["_id"]), "name": payload.name, "relation": payload.relation, "color": payload.color, "is_deleted": False, "created_at": now_iso()}
    res = await db.profiles.insert_one(doc)
    doc["_id"] = res.inserted_id
    return profile_out(doc)

@api_router.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: str, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    if not ObjectId.is_valid(profile_id):
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    await db.profiles.update_one({"_id": ObjectId(profile_id), "user_id": str(user["_id"])}, {"$set": {"is_deleted": True}})
    return {"ok": True}

# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------
def document_out(d: dict) -> dict:
    return {
        "id": str(d["_id"]),
        "profile_id": d["profile_id"],
        "title": d.get("title", "Documento"),
        "category": d.get("category", "Altro"),
        "original_filename": d.get("original_filename"),
        "content_type": d.get("content_type"),
        "summary": d.get("summary", ""),
        "key_terms": d.get("key_terms", []),
        "deadlines": d.get("deadlines", []),
        "status": d.get("status", "ready"),
        "created_at": d.get("created_at"),
    }

def validate_upload(filename: str, data: bytes) -> str:
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "bin").lower()
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Formato non supportato. Usa foto (JPG/PNG) o PDF.")
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande (max 15MB).")
    return ext

async def safe_analyze(data: bytes, ext: str, lang: str, filename: str) -> tuple[dict, str]:
    try:
        return await analyze_document(data, ext, lang), "ready"
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        return {"title": filename, "category": "Altro", "summary": "", "key_terms": [], "deadlines": []}, "error"

async def create_reminders_from_deadlines(user_id: str, profile_id: str, document_id: str, deadlines: list):
    for dl in deadlines:
        await db.reminders.insert_one({
            "user_id": user_id,
            "profile_id": profile_id,
            "document_id": document_id,
            "title": dl.get("title", "Controllo"),
            "due_label": dl.get("timeframe", ""),
            "due_date": dl.get("due_date") if dl.get("due_date") not in (None, "null", "") else None,
            "done": False,
            "source": "ai",
            "created_at": now_iso(),
        })

@api_router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    profile_id: str = Form(...),
    lang: str = Form("it"),
    user: dict = Depends(get_current_user),
):
    await require_upload(user)
    profile = await db.profiles.find_one({"_id": ObjectId(profile_id), "user_id": str(user["_id"])}) if ObjectId.is_valid(profile_id) else None
    if not profile:
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    data = await file.read()
    ext = validate_upload(file.filename, data)
    content_type = MIME_TYPES[ext]
    result = put_object(f"{APP_NAME}/uploads/{user['_id']}/{uuid.uuid4()}.{ext}", data, content_type)
    analysis, status = await safe_analyze(data, ext, lang, file.filename)

    doc = {
        "user_id": str(user["_id"]),
        "profile_id": profile_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "title": analysis.get("title") or file.filename,
        "category": analysis.get("category", "Altro"),
        "summary": analysis.get("summary", ""),
        "key_terms": analysis.get("key_terms", []),
        "deadlines": analysis.get("deadlines", []),
        "status": status,
        "is_deleted": False,
        "created_at": now_iso(),
    }
    res = await db.documents.insert_one(doc)
    doc["_id"] = res.inserted_id
    await create_reminders_from_deadlines(str(user["_id"]), profile_id, str(res.inserted_id), analysis.get("deadlines", []))
    return document_out(doc)

@api_router.get("/documents")
async def list_documents(profile_id: str = Query(...), user: dict = Depends(get_current_user)):
    docs = await db.documents.find({"user_id": str(user["_id"]), "profile_id": profile_id, "is_deleted": {"$ne": True}}).sort("created_at", -1).to_list(500)
    return [document_out(d) for d in docs]

@api_router.get("/documents/{document_id}")
async def get_document(document_id: str, user: dict = Depends(get_current_user)):
    d = await db.documents.find_one({"_id": ObjectId(document_id), "user_id": str(user["_id"]), "is_deleted": {"$ne": True}})
    if not d:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    return document_out(d)

@api_router.get("/documents/{document_id}/file")
async def download_document(document_id: str, authorization: str = Header(None), auth: str = Query(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Non autenticato")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload["sub"]
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido")
    d = await db.documents.find_one({"_id": ObjectId(document_id), "user_id": user_id, "is_deleted": {"$ne": True}})
    if not d:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    content, ctype = get_object(d["storage_path"])
    return StarletteResponse(content=content, media_type=d.get("content_type", ctype))

@api_router.delete("/documents/{document_id}")
async def delete_document(document_id: str, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    await db.documents.update_one({"_id": ObjectId(document_id), "user_id": str(user["_id"])}, {"$set": {"is_deleted": True}})
    await db.reminders.update_many({"document_id": document_id, "user_id": str(user["_id"])}, {"$set": {"done": True}})
    return {"ok": True}

@api_router.post("/documents/{document_id}/explain")
async def explain_simple(document_id: str, payload: LangInput, user: dict = Depends(get_current_user)):
    await require_ai(user)
    d = await db.documents.find_one({"_id": ObjectId(document_id), "user_id": str(user["_id"]), "is_deleted": {"$ne": True}})
    if not d:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    lang_name = "italiano" if payload.lang == "it" else "English"
    prompt = (
        f"Ecco il contenuto estratto di un documento sanitario:\n\nTITOLO: {d.get('title')}\nSINTESI: {d.get('summary')}\n"
        f"TERMINI: {json.dumps(d.get('key_terms', []), ensure_ascii=False)}\n\n"
        f"Spiega in {lang_name}, in parole molto semplici e rassicuranti (senza diagnosi ne valutazioni di gravita), cosa dice questo documento. "
        "Usa frasi brevi. Chiudi ricordando di parlarne con il medico curante."
    )
    text = await ai_text(SYSTEM_PROMPT, prompt)
    await record_ai_usage(user)
    return {"answer": text}

@api_router.post("/documents/{document_id}/term")
async def explain_term(document_id: str, payload: TermInput, user: dict = Depends(get_current_user)):
    await require_ai(user)
    d = await db.documents.find_one({"_id": ObjectId(document_id), "user_id": str(user["_id"]), "is_deleted": {"$ne": True}})
    if not d:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    lang_name = "italiano" if payload.lang == "it" else "English"
    prompt = (
        f"Nel documento sanitario (titolo: {d.get('title')}, sintesi: {d.get('summary')}) l'utente non capisce questo termine: \"{payload.term}\".\n"
        f"Spiega in {lang_name}, in parole semplici, cosa significa in generale questo termine, restando ancorato al contesto del documento. "
        "Non fare diagnosi ne valutazioni di gravita. Massimo 4 frasi. Ricorda di chiedere al medico per il caso specifico."
    )
    text = await ai_text(SYSTEM_PROMPT, prompt)
    await record_ai_usage(user)
    return {"answer": text}

@api_router.post("/documents/{document_id}/next-steps")
async def next_steps(document_id: str, payload: LangInput, user: dict = Depends(get_current_user)):
    await require_ai(user)
    d = await db.documents.find_one({"_id": ObjectId(document_id), "user_id": str(user["_id"]), "is_deleted": {"$ne": True}})
    if not d:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    lang_name = "italiano" if payload.lang == "it" else "English"
    prompt = (
        f"Documento sanitario (titolo: {d.get('title')}, sintesi: {d.get('summary')}, scadenze: {json.dumps(d.get('deadlines', []), ensure_ascii=False)}).\n"
        f"Elenca in {lang_name}, in modo semplice, i prossimi passi PRATICI e ORGANIZZATIVI che il documento stesso indica (es. prenotare un controllo, portare il referto al medico, conservare il documento). "
        "NON dare consigli medici, NON suggerire terapie o farmaci. Usa un elenco puntato breve. Chiudi ricordando di confermare tutto con il medico curante."
    )
    text = await ai_text(SYSTEM_PROMPT, prompt)
    await record_ai_usage(user)
    return {"answer": text}

# ---------------------------------------------------------------------------
# Reminders
# ---------------------------------------------------------------------------
def reminder_out(r: dict) -> dict:
    return {
        "id": str(r["_id"]),
        "profile_id": r["profile_id"],
        "document_id": r.get("document_id"),
        "title": r.get("title"),
        "due_label": r.get("due_label", ""),
        "due_date": r.get("due_date"),
        "done": r.get("done", False),
        "source": r.get("source", "manual"),
        "created_at": r.get("created_at"),
    }

@api_router.get("/reminders")
async def list_reminders(profile_id: str = Query(...), user: dict = Depends(get_current_user)):
    docs = await db.reminders.find({"user_id": str(user["_id"]), "profile_id": profile_id}).sort("created_at", -1).to_list(500)
    return [reminder_out(r) for r in docs]

@api_router.post("/reminders")
async def create_reminder(payload: ReminderInput, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    doc = {
        "user_id": str(user["_id"]),
        "profile_id": payload.profile_id,
        "document_id": payload.document_id,
        "title": payload.title,
        "due_label": payload.due_label,
        "due_date": payload.due_date,
        "done": False,
        "source": "manual",
        "created_at": now_iso(),
    }
    res = await db.reminders.insert_one(doc)
    doc["_id"] = res.inserted_id
    return reminder_out(doc)

@api_router.patch("/reminders/{reminder_id}")
async def update_reminder(reminder_id: str, payload: ReminderUpdate, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    await db.reminders.update_one({"_id": ObjectId(reminder_id), "user_id": str(user["_id"])}, {"$set": {"done": payload.done}})
    r = await db.reminders.find_one({"_id": ObjectId(reminder_id)})
    return reminder_out(r)

@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    await db.reminders.delete_one({"_id": ObjectId(reminder_id), "user_id": str(user["_id"])})
    return {"ok": True}

@api_router.get("/")
async def root():
    return {"message": "Accanto API"}

app.include_router(api_router)
app.include_router(billing_router)
app.include_router(admin_router)
app.include_router(care_router)
app.include_router(legal_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.profiles.create_index("user_id")
    await db.documents.create_index([("user_id", 1), ("profile_id", 1)])
    await db.reminders.create_index([("user_id", 1), ("profile_id", 1)])
    await db.ai_usage.create_index([("user_id", 1), ("month", 1)], unique=True)
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    # Seed demo user
    demo_email = DEMO_EMAIL
    demo_pw = os.environ.get("DEMO_PASSWORD", "demo1234")
    existing = await db.users.find_one({"email": demo_email})
    if not existing:
        await db.users.insert_one({"email": demo_email, "password_hash": hash_password(demo_pw), "name": "Demo Caregiver", "created_at": now_iso()})
        logger.info("Demo user seeded")
    # Seed owner / master admin
    admin_pw = os.environ.get("ADMIN_PASSWORD")
    if admin_pw:
        admin = await db.users.find_one({"email": ADMIN_EMAIL})
        if not admin:
            await db.users.insert_one({"email": ADMIN_EMAIL, "password_hash": hash_password(admin_pw), "name": "Master Admin", "role": "owner", "created_at": now_iso()})
            logger.info("Owner account seeded")
        elif admin.get("role") != "owner" or not verify_password(admin_pw, admin["password_hash"]):
            await db.users.update_one({"_id": admin["_id"]}, {"$set": {"role": "owner", "password_hash": hash_password(admin_pw)}})
    await db.unlock_codes.create_index("code", unique=True)
    await db.payments.create_index([("user_id", 1), ("created_at", -1)])
    await db.webhook_events.create_index("event_id")
    for coll in ("medications", "vitals", "expenses"):
        await db[coll].create_index([("user_id", 1), ("profile_id", 1)])
    for email in (DEMO_EMAIL, ADMIN_EMAIL):
        u = await db.users.find_one({"email": email})
        if u:
            try:
                await seed_rich_data(u)
            except Exception as e:
                logger.error(f"Rich seed failed for {email}: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
