import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, ShieldCheck, Sparkles, KeyRound, Star } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useBilling } from "@/context/BillingContext";
import api, { errorMessage } from "@/lib/api";

const eur = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;

const FEATURE_LABELS = { dossier: "feat_dossier", fridge_table: "feat_fridge", history_compare: "feat_history", expenses_730: "feat_730", vitals: "feat_vitals", caregiver_kit: "feat_kit" };

const limitLabel = (value, t, { one, many, unlimited }) => {
  if (value === null) return t(unlimited);
  if (one && value === 1) return t(one);
  return t(many).replace("{n}", value);
};

const features = (p, t) => [
  limitLabel(p.limits.profiles, t, { one: "feat_profiles_one", many: "feat_profiles_n", unlimited: "feat_profiles_unl" }),
  limitLabel(p.limits.docs, t, { many: "feat_docs_n", unlimited: "feat_docs_unl" }),
  limitLabel(p.limits.ai, t, { many: "feat_ai_n", unlimited: "feat_ai_unl" }),
  t("feat_archive"),
  ...(p.id === "completo" || p.id === "lifetime" ? [t("feat_kit"), t("feat_future")] : p.features.map((f) => t(FEATURE_LABELS[f]))),
];

const PriceLine = ({ p, interval, t }) => {
  if (p.lifetime) {
    return (
      <div className="mt-2">
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-4xl font-bold text-slate-900">{eur(p.once)}</span>
          <span className="text-sm text-slate-500">{t("lifetime_once")}</span>
        </p>
        <p className="mt-1 text-xs font-semibold text-[#C85F46]">{t("instead_of")} <span className="line-through">{eur(p.list_price)}</span></p>
      </div>
    );
  }
  const amount = interval === "yearly" ? p.yearly : p.monthly;
  return (
    <div className="mt-2">
      <p className="flex items-baseline gap-1">
        <span className="font-heading text-4xl font-bold text-slate-900">{eur(amount)}</span>
        <span className="text-sm text-slate-500">{interval === "yearly" ? t("per_year") : t("per_month")}</span>
      </p>
      {interval === "yearly" && <p className="mt-1 text-xs font-semibold text-[#2D6A4F]">{eur(p.yearly / 12)}{t("per_month")} · {t("yearly_save")}</p>}
    </div>
  );
};

const PlanCard = ({ p, interval, isCurrent, onChoose, t }) => {
  const hi = p.recommended;
  const gold = p.lifetime;
  return (
    <div data-testid={`plan-card-${p.id}`} className={`relative rounded-3xl border p-6 ${hi ? "border-[#2D6A4F] bg-white shadow-lg ring-2 ring-[#E8F5E9]" : gold ? "border-[#D97706] bg-[#FFFBEB] shadow-md" : "border-slate-200 bg-white"}`}>
      {hi && <span className="absolute -top-3 left-6 rounded-full bg-[#2D6A4F] px-3 py-1 text-xs font-bold text-white">{t("recommended")}</span>}
      {gold && <span className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-[#D97706] px-3 py-1 text-xs font-bold text-white"><Star className="h-3 w-3" /> {t("lifetime_badge")}</span>}
      <h2 className="font-heading text-xl font-bold text-slate-900">{p.lifetime ? p.name : p.short}</h2>
      {gold && <p className="mt-1 text-sm text-slate-600">{t("lifetime_desc")}</p>}
      <PriceLine p={p} interval={interval} t={t} />
      <ul className="mt-5 space-y-2.5">
        {features(p, t).map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#2D6A4F]" /> {f}</li>
        ))}
      </ul>
      <button data-testid={`choose-plan-${p.id}`} onClick={() => onChoose(p)} disabled={isCurrent}
        className={`mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl font-semibold transition-colors disabled:opacity-60 ${hi || gold ? "bg-[#2D6A4F] text-white hover:bg-[#1B4332]" : "border-2 border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#E8F5E9]"}`}>
        {isCurrent ? t("current_plan") : t("choose_plan")}
      </button>
    </div>
  );
};

const UnlockCodeBox = ({ onDone, t }) => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/billing/redeem", { code });
      toast.success(t("unlock_code_ok"));
      onDone();
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="rounded-2xl border border-dashed border-[#2D6A4F] bg-[#E8F5E9]/40 p-4" data-testid="unlock-code-box">
      <p className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><KeyRound className="h-4 w-4 text-[#2D6A4F]" /> {t("unlock_code_title")}</p>
      <div className="flex gap-2">
        <input data-testid="unlock-code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("unlock_code_ph")} required
          className="h-[48px] flex-1 rounded-xl border border-slate-200 bg-white px-3 font-mono text-base uppercase outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]" />
        <button data-testid="unlock-code-submit" type="submit" disabled={busy} className="flex h-[48px] items-center justify-center rounded-xl bg-[#2D6A4F] px-4 font-semibold text-white hover:bg-[#1B4332] disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("unlock_code_btn")}
        </button>
      </div>
    </form>
  );
};

export default function Pricing() {
  const { t } = useLang();
  const { billing, refreshBilling } = useBilling();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [meta, setMeta] = useState({ trial_days: 7, trial_docs: 2 });
  const [interval, setInterval] = useState("monthly");

  useEffect(() => {
    api.get("/billing/plans").then(({ data }) => { setPlans(data.plans); setMeta({ trial_days: data.trial_days, trial_docs: data.trial_docs }); }).catch((err) => toast.error(errorMessage(err)));
  }, []);

  const choose = (p) => {
    if (billing?.is_demo) { navigate("/register"); return; }
    navigate(`/checkout/${p.id}?interval=${interval}`);
  };

  const isCurrent = (p) => billing?.status === "active" && billing?.plan === p.id && (p.lifetime || billing?.interval === interval);

  return (
    <div className="animate-fade-up space-y-6" data-testid="pricing-page">
      <div>
        <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-3 py-1 text-xs font-semibold text-[#2D6A4F]"><Sparkles className="h-3 w-3" /> {t("trial_docs_note").replace("{d}", meta.trial_days).replace("{n}", meta.trial_docs)}</span>
        <h1 className="font-heading text-2xl font-bold text-slate-900">{t("pricing_title")}</h1>
      </div>

      <div className="flex rounded-full border border-slate-200 bg-white p-1" data-testid="interval-toggle">
        {["monthly", "yearly"].map((k) => (
          <button key={k} data-testid={`interval-${k}`} onClick={() => setInterval(k)}
            className={`min-h-[44px] flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${interval === k ? "bg-[#2D6A4F] text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            {t(`billing_${k}`)}{k === "yearly" && <span className={`ml-1.5 text-xs ${interval === k ? "text-white/80" : "text-[#2D6A4F]"}`}>· {t("yearly_save")}</span>}
          </button>
        ))}
      </div>

      {plans.length === 0 ? (
        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-[#2D6A4F]" /></div>
      ) : (
        <div className="space-y-6 pt-2">
          {plans.map((p) => <PlanCard key={p.id} p={p} interval={interval} t={t} isCurrent={isCurrent(p)} onChoose={choose} />)}
        </div>
      )}

      {!billing?.is_demo && <UnlockCodeBox t={t} onDone={() => { refreshBilling(); navigate("/profiles"); }} />}

      <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-[#2D6A4F]" /> {t("secure_payment_paypal")}</p>
    </div>
  );
}
