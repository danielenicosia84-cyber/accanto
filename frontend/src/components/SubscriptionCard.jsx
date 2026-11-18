import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Loader2, Sparkles, Clock, Lock, Eye, Crown, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useBilling } from "@/context/BillingContext";
import api, { errorMessage, downloadFile } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

const eur = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;

const Usage = ({ label, used, limit, t }) => {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{used}{limit === null ? ` · ${t("unlimited")}` : ` / ${limit}`}</span>
      </div>
      {limit !== null && limit > 0 && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${pct >= 100 ? "bg-[#C85F46]" : "bg-[#2D6A4F]"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
};

const statusLine = (b, t, lang) => {
  if (b.status === "owner") return { Icon: Crown, text: t("sub_owner"), tone: "text-[#92400E] bg-[#FEF3C7]" };
  if (b.status === "demo") return { Icon: Eye, text: t("sub_demo"), tone: "text-[#1E40AF] bg-[#E8F0FE]" };
  if (b.status === "expired") return { Icon: Lock, text: t("sub_expired"), tone: "text-[#C85F46] bg-[#FDF0ED]" };
  if (b.status === "trial") return { Icon: Clock, text: t("sub_trial").replace("{n}", b.trial_days_left), tone: "text-[#92400E] bg-[#FEF3C7]" };
  if (b.plan === "lifetime") return { Icon: Sparkles, text: t("sub_lifetime"), tone: "text-[#2D6A4F] bg-[#E8F5E9]" };
  const when = b.current_period_end ? formatDate(b.current_period_end, lang) : "";
  return { Icon: Sparkles, text: (b.cancel_at_period_end ? t("sub_ends") : t("sub_renews")).replace("{date}", when), tone: "text-[#2D6A4F] bg-[#E8F5E9]" };
};

const planLabelFor = (b, t) => {
  if (b.status === "active" || b.status === "owner") return b.plan_name;
  if (b.status === "trial") return t("trial_plan_label");
  if (b.status === "demo") return t("sub_demo");
  return t("sub_expired");
};

const PaymentsHistory = ({ t, lang }) => {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => { api.get("/billing/payments").then((r) => setData(r.data)).catch(() => setData({ payments: [], pending_requests: [] })); }, []);
  if (!data) return null;
  const dl = async (p) => {
    setBusy(p.id);
    try { await downloadFile(`/billing/receipts/${p.id}.pdf`, `${p.receipt_number}.pdf`); }
    catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(null); }
  };
  return (
    <div className="mt-5 border-t border-slate-100 pt-4" data-testid="payments-history">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><FileText className="h-4 w-4 text-[#2D6A4F]" /> {t("payments_title")}</p>
      {data.pending_requests.map((r) => (
        <p key={r.id} data-testid="pending-request" className="mb-2 rounded-xl bg-[#FEF3C7] px-3 py-2 text-xs font-semibold text-[#92400E]">{t("pay_manual_pending")} · {r.reference} · {eur(r.amount)}</p>
      ))}
      {data.payments.length === 0 ? <p className="text-sm text-slate-500">{t("no_payments")}</p> : (
        <ul className="space-y-2">
          {data.payments.map((p) => (
            <li key={p.id} data-testid={`payment-${p.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{p.receipt_number} · {eur(p.amount)}</p>
                <p className="text-xs text-slate-500">{formatDate(p.created_at, lang)} · {p.plan_name}</p>
              </div>
              {p.has_pdf && (
                <button data-testid={`download-receipt-${p.id}`} onClick={() => dl(p)} disabled={busy === p.id} className="flex min-h-[40px] items-center gap-1 rounded-full bg-white px-3 text-xs font-bold text-[#2D6A4F] shadow-sm hover:bg-[#E8F5E9]">
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const SubscriptionCard = () => {
  const { t, lang } = useLang();
  const { billing, refreshBilling } = useBilling();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!billing) return null;

  const { Icon, text, tone } = statusLine(billing, t, lang);
  const canCancel = billing.status === "active" && billing.plan !== "lifetime" && !billing.cancel_at_period_end && ["paypal", "simulated", "manual", "admin"].includes(billing.provider);

  const cancel = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/billing/cancel");
      toast.success(t("cancel_sub_ok").replace("{date}", data.access_until ? formatDate(data.access_until, lang) : ""));
      refreshBilling();
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <section data-testid="subscription-card" className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-[#2D6A4F]" />
        <h2 className="font-heading text-lg font-bold text-slate-900">{t("sub_title")}</h2>
      </div>
      <p className="font-heading text-xl font-bold text-slate-900" data-testid="subscription-plan">{planLabelFor(billing, t)}</p>
      <span data-testid="subscription-status" className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${tone}`}><Icon className="h-4 w-4" /> {text}</span>

      {!["demo", "owner"].includes(billing.status) && (
        <div className="mt-4 space-y-3">
          <Usage label={t("usage_docs")} used={billing.usage.docs} limit={billing.limits.docs} t={t} />
          <Usage label={t("usage_ai")} used={billing.usage.ai} limit={billing.limits.ai} t={t} />
          <Usage label={t("usage_profiles")} used={billing.usage.profiles} limit={billing.limits.profiles} t={t} />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {billing.status === "demo" && (
          <button data-testid="subscription-register" onClick={() => navigate("/register")} className="min-h-[48px] flex-1 rounded-2xl bg-[#2D6A4F] font-semibold text-white hover:bg-[#1B4332]">{t("register_cta")}</button>
        )}
        {["trial", "expired", "active"].includes(billing.status) && billing.plan !== "lifetime" && (
          <button data-testid="subscription-choose-plan" onClick={() => navigate("/pricing")} className="min-h-[48px] flex-1 rounded-2xl bg-[#2D6A4F] font-semibold text-white hover:bg-[#1B4332]">
            {billing.status === "active" ? t("change_plan") : t("choose_plan_cta")}
          </button>
        )}
        {canCancel && (
          <ConfirmDeleteDialog title={t("cancel_sub_title")} description={t("cancel_sub_desc")} onConfirm={cancel} confirmTestId="confirm-cancel-subscription" confirmLabel={t("cancel_sub")}>
            <button data-testid="subscription-cancel" disabled={busy} className="flex min-h-[48px] flex-1 items-center justify-center rounded-2xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("cancel_sub")}
            </button>
          </ConfirmDeleteDialog>
        )}
      </div>

      {!["demo"].includes(billing.status) && <PaymentsHistory t={t} lang={lang} />}
    </section>
  );
};
