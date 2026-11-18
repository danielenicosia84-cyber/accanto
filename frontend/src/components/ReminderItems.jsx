import { useState } from "react";
import { Check, Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import api, { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const ReminderRow = ({ r, onToggle, onRemove }) => {
  const { t, lang } = useLang();
  return (
    <div data-testid={`reminder-${r.id}`} className={`flex items-center gap-3 rounded-2xl border bg-white p-4 ${r.done ? "border-slate-100 opacity-60" : "border-slate-200"}`}>
      <button data-testid={`reminder-toggle-${r.id}`} onClick={() => onToggle(r)}
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${r.done ? "border-[#2D6A4F] bg-[#2D6A4F] text-white" : "border-slate-300 text-transparent hover:border-[#2D6A4F]"}`}>
        <Check className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-slate-900 ${r.done ? "line-through" : ""}`}>{r.title}</p>
        <div className="flex items-center gap-2">
          {(r.due_label || r.due_date) && <p className="text-sm text-[#D97706]">{r.due_label || formatDate(r.due_date, lang)}</p>}
          {r.source === "ai" && <span className="flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2 py-0.5 text-xs font-semibold text-[#2D6A4F]"><Sparkles className="h-3 w-3" /> AI</span>}
        </div>
      </div>
      <button data-testid={`reminder-delete-${r.id}`} onClick={() => onRemove(r.id)} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label={t("delete")}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

export const ReminderForm = ({ profileId, onAdded, onCancel }) => {
  const { t } = useLang();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/reminders", { profile_id: profileId, title, due_label: when });
      toast.success(t("save"));
      onAdded(data);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={add} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <input data-testid="reminder-title-input" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("reminder_title_ph")}
        className="h-[52px] w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]" />
      <input data-testid="reminder-when-input" value={when} onChange={(e) => setWhen(e.target.value)} placeholder={t("reminder_when_ph")}
        className="h-[52px] w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]" />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="min-h-[52px] flex-1 rounded-2xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50">{t("cancel")}</button>
        <button data-testid="reminder-save-button" type="submit" disabled={saving} className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-[#2D6A4F] font-semibold text-white hover:bg-[#1B4332] disabled:opacity-60">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : t("save")}
        </button>
      </div>
    </form>
  );
};
