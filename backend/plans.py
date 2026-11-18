TRIAL_DAYS = 7
TRIAL_DOC_LIMIT = 2
TRIAL_AI_LIMIT = 10

ALL_FEATURES = ["dossier", "fridge_table", "history_compare", "expenses_730", "vitals", "caregiver_kit"]
FAMILY_FEATURES = ["dossier", "fridge_table", "history_compare", "expenses_730", "vitals"]

PLANS = {
    "base": {
        "name": "Accanto Base", "short": "Base", "order": 1,
        "monthly": 4.99, "yearly": 39.90,
        "limits": {"profiles": 1, "docs": 10, "ai": 20},
        "features": [],
    },
    "famiglia": {
        "name": "Accanto Famiglia & Caregiver", "short": "Famiglia & Caregiver", "order": 2, "recommended": True,
        "monthly": 7.99, "yearly": 69.90,
        "limits": {"profiles": 3, "docs": 30, "ai": None},
        "features": FAMILY_FEATURES,
    },
    "completo": {
        "name": "Accanto Completo", "short": "Completo", "order": 3,
        "monthly": 10.99, "yearly": 89.90,
        "limits": {"profiles": None, "docs": None, "ai": None},
        "features": ALL_FEATURES,
    },
    "lifetime": {
        "name": "Licenza Famiglia Senza Pensieri", "short": "Lifetime", "order": 4, "lifetime": True,
        "once": 59.00, "list_price": 99.00,
        "limits": {"profiles": None, "docs": None, "ai": None},
        "features": ALL_FEATURES,
    },
}

UNLIMITED = {"profiles": None, "docs": None, "ai": None}
LOCKED = {"profiles": 0, "docs": 0, "ai": 0}
TRIAL_LIMITS = {"profiles": 1, "docs": TRIAL_DOC_LIMIT, "ai": TRIAL_AI_LIMIT}

INTERVALS = ("monthly", "yearly")


def plan_price(plan: str, interval: str) -> float:
    p = PLANS[plan]
    if p.get("lifetime"):
        return p["once"]
    return p[interval]


def plan_key(plan: str, interval: str) -> str:
    return "lifetime" if plan == "lifetime" else f"{plan}_{interval}"
