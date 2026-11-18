import { useState } from "react";
import { Landmark, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import api, { errorMessage } from "@/lib/api";

const Row = ({ label, value, testId }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => { await navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p data-testid={testId} className="break-all font-mono text-sm font-semibold text-slate-900">{value}</p>
      </div>
      <button type="button" onClick={copy} aria-label="Copia" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
        {copied ? <Check className="h-4 w-4 text-[#2D6A4F]" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
};

export const ManualPayment = ({ manual, plan, interval, amount }) => {
  const { t } = useLang();
  const [req, setReq] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/billing/manual-request", { plan, interval, method: "bonifico" });
      setReq(data);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F7F5F0] p-4" data-testid="manual-payment">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-[#2D6A4F]"><Landmark className="h-5 w-5" /></span>
        <div className="flex-1">
          <p className="font-semibold text-slate-900">{t("pay_manual_title")}</p>
          <p className="text-xs text-slate-500">{t("pay_manual_sub")}</p>
        </div>
      </div>
      {!req ? (
        <button data-testid="manual-show-button" onClick={start} disabled={busy} className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-2xl border-2 border-[#2D6A4F] bg-white font-semibold text-[#2D6A4F] hover:bg-[#E8F5E9] disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("pay_manual_btn")}
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          {sent && <p data-testid="manual-sent" className="rounded-xl bg-[#E8F5E9] p-3 text-sm font-medium text-[#1B4332]">{t("pay_manual_done")}</p>}
          <Row label={t("amount_due")} value={`${req.amount.toFixed(2).replace(".", ",")} €`} testId="manual-amount" />
          <Row label={t("pay_manual_ref")} value={req.reference} testId="manual-reference" />
          <Row label="IBAN" value={req.iban} testId="manual-iban" />
          <Row label="Intestatario" value={req.bank_holder} />
          {req.revolut_link && <Row label="Revolut" value={req.revolut_link} testId="manual-revolut" />}
          {req.instructions && <p className="text-xs text-slate-600">{req.instructions}</p>}
          {!req.iban && !req.revolut_link && <p className="text-xs text-[#C85F46]">{manual?.instructions || "Coordinate non ancora configurate dal gestore."}</p>}
          {!sent && <button data-testid="manual-sent-button" onClick={() => setSent(true)} className="mt-1 min-h-[48px] w-full rounded-2xl bg-[#2D6A4F] font-semibold text-white hover:bg-[#1B4332]">{t("pay_manual_sent")}</button>}
        </div>
      )}
    </div>
  );
};
