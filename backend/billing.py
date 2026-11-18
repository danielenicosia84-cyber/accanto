import math
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import Response
from pydantic import BaseModel

from core import db, get_current_user, is_demo, is_owner, require_not_demo, now_iso
from plans import PLANS, INTERVALS, UNLIMITED, LOCKED, TRIAL_LIMITS, TRIAL_DAYS, ALL_FEATURES, plan_price
import paypal_client as pp
from receipts import record_payment
from storage import get_object

logger = logging.getLogger("dopo.billing")
router = APIRouter(prefix="/api")

ACTIVE_STATUSES = {"active", "cancelled", "past_due"}


def _parse(dt: Optional[str]) -> Optional[datetime]:
    if not dt:
        return None
    try:
        d = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def month_key(now: datetime) -> str:
    return now.strftime("%Y-%m")


async def ensure_trial(user: dict) -> datetime:
    ends = _parse(user.get("trial_ends_at"))
    if ends:
        return ends
    ends = datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"trial_ends_at": ends.isoformat()}})
    return ends


def subscription_is_active(sub: dict, now: datetime) -> bool:
    if not sub or sub.get("plan") not in PLANS or sub.get("status") not in ACTIVE_STATUSES:
        return False
    if sub.get("plan") == "lifetime" or sub.get("interval") == "lifetime":
        return True
    period_end = _parse(sub.get("current_period_end"))
    if not period_end:
        return True
    grace = timedelta(days=5) if sub.get("status") == "past_due" else timedelta(days=1)
    return now < period_end + grace


async def _resolve_plan(user: dict, now: datetime) -> tuple[str, str, dict, int]:
    """Returns (plan, status, limits, trial_days_left)."""
    if is_owner(user):
        return "owner", "owner", UNLIMITED, 0
    if is_demo(user):
        return "demo", "demo", LOCKED, 0
    sub = user.get("subscription") or {}
    if subscription_is_active(sub, now):
        return sub["plan"], "active", PLANS[sub["plan"]]["limits"], 0
    trial_ends = await ensure_trial(user)
    if now < trial_ends:
        return "trial", "trial", TRIAL_LIMITS, max(1, math.ceil((trial_ends - now).total_seconds() / 86400))
    return "expired", "expired", LOCKED, 0


async def _usage(uid: str, now: datetime, status: str) -> dict:
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    doc_query = {"user_id": uid, "is_deleted": {"$ne": True}}
    if status != "trial":
        doc_query["created_at"] = {"$gte": month_start}
    ai_doc = await db.ai_usage.find_one({"user_id": uid, "month": month_key(now)})
    return {
        "profiles": await db.profiles.count_documents({"user_id": uid, "is_deleted": {"$ne": True}}),
        "docs": await db.documents.count_documents(doc_query),
        "ai": (ai_doc or {}).get("count", 0),
    }


def _within(limit: Optional[int], used: int) -> bool:
    return limit is None or used < limit


def features_for(plan: str, status: str) -> list:
    if status in ("owner", "trial", "demo"):
        return ALL_FEATURES
    if status == "active":
        return PLANS[plan]["features"]
    return []


async def get_entitlements(user: dict) -> dict:
    now = datetime.now(timezone.utc)
    plan, status, limits, trial_days_left = await _resolve_plan(user, now)
    usage = await _usage(str(user["_id"]), now, status)
    sub = user.get("subscription") or {}
    active = status == "active"
    usable = status in ("trial", "active", "owner")
    return {
        "plan": plan,
        "plan_name": {"owner": "Master Admin - Illimitato", "trial": "Prova gratuita"}.get(plan) or PLANS.get(plan, {}).get("name"),
        "status": status,
        "is_demo": status == "demo",
        "is_owner": status == "owner",
        "trial_days_left": trial_days_left,
        "trial_ends_at": user.get("trial_ends_at"),
        "limits": limits,
        "usage": usage,
        "features": features_for(plan, status),
        "can_upload": usable and _within(limits["docs"], usage["docs"]),
        "can_ai": usable and _within(limits["ai"], usage["ai"]),
        "can_add_profile": usable and _within(limits["profiles"], usage["profiles"]),
        "interval": sub.get("interval") if active else None,
        "provider": sub.get("provider") if active else None,
        "current_period_end": sub.get("current_period_end") if active else None,
        "cancel_at_period_end": sub.get("status") == "cancelled" if active else False,
        "paypal_subscription_id": sub.get("paypal_subscription_id") if active else None,
        "billing_details": user.get("billing_details") or {},
    }


def paywall(status: str, what: str):
    if status == "expired":
        return HTTPException(status_code=402, detail=f"La prova gratuita di {TRIAL_DAYS} giorni e' terminata. Scegli un piano per continuare a caricare documenti e usare l'assistente.")
    if status == "trial":
        return HTTPException(status_code=402, detail=f"Hai usato i {what} inclusi nella prova gratuita. Scegli un piano per continuare senza limiti.")
    return HTTPException(status_code=402, detail=f"Hai raggiunto il limite mensile di {what} del tuo piano. Passa a un piano superiore per continuare.")


async def require_upload(user: dict):
    require_not_demo(user)
    ent = await get_entitlements(user)
    if not ent["can_upload"]:
        raise paywall(ent["status"], "documenti")


async def require_ai(user: dict):
    require_not_demo(user)
    ent = await get_entitlements(user)
    if not ent["can_ai"]:
        raise paywall(ent["status"], "spiegazioni AI")


async def require_profile_slot(user: dict):
    require_not_demo(user)
    ent = await get_entitlements(user)
    if not ent["can_add_profile"]:
        if ent["status"] == "expired":
            raise paywall("expired", "")
        raise HTTPException(status_code=402, detail="Il tuo piano include un numero limitato di familiari assistiti. Passa a un piano superiore per aggiungerne altri.")


async def require_feature(user: dict, feature: str):
    ent = await get_entitlements(user)
    if feature not in ent["features"]:
        raise HTTPException(status_code=402, detail="Questa funzione e' inclusa nei piani Famiglia & Caregiver, Completo e Lifetime.")


async def record_ai_usage(user: dict):
    await db.ai_usage.update_one(
        {"user_id": str(user["_id"]), "month": month_key(datetime.now(timezone.utc))},
        {"$inc": {"count": 1}, "$set": {"updated_at": now_iso()}},
        upsert=True,
    )


# ---------------------------------------------------------------------------
# Activation core (used by PayPal, codes, admin, manual)
# ---------------------------------------------------------------------------
def period_end_for(interval: str, start: Optional[datetime] = None) -> Optional[str]:
    start = start or datetime.now(timezone.utc)
    if interval == "lifetime":
        return None
    return (start + timedelta(days=366 if interval == "yearly" else 31)).isoformat()


async def activate_plan(user: dict, plan: str, interval: str, provider: str, *, external_id: str = "",
                        period_end: Optional[str] = None, with_receipt: bool = True, amount: Optional[float] = None) -> dict:
    if plan not in PLANS:
        raise HTTPException(status_code=400, detail="Piano non valido")
    if plan == "lifetime":
        interval = "lifetime"
    sub = {
        "plan": plan, "interval": interval, "provider": provider, "status": "active",
        "current_period_end": None if interval == "lifetime" else (period_end or period_end_for(interval)),
        "paypal_subscription_id": external_id if provider == "paypal" and interval != "lifetime" else None,
        "paypal_order_id": external_id if provider == "paypal" and interval == "lifetime" else None,
        "activated_at": now_iso(), "updated_at": now_iso(),
    }
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"subscription": sub}})
    payment = None
    if with_receipt:
        amt = plan_price(plan, interval) if amount is None else amount
        label = _period_label(interval, sub["current_period_end"])
        payment = await record_payment(user, provider=provider, plan=plan, interval=interval, amount=amt, external_id=external_id, period_label=label)
    return {"subscription": sub, "payment": _payment_out(payment) if payment else None}


def _period_label(interval: str, period_end: Optional[str]) -> str:
    if interval == "lifetime":
        return "Licenza a vita / Lifetime license"
    start = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    end = datetime.fromisoformat(period_end).strftime("%d/%m/%Y") if period_end else ""
    return f"{start} - {end}"


def _payment_out(p: dict) -> dict:
    return {
        "id": str(p["_id"]), "receipt_number": p.get("receipt_number"), "plan": p.get("plan"), "plan_name": PLANS.get(p.get("plan"), {}).get("name"),
        "interval": p.get("interval"), "amount": p.get("amount"), "currency": p.get("currency", "eur"), "provider": p.get("provider"),
        "status": p.get("status"), "created_at": p.get("created_at"), "has_pdf": bool(p.get("pdf_path")), "period_label": p.get("period_label"),
    }


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class BillingDetails(BaseModel):
    first_name: str
    last_name: str
    fiscal_code: str = ""
    address: str = ""
    city: str = ""
    zip: str = ""


class SubscriptionActivate(BaseModel):
    subscription_id: str
    plan: str
    interval: str


class OrderCreate(BaseModel):
    plan: str = "lifetime"


class OrderCapture(BaseModel):
    order_id: str


class RedeemInput(BaseModel):
    code: str


class ManualRequest(BaseModel):
    plan: str
    interval: str
    method: str = "bonifico"


# ---------------------------------------------------------------------------
# Public / user routes
# ---------------------------------------------------------------------------
@router.get("/billing/plans")
async def list_plans():
    cfg = await pp.paypal_config()
    out = []
    for key, p in sorted(PLANS.items(), key=lambda kv: kv[1]["order"]):
        out.append({
            "id": key, "name": p["name"], "short": p["short"], "recommended": p.get("recommended", False), "lifetime": p.get("lifetime", False),
            "monthly": p.get("monthly"), "yearly": p.get("yearly"), "once": p.get("once"), "list_price": p.get("list_price"),
            "currency": "eur", "limits": p["limits"], "features": p["features"],
            "paypal_plan_ids": {i: cfg["plan_ids"].get(f"{key}_{i}") for i in INTERVALS} if not p.get("lifetime") else {},
        })
    return {"plans": out, "trial_days": TRIAL_DAYS, "trial_docs": TRIAL_LIMITS["docs"]}


@router.get("/billing/config")
async def billing_config():
    cfg = await pp.paypal_config()
    s = await pp.get_settings()
    return {
        "paypal_client_id": cfg["client_id"], "paypal_mode": cfg["mode"], "paypal_ready": bool(cfg["client_id"] and cfg["plan_ids"]),
        "manual": {"enabled": bool(s.get("manual_enabled", True)), "revolut_link": s.get("revolut_link", ""), "iban": s.get("iban", ""), "bank_holder": s.get("bank_holder", ""), "instructions": s.get("manual_instructions", "")},
    }


@router.get("/billing/me")
async def billing_me(user: dict = Depends(get_current_user)):
    return await get_entitlements(user)


@router.put("/billing/details")
async def save_details(payload: BillingDetails, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    details = payload.model_dump()
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"billing_details": details}})
    return details


def _require_details(user: dict):
    d = user.get("billing_details") or {}
    if not d.get("first_name") or not d.get("last_name"):
        raise HTTPException(status_code=400, detail="Inserisci prima i dati di intestazione (nome e cognome).")


@router.post("/billing/paypal/subscription/activate")
async def paypal_activate_subscription(payload: SubscriptionActivate, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    _require_details(user)
    if payload.plan not in PLANS or PLANS[payload.plan].get("lifetime") or payload.interval not in INTERVALS:
        raise HTTPException(status_code=400, detail="Piano non valido")
    try:
        sub = await pp.get_subscription(payload.subscription_id)
    except pp.PayPalError as e:
        raise HTTPException(status_code=424, detail=str(e))
    cfg = await pp.paypal_config()
    expected = cfg["plan_ids"].get(f"{payload.plan}_{payload.interval}")
    if sub.get("plan_id") != expected:
        raise HTTPException(status_code=400, detail="Il piano PayPal non corrisponde a quello scelto.")
    if sub.get("status") not in ("ACTIVE", "APPROVED"):
        raise HTTPException(status_code=400, detail=f"Abbonamento PayPal non attivo (stato {sub.get('status')}).")
    other = await db.users.find_one({"subscription.paypal_subscription_id": sub["id"], "_id": {"$ne": user["_id"]}})
    if other:
        raise HTTPException(status_code=409, detail="Questo abbonamento PayPal e' gia' collegato a un altro account.")
    next_time = (sub.get("billing_info") or {}).get("next_billing_time")
    period_end = _parse(next_time).isoformat() if _parse(next_time) else None
    paid = bool((sub.get("billing_info") or {}).get("last_payment"))
    return await activate_plan(user, payload.plan, payload.interval, "paypal", external_id=sub["id"], period_end=period_end, with_receipt=paid)


@router.post("/billing/paypal/order/create")
async def paypal_create_order(payload: OrderCreate, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    _require_details(user)
    if payload.plan != "lifetime":
        raise HTTPException(status_code=400, detail="Solo la licenza Lifetime si paga una tantum.")
    try:
        order = await pp.create_order(PLANS["lifetime"]["once"], PLANS["lifetime"]["name"], str(user["_id"]))
    except pp.PayPalError as e:
        raise HTTPException(status_code=424, detail=str(e))
    await db.payment_intents.insert_one({"order_id": order["id"], "user_id": str(user["_id"]), "plan": "lifetime", "status": "created", "created_at": now_iso()})
    return {"order_id": order["id"]}


@router.post("/billing/paypal/order/capture")
async def paypal_capture_order(payload: OrderCapture, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    intent = await db.payment_intents.find_one({"order_id": payload.order_id, "user_id": str(user["_id"])})
    if not intent:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    try:
        order = await pp.get_order(payload.order_id)
        if order.get("status") == "APPROVED":
            order = await pp.capture_order(payload.order_id)
    except pp.PayPalError as e:
        raise HTTPException(status_code=424, detail=str(e))
    if order.get("status") != "COMPLETED":
        raise HTTPException(status_code=400, detail=f"Pagamento non completato (stato {order.get('status')}).")
    captures = (((order.get("purchase_units") or [{}])[0].get("payments") or {}).get("captures") or [{}])
    cap = captures[0]
    amount = float((cap.get("amount") or {}).get("value") or 0)
    if cap.get("status") != "COMPLETED" or abs(amount - float(PLANS["lifetime"]["once"])) > 0.01:
        raise HTTPException(status_code=400, detail="Importo o stato del pagamento non validi.")
    await db.payment_intents.update_one({"order_id": payload.order_id}, {"$set": {"status": "completed"}})
    return await activate_plan(user, "lifetime", "lifetime", "paypal", external_id=order["id"], amount=amount)


@router.post("/billing/cancel")
async def cancel_subscription(user: dict = Depends(get_current_user)):
    require_not_demo(user)
    sub = user.get("subscription") or {}
    if sub.get("status") != "active" or sub.get("interval") == "lifetime":
        raise HTTPException(status_code=400, detail="Nessun abbonamento ricorrente da disdire.")
    if sub.get("provider") == "paypal" and str(sub.get("paypal_subscription_id") or "").startswith("I-"):
        try:
            await pp.cancel_subscription(sub["paypal_subscription_id"])
        except pp.PayPalError as e:
            raise HTTPException(status_code=424, detail=str(e))
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"subscription.status": "cancelled", "subscription.updated_at": now_iso()}})
    return {"ok": True, "access_until": sub.get("current_period_end")}


@router.post("/billing/redeem")
async def redeem_code(payload: RedeemInput, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    if is_owner(user):
        raise HTTPException(status_code=400, detail="L'account amministratore ha gia' accesso illimitato.")
    code = payload.code.strip().upper()
    c = await db.unlock_codes.find_one({"code": code})
    if not c:
        raise HTTPException(status_code=404, detail="Codice non valido.")
    if c.get("expires_at") and _parse(c["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Codice scaduto.")
    if c.get("max_uses") and c.get("used_count", 0) >= c["max_uses"]:
        raise HTTPException(status_code=400, detail="Codice gia' utilizzato.")
    if str(user["_id"]) in (c.get("used_by") or []):
        raise HTTPException(status_code=400, detail="Hai gia' usato questo codice.")
    months = c.get("months") or 0
    interval = c.get("interval", "monthly")
    period_end = None if interval == "lifetime" else (datetime.now(timezone.utc) + timedelta(days=31 * months if months else (366 if interval == "yearly" else 31))).isoformat()
    res = await activate_plan(user, c["plan"], interval, "code", external_id=f"{code}:{user['_id']}", period_end=period_end, amount=0.0, with_receipt=False)
    await db.unlock_codes.update_one({"_id": c["_id"]}, {"$inc": {"used_count": 1}, "$push": {"used_by": str(user["_id"])}, "$set": {"last_used_at": now_iso()}})
    return res


@router.post("/billing/manual-request")
async def manual_request(payload: ManualRequest, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    _require_details(user)
    if payload.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Piano non valido")
    interval = "lifetime" if payload.plan == "lifetime" else payload.interval
    if interval not in INTERVALS + ("lifetime",):
        raise HTTPException(status_code=400, detail="Periodicita' non valida")
    ref = f"ACC-{secrets.token_hex(3).upper()}"
    doc = {
        "user_id": str(user["_id"]), "email": user["email"], "name": user.get("name", ""), "plan": payload.plan, "interval": interval,
        "amount": plan_price(payload.plan, interval), "method": payload.method, "reference": ref, "status": "pending", "created_at": now_iso(),
    }
    res = await db.activation_requests.insert_one(doc)
    s = await pp.get_settings()
    return {
        "id": str(res.inserted_id), "reference": ref, "amount": doc["amount"], "plan": payload.plan, "interval": interval,
        "iban": s.get("iban", ""), "bank_holder": s.get("bank_holder", ""), "revolut_link": s.get("revolut_link", ""), "instructions": s.get("manual_instructions", ""),
    }


@router.get("/billing/payments")
async def my_payments(user: dict = Depends(get_current_user)):
    rows = await db.payments.find({"user_id": str(user["_id"])}).sort("created_at", -1).to_list(200)
    pending = await db.activation_requests.find({"user_id": str(user["_id"]), "status": "pending"}).sort("created_at", -1).to_list(10)
    return {"payments": [_payment_out(p) for p in rows], "pending_requests": [{"id": str(r["_id"]), "reference": r["reference"], "plan": r["plan"], "interval": r["interval"], "amount": r["amount"], "created_at": r["created_at"]} for r in pending]}


@router.get("/billing/receipts/{payment_id}.pdf")
async def receipt_pdf(payment_id: str, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(status_code=404, detail="Ricevuta non trovata")
    q = {"_id": ObjectId(payment_id)}
    if not is_owner(user):
        q["user_id"] = str(user["_id"])
    p = await db.payments.find_one(q)
    if not p or not p.get("pdf_path"):
        raise HTTPException(status_code=404, detail="Ricevuta non trovata")
    content, _ = get_object(p["pdf_path"])
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{p["receipt_number"]}.pdf"'})


# ---------------------------------------------------------------------------
# PayPal webhook
# ---------------------------------------------------------------------------
async def _user_by_paypal_sub(sub_id: str) -> Optional[dict]:
    return await db.users.find_one({"subscription.paypal_subscription_id": sub_id})


async def _on_sale_completed(res: dict):
    sub_id = res.get("billing_agreement_id")
    if not sub_id:
        return
    user = await _user_by_paypal_sub(sub_id)
    if not user:
        return
    sub = user["subscription"]
    try:
        remote = await pp.get_subscription(sub_id)
        next_time = _parse((remote.get("billing_info") or {}).get("next_billing_time"))
    except pp.PayPalError:
        next_time = None
    period_end = next_time.isoformat() if next_time else period_end_for(sub["interval"])
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"subscription.status": "active", "subscription.current_period_end": period_end, "subscription.updated_at": now_iso()}})
    amount = float((res.get("amount") or {}).get("total") or plan_price(sub["plan"], sub["interval"]))
    await record_payment(user, provider="paypal", plan=sub["plan"], interval=sub["interval"], amount=amount, external_id=res.get("id", ""), period_label=_period_label(sub["interval"], period_end))


async def _on_sub_status(res: dict, status: str):
    user = await _user_by_paypal_sub(res.get("id", ""))
    if user:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"subscription.status": status, "subscription.updated_at": now_iso()}})


async def _on_sub_activated(res: dict):
    user = await _user_by_paypal_sub(res.get("id", ""))
    if not user:
        return
    next_time = _parse((res.get("billing_info") or {}).get("next_billing_time"))
    upd = {"subscription.status": "active", "subscription.updated_at": now_iso()}
    if next_time:
        upd["subscription.current_period_end"] = next_time.isoformat()
    await db.users.update_one({"_id": user["_id"]}, {"$set": upd})
    last = (res.get("billing_info") or {}).get("last_payment")
    if last:
        sub = user["subscription"]
        await record_payment(user, provider="paypal", plan=sub["plan"], interval=sub["interval"], amount=float((last.get("amount") or {}).get("value") or plan_price(sub["plan"], sub["interval"])),
                             external_id=f"{res['id']}:{last.get('time', '')[:10]}", period_label=_period_label(sub["interval"], upd.get("subscription.current_period_end")))


WEBHOOK_HANDLERS = {
    "PAYMENT.SALE.COMPLETED": _on_sale_completed,
    "BILLING.SUBSCRIPTION.ACTIVATED": _on_sub_activated,
    "BILLING.SUBSCRIPTION.CANCELLED": lambda r: _on_sub_status(r, "cancelled"),
    "BILLING.SUBSCRIPTION.SUSPENDED": lambda r: _on_sub_status(r, "past_due"),
    "BILLING.SUBSCRIPTION.PAYMENT.FAILED": lambda r: _on_sub_status(r, "past_due"),
    "BILLING.SUBSCRIPTION.EXPIRED": lambda r: _on_sub_status(r, "expired"),
}


@router.post("/paypal/webhook")
async def paypal_webhook(request: Request):
    body = await request.json()
    if not await pp.verify_webhook(request.headers, body):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    handler = WEBHOOK_HANDLERS.get(body.get("event_type"))
    if handler:
        await handler(body.get("resource") or {})
    await db.webhook_events.insert_one({"provider": "paypal", "event_id": body.get("id"), "type": body.get("event_type"), "received_at": now_iso()})
    return {"status": "ok"}
