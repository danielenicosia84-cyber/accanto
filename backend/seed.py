"""Rich, realistic demo data for the demo and owner accounts (idempotent via users.seed_version)."""
import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta

from core import db
from storage import put_object, APP_NAME
from pdfgen import build_pdf, P, table, kv_table, Spacer, mm

logger = logging.getLogger("dopo.seed")
SEED_VERSION = 3


def _d(days_ago: int, hour: int = 8) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).replace(hour=hour, minute=0, second=0, microsecond=0).isoformat()


def _date(days_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d")


def _days_since(month: int, day: int) -> int:
    now = datetime.now(timezone.utc)
    d = datetime(now.year, month, day, tzinfo=timezone.utc)
    if d > now:
        d = datetime(now.year - 1, month, day, tzinfo=timezone.utc)
    return (now - d).days


def _future(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")


PROFILE = {
    "name": "Papà", "relation": "Padre (Giuseppe)", "color": "#2D6A4F", "birth_date": "1948-03-12", "fiscal_code": "RSSGPP48C12H501X",
    "blood_type": "A+", "weight_kg": 78, "height_cm": 172, "allergies": "Penicillina (reazione cutanea)",
    "conditions": "Ipertensione arteriosa, Diabete di tipo 2, Ipercolesterolemia",
    "doctor_name": "Dott.ssa Maria Bianchi (MMG)", "doctor_phone": "06 1234567",
    "emergency_contacts": [{"name": "Anna Rossi", "relation": "figlia", "phone": "333 1234567"}, {"name": "Marco Rossi", "relation": "figlio", "phone": "347 7654321"}],
    "exemption_codes": "013 (diabete), E01", "health_card_expiry": _future(410), "address": "Via Roma 12, 00100 Roma",
    "habits": "Colazione alle 8, pranzo alle 12:30, cena alle 19:30. Passeggiata pomeridiana. Non ama il pesce. Dorme con la luce accesa.",
    "notes": "Porta gli occhiali per leggere. Usa il bastone fuori casa.",
}

DOCUMENTS = [
    {
        "key": "esami_gen", "days_ago": _days_since(1, 20), "title": "Esami del sangue - gennaio", "category": "Esame",
        "summary": "Sono gli esami del sangue di controllo di gennaio. Il colesterolo totale è 232 mg/dL e la glicemia a digiuno è 118 mg/dL; l'emoglobina glicata è 7,1%. La creatinina è 1,1 mg/dL e gli altri valori dell'emocromo rientrano negli intervalli indicati dal laboratorio. Il referto consiglia di mostrare i risultati al medico curante.",
        "key_terms": [{"term": "Colesterolo totale", "meaning": "La quantità complessiva di grassi 'colesterolo' nel sangue."}, {"term": "Glicemia", "meaning": "Lo zucchero nel sangue misurato a digiuno."}, {"term": "Emoglobina glicata (HbA1c)", "meaning": "Indica la media degli zuccheri negli ultimi 2-3 mesi."}, {"term": "Creatinina", "meaning": "Un valore che racconta come lavorano i reni."}],
        "deadlines": [],
        "rows": [["Esame", "Risultato", "Riferimento"], ["Colesterolo totale", "232 mg/dL", "< 200"], ["Colesterolo HDL", "44 mg/dL", "> 40"], ["Colesterolo LDL", "156 mg/dL", "< 130"], ["Trigliceridi", "160 mg/dL", "< 150"], ["Glicemia", "118 mg/dL", "70 - 100"], ["Emoglobina glicata", "7,1 %", "< 6,5"], ["Creatinina", "1,1 mg/dL", "0,7 - 1,2"], ["Emoglobina", "13,8 g/dL", "13 - 17"], ["Piastrine", "230 x10^3/µL", "150 - 400"]],
    },
    {
        "key": "esami_mag", "days_ago": _days_since(5, 18), "title": "Esami del sangue - maggio", "category": "Esame",
        "summary": "Sono gli esami del sangue di controllo di maggio. Il colesterolo totale è 198 mg/dL e la glicemia a digiuno è 104 mg/dL; l'emoglobina glicata è 6,6%. La creatinina è 1,0 mg/dL. Gli altri valori dell'emocromo rientrano negli intervalli indicati dal laboratorio. Il referto consiglia di mostrare i risultati al medico curante.",
        "key_terms": [{"term": "Colesterolo LDL", "meaning": "La parte di colesterolo che il medico tiene d'occhio."}, {"term": "Trigliceridi", "meaning": "Un tipo di grassi nel sangue legati anche all'alimentazione."}, {"term": "Emoglobina glicata (HbA1c)", "meaning": "Indica la media degli zuccheri negli ultimi 2-3 mesi."}],
        "deadlines": [{"title": "Ripetere esami del sangue di controllo", "timeframe": "tra 6 mesi", "due_date": _future(155)}],
        "rows": [["Esame", "Risultato", "Riferimento"], ["Colesterolo totale", "198 mg/dL", "< 200"], ["Colesterolo HDL", "47 mg/dL", "> 40"], ["Colesterolo LDL", "124 mg/dL", "< 130"], ["Trigliceridi", "138 mg/dL", "< 150"], ["Glicemia", "104 mg/dL", "70 - 100"], ["Emoglobina glicata", "6,6 %", "< 6,5"], ["Creatinina", "1,0 mg/dL", "0,7 - 1,2"], ["Emoglobina", "14,0 g/dL", "13 - 17"], ["Piastrine", "225 x10^3/µL", "150 - 400"]],
    },
    {
        "key": "cardio", "days_ago": _days_since(3, 10), "title": "Visita cardiologica di controllo", "category": "Referto",
        "summary": "È il referto della visita cardiologica di controllo. La pressione misurata in studio era 145/88 mmHg. L'elettrocardiogramma mostra un ritmo regolare. Il cardiologo conferma la terapia in corso e chiede di misurare la pressione a casa ogni mattina, annotando i valori. È indicato un controllo tra 6 mesi con ecocardiogramma.",
        "key_terms": [{"term": "ECG", "meaning": "Registrazione dell'attività elettrica del cuore."}, {"term": "Ritmo sinusale", "meaning": "Il ritmo normale del cuore."}, {"term": "Ecocardiogramma", "meaning": "Un'ecografia del cuore."}],
        "deadlines": [{"title": "Controllo cardiologico con ecocardiogramma", "timeframe": "tra 6 mesi", "due_date": _future(120)}],
        "rows": [["Voce", "Dettaglio"], ["Pressione arteriosa", "145/88 mmHg"], ["Frequenza cardiaca", "72 bpm"], ["ECG", "Ritmo sinusale regolare"], ["Terapia", "Confermata (Ramipril 5 mg, Cardioaspirina 100 mg)"], ["Indicazioni", "Misurare la pressione a casa ogni mattina; controllo con ecocardiogramma tra 6 mesi"]],
    },
    {
        "key": "ricetta", "days_ago": 12, "title": "Ricetta farmaci mensile", "category": "Ricetta",
        "summary": "È la ricetta del medico curante con i farmaci del mese: Ramipril 5 mg, Atorvastatina 20 mg, Metformina 500 mg e Cardioaspirina 100 mg. La ricetta va presentata in farmacia entro 30 giorni dalla data di emissione.",
        "key_terms": [{"term": "Posologia", "meaning": "Come e quando prendere il farmaco."}, {"term": "Ricetta dematerializzata", "meaning": "La ricetta elettronica: in farmacia basta la tessera sanitaria."}],
        "deadlines": [{"title": "Ritirare i farmaci in farmacia", "timeframe": "entro 30 giorni", "due_date": _future(18)}],
        "rows": [["Farmaco", "Posologia"], ["Ramipril 5 mg", "1 compressa al mattino"], ["Atorvastatina 20 mg", "1 compressa la sera"], ["Metformina 500 mg", "1 compressa a pranzo e 1 a cena"], ["Cardioaspirina 100 mg", "1 compressa dopo pranzo"]],
    },
]

REMINDERS = [
    {"title": "Rinnovo esenzione ticket per reddito", "due_label": "entro il 31 marzo", "due_date": None, "source": "bureaucracy"},
    {"title": "Misurare la pressione ogni mattina", "due_label": "ogni giorno", "due_date": None, "source": "manual"},
    {"title": "Prenotare vaccino antinfluenzale", "due_label": "ottobre", "due_date": None, "source": "bureaucracy"},
]

MEDICATIONS = [
    {"name": "Ramipril", "dosage": "5 mg", "form": "compressa", "morning": "1", "noon": "", "evening": "", "night": "", "food": "any", "notes": "Per la pressione", "prescribed_by": "Dott.ssa Bianchi"},
    {"name": "Atorvastatina", "dosage": "20 mg", "form": "compressa", "morning": "", "noon": "", "evening": "1", "night": "", "food": "after", "notes": "Per il colesterolo", "prescribed_by": "Dott.ssa Bianchi"},
    {"name": "Metformina", "dosage": "500 mg", "form": "compressa", "morning": "", "noon": "1", "evening": "1", "night": "", "food": "after", "notes": "Per il diabete, con i pasti", "prescribed_by": "Dott.ssa Bianchi"},
    {"name": "Cardioaspirina", "dosage": "100 mg", "form": "compressa", "morning": "", "noon": "1", "evening": "", "night": "", "food": "after", "notes": "Dopo pranzo, con acqua", "prescribed_by": "Cardiologo"},
]

PRESSURE = [(148, 90), (142, 86), (139, 85), (145, 88), (136, 84), (141, 87), (138, 83), (135, 82), (140, 86), (133, 81), (137, 84), (134, 80), (131, 79), (136, 82)]
WEIGHTS = [(28, 79.5), (21, 79.0), (14, 78.6), (7, 78.2), (1, 78.0)]
GLUCOSE = [(20, 118), (13, 110), (6, 104), (2, 101)]

EXPENSES = [
    {"days_ago": 150, "description": "Ticket esami del sangue", "category": "ticket", "amount": 36.15, "traceable": True},
    {"days_ago": 120, "description": "Farmaci con ricetta (quota)", "category": "farmaci", "amount": 18.40, "traceable": False},
    {"days_ago": 95, "description": "Visita cardiologica privata", "category": "visite", "amount": 120.00, "traceable": True},
    {"days_ago": 70, "description": "Misuratore di pressione", "category": "dispositivi", "amount": 49.90, "traceable": True},
    {"days_ago": 60, "description": "Ticket visita cardiologica", "category": "ticket", "amount": 25.00, "traceable": True},
    {"days_ago": 45, "description": "Farmaci da banco e integratori", "category": "farmaci", "amount": 22.70, "traceable": False},
    {"days_ago": 30, "description": "Seduta dentista (igiene)", "category": "dentista", "amount": 80.00, "traceable": True},
    {"days_ago": 25, "description": "Ticket esami del sangue", "category": "ticket", "amount": 36.15, "traceable": True},
    {"days_ago": 12, "description": "Farmaci mensili (quota fissa)", "category": "farmaci", "amount": 12.00, "traceable": False},
]


def _doc_pdf(d: dict, profile: dict) -> bytes:
    s = [P(d["title"], "h1"), P(f"Paziente: {profile['name']} · Nato il 12/03/1948 · CF {profile['fiscal_code']}", "small"), Spacer(1, 6),
         kv_table([("Data", (datetime.now(timezone.utc) - timedelta(days=d["days_ago"])).strftime("%d/%m/%Y")), ("Tipo", d["category"]), ("Struttura", "Laboratorio Analisi / Ambulatorio di esempio")]),
         Spacer(1, 8), table(d["rows"], col_widths=[70 * mm, 60 * mm, 48 * mm] if len(d["rows"][0]) == 3 else [60 * mm, 118 * mm]), Spacer(1, 10),
         P("Documento di esempio generato per la dimostrazione di Accanto. I valori non si riferiscono a una persona reale.", "note")]
    return build_pdf(d["title"], "Documento di esempio", s)


async def seed_rich_data(user: dict):
    if user.get("seed_version", 0) >= SEED_VERSION:
        return
    uid = str(user["_id"])
    prof = await db.profiles.find_one({"user_id": uid, "name": "Papà", "is_deleted": {"$ne": True}})
    if prof:
        await db.profiles.update_one({"_id": prof["_id"]}, {"$set": {k: v for k, v in PROFILE.items() if k not in ("name",)}})
        pid = str(prof["_id"])
    else:
        res = await db.profiles.insert_one({**PROFILE, "user_id": uid, "is_deleted": False, "created_at": _d(200)})
        pid = str(res.inserted_id)

    for d in DOCUMENTS:
        existing = await db.documents.find_one({"user_id": uid, "profile_id": pid, "seed_key": d["key"]})
        if existing:
            await db.documents.update_one({"_id": existing["_id"]}, {"$set": {"created_at": _d(d["days_ago"], 10)}})
            continue
        pdf = await asyncio.to_thread(_doc_pdf, d, PROFILE)
        path = f"{APP_NAME}/uploads/{uid}/seed-{d['key']}-{uuid.uuid4().hex[:6]}.pdf"
        await asyncio.to_thread(put_object, path, pdf, "application/pdf")
        created = _d(d["days_ago"], 10)
        res = await db.documents.insert_one({
            "user_id": uid, "profile_id": pid, "seed_key": d["key"], "storage_path": path, "original_filename": f"{d['key']}.pdf", "content_type": "application/pdf", "size": len(pdf),
            "title": d["title"], "category": d["category"], "summary": d["summary"], "key_terms": d["key_terms"], "deadlines": d["deadlines"], "status": "ready", "is_deleted": False, "created_at": created,
        })
        for dl in d["deadlines"]:
            await db.reminders.insert_one({"user_id": uid, "profile_id": pid, "document_id": str(res.inserted_id), "title": dl["title"], "due_label": dl["timeframe"], "due_date": dl["due_date"], "done": False, "source": "ai", "created_at": created})

    if not await db.reminders.find_one({"user_id": uid, "profile_id": pid, "source": "bureaucracy"}):
        for r in REMINDERS:
            await db.reminders.insert_one({**r, "user_id": uid, "profile_id": pid, "document_id": None, "done": False, "created_at": _d(40)})

    if not await db.medications.find_one({"user_id": uid, "profile_id": pid}):
        for m in MEDICATIONS:
            await db.medications.insert_one({**m, "start_date": _date(180), "end_date": None, "active": True, "user_id": uid, "profile_id": pid, "created_at": _d(180)})

    if not await db.vitals.find_one({"user_id": uid, "profile_id": pid}):
        for i, (sys_, dia) in enumerate(PRESSURE):
            days = len(PRESSURE) - 1 - i
            await db.vitals.insert_one({"type": "pressure", "value": sys_, "value2": dia, "measured_at": _d(days, 8), "notes": "", "user_id": uid, "profile_id": pid, "created_at": _d(days, 8)})
            await db.vitals.insert_one({"type": "heart_rate", "value": 68 + (i % 5), "value2": None, "measured_at": _d(days, 8), "notes": "", "user_id": uid, "profile_id": pid, "created_at": _d(days, 8)})
        for days, w in WEIGHTS:
            await db.vitals.insert_one({"type": "weight", "value": w, "value2": None, "measured_at": _d(days, 7), "notes": "", "user_id": uid, "profile_id": pid, "created_at": _d(days, 7)})
        for days, g in GLUCOSE:
            await db.vitals.insert_one({"type": "glucose", "value": g, "value2": None, "measured_at": _d(days, 7), "notes": "a digiuno", "user_id": uid, "profile_id": pid, "created_at": _d(days, 7)})
        await db.vitals.insert_one({"type": "spo2", "value": 97, "value2": None, "measured_at": _d(3, 9), "notes": "", "user_id": uid, "profile_id": pid, "created_at": _d(3, 9)})
        await db.vitals.insert_one({"type": "temperature", "value": 36.6, "value2": None, "measured_at": _d(3, 9), "notes": "", "user_id": uid, "profile_id": pid, "created_at": _d(3, 9)})

    if not await db.expenses.find_one({"user_id": uid, "profile_id": pid}):
        for e in EXPENSES:
            await db.expenses.insert_one({"date": _date(e["days_ago"]), "description": e["description"], "category": e["category"], "amount": e["amount"], "traceable": e["traceable"], "deductible": True, "document_id": None, "notes": "", "user_id": uid, "profile_id": pid, "created_at": _d(e["days_ago"])})

    await db.users.update_one({"_id": user["_id"]}, {"$set": {"seed_version": SEED_VERSION}})
    logger.info(f"Rich seed applied for {user['email']}")
