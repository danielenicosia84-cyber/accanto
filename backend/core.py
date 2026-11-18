import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import jwt

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@dopo.app")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@accanto.app")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Non autenticato")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Utente non trovato")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessione scaduta")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido")


def is_demo(user: dict) -> bool:
    return user.get("email") == DEMO_EMAIL


def is_owner(user: dict) -> bool:
    return user.get("role") == "owner" or user.get("email") == ADMIN_EMAIL


async def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if not is_owner(user):
        raise HTTPException(status_code=403, detail="Area riservata al proprietario dell'app.")
    return user


def require_not_demo(user: dict):
    if is_demo(user):
        raise HTTPException(status_code=403, detail="Account dimostrativo: puoi solo esplorare l'app. Registrati gratis per salvare documenti e usare l'assistente.")
