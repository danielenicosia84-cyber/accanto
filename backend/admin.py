import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from core import db, require_owner, now_iso, is_owner, is_demo
from plans import PLANS, INTERVALS, plan_price
import paypal_client as pp
from billing import activate_plan, get_entitlements, _payment_out

logger = logging.getLogger("dopo.admin")
router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_owner)])

PUBLIC_SETTINGS = ["paypal_client_id", "paypal_mode", "paypal_plan_ids", "paypal_product_id", "paypal_webhook_id",
                   "revolut_link", "iban", "bank_holder", "manual_enabled", "manual_instructions", "issuer"]


class SettingsInput(BaseModel):
    paypal_client_id: Optional[str] = None
    paypal_secret: Optional[str] = None
    paypal_mode: Optional[str] = None
    revolut_link: Optional[str] = None
    iban: Optional[str] = None
    bank_holder: Optional[str] = None
    manual_enabled: Optional[bool] = None
    manual_instructions: Optional[str] = None
    issuer: Optional[dict] = None


class PlanChange(BaseModel):
    plan: str  # base|famiglia|completo|lifetime|trial|expired
    interval: str = "monthly"
    months: int = 0


class CodeInput(BaseModel):
    plan: str
    interval: str = "monthly"
    months: int = 0
    max_uses: int = 1
    expires_days: int = 0
    note: str = ""
    quantity: int = 1


class SimulateInput(BaseModel):
    user_id: Optional[str] = None
    plan: str = "famiglia"
    interval: str = "monthly"


class OriginInput(BaseModel):
    origin_url: str


class RequestDecision(BaseModel):
    approve: bool


def _oid(value: str) -> ObjectId:
    if not ObjectId.is_valid(value or ""):
        raise HTTPException(status_code=404, detail="Elemento non trovato")
    return ObjectId(value)


def _user_out(u: dict, ent: dict) -> dict:
    return {
        "id": str(u["_id"]), "email": u["email"], "name": u.get("name", ""), "created_at": u.get("created_at"),
        "plan": ent["plan"], "status": ent["status"], "interval": ent["interval"], "provider": ent["provider"],
        "current_period_end": ent["current_period_end"], "trial_days_left": ent["trial_days_left"],
        "is_demo": is_demo(u), "is_owner": is_owner(u), "billing_details": u.get("billing_details") or {},
    }


@router.get("/settings")
async def get_settings():
    s = await pp.get_settings()
    out = {k: s.get(k) for k in PUBLIC_SETTINGS}
    out["manual_enabled"] = bool(s.get("manual_enabled", True))
    cfg = await pp.paypal_config()
    out["paypal_client_id"] = cfg["client_id"]
    out["paypal_mode"] = cfg["mode"]
    out["paypal_secret_set"] = bool(cfg["secret"])
    out["paypal_plan_ids"] = cfg["plan_ids"]
    out["paypal_webhook_id"] = cfg["webhook_id"]
    return out


@router.put("/settings")
async def update_settings(payload: SettingsInput):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "paypal_mode" in data and data["paypal_mode"] not in ("sandbox", "live"):
        raise HTTPException(status_code=400, detail="Modalita' PayPal non valida")
    if data.get("paypal_client_id") is not None or data.get("paypal_mode") is not None or data.get("paypal_secret"):
        current = await pp.paypal_config()
        if data.get("paypal_client_id", current["client_id"]) != current["client_id"] or data.get("paypal_mode", current["mode"]) != current["mode"]:
            data.update({"paypal_plan_ids": {}, "paypal_product_id": "", "paypal_webhook_id": ""})
    await db.settings.update_one({"_id": "app"}, {"$set": {**data, "updated_at": now_iso()}}, upsert=True)
    return await get_settings()


@router.post("/paypal/sync")
async def paypal_sync(payload: OriginInput):
    try:
        cat = await pp.ensure_catalog()
        webhook_id = ""
        try:
            webhook_id = await pp.register_webhook(payload.origin_url)
        except pp.PayPalError as e:
            logger.warning(f"Webhook registration failed: {e}")
    except pp.PayPalError as e:
        raise HTTPException(status_code=424, detail=str(e))
    return {**cat, "webhook_id": webhook_id}


@router.get("/users")
async def list_users(q: str = ""):
    query = {"email": {"$regex": q, "$options": "i"}} if q else {}
    users = await db.users.find(query).sort("created_at", -1).to_list(500)
    return [_user_out(u, await get_entitlements(u)) for u in users]


@router.put("/users/{user_id}/plan")
async def change_user_plan(user_id: str, payload: PlanChange):
    user = await db.users.find_one({"_id": _oid(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if payload.plan == "expired":
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"subscription": {"status": "expired", "updated_at": now_iso()}, "trial_ends_at": datetime.now(timezone.utc).isoformat()}})
    elif payload.plan == "trial":
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"subscription": {}, "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()}})
    elif payload.plan in PLANS:
        interval = "lifetime" if payload.plan == "lifetime" else payload.interval
        period_end = None if interval == "lifetime" else (datetime.now(timezone.utc) + timedelta(days=31 * payload.months if payload.months else (366 if interval == "yearly" else 31))).isoformat()
        await activate_plan(user, payload.plan, interval, "admin", period_end=period_end, with_receipt=False)
    else:
        raise HTTPException(status_code=400, detail="Piano non valido")
    user = await db.users.find_one({"_id": user["_id"]})
    return _user_out(user, await get_entitlements(user))


@router.get("/codes")
async def list_codes():
    rows = await db.unlock_codes.find().sort("created_at", -1).to_list(500)
    return [{**{k: v for k, v in r.items() if k != "_id"}, "id": str(r["_id"])} for r in rows]


@router.post("/codes")
async def create_codes(payload: CodeInput):
    if payload.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Piano non valido")
    interval = "lifetime" if payload.plan == "lifetime" else payload.interval
    if interval not in INTERVALS + ("lifetime",):
        raise HTTPException(status_code=400, detail="Periodicita' non valida")
    created = []
    for _ in range(max(1, min(payload.quantity, 50))):
        code = "ACC-" + "-".join(secrets.token_hex(2).upper() for _ in range(2))
        doc = {
            "code": code, "plan": payload.plan, "interval": interval, "months": payload.months, "max_uses": payload.max_uses,
            "used_count": 0, "used_by": [], "note": payload.note, "created_at": now_iso(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=payload.expires_days)).isoformat() if payload.expires_days else None,
        }
        res = await db.unlock_codes.insert_one(doc)
        created.append({**{k: v for k, v in doc.items() if k != "_id"}, "id": str(res.inserted_id)})
    return created


@router.delete("/codes/{code_id}")
async def delete_code(code_id: str):
    await db.unlock_codes.delete_one({"_id": _oid(code_id)})
    return {"ok": True}


@router.get("/requests")
async def list_requests(status: str = "pending"):
    q = {"status": status} if status != "all" else {}
    rows = await db.activation_requests.find(q).sort("created_at", -1).to_list(300)
    return [{**{k: v for k, v in r.items() if k != "_id"}, "id": str(r["_id"])} for r in rows]


@router.post("/requests/{request_id}")
async def decide_request(request_id: str, payload: RequestDecision):
    r = await db.activation_requests.find_one({"_id": _oid(request_id)})
    if not r:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")
    if r.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Richiesta gia' gestita.")
    if payload.approve:
        user = await db.users.find_one({"_id": _oid(r["user_id"])})
        if not user:
            raise HTTPException(status_code=404, detail="Utente non trovato")
        cur = user.get("subscription") or {}
        if cur.get("status") == "active" and cur.get("interval") == "lifetime":
            raise HTTPException(status_code=409, detail="L'utente ha gia' una licenza Lifetime: rifiuta la richiesta o rimborsa.")
        await activate_plan(user, r["plan"], r["interval"], "manual", external_id=r["reference"], amount=r["amount"])
    await db.activation_requests.update_one({"_id": r["_id"]}, {"$set": {"status": "approved" if payload.approve else "rejected", "decided_at": now_iso()}})
    return {"ok": True}


@router.get("/payments")
async def all_payments():
    rows = await db.payments.find().sort("created_at", -1).to_list(500)
    return [{**_payment_out(p), "email": (p.get("customer") or {}).get("email")} for p in rows]


@router.post("/simulate-payment")
async def simulate_payment(payload: SimulateInput, owner: dict = Depends(require_owner)):
    user = await db.users.find_one({"_id": _oid(payload.user_id)}) if payload.user_id else owner
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if payload.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Piano non valido")
    interval = "lifetime" if payload.plan == "lifetime" else payload.interval
    ext = f"SIM-{secrets.token_hex(4).upper()}"
    res = await activate_plan(user, payload.plan, interval, "simulated", external_id=ext, amount=plan_price(payload.plan, interval))
    if is_owner(user):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"subscription": {}}})
    return res


@router.get("/stats")
async def stats():
    users = await db.users.count_documents({})
    active = await db.users.count_documents({"subscription.status": "active"})
    pending = await db.activation_requests.count_documents({"status": "pending"})
    total = 0.0
    async for p in db.payments.find({"status": "paid"}, {"amount": 1}):
        total += float(p.get("amount") or 0)
    return {"users": users, "active_subscriptions": active, "pending_requests": pending, "revenue": round(total, 2)}
