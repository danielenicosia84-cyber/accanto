import { useEffect, useState } from "react";
import { Landmark, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useProfiles } from "@/context/ProfileContext";
import api, { errorMessage } from "@/lib/api";
import { INPUT, BTN_PRIMARY } from "@/lib/care";
import { CarePage } from "@/components/care/CareShell";

const defaultDate = (tpl) => {
  if (!tpl.default_month) return "";
  const now = new Date();
  let d = new Date(now.getFullYear(), tpl.default_month - 1, tpl.default_day || 1);
  if (d < now) d = new Date(now.getFullYear() + 1, tpl.default_month - 1, tpl.default_day || 1);
  return d.toISOString().slice(0, 10);
};

const TemplateCard = ({ tpl, profileId, t }) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate(tpl));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      await api.post("/reminders", { profile_id: profileId, title: tpl.title, due_date: date || null, due_label: date ? "" : tpl.title });
      toast.success(t("bureaucracy_added")); setDone(true); setOpen(false);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <div data-testid={`bureaucracy-${tpl.id}`} className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] text-[#475569]"><Landmark className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-base font-bold text-slate-900">{tpl.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{tpl.description}</p>
        </div>
      </div>
      {open ? (
        <div className="mt-3 flex items-end gap-2">
          <label className="flex-1"><span className="mb-1 block text-xs font-semibold text-slate-600">{t("bureaucracy_date")}</span><input data-testid={`bureaucracy-date-${tpl.id}`} type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <button data-testid={`bureaucracy-confirm-${tpl.id}`} onClick={add} disabled={busy} className={`${BTN_PRIMARY} h-[52px]`}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("add")}</button>
        </div>
      ) : (
        <button data-testid={`bureaucracy-add-${tpl.id}`} onClick={() => setOpen(true)} disabled={done} className="mt-3 flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[#2D6A4F] hover:underline disabled:text-slate-400">
          <Plus className="h-4 w-4" /> {done ? t("bureaucracy_added") : t("bureaucracy_add")}
        </button>
      )}
    </div>
  );
};

export default function Bureaucracy() {
  const { t, lang } = useLang();
  const { activeId } = useProfiles();
  const [templates, setTemplates] = useState([]);
  useEffect(() => { api.get("/deadlines/templates", { params: { lang } }).then((r) => setTemplates(r.data)).catch((err) => toast.error(errorMessage(err))); }, [lang]);
  return (
    <CarePage title={t("bureaucracy_title")} subtitle={t("bureaucracy_sub")} testId="bureaucracy-page">
      <div className="space-y-3">{templates.map((tpl) => <TemplateCard key={tpl.id} tpl={tpl} profileId={activeId} t={t} />)}</div>
    </CarePage>
  );
}
