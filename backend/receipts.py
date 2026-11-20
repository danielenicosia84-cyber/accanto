import io
import asyncio
import logging
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from core import db, now_iso
from storage import put_object, APP_NAME
from plans import PLANS

logger = logging.getLogger("dopo.receipts")
GREEN = colors.HexColor("#235D43")
GREY = colors.HexColor("#64748B")

DEFAULT_ISSUER = {
    "name": "Accanto", "address": "", "fiscal_code": "", "vat": "", "email": "",
    "footer_it": "Operazione non soggetta a fattura ai sensi dell'art. 22 DPR 633/72. Documento emesso automaticamente; prezzo finito comprensivo di ogni onere.",
    "footer_en": "Receipt for a digital service; final price all inclusive. This document was generated automatically.",
}


async def next_receipt_number() -> str:
    year = datetime.now(timezone.utc).year
    doc = await db.receipt_counters.find_one_and_update({"_id": year}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
    return f"ACC-{year}-{doc['seq']:04d}"


def _pair(c, x, y, label_it, label_en, value, bold=False):
    c.setFont("Helvetica", 8.5)
    c.setFillColor(GREY)
    c.drawString(x, y + 11, f"{label_it} / {label_en}")
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold" if bold else "Helvetica", 11.5)
    c.drawString(x, y, value or "-")


def render_receipt_pdf(payment: dict, customer: dict, issuer: dict) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    m = 20 * mm

    c.setFillColor(GREEN)
    c.rect(0, h - 34 * mm, w, 34 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(m, h - 16 * mm, "Accanto")
    c.setFont("Helvetica", 10)
    c.drawString(m, h - 23 * mm, "I referti, in parole semplici")
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(w - m, h - 15 * mm, "RICEVUTA DI PAGAMENTO")
    c.setFont("Helvetica", 10)
    c.drawRightString(w - m, h - 21 * mm, "PAYMENT RECEIPT")
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(w - m, h - 28 * mm, payment["receipt_number"])

    y = h - 52 * mm
    c.setFillColor(colors.black)
    plan = PLANS.get(payment["plan"], {})
    interval_lbl = {"monthly": "Mensile / Monthly", "yearly": "Annuale / Yearly", "lifetime": "Una tantum / One-time"}.get(payment.get("interval"), "")
    paid_at = payment.get("created_at", now_iso())[:10]
    _pair(c, m, y, "Data", "Date", datetime.fromisoformat(paid_at).strftime("%d/%m/%Y"))
    _pair(c, m + 70 * mm, y, "ID Transazione", "Transaction ID", str(payment.get("external_id") or payment.get("_id")))
    y -= 16 * mm
    _pair(c, m, y, "Metodo", "Method", {"paypal": "PayPal", "card": "Carta / Card", "manual": "Bonifico / Transfer", "code": "Codice sblocco / Unlock code", "admin": "Attivazione manuale / Manual", "simulated": "Simulazione (test) / Simulated"}.get(payment.get("provider"), payment.get("provider", "")))
    _pair(c, m + 70 * mm, y, "Stato", "Status", "PAGATO / PAID")

    y -= 22 * mm
    c.setStrokeColor(GREEN)
    c.setLineWidth(1)
    c.line(m, y + 8 * mm, w - m, y + 8 * mm)
    c.setFont("Helvetica-Bold", 10.5)
    c.setFillColor(GREEN)
    c.drawString(m, y, "INTESTATARIO / BILLED TO")
    c.drawString(w / 2, y, "EMITTENTE / ISSUER")
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10.5)
    lines_c = [f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip() or customer.get("name", ""),
               f"CF: {customer.get('fiscal_code', '')}" if customer.get("fiscal_code") else "",
               customer.get("address", ""), f"{customer.get('zip', '')} {customer.get('city', '')}".strip(), customer.get("email", "")]
    lines_i = [issuer.get("name", ""), issuer.get("address", ""),
               f"CF/P.IVA: {issuer.get('vat') or issuer.get('fiscal_code', '')}" if (issuer.get("vat") or issuer.get("fiscal_code")) else "", issuer.get("email", "")]
    yy = y - 6 * mm
    for ln in [x for x in lines_c if x]:
        c.drawString(m, yy, ln); yy -= 5.5 * mm
    yy = y - 6 * mm
    for ln in [x for x in lines_i if x]:
        c.drawString(w / 2, yy, ln); yy -= 5.5 * mm

    y -= 48 * mm
    c.setFillColor(colors.HexColor("#E8F5E9"))
    c.rect(m, y - 4 * mm, w - 2 * m, 12 * mm, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(m + 4 * mm, y, "DESCRIZIONE / DESCRIPTION")
    c.drawRightString(w - m - 4 * mm, y, "IMPORTO / AMOUNT")
    y -= 12 * mm
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 11)
    c.drawString(m + 4 * mm, y, f"{plan.get('name', payment['plan'])} - {interval_lbl}")
    c.drawRightString(w - m - 4 * mm, y, f"{payment['amount']:.2f} {payment.get('currency', 'EUR').upper()}")
    y -= 8 * mm
    c.setFont("Helvetica", 9)
    c.setFillColor(GREY)
    period = payment.get("period_label")
    if period:
        c.drawString(m + 4 * mm, y, f"Periodo / Period: {period}")
        if payment.get("interval") in ("monthly", "yearly"):
            y -= 4.5 * mm
            c.drawString(m + 4 * mm, y, "Rinnovo automatico disattivabile dal profilo / Auto-renewal can be cancelled from profile")
    y -= 14 * mm
    c.setStrokeColor(GREEN)
    c.line(m, y + 6 * mm, w - m, y + 6 * mm)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(m + 4 * mm, y - 4 * mm, "TOTALE PAGATO / TOTAL PAID")
    c.drawRightString(w - m - 4 * mm, y - 4 * mm, f"{payment['amount']:.2f} EUR")
    c.setFont("Helvetica", 8.5)
    c.setFillColor(GREY)
    c.drawString(m + 4 * mm, y - 10 * mm, "Prezzo finito tutto incluso / Final all-inclusive price")

    c.setFont("Helvetica", 8)
    c.setFillColor(GREY)
    footer_it = issuer.get("footer_it") or DEFAULT_ISSUER["footer_it"]
    footer_en = issuer.get("footer_en") or DEFAULT_ISSUER["footer_en"]
    fy = 30 * mm
    fy -= 2 * mm
    support_email = issuer.get("email") or DEFAULT_ISSUER.get("email") or ""
    if support_email:
        c.drawString(m, fy, f"Assistenza abbonamenti e ricevute / Support: {support_email}")
        fy -= 4 * mm
    c.drawString(m, 12 * mm, f"Accanto - Ricevuta {payment['receipt_number']} - generata il {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')} UTC")
    c.showPage()
    c.save()
    return buf.getvalue()


def _wrap(text: str, width: int):
    words, line, out = text.split(), "", []
    for wd in words:
        if len(line) + len(wd) + 1 > width:
            out.append(line); line = wd
        else:
            line = f"{line} {wd}".strip()
    if line:
        out.append(line)
    return out


async def record_payment(user: dict, *, provider: str, plan: str, interval: str, amount: float, external_id: str = "", period_label: str = "") -> dict:
    """Creates the payment record + numbered PDF receipt. Idempotent on (provider, external_id)."""
    if external_id:
        existing = await db.payments.find_one({"provider": provider, "external_id": external_id})
        if existing:
            return existing
    settings = await db.settings.find_one({"_id": "app"}) or {}
    issuer = {**DEFAULT_ISSUER, **(settings.get("issuer") or {})}
    customer = {**(user.get("billing_details") or {}), "email": user["email"], "name": user.get("name", "")}
    payment = {
        "user_id": str(user["_id"]), "provider": provider, "external_id": external_id,
        "plan": plan, "interval": interval, "amount": float(amount), "currency": "eur",
        "status": "paid", "receipt_number": await next_receipt_number(), "period_label": period_label,
        "customer": customer, "created_at": now_iso(),
    }
    try:
        path = f"{APP_NAME}/receipts/{user['_id']}/{payment['receipt_number']}.pdf"
        pdf = await asyncio.to_thread(render_receipt_pdf, payment, customer, issuer)
        await asyncio.to_thread(put_object, path, pdf, "application/pdf")
        payment["pdf_path"] = path
    except Exception as e:
        logger.error(f"Receipt PDF failed: {e}")
    res = await db.payments.insert_one(payment)
    payment["_id"] = res.inserted_id
    return payment
