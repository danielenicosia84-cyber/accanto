import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useBilling } from "@/context/BillingContext";
import { useAuth } from "@/context/AuthContext";
import api, { errorMessage } from "@/lib/api";
import { BillingDetailsForm } from "@/components/BillingDetailsForm";
import { PayPalCheckout } from "@/components/PayPalCheckout";
import { ManualPayment } from "@/components/ManualPayment";

const eur = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;

const Summary = ({ plan, interval, t }) => {
  const amount = plan.lifetime ? plan.once : plan[interval];
  const period = plan.lifetime ? t("lifetime_once") : interval === "yearly" ? t("per_year") : t("per_month");
  return (
    <div className="rounded-2xl bg-[#2D6A4F] p-5 text-white" data-testid="checkout-summary">
      <p className="text-sm text-white/80">{plan.lifetime ? t("lifetime_badge") : interval === "yearly" ? t("billing_yearly") : t("billing_monthly")}</p>
      <h2 className="font-heading text-xl font-bold">{plan.name}</h2>
      <p className="mt-2 font-heading text-3xl font-bold">{eur(amount)} <span className="text-base font-normal text-white/80">{period}</span></p>
    </div>
  );
};

const DetailsCard = ({ details, onEdit, t }) => (
  <div className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-4" data-testid="billing-details-card">
    <div>
      <p className="text-xs font-semibold text-slate-500">{t("checkout_details_title")}</p>
      <p className="font-semibold text-slate-900">{details.first_name} {details.last_name}</p>
      <p className="text-sm text-slate-600">{[details.fiscal_code, details.address, [details.zip, details.city].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}</p>
    </div>
    <button data-testid="billing-details-edit" onClick={onEdit} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label={t("edit")}><Pencil className="h-4 w-4" /></button>
  </div>
);

export default function Checkout() {
  const { plan: planId } = useParams();
  const [params] = useSearchParams();
  const interval = params.get("interval") === "yearly" ? "yearly" : "monthly";
  const { t } = useLang();
  const { billing, refreshBilling } = useBilling();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [config, setConfig] = useState(null);
  const [details, setDetails] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/billing/plans"), api.get("/billing/config")])
      .then(([p, c]) => { setPlan(p.data.plans.find((x) => x.id === planId) || null); setConfig(c.data); })
      .catch((err) => toast.error(errorMessage(err)));
  }, [planId]);

  useEffect(() => {
    if (billing && details === null) setDetails(billing.billing_details || {});
  }, [billing, details]);

  if (user?.is_demo) {
    return (
      <div className="animate-fade-up space-y-4" data-testid="checkout-demo-locked">
        <p className="rounded-2xl bg-[#FEF3C7] p-4 text-sm font-medium text-[#92400E]">{t("demo_checkout")}</p>
        <Link to="/register" className="flex min-h-[52px] items-center justify-center rounded-2xl bg-[#2D6A4F] font-semibold text-white hover:bg-[#1B4332]">{t("register")}</Link>
      </div>
    );
  }

  if (!plan || !config || details === null) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#2D6A4F]" /></div>;
  }

  const hasDetails = details.first_name && details.last_name && !editing;

  const onActivated = async () => {
    await refreshBilling();
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex min-h-[60vh] animate-fade-up flex-col items-center justify-center text-center" data-testid="checkout-success">
        <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#E8F5E9] text-[#2D6A4F]"><CheckCircle2 className="h-10 w-10" /></span>
        <h1 className="font-heading text-2xl font-bold text-slate-900">{t("activated_title")}</h1>
        <p className="mt-2 max-w-sm text-base text-slate-600">{t("activated_sub")}</p>
        <Link to="/profiles" data-testid="checkout-go-profile" className="mt-6 flex min-h-[52px] w-full max-w-xs items-center justify-center rounded-2xl bg-[#2D6A4F] font-semibold text-white hover:bg-[#1B4332]">{t("sub_title")}</Link>
        <Link to="/" className="mt-3 text-sm font-semibold text-slate-500 hover:underline">{t("go_home")}</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-5" data-testid="checkout-page">
      <button onClick={() => navigate("/pricing")} className="-ml-2 flex min-h-[44px] items-center gap-1 px-2 text-sm font-semibold text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> {t("back_pricing")}</button>
      <h1 className="font-heading text-2xl font-bold text-slate-900">{t("checkout_title")}</h1>
      <Summary plan={plan} interval={interval} t={t} />

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-slate-900">1. {t("checkout_details_title")}</h2>
          <p className="text-sm text-slate-500">{t("checkout_details_sub")}</p>
        </div>
        {hasDetails ? <DetailsCard details={details} onEdit={() => setEditing(true)} t={t} /> : (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <BillingDetailsForm initial={details} onSaved={(d) => { setDetails(d); setEditing(false); refreshBilling(); }} />
          </div>
        )}
      </section>

      <section className={`space-y-4 ${hasDetails ? "" : "pointer-events-none opacity-40"}`} data-testid="payment-section">
        <h2 className="font-heading text-lg font-bold text-slate-900">2. {t("pay_title")}</h2>
        {busy && <p className="flex items-center gap-2 rounded-xl bg-[#E8F5E9] p-3 text-sm font-semibold text-[#1B4332]"><Loader2 className="h-4 w-4 animate-spin" /> {t("activating")}</p>}
        {hasDetails && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <PayPalCheckout config={config} plan={plan.id} interval={interval} paypalPlanId={plan.paypal_plan_ids?.[interval]} onActivated={onActivated} onBusy={setBusy} />
          </div>
        )}
        {config.manual?.enabled && hasDetails && <ManualPayment manual={config.manual} plan={plan.id} interval={plan.lifetime ? "lifetime" : interval} />}
      </section>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-[#2D6A4F]" /> {t("secure_payment_paypal")}</p>
    </div>
  );
}
