import os
import time
import logging
from typing import Optional

import httpx

from core import db
from plans import PLANS, INTERVALS

logger = logging.getLogger("dopo.paypal")

_token_cache = {"token": None, "exp": 0, "key": None}

WEBHOOK_EVENTS = [
    "BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.SUSPENDED",
    "BILLING.SUBSCRIPTION.EXPIRED", "BILLING.SUBSCRIPTION.PAYMENT.FAILED", "BILLING.SUBSCRIPTION.UPDATED",
    "PAYMENT.SALE.COMPLETED", "PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.REFUNDED",
]


async def get_settings() -> dict:
    s = await db.settings.find_one({"_id": "app"}) or {}
    s.pop("_id", None)
    return s


async def paypal_config() -> dict:
    s = await get_settings()
    mode = s.get("paypal_mode") or os.environ.get("PAYPAL_MODE", "sandbox")
    return {
        "client_id": s.get("paypal_client_id") or os.environ.get("PAYPAL_CLIENT_ID", ""),
        "secret": s.get("paypal_secret") or os.environ.get("PAYPAL_SECRET", ""),
        "mode": mode,
        "base": "https://api-m.paypal.com" if mode == "live" else "https://api-m.sandbox.paypal.com",
        "plan_ids": s.get("paypal_plan_ids") or {},
        "webhook_id": s.get("paypal_webhook_id") or "",
        "product_id": s.get("paypal_product_id") or "",
    }


class PayPalError(Exception):
    pass


async def _token(cfg: dict) -> str:
    key = f"{cfg['mode']}:{cfg['client_id']}"
    if _token_cache["token"] and _token_cache["key"] == key and time.time() < _token_cache["exp"] - 60:
        return _token_cache["token"]
    if not cfg["client_id"] or not cfg["secret"]:
        raise PayPalError("PayPal non configurato: inserisci Client ID e Secret nel Pannello Admin.")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{cfg['base']}/v1/oauth2/token", data={"grant_type": "client_credentials"}, auth=(cfg["client_id"], cfg["secret"]))
    if r.status_code != 200:
        raise PayPalError(f"Autenticazione PayPal fallita ({r.status_code}): controlla Client ID / Secret.")
    data = r.json()
    _token_cache.update({"token": data["access_token"], "exp": time.time() + int(data.get("expires_in", 3000)), "key": key})
    return data["access_token"]


async def api(method: str, path: str, json: Optional[dict] = None, cfg: Optional[dict] = None, ok=(200, 201, 204)) -> dict:
    cfg = cfg or await paypal_config()
    token = await _token(cfg)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json", "Prefer": "return=representation"}
    async with httpx.AsyncClient(timeout=40) as c:
        r = await c.request(method, f"{cfg['base']}{path}", json=json, headers=headers)
    if r.status_code not in ok:
        logger.warning(f"PayPal {method} {path} -> {r.status_code}: {r.text[:500]}")
        raise PayPalError(f"Errore PayPal ({r.status_code}): {r.text[:200]}")
    return r.json() if r.content else {}


# --- Catalog -------------------------------------------------------------
async def ensure_catalog() -> dict:
    """Creates product + billing plans for every recurring plan/interval. Idempotent via stored IDs."""
    cfg = await paypal_config()
    product_id = cfg["product_id"]
    if not product_id:
        prod = await api("POST", "/v1/catalogs/products", {
            "name": "Accanto - abbonamento", "description": "Accanto: i referti, in parole semplici",
            "type": "SERVICE", "category": "SOFTWARE",
        }, cfg)
        product_id = prod["id"]
    plan_ids = dict(cfg["plan_ids"])
    for key, p in PLANS.items():
        if p.get("lifetime"):
            continue
        for interval in INTERVALS:
            k = f"{key}_{interval}"
            if plan_ids.get(k):
                continue
            body = {
                "product_id": product_id,
                "name": f"{p['name']} - {'Annuale' if interval == 'yearly' else 'Mensile'}",
                "status": "ACTIVE",
                "billing_cycles": [{
                    "frequency": {"interval_unit": "YEAR" if interval == "yearly" else "MONTH", "interval_count": 1},
                    "tenure_type": "REGULAR", "sequence": 1, "total_cycles": 0,
                    "pricing_scheme": {"fixed_price": {"value": f"{p[interval]:.2f}", "currency_code": "EUR"}},
                }],
                "payment_preferences": {"auto_bill_outstanding": True, "setup_fee_failure_action": "CONTINUE", "payment_failure_threshold": 2},
            }
            plan = await api("POST", "/v1/billing/plans", body, cfg)
            plan_ids[k] = plan["id"]
    await db.settings.update_one({"_id": "app"}, {"$set": {"paypal_product_id": product_id, "paypal_plan_ids": plan_ids}}, upsert=True)
    return {"product_id": product_id, "plan_ids": plan_ids}


async def register_webhook(public_url: str) -> str:
    cfg = await paypal_config()
    url = f"{public_url.rstrip('/')}/api/paypal/webhook"
    existing = await api("GET", "/v1/notifications/webhooks", cfg=cfg)
    for w in existing.get("webhooks", []):
        if w.get("url") == url:
            await db.settings.update_one({"_id": "app"}, {"$set": {"paypal_webhook_id": w["id"]}}, upsert=True)
            return w["id"]
    w = await api("POST", "/v1/notifications/webhooks", {"url": url, "event_types": [{"name": e} for e in WEBHOOK_EVENTS]}, cfg)
    await db.settings.update_one({"_id": "app"}, {"$set": {"paypal_webhook_id": w["id"]}}, upsert=True)
    return w["id"]


# --- Subscriptions / Orders ------------------------------------------------
async def get_subscription(sub_id: str) -> dict:
    return await api("GET", f"/v1/billing/subscriptions/{sub_id}")


async def cancel_subscription(sub_id: str, reason: str = "Richiesta dell'utente") -> None:
    await api("POST", f"/v1/billing/subscriptions/{sub_id}/cancel", {"reason": reason}, ok=(204, 200))


async def create_order(amount: float, description: str, custom_id: str) -> dict:
    return await api("POST", "/v2/checkout/orders", {
        "intent": "CAPTURE",
        "purchase_units": [{"description": description, "custom_id": custom_id, "amount": {"currency_code": "EUR", "value": f"{amount:.2f}"}}],
        "application_context": {"brand_name": "Accanto", "locale": "it-IT", "shipping_preference": "NO_SHIPPING", "user_action": "PAY_NOW"},
    })


async def capture_order(order_id: str) -> dict:
    return await api("POST", f"/v2/checkout/orders/{order_id}/capture", {})


async def get_order(order_id: str) -> dict:
    return await api("GET", f"/v2/checkout/orders/{order_id}")


async def verify_webhook(headers, body: dict) -> bool:
    cfg = await paypal_config()
    if not cfg["webhook_id"]:
        logger.warning("PayPal webhook received but no webhook_id configured; rejecting")
        return False
    payload = {
        "auth_algo": headers.get("paypal-auth-algo"),
        "cert_url": headers.get("paypal-cert-url"),
        "transmission_id": headers.get("paypal-transmission-id"),
        "transmission_sig": headers.get("paypal-transmission-sig"),
        "transmission_time": headers.get("paypal-transmission-time"),
        "webhook_id": cfg["webhook_id"],
        "webhook_event": body,
    }
    try:
        res = await api("POST", "/v1/notifications/verify-webhook-signature", payload, cfg)
    except PayPalError:
        return False
    return res.get("verification_status") == "SUCCESS"
