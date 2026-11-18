import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Response

from core import db, get_current_user, require_not_demo, is_owner, now_iso
from storage import delete_object
from pdfgen import build_pdf, P, table, kv_table, Spacer, mm

logger = logging.getLogger("dopo.legal")
router = APIRouter(prefix="/api")

LEGAL_VERSION = "1.0 (2026-10-01)"
ISSUER_PUBLIC = ("name", "address", "fiscal_code", "vat", "email")


def consent_payload(accept_terms: bool, accept_health: bool, accept_disclaimer: bool) -> dict:
    if not (accept_terms and accept_health and accept_disclaimer):
        raise HTTPException(status_code=400, detail="Per registrarti devi accettare tutti e tre i consensi obbligatori.")
    return {"terms_privacy": True, "health_data_art9": True, "medical_ai_disclaimer": True,
            "accepted_at": datetime.now(timezone.utc).isoformat(), "legal_version": LEGAL_VERSION}


@router.get("/legal/issuer")
async def legal_issuer():
    s = await db.settings.find_one({"_id": "global"}) or {}
    issuer = s.get("issuer") or {}
    return {**{k: issuer.get(k, "") for k in ISSUER_PUBLIC}, "legal_version": LEGAL_VERSION}


def _clean(doc: dict) -> dict:
    return {k: (str(v) if k == "_id" else v) for k, v in doc.items() if k not in ("password_hash", "storage_path")}


async def _collect(user: dict) -> dict:
    uid = str(user["_id"])
    out = {"exported_at": now_iso(), "legal_version": LEGAL_VERSION,
           "account": {"id": uid, "email": user["email"], "name": user.get("name"), "created_at": user.get("created_at"), "consents": user.get("consents"), "subscription": user.get("subscription"), "billing_details": user.get("billing_details")}}
    for coll in ("profiles", "documents", "reminders", "medications", "vitals", "expenses", "payments", "activation_requests"):
        rows = await db[coll].find({"user_id": uid}).to_list(5000)
        out[coll] = [_clean(r) for r in rows]
    return out


@router.get("/account/export")
async def export_account(fmt: str = "json", user: dict = Depends(get_current_user)):
    data = await _collect(user)
    if fmt != "pdf":
        body = json.dumps(data, ensure_ascii=False, indent=2, default=str).encode("utf-8")
        return Response(content=body, media_type="application/json", headers={"Content-Disposition": 'attachment; filename="Accanto-dati-personali.json"'})
    a = data["account"]
    s = [P("Esportazione dati personali (Art. 20 GDPR)", "h1"), P(f"Generata il {datetime.now().strftime('%d/%m/%Y %H:%M')} · Versione documenti legali {LEGAL_VERSION}", "small"), Spacer(1, 6)]
    c = a.get("consents") or {}
    s += [P("Account", "h2"), kv_table([("Nome", a.get("name")), ("Email", a.get("email")), ("Registrato il", a.get("created_at")), ("Piano", (a.get("subscription") or {}).get("plan") or "prova gratuita"),
                                        ("Consensi", f"Termini/Privacy: {'sì' if c.get('terms_privacy') else 'no'} · Dati sanitari art. 9: {'sì' if c.get('health_data_art9') else 'no'} · Disclaimer medico/IA: {'sì' if c.get('medical_ai_disclaimer') else 'no'}" if c else "-"),
                                        ("Consensi prestati il (UTC)", c.get("accepted_at", "-")), ("Versione accettata", c.get("legal_version", "-"))])]
    s += [P(f"Profili assistiti ({len(data['profiles'])})", "h2")]
    for p in data["profiles"]:
        s += [kv_table([("Nome", p.get("name")), ("Relazione", p.get("relation")), ("Data di nascita", p.get("birth_date")), ("Codice fiscale", p.get("fiscal_code")), ("Allergie", p.get("allergies")), ("Condizioni", p.get("conditions")), ("Medico", p.get("doctor_name"))]), Spacer(1, 4)]
    if data["documents"]:
        s += [P(f"Documenti ({len(data['documents'])})", "h2"), table([["Data", "Titolo", "Categoria", "Sintesi"]] + [[str(d.get("created_at", ""))[:10], d.get("title", ""), d.get("category", ""), (d.get("summary") or "")[:400]] for d in data["documents"]], col_widths=[20 * mm, 40 * mm, 24 * mm, 94 * mm])]
    if data["reminders"]:
        s += [P(f"Scadenze ({len(data['reminders'])})", "h2"), table([["Titolo", "Quando", "Fatto"]] + [[r.get("title", ""), r.get("due_date") or r.get("due_label") or "", "sì" if r.get("done") else "no"] for r in data["reminders"]], col_widths=[100 * mm, 50 * mm, 28 * mm])]
    if data["medications"]:
        s += [P(f"Terapie ({len(data['medications'])})", "h2"), table([["Farmaco", "Dose", "Mattina", "Pranzo", "Sera", "Notte", "Note"]] + [[m.get("name", ""), m.get("dosage", ""), m.get("morning", ""), m.get("noon", ""), m.get("evening", ""), m.get("night", ""), m.get("notes", "")] for m in data["medications"]], col_widths=[40 * mm, 24 * mm, 17 * mm, 17 * mm, 17 * mm, 17 * mm, 46 * mm])]
    if data["vitals"]:
        s += [P(f"Parametri ({len(data['vitals'])})", "h2"), table([["Data", "Tipo", "Valore", "Note"]] + [[str(v.get("measured_at", ""))[:16].replace("T", " "), v.get("type", ""), f"{v.get('value')}" + (f"/{v.get('value2')}" if v.get("value2") is not None else ""), v.get("notes", "")] for v in data["vitals"]], col_widths=[34 * mm, 30 * mm, 30 * mm, 84 * mm])]
    if data["expenses"]:
        s += [P(f"Spese ({len(data['expenses'])})", "h2"), table([["Data", "Descrizione", "Categoria", "Importo"]] + [[e.get("date", ""), e.get("description", ""), e.get("category", ""), f"{float(e.get('amount', 0)):.2f} €"] for e in data["expenses"]], col_widths=[24 * mm, 94 * mm, 30 * mm, 30 * mm])]
    if data["payments"]:
        s += [P(f"Pagamenti ({len(data['payments'])})", "h2"), table([["Data", "Ricevuta", "Piano", "Importo"]] + [[str(p.get("created_at", ""))[:10], p.get("receipt_number", ""), p.get("plan", ""), f"{float(p.get('amount', 0)):.2f} €"] for p in data["payments"]], col_widths=[30 * mm, 50 * mm, 50 * mm, 48 * mm])]
    s += [Spacer(1, 8), P("Il file JSON scaricabile dall'app contiene l'esportazione completa in formato strutturato e leggibile da dispositivo automatico (Art. 20 GDPR).", "note")]
    return Response(content=build_pdf("Esportazione dati personali", user["email"], s), media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="Accanto-dati-personali.pdf"'})


@router.delete("/account")
async def delete_account(response: Response, user: dict = Depends(get_current_user)):
    require_not_demo(user)
    if is_owner(user):
        raise HTTPException(status_code=400, detail="L'account amministratore non puo' essere eliminato dall'app.")
    uid = str(user["_id"])
    paths = [d["storage_path"] for d in await db.documents.find({"user_id": uid}, {"storage_path": 1}).to_list(5000) if d.get("storage_path")]
    paths += [p["pdf_path"] for p in await db.payments.find({"user_id": uid}, {"pdf_path": 1}).to_list(5000) if p.get("pdf_path")]
    for path in paths:
        try:
            await asyncio.to_thread(delete_object, path)
        except Exception as e:
            logger.warning(f"Storage delete failed for {path}: {e}")
    for coll in ("documents", "reminders", "medications", "vitals", "expenses", "profiles", "payments", "activation_requests", "ai_usage"):
        await db[coll].delete_many({"user_id": uid})
    await db.users.delete_one({"_id": user["_id"]})
    response.delete_cookie("access_token", path="/")
    logger.info(f"Account deleted (GDPR art. 17): {uid}")
    return {"ok": True}
