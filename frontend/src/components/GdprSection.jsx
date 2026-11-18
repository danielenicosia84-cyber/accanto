import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Download, FileDown, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import api, { errorMessage } from "@/lib/api";
import { download } from "@/lib/care";

const DeleteDialog = ({ open, onOpenChange }) => {
  const { t } = useLang();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = (o) => { if (!o) { setStep(1); setAck(false); } onOpenChange(o); };

  const confirm = async () => {
    setBusy(true);
    try {
      await api.delete("/account");
      toast.success(t("gdpr_deleted"));
      await logout();
      navigate("/login", { replace: true });
    } catch (err) { toast.error(errorMessage(err)); setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-md rounded-3xl" data-testid="delete-account-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-xl text-[#C53030]"><AlertTriangle className="h-5 w-5" /> {t("gdpr_delete_title")}</DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-slate-700">{t("gdpr_delete_desc")}</DialogDescription>
        </DialogHeader>
        {step === 1 ? (
          <div className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#FFF5F5] p-3">
              <input data-testid="delete-account-ack" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[#C53030]" />
              <span className="text-sm leading-relaxed text-slate-700">{t("gdpr_delete_ack")}</span>
            </label>
            <div className="flex gap-3">
              <button onClick={() => reset(false)} className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl border border-slate-200 font-semibold text-slate-700">{t("cancel")}</button>
              <button data-testid="delete-account-step1" disabled={!ack} onClick={() => setStep(2)} className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-[#C53030] font-semibold text-white disabled:opacity-40">{t("continue")}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p data-testid="delete-account-final-warning" className="rounded-xl bg-[#FFF5F5] p-3 text-sm font-semibold text-[#C53030]">{t("gdpr_delete_final")}</p>
            <div className="flex gap-3">
              <button onClick={() => reset(false)} disabled={busy} className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl border border-slate-200 font-semibold text-slate-700">{t("cancel")}</button>
              <button data-testid="delete-account-confirm" disabled={busy} onClick={confirm} className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#C53030] font-semibold text-white disabled:opacity-60">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Trash2 className="h-5 w-5" /> {t("gdpr_delete_confirm")}</>}</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const GdprSection = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const btn = "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="gdpr-section">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-[#2D6A4F]" /> {t("gdpr_title")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("gdpr_sub")}</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button data-testid="gdpr-export-json" onClick={() => download("/account/export?fmt=json", "Accanto-dati-personali.json", t("downloading"))} className={btn}><Download className="h-4 w-4" /> {t("gdpr_export")} (JSON)</button>
        <button data-testid="gdpr-export-pdf" onClick={() => download("/account/export?fmt=pdf", "Accanto-dati-personali.pdf", t("downloading"))} className={btn}><FileDown className="h-4 w-4" /> {t("gdpr_export")} (PDF)</button>
      </div>
      {!user?.is_demo && !user?.is_owner && (
        <button data-testid="gdpr-delete-account" onClick={() => setOpen(true)} className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C53030] px-4 text-sm font-semibold text-white hover:bg-[#9B2C2C]"><Trash2 className="h-4 w-4" /> {t("gdpr_delete")}</button>
      )}
      <DeleteDialog open={open} onOpenChange={setOpen} />
    </section>
  );
};
