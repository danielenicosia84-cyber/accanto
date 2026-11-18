import io
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Query, Response
from pydantic import BaseModel

from core import db, get_current_user, require_not_demo, now_iso
from billing import require_feature, require_ai, record_ai_usage
from ai import ai_text, SYSTEM_PROMPT
from guide_content import GUIDE, BUREAUCRACY, KIT_PHRASES, KIT_LABELS, KIT_LANGUAGES
from pdfgen import build_pdf, P, table, kv_table, Spacer, KeepTogether, mm

logger = logging.getLogger("dopo.care")
router = APIRouter(prefix="/api")

VITAL_TYPES = {
    "pressure": {"unit": "mmHg", "it": "Pressione", "en": "Blood pressure", "two": True},
    "heart_rate": {"unit": "bpm", "it": "Battiti", "en": "Heart rate"},
    "glucose": {"unit": "mg/dL", "it": "Glicemia", "en": "Glucose"},
    "weight": {"unit": "kg", "it": "Peso", "en": "Weight"},
    "temperature": {"unit": "°C", "it": "Temperatura", "en": "Temperature"},
    "spo2": {"unit": "%", "it": "Saturazione", "en": "Saturation"},
}
EXPENSE_CATEGORIES = ["visite", "farmaci", "esami", "ticket", "dispositivi", "dentista", "ricoveri", "assistenza", "altro"]
FRANCHIGIA = 129.11
DETRAZIONE = 0.19


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    relation: Optional[str] = None
    color: Optional[str] = None
    birth_date: Optional[str] = None
    fiscal_code: Optional[str] = None
    blood_type: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    allergies: Optional[str] = None
    conditions: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_phone: Optional[str] = None
    emergency_contacts: Optional[list] = None
    exemption_codes: Optional[str] = None
    health_card_expiry: Optional[str] = None
    address: Optional[str] = None
    habits: Optional[str] = None
    notes: Optional[str] = None


class MedicationInput(BaseModel):
    name: str
    dosage: str = ""
    form: str = ""
    morning: str = ""
    noon: str = ""
    evening: str = ""
    night: str = ""
    food: str = "any"  # before|after|any
    notes: str = ""
    prescribed_by: str = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    active: bool = True


class VitalInput(BaseModel):
    type: str
    value: float
    value2: Optional[float] = None
    measured_at: Optional[str] = None
    notes: str = ""


class ExpenseInput(BaseModel):
    date: str
    description: str
    category: str = "altro"
    amount: float
    traceable: bool = True
    deductible: bool = True
    document_id: Optional[str] = None
    notes: str = ""


class CompareInput(BaseModel):
    document_ids: list[str]
    lang: str = "it"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _oid(v: str) -> ObjectId:
    if not ObjectId.is_valid(v or ""):
        raise HTTPException(status_code=404, detail="Elemento non trovato")
    return ObjectId(v)


def _out(d: dict) -> dict:
    return {**{k: v for k, v in d.items() if k != "_id"}, "id": str(d["_id"])}


def profile_out(p: dict) -> dict:
    return {
        "id": str(p["_id"]), "name": p["name"], "relation": p.get("relation", ""), "color": p.get("color", "#2D6A4F"), "created_at": p.get("created_at"),
        "birth_date": p.get("birth_date"), "fiscal_code": p.get("fiscal_code", ""), "blood_type": p.get("blood_type", ""),
        "weight_kg": p.get("weight_kg"), "height_cm": p.get("height_cm"), "allergies": p.get("allergies", ""), "conditions": p.get("conditions", ""),
        "doctor_name": p.get("doctor_name", ""), "doctor_phone": p.get("doctor_phone", ""), "emergency_contacts": p.get("emergency_contacts", []),
        "exemption_codes": p.get("exemption_codes", ""), "health_card_expiry": p.get("health_card_expiry"), "address": p.get("address", ""),
        "habits": p.get("habits", ""), "notes": p.get("notes", ""),
    }


async def _profile(pid: str, user: dict) -> dict:
    p = await db.profiles.find_one({"_id": _oid(pid), "user_id": str(user["_id"]), "is_deleted": {"$ne": True}})
    if not p:
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    return p


def _fmt_date(iso: Optional[str], lang="it") -> str:
    if not iso:
        return "-"
    try:
        d = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        return d.strftime("%d/%m/%Y") if lang == "it" else d.strftime("%d %b %Y")
    except ValueError:
        return str(iso)


def _fmt_dt(iso: Optional[str]) -> str:
    if not iso:
        return "-"
    try:
        return datetime.fromisoformat(str(iso).replace("Z", "+00:00")).strftime("%d/%m/%Y %H:%M")
    except ValueError:
        return str(iso)


def _eur(n) -> str:
    return f"{float(n or 0):.2f}".replace(".", ",") + " €"


def _age(birth: Optional[str]) -> str:
    if not birth:
        return ""
    try:
        b = datetime.fromisoformat(birth)
        today = datetime.now(timezone.utc)
        years = today.year - b.year - ((today.month, today.day) < (b.month, b.day))
        return f"{years}"
    except ValueError:
        return ""


def _pdf_response(content: bytes, filename: str) -> Response:
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{filename}"'})


def _xlsx_response(wb, filename: str) -> Response:
    buf = io.BytesIO()
    wb.save(buf)
    return Response(content=buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _food_label(code: str, lang: str) -> str:
    key = {"before": "before_food", "after": "after_food"}.get(code, "any_food")
    return KIT_LABELS[key][0 if lang == "it" else 1]


def _validate_expense(payload: "ExpenseInput"):
    if payload.category not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoria non valida")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Importo non valido")


def _validate_vital(payload: "VitalInput"):
    if payload.type not in VITAL_TYPES:
        raise HTTPException(status_code=400, detail="Tipo di parametro non valido")
    if VITAL_TYPES[payload.type].get("two") and payload.value2 is None:
        raise HTTPException(status_code=400, detail="Inserisci anche la minima")
    if payload.value <= 0 or (payload.value2 is not None and payload.value2 <= 0):
        raise HTTPException(status_code=400, detail="Valore non valido")


def _safe_name(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in " _-").strip().replace(" ", "_") or "profilo"


# ---------------------------------------------------------------------------
# Guide / legend / bureaucracy templates
# ---------------------------------------------------------------------------
def _bureaucracy(lang: str) -> list:
    return [{"id": b["id"], "title": (b.get(lang) or b["it"])[0], "description": (b.get(lang) or b["it"])[1],
             "default_month": b.get("default_month"), "default_day": b.get("default_day")} for b in BUREAUCRACY]


@router.get("/guide")
async def get_guide(lang: str = "it"):
    lang = "en" if lang == "en" else "it"
    g = GUIDE[lang]
    return {**g, "bureaucracy": _bureaucracy(lang), "kit_languages": KIT_LANGUAGES}


@router.get("/deadlines/templates")
async def deadline_templates(lang: str = "it"):
    return _bureaucracy("en" if lang == "en" else "it")


@router.get("/guide/pdf")
async def guide_pdf(lang: str = "it"):
    lang = "en" if lang == "en" else "it"
    g = GUIDE[lang]
    it = lang == "it"
    s = [P(g["title"], "h1"), P(g["intro"]), Spacer(1, 6)]
    s += [P("Come funziona" if it else "How it works", "h2")]
    s += [table([["#", "Passo" if it else "Step", "Cosa fare" if it else "What to do"]] + [[str(i + 1), a, b] for i, (a, b) in enumerate(g["steps"])], col_widths=[8 * mm, 50 * mm, 120 * mm])]
    s += [P("Legenda delle categorie" if it else "Document categories", "h2"), table([["Categoria" if it else "Category", "Significato" if it else "Meaning"]] + [list(x) for x in g["categories"]], col_widths=[55 * mm, 123 * mm])]
    s += [P("Legenda icone e pulsanti" if it else "Icons and buttons", "h2"), table([["Voce" if it else "Item", "Descrizione" if it else "Description"]] + [list(x) for x in g["icons"]], col_widths=[55 * mm, 123 * mm])]
    s += [P("Glossario medico essenziale" if it else "Essential medical glossary", "h2"), table([["Termine" if it else "Term", "In parole semplici" if it else "In plain words"]] + [list(x) for x in g["glossary"]], col_widths=[55 * mm, 123 * mm])]
    s += [P("Parametri vitali: come leggerli" if it else "Vital signs: how to read them", "h2"), P(g["vitals_note"], "note"), Spacer(1, 4),
          table([["Parametro" if it else "Parameter", "Unità" if it else "Unit", "Riferimento generale" if it else "General reference"]] + [list(x) for x in g["vitals"]], col_widths=[45 * mm, 20 * mm, 113 * mm])]
    s += [P("Scadenze burocratiche in Italia" if it else "Italian bureaucratic deadlines", "h2"), table([["Scadenza" if it else "Deadline", "Cosa sapere" if it else "What to know"]] + [[b["title"], b["description"]] for b in _bureaucracy(lang)], col_widths=[60 * mm, 118 * mm])]
    s += [P("Domande frequenti" if it else "FAQ", "h2")] + [KeepTogether([P(q, "h3"), P(a)]) for q, a in g["faq"]]
    return _pdf_response(build_pdf(g["title"], "Manuale d'uso / User manual", s), "Accanto-Guida.pdf")


# ---------------------------------------------------------------------------
# Extended clinical profile
# ---------------------------------------------------------------------------
@router.put("/profiles/{pid}")
async def update_profile(pid: str, payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    p = await _profile(pid, user)
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "name" in data and not data["name"].strip():
        raise HTTPException(status_code=400, detail="Il nome e' obbligatorio")
    if "fiscal_code" in data:
        data["fiscal_code"] = data["fiscal_code"].upper().strip()
    await db.profiles.update_one({"_id": p["_id"]}, {"$set": {**data, "updated_at": now_iso()}})
    return profile_out(await db.profiles.find_one({"_id": p["_id"]}))


# ---------------------------------------------------------------------------
# Medications (therapy plan) — list for all plans, bilingual PDF gated
# ---------------------------------------------------------------------------
@router.get("/profiles/{pid}/medications")
async def list_medications(pid: str, user: dict = Depends(get_current_user)):
    await _profile(pid, user)
    rows = await db.medications.find({"user_id": str(user["_id"]), "profile_id": pid}).sort("created_at", 1).to_list(200)
    return [_out(r) for r in rows]


@router.post("/profiles/{pid}/medications")
async def create_medication(pid: str, payload: MedicationInput, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    await _profile(pid, user)
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Il nome del farmaco e' obbligatorio")
    doc = {**payload.model_dump(), "user_id": str(user["_id"]), "profile_id": pid, "created_at": now_iso()}
    res = await db.medications.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _out(doc)


@router.put("/medications/{mid}")
async def update_medication(mid: str, payload: MedicationInput, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    q = {"_id": _oid(mid), "user_id": str(user["_id"])}
    if not await db.medications.find_one(q):
        raise HTTPException(status_code=404, detail="Farmaco non trovato")
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Il nome del farmaco e' obbligatorio")
    await db.medications.update_one(q, {"$set": {**payload.model_dump(), "updated_at": now_iso()}})
    return _out(await db.medications.find_one(q))


@router.delete("/medications/{mid}")
async def delete_medication(mid: str, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    res = await db.medications.delete_one({"_id": _oid(mid), "user_id": str(user["_id"])})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Farmaco non trovato")
    return {"ok": True}


async def _kit_translation(lang: str) -> dict:
    """Phrases + labels translated into `lang` (IT always first). Cached per language."""
    if lang == "en":
        return {"phrases": [en for _, en in KIT_PHRASES], "labels": {k: v[1] for k, v in KIT_LABELS.items()}}
    cached = await db.translations.find_one({"_id": f"kit:{lang}:v1"})
    if cached:
        return cached["data"]
    payload = {"phrases": [it for it, _ in KIT_PHRASES], "labels": {k: v[0] for k, v in KIT_LABELS.items()}}
    prompt = (
        f"Traduci in {KIT_LANGUAGES.get(lang, lang)} il seguente JSON mantenendo ESATTAMENTE la stessa struttura e le stesse chiavi. "
        "Traduci solo i valori testuali, in modo semplice e naturale per una badante che assiste una persona anziana. "
        "Rispondi SOLO con il JSON tradotto, senza commenti.\n" + json.dumps(payload, ensure_ascii=False)
    )
    text = await ai_text("Sei un traduttore professionale. Rispondi solo con JSON valido.", prompt)
    try:
        start, end = text.index("{"), text.rindex("}") + 1
        data = json.loads(text[start:end])
        if len(data.get("phrases", [])) != len(KIT_PHRASES):
            raise ValueError("phrase count mismatch")
        data["labels"] = {k: data.get("labels", {}).get(k, v[1]) for k, v in KIT_LABELS.items()}
    except Exception as e:
        logger.warning(f"Kit translation failed for {lang}: {e}")
        data = {"phrases": [en for _, en in KIT_PHRASES], "labels": {k: v[1] for k, v in KIT_LABELS.items()}}
    await db.translations.update_one({"_id": f"kit:{lang}:v1"}, {"$set": {"data": data, "created_at": now_iso()}}, upsert=True)
    return data


def _med_rows(meds: list, l1: dict, l2: dict, lang2: str) -> list:
    head = [f"{l1['medicine']} / {l2['medicine']}", f"{l1['dose']} / {l2['dose']}", f"{l1['morning']}<br/>{l2['morning']}", f"{l1['noon']}<br/>{l2['noon']}",
            f"{l1['evening']}<br/>{l2['evening']}", f"{l1['night']}<br/>{l2['night']}", f"{l1['notes']} / {l2['notes']}"]
    rows = [head]
    for m in meds:
        food_it = _food_label(m.get("food", "any"), "it")
        food_2 = l2.get({"before": "before_food", "after": "after_food"}.get(m.get("food", "any"), "any_food"), "")
        notes = " · ".join(x for x in [f"{food_it} / {food_2}" if lang2 != "it" else food_it, m.get("notes", "")] if x)
        rows.append([f"<b>{m['name']}</b>" + (f"<br/>{m['form']}" if m.get("form") else ""), m.get("dosage", ""), m.get("morning") or "—", m.get("noon") or "—", m.get("evening") or "—", m.get("night") or "—", notes])
    return rows


@router.get("/profiles/{pid}/medications/pdf")
async def medications_pdf(pid: str, lang2: str = "en", user: dict = Depends(get_current_user)):
    await require_feature(user, "fridge_table")
    p = await _profile(pid, user)
    meds = [m for m in await db.medications.find({"user_id": str(user["_id"]), "profile_id": pid, "active": {"$ne": False}}).sort("created_at", 1).to_list(200)]
    lang2 = lang2 if lang2 in KIT_LANGUAGES else "en"
    l1 = {k: v[0] for k, v in KIT_LABELS.items()}
    l2 = (await _kit_translation(lang2))["labels"]
    s = [P(f"Tabella farmaci — {p['name']}", "h1"), P(f"{l1['routine']} / {l2['routine']} · Aggiornato il {datetime.now().strftime('%d/%m/%Y')}", "small"), Spacer(1, 8)]
    if meds:
        s.append(table(_med_rows(meds, l1, l2, lang2), col_widths=[42 * mm, 24 * mm, 18 * mm, 18 * mm, 18 * mm, 18 * mm, 40 * mm]))
    else:
        s.append(P("Nessun farmaco inserito. / No medicines recorded."))
    s += [Spacer(1, 10)]
    info = [(f"{l1['allergies']} / {l2['allergies']}", p.get("allergies") or "-"), (f"{l1['doctor']} / {l2['doctor']}", " · ".join(x for x in [p.get("doctor_name"), p.get("doctor_phone")] if x) or "-")]
    for c in (p.get("emergency_contacts") or [])[:3]:
        info.append((f"{l1['contacts']} / {l2['contacts']}", f"{c.get('name', '')} ({c.get('relation', '')}) {c.get('phone', '')}"))
    s += [kv_table(info), Spacer(1, 8), P("Questa tabella riporta la terapia così come inserita dal familiare. Verificare sempre con il medico o il farmacista. / Always verify with the doctor or pharmacist.", "note")]
    return _pdf_response(build_pdf(f"Tabella farmaci — {p['name']}", f"Italiano / {KIT_LANGUAGES[lang2]}", s), f"Accanto-Farmaci-{_safe_name(p['name'])}.pdf")


# ---------------------------------------------------------------------------
# Vitals diary
# ---------------------------------------------------------------------------
@router.get("/profiles/{pid}/vitals")
async def list_vitals(pid: str, type: str = "", limit: int = 300, user: dict = Depends(get_current_user)):
    await require_feature(user, "vitals")
    await _profile(pid, user)
    q = {"user_id": str(user["_id"]), "profile_id": pid}
    if type:
        q["type"] = type
    rows = await db.vitals.find(q).sort("measured_at", -1).to_list(min(limit, 1000))
    return [_out(r) for r in rows]


@router.post("/profiles/{pid}/vitals")
async def create_vital(pid: str, payload: VitalInput, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    await require_feature(user, "vitals")
    await _profile(pid, user)
    _validate_vital(payload)
    doc = {**payload.model_dump(), "measured_at": payload.measured_at or now_iso(), "user_id": str(user["_id"]), "profile_id": pid, "created_at": now_iso()}
    res = await db.vitals.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _out(doc)


@router.delete("/vitals/{vid}")
async def delete_vital(vid: str, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    res = await db.vitals.delete_one({"_id": _oid(vid), "user_id": str(user["_id"])})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Misurazione non trovata")
    return {"ok": True}


def _vital_value(v: dict) -> str:
    t = VITAL_TYPES.get(v["type"], {})
    if t.get("two"):
        return f"{v['value']:g}/{(v.get('value2') or 0):g}"
    return f"{v['value']:g}"


def _vital_label(t: str, lang: str) -> str:
    return VITAL_TYPES.get(t, {}).get(lang, t)


@router.get("/profiles/{pid}/vitals/export")
async def vitals_export(pid: str, fmt: str = "pdf", lang: str = "it", user: dict = Depends(get_current_user)):
    await require_feature(user, "vitals")
    p = await _profile(pid, user)
    rows = await db.vitals.find({"user_id": str(user["_id"]), "profile_id": pid}).sort("measured_at", -1).to_list(1000)
    it = lang != "en"
    head = ["Data" if it else "Date", "Parametro" if it else "Parameter", "Valore" if it else "Value", "Unità" if it else "Unit", "Note" if it else "Notes"]
    data = [[_fmt_dt(v.get("measured_at")), _vital_label(v["type"], "it" if it else "en"), _vital_value(v), VITAL_TYPES.get(v["type"], {}).get("unit", ""), v.get("notes", "")] for v in rows]
    title = f"{'Diario parametri' if it else 'Vitals diary'} — {p['name']}"
    if fmt == "xlsx":
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Parametri" if it else "Vitals"
        ws.append(head)
        for r in data:
            ws.append(r)
        for col, w in zip("ABCDE", (18, 18, 12, 10, 40)):
            ws.column_dimensions[col].width = w
        return _xlsx_response(wb, f"Accanto-Parametri-{_safe_name(p['name'])}.xlsx")
    s = [P(title, "h1"), P(f"{len(rows)} {'misurazioni' if it else 'measurements'} · {datetime.now().strftime('%d/%m/%Y')}", "small"), Spacer(1, 6)]
    summary = []
    for t, meta in VITAL_TYPES.items():
        vals = [v for v in rows if v["type"] == t]
        if not vals:
            continue
        nums = [v["value"] for v in vals]
        last = vals[0]
        summary.append([meta["it" if it else "en"], _vital_value(last) + " " + meta["unit"], _fmt_dt(last.get("measured_at")), f"{min(nums):g} – {max(nums):g}", f"{sum(nums) / len(nums):.1f}", str(len(vals))])
    if summary:
        s += [P("Riepilogo" if it else "Summary", "h2"), table([["Parametro" if it else "Parameter", "Ultimo" if it else "Last", "Quando" if it else "When", "Min – Max", "Media" if it else "Avg", "N."]] + summary, col_widths=[36 * mm, 30 * mm, 34 * mm, 30 * mm, 22 * mm, 14 * mm])]
    s += [P("Tutte le misurazioni" if it else "All measurements", "h2"), table([head] + data, col_widths=[32 * mm, 34 * mm, 24 * mm, 18 * mm, 70 * mm]) if data else P("Nessuna misurazione." if it else "No measurements.")]
    s += [Spacer(1, 8), P(GUIDE["it" if it else "en"]["vitals_note"], "note")]
    return _pdf_response(build_pdf(title, p['name'], s), f"Accanto-Parametri-{_safe_name(p['name'])}.pdf")


# ---------------------------------------------------------------------------
# Medical expenses (730)
# ---------------------------------------------------------------------------
@router.get("/profiles/{pid}/expenses")
async def list_expenses(pid: str, year: int = 0, user: dict = Depends(get_current_user)):
    await require_feature(user, "expenses_730")
    await _profile(pid, user)
    q = {"user_id": str(user["_id"]), "profile_id": pid}
    if year:
        q["date"] = {"$regex": f"^{year}-"}
    rows = await db.expenses.find(q).sort("date", -1).to_list(2000)
    return [_out(r) for r in rows]


@router.post("/profiles/{pid}/expenses")
async def create_expense(pid: str, payload: ExpenseInput, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    await require_feature(user, "expenses_730")
    await _profile(pid, user)
    _validate_expense(payload)
    doc = {**payload.model_dump(), "user_id": str(user["_id"]), "profile_id": pid, "created_at": now_iso()}
    res = await db.expenses.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _out(doc)


@router.put("/expenses/{eid}")
async def update_expense(eid: str, payload: ExpenseInput, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    q = {"_id": _oid(eid), "user_id": str(user["_id"])}
    if not await db.expenses.find_one(q):
        raise HTTPException(status_code=404, detail="Spesa non trovata")
    _validate_expense(payload)
    await db.expenses.update_one(q, {"$set": {**payload.model_dump(), "updated_at": now_iso()}})
    return _out(await db.expenses.find_one(q))


@router.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    res = await db.expenses.delete_one({"_id": _oid(eid), "user_id": str(user["_id"])})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Spesa non trovata")
    return {"ok": True}


def _expense_summary(rows: list) -> dict:
    total = sum(float(r["amount"]) for r in rows)
    deductible = sum(float(r["amount"]) for r in rows if r.get("deductible", True) and (r.get("traceable", True) or r.get("category") in ("farmaci", "dispositivi")))
    by_cat = {}
    for r in rows:
        by_cat[r.get("category", "altro")] = round(by_cat.get(r.get("category", "altro"), 0) + float(r["amount"]), 2)
    estimate = round(max(0.0, deductible - FRANCHIGIA) * DETRAZIONE, 2)
    return {"total": round(total, 2), "deductible": round(deductible, 2), "franchigia": FRANCHIGIA, "estimated_refund": estimate, "by_category": by_cat, "count": len(rows)}


@router.get("/profiles/{pid}/expenses/summary")
async def expenses_summary(pid: str, year: int = 0, user: dict = Depends(get_current_user)):
    await require_feature(user, "expenses_730")
    await _profile(pid, user)
    year = year or datetime.now().year
    rows = await db.expenses.find({"user_id": str(user["_id"]), "profile_id": pid, "date": {"$regex": f"^{year}-"}}).to_list(2000)
    return {"year": year, **_expense_summary(rows)}


@router.get("/profiles/{pid}/expenses/export")
async def expenses_export(pid: str, fmt: str = "pdf", year: int = 0, lang: str = "it", user: dict = Depends(get_current_user)):
    await require_feature(user, "expenses_730")
    p = await _profile(pid, user)
    year = year or datetime.now().year
    rows = await db.expenses.find({"user_id": str(user["_id"]), "profile_id": pid, "date": {"$regex": f"^{year}-"}}).sort("date", 1).to_list(2000)
    it = lang != "en"
    summ = _expense_summary(rows)
    head = ["Data" if it else "Date", "Descrizione" if it else "Description", "Categoria" if it else "Category", "Importo" if it else "Amount", "Tracciabile" if it else "Traceable", "Detraibile" if it else "Deductible", "Note" if it else "Notes"]
    yes, no = ("Sì", "No") if it else ("Yes", "No")
    data = [[_fmt_date(r["date"]), r["description"], r.get("category", ""), _eur(r["amount"]), yes if r.get("traceable", True) else no, yes if r.get("deductible", True) else no, r.get("notes", "")] for r in rows]
    title = f"{'Spese mediche' if it else 'Medical expenses'} {year} — {p['name']}"
    if fmt == "xlsx":
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = f"Spese {year}" if it else f"Expenses {year}"
        ws.append(head)
        for r in rows:
            ws.append([r["date"], r["description"], r.get("category", ""), float(r["amount"]), yes if r.get("traceable", True) else no, yes if r.get("deductible", True) else no, r.get("notes", "")])
        ws.append([])
        ws.append(["Totale" if it else "Total", "", "", summ["total"]])
        ws.append(["Detraibile" if it else "Deductible", "", "", summ["deductible"]])
        ws.append(["Franchigia" if it else "Threshold", "", "", summ["franchigia"]])
        ws.append(["Detrazione stimata 19%" if it else "Estimated 19% credit", "", "", summ["estimated_refund"]])
        for col, w in zip("ABCDEFG", (12, 40, 14, 12, 12, 12, 30)):
            ws.column_dimensions[col].width = w
        return _xlsx_response(wb, f"Accanto-Spese-{year}-{_safe_name(p['name'])}.xlsx")
    s = [P(title, "h1"), P(f"{'Riepilogo per la dichiarazione dei redditi (730 / Redditi PF)' if it else 'Summary for the Italian tax return (730)'} · {datetime.now().strftime('%d/%m/%Y')}", "small"), Spacer(1, 6)]
    s += [kv_table([
        ("Totale spese" if it else "Total expenses", _eur(summ["total"])),
        ("Spese detraibili (pagamento tracciabile o farmaci/dispositivi)" if it else "Deductible (traceable or medicines/devices)", _eur(summ["deductible"])),
        ("Franchigia" if it else "Threshold", _eur(summ["franchigia"])),
        ("Detrazione stimata (19%)" if it else "Estimated tax credit (19%)", _eur(summ["estimated_refund"])),
    ])]
    if summ["by_category"]:
        s += [P("Per categoria" if it else "By category", "h2"), table([["Categoria" if it else "Category", "Importo" if it else "Amount"]] + [[k, _eur(v)] for k, v in sorted(summ["by_category"].items(), key=lambda x: -x[1])], col_widths=[90 * mm, 40 * mm])]
    s += [P("Dettaglio" if it else "Details", "h2"), table([head] + data, col_widths=[20 * mm, 50 * mm, 22 * mm, 20 * mm, 18 * mm, 18 * mm, 30 * mm]) if data else P("Nessuna spesa registrata." if it else "No expenses recorded.")]
    s += [Spacer(1, 8), P(("La detrazione è una stima indicativa: valgono le regole dell'Agenzia delle Entrate e del tuo CAF/commercialista. Conserva scontrini parlanti e ricevute." if it else "The credit is an indicative estimate: Agenzia delle Entrate rules and your tax advisor prevail. Keep itemised receipts."), "note")]
    return _pdf_response(build_pdf(title, p['name'], s), f"Accanto-Spese-{year}-{_safe_name(p['name'])}.pdf")


# ---------------------------------------------------------------------------
# Emergency dossier
# ---------------------------------------------------------------------------
async def _latest_vitals(user_id: str, pid: str) -> list:
    out = []
    for t, meta in VITAL_TYPES.items():
        v = await db.vitals.find_one({"user_id": user_id, "profile_id": pid, "type": t}, sort=[("measured_at", -1)])
        if v:
            out.append((meta["it"], f"{_vital_value(v)} {meta['unit']} ({_fmt_dt(v.get('measured_at'))})"))
    return out


@router.get("/profiles/{pid}/dossier/pdf")
async def dossier_pdf(pid: str, lang: str = "it", user: dict = Depends(get_current_user)):
    await require_feature(user, "dossier")
    p = await _profile(pid, user)
    uid = str(user["_id"])
    it = lang != "en"
    meds = await db.medications.find({"user_id": uid, "profile_id": pid, "active": {"$ne": False}}).sort("created_at", 1).to_list(100)
    docs = await db.documents.find({"user_id": uid, "profile_id": pid, "is_deleted": {"$ne": True}}).sort("created_at", -1).to_list(8)
    reminders = await db.reminders.find({"user_id": uid, "profile_id": pid, "done": False}).sort("due_date", 1).to_list(6)
    age = _age(p.get("birth_date"))
    title = f"{'Dossier di emergenza' if it else 'Emergency dossier'} — {p['name']}"
    s = [P(title, "h1"), P(f"{'Aggiornato il' if it else 'Updated'} {datetime.now().strftime('%d/%m/%Y')} · {'Da consegnare a medici e soccorritori' if it else 'To hand to doctors and first responders'}", "small"), Spacer(1, 6)]
    s += [P("Dati della persona" if it else "Personal data", "h2"), kv_table([
        ("Nome" if it else "Name", f"{p['name']}" + (f" ({p.get('relation')})" if p.get("relation") else "")),
        ("Data di nascita" if it else "Date of birth", f"{_fmt_date(p.get('birth_date'))}" + (f" · {age} {'anni' if it else 'years'}" if age else "")),
        ("Codice fiscale" if it else "Fiscal code", p.get("fiscal_code")),
        ("Gruppo sanguigno" if it else "Blood type", p.get("blood_type")),
        ("Peso / Altezza" if it else "Weight / Height", " / ".join(x for x in [f"{p['weight_kg']:g} kg" if p.get("weight_kg") else "", f"{p['height_cm']:g} cm" if p.get("height_cm") else ""] if x)),
        ("Indirizzo" if it else "Address", p.get("address")),
        ("Esenzioni" if it else "Exemptions", p.get("exemption_codes")),
    ])]
    s += [P("Allergie e condizioni" if it else "Allergies and conditions", "h2"), kv_table([
        ("ALLERGIE" if it else "ALLERGIES", p.get("allergies") or ("Nessuna nota" if it else "None known")),
        ("Condizioni di salute" if it else "Health conditions", p.get("conditions")),
        ("Abitudini / preferenze" if it else "Habits / preferences", p.get("habits")),
    ])]
    contacts = [(f"{c.get('name', '')} ({c.get('relation', '')})", c.get("phone", "")) for c in (p.get("emergency_contacts") or [])]
    s += [P("Contatti" if it else "Contacts", "h2"), kv_table([("Medico curante" if it else "Family doctor", " · ".join(x for x in [p.get("doctor_name"), p.get("doctor_phone")] if x))] + contacts + [("Emergenza" if it else "Emergency", "112")])]
    s += [P("Terapia in corso" if it else "Current therapy", "h2")]
    if meds:
        s.append(table([["Farmaco" if it else "Medicine", "Dose", "Mattina" if it else "Morning", "Pranzo" if it else "Noon", "Sera" if it else "Evening", "Notte" if it else "Night", "Note" if it else "Notes"]] +
                       [[m["name"], m.get("dosage", ""), m.get("morning") or "—", m.get("noon") or "—", m.get("evening") or "—", m.get("night") or "—", " · ".join(x for x in [_food_label(m.get("food", "any"), "it" if it else "en"), m.get("notes", "")] if x)] for m in meds],
                       col_widths=[40 * mm, 24 * mm, 17 * mm, 17 * mm, 17 * mm, 17 * mm, 46 * mm]))
    else:
        s.append(P("Nessun farmaco inserito." if it else "No medicines recorded."))
    lv = await _latest_vitals(uid, pid)
    if lv:
        s += [P("Ultimi parametri" if it else "Latest vitals", "h2"), kv_table(lv)]
    if docs:
        s += [P("Documenti recenti" if it else "Recent documents", "h2"), table([["Data" if it else "Date", "Documento" if it else "Document", "Categoria" if it else "Category"]] + [[_fmt_date(d.get("created_at")), d.get("title", ""), d.get("category", "")] for d in docs], col_widths=[25 * mm, 110 * mm, 43 * mm])]
    if reminders:
        s += [P("Prossimi controlli" if it else "Upcoming checks", "h2"), table([["Quando" if it else "When", "Cosa" if it else "What"]] + [[r.get("due_label") or _fmt_date(r.get("due_date")), r.get("title", "")] for r in reminders], col_widths=[45 * mm, 133 * mm])]
    if p.get("notes"):
        s += [P("Note" if it else "Notes", "h2"), P(p["notes"])]
    s += [Spacer(1, 8), P("Dossier compilato dal familiare sulla base dei documenti disponibili: non sostituisce la cartella clinica." if it else "Compiled by the family member from available documents: it does not replace the medical record.", "note")]
    return _pdf_response(build_pdf(title, p["name"], s), f"Accanto-Dossier-{_safe_name(p['name'])}.pdf")


# ---------------------------------------------------------------------------
# Caregiver kit (multilingual)
# ---------------------------------------------------------------------------
@router.get("/profiles/{pid}/kit")
async def kit_preview(pid: str, lang: str = "en", user: dict = Depends(get_current_user)):
    await require_feature(user, "caregiver_kit")
    await _profile(pid, user)
    lang = lang if lang in KIT_LANGUAGES else "en"
    tr = await _kit_translation(lang)
    return {"lang": lang, "language_name": KIT_LANGUAGES[lang], "labels_it": {k: v[0] for k, v in KIT_LABELS.items()}, "labels": tr["labels"],
            "phrases": [{"it": it, "tr": t} for (it, _), t in zip(KIT_PHRASES, tr["phrases"])]}


@router.get("/profiles/{pid}/kit/pdf")
async def kit_pdf(pid: str, lang: str = "en", user: dict = Depends(get_current_user)):
    await require_feature(user, "caregiver_kit")
    p = await _profile(pid, user)
    lang = lang if lang in KIT_LANGUAGES else "en"
    tr = await _kit_translation(lang)
    l1 = {k: v[0] for k, v in KIT_LABELS.items()}
    l2 = tr["labels"]
    meds = await db.medications.find({"user_id": str(user["_id"]), "profile_id": pid, "active": {"$ne": False}}).sort("created_at", 1).to_list(100)
    title = f"{l1['title']} / {l2['title']} — {p['name']}"
    s = [P(title, "h1"), P(f"Italiano / {KIT_LANGUAGES[lang]} · {datetime.now().strftime('%d/%m/%Y')}", "small"), Spacer(1, 6)]
    s += [P(f"{l1['emergency']} / {l2['emergency']}", "h2"), P(f"<b>IT:</b> {KIT_LABELS['emergency_text'][0]}<br/><b>{lang.upper()}:</b> {l2['emergency_text']}", "note"), Spacer(1, 4)]
    info = [(f"{l1['allergies']} / {l2['allergies']}", p.get("allergies") or "-"), (f"{l1['conditions']} / {l2['conditions']}", p.get("conditions") or "-"),
            (f"{l1['doctor']} / {l2['doctor']}", " · ".join(x for x in [p.get("doctor_name"), p.get("doctor_phone")] if x) or "-")]
    for c in (p.get("emergency_contacts") or [])[:4]:
        info.append((f"{l1['contacts']} / {l2['contacts']}", f"{c.get('name', '')} ({c.get('relation', '')}) {c.get('phone', '')}"))
    if p.get("habits"):
        info.append((f"{l1['habits']} / {l2['habits']}", p["habits"]))
    s += [kv_table(info, col_widths=(62 * mm, 116 * mm))]
    s += [P(f"{l1['routine']} / {l2['routine']}", "h2")]
    s.append(table(_med_rows(meds, l1, l2, lang), col_widths=[42 * mm, 24 * mm, 18 * mm, 18 * mm, 18 * mm, 18 * mm, 40 * mm]) if meds else P("Nessun farmaco inserito. / —"))
    s += [P(f"{l1['phrases']} / {l2['phrases']}", "h2"), table([["Italiano", KIT_LANGUAGES[lang]]] + [[it, t] for (it, _), t in zip(KIT_PHRASES, tr["phrases"])], col_widths=[89 * mm, 89 * mm])]
    return _pdf_response(build_pdf(f"Kit badante — {p['name']}", f"Italiano / {KIT_LANGUAGES[lang]}", s), f"Accanto-Kit-{lang}-{_safe_name(p['name'])}.pdf")


# ---------------------------------------------------------------------------
# AI history compare
# ---------------------------------------------------------------------------
@router.post("/profiles/{pid}/compare")
async def compare_documents(pid: str, payload: CompareInput, user: dict = Depends(get_current_user)):
    await require_feature(user, "history_compare")
    await require_ai(user)
    await _profile(pid, user)
    if len(payload.document_ids) != 2 or payload.document_ids[0] == payload.document_ids[1]:
        raise HTTPException(status_code=400, detail="Scegli due documenti diversi da confrontare.")
    docs = []
    for did in payload.document_ids:
        d = await db.documents.find_one({"_id": _oid(did), "user_id": str(user["_id"]), "profile_id": pid, "is_deleted": {"$ne": True}})
        if not d:
            raise HTTPException(status_code=404, detail="Documento non trovato")
        docs.append(d)
    docs.sort(key=lambda d: d.get("created_at", ""))
    lang_name = "italiano" if payload.lang == "it" else "English"

    def block(d, label):
        return (f"{label} (data: {_fmt_date(d.get('created_at'))}, categoria: {d.get('category')})\nTITOLO: {d.get('title')}\nSINTESI: {d.get('summary')}\n"
                f"TERMINI: {json.dumps(d.get('key_terms', []), ensure_ascii=False)}\nSCADENZE: {json.dumps(d.get('deadlines', []), ensure_ascii=False)}\n")

    prompt = (
        "Confronta questi due documenti sanitari della stessa persona.\n\n" + block(docs[0], "DOCUMENTO PRECEDENTE") + "\n" + block(docs[1], "DOCUMENTO PIU' RECENTE") +
        f"\nRispondi in {lang_name}, in parole molto semplici, con questa struttura:\n"
        "1) Cosa è rimasto uguale\n2) Cosa è cambiato (solo dati realmente presenti nei due testi, citando i valori se ci sono)\n3) Domande utili da fare al medico\n"
        "NON valutare la gravità, NON dire se è 'meglio' o 'peggio' in senso clinico, NON consigliare cure. Usa elenchi puntati brevi con il trattino (-). Scrivi in testo semplice SENZA markdown: niente asterischi, niente grassetto, niente titoli con #. "
        "Chiudi ricordando che il confronto va fatto con il medico curante."
    )
    text = await ai_text(SYSTEM_PROMPT, prompt)
    await record_ai_usage(user)
    return {"answer": text, "documents": [{"id": str(d["_id"]), "title": d.get("title"), "created_at": d.get("created_at")} for d in docs]}


# ---------------------------------------------------------------------------
# Care hub overview
# ---------------------------------------------------------------------------
@router.get("/care/overview")
async def care_overview(profile_id: str = Query(...), user: dict = Depends(get_current_user)):
    p = await _profile(profile_id, user)
    uid = str(user["_id"])
    year = datetime.now().year
    meds = await db.medications.count_documents({"user_id": uid, "profile_id": profile_id, "active": {"$ne": False}})
    vitals = await db.vitals.count_documents({"user_id": uid, "profile_id": profile_id})
    last_vital = await db.vitals.find_one({"user_id": uid, "profile_id": profile_id}, sort=[("measured_at", -1)])
    exp_rows = await db.expenses.find({"user_id": uid, "profile_id": profile_id, "date": {"$regex": f"^{year}-"}}, {"amount": 1}).to_list(5000)
    docs = await db.documents.count_documents({"user_id": uid, "profile_id": profile_id, "is_deleted": {"$ne": True}})
    filled = sum(1 for k in ("birth_date", "fiscal_code", "blood_type", "allergies", "conditions", "doctor_name") if p.get(k))
    return {
        "medications": meds, "vitals": vitals,
        "last_vital": {"type": last_vital["type"], "label": _vital_label(last_vital["type"], "it"), "value": _vital_value(last_vital), "unit": VITAL_TYPES[last_vital["type"]]["unit"], "measured_at": last_vital.get("measured_at")} if last_vital else None,
        "expenses_year": year, "expenses_total": round(sum(float(r["amount"]) for r in exp_rows), 2), "expenses_count": len(exp_rows),
        "documents": docs, "clinical_completeness": round(filled / 6 * 100), "emergency_contacts": len(p.get("emergency_contacts") or []),
    }
