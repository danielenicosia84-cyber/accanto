import { useEffect, useState, useCallback } from "react";
import { Receipt, Plus, Pencil, Trash2, FileDown, Sheet, CreditCard, Banknote } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useProfiles } from "@/context/ProfileContext";
import api, { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, eur, download } from "@/lib/care";
import { CarePage } from "@/components/care/CareShell";
import { ExpenseForm } from "@/components/care/ExpenseForm";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { EmptyState } from "@/components/EmptyState";

const Summary = ({ s, t }) => (
  <div className="rounded-2xl bg-[#2D6A4F] p-5 text-white" data-testid="expenses-summary">
    <div className="flex items-end justify-between gap-3">
      <div><p className="text-sm text-white/80">{t("exp_total")} {s.year}</p><p className="font-heading text-3xl font-bold" data-testid="expenses-total">{eur(s.total)}</p></div>
      <div className="text-right"><p className="text-sm text-white/80">{t("exp_refund")}</p><p className="font-heading text-2xl font-bold" data-testid="expenses-refund">{eur(s.estimated_refund)}</p></div>
    </div>
    <p className="mt-2 text-xs text-white/70">{t("exp_deductible_total")}: {eur(s.deductible)} · {t("exp_franchigia")}</p>
  </div>
);

const ExpenseRow = ({ e, onEdit, onDelete, lang, t }) => (
  <div data-testid={`expense-row-${e.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-[#D97706]">{e.traceable ? <CreditCard className="h-5 w-5" /> : <Banknote className="h-5 w-5" />}</span>
    <div className="min-w-0 flex-1">
      <p className="line-clamp-2 font-semibold leading-snug text-slate-900">{e.description}</p>
      <p className="text-xs text-slate-500">{formatDate(e.date, lang)} · {t(`cat_${e.category}`)}{e.deductible ? "" : ` · ${t("exp_deductible")}: No`}</p>
    </div>
    <div className="flex flex-col items-end">
      <p className="font-heading text-base font-bold text-slate-900">{eur(e.amount)}</p>
      <div className="-mr-2 flex">
    <button data-testid={`expense-edit-${e.id}`} onClick={() => onEdit(e)} aria-label={t("edit")} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
    <ConfirmDeleteDialog title={t("exp_delete_title")} description={t("exp_delete_desc")} onConfirm={() => onDelete(e.id)} confirmTestId={`confirm-delete-expense-${e.id}`}>
      <button data-testid={`expense-delete-${e.id}`} aria-label={t("delete")} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
    </ConfirmDeleteDialog>
      </div>
    </div>
  </div>
);

export default function Expenses() {
  const { t, lang } = useLang();
  const { activeId } = useProfiles();
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    if (!activeId) return;
    try {
      const [r, s] = await Promise.all([api.get(`/profiles/${activeId}/expenses`, { params: { year } }), api.get(`/profiles/${activeId}/expenses/summary`, { params: { year } })]);
      setRows(r.data); setSummary(s.data);
    } catch (err) { if (err?.response?.status !== 402) toast.error(errorMessage(err)); }
  }, [activeId, year]);
  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    try { await api.delete(`/expenses/${id}`); toast.success(t("deleted_ok")); load(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const years = [0, 1, 2].map((i) => new Date().getFullYear() - i);

  return (
    <CarePage title={t("expenses_title")} subtitle={t("expenses_sub")} feature="expenses_730" testId="expenses-page">
      <div className="flex items-center gap-3">
        <label className="flex-1"><span className="mb-1 block text-sm font-semibold text-slate-700">{t("exp_year")}</span>
          <select data-testid="expenses-year" className={INPUT} value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        </label>
      </div>
      {summary && <Summary s={summary} t={t} />}
      {editing !== null ? (
        <ExpenseForm profileId={activeId} initial={editing || undefined} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      ) : (
        <button data-testid="expenses-add" onClick={() => setEditing(false)} className={`${BTN_PRIMARY} w-full`}><Plus className="h-5 w-5" /> {t("expenses_add")}</button>
      )}
      {rows.length === 0 && editing === null && <EmptyState icon={Receipt} text={t("expenses_empty")} testId="expenses-empty" />}
      <div className="space-y-2">{rows.map((e) => <ExpenseRow key={e.id} e={e} onEdit={setEditing} onDelete={del} lang={lang} t={t} />)}</div>
      <p className="text-xs text-slate-500">{t("exp_note")}</p>
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <button data-testid="expenses-pdf" onClick={() => download(`/profiles/${activeId}/expenses/export?fmt=pdf&year=${year}&lang=${lang}`, `Accanto-Spese-${year}.pdf`, t("downloading"))} className={BTN_SECONDARY}><FileDown className="h-5 w-5" /> {t("export_pdf")}</button>
          <button data-testid="expenses-xlsx" onClick={() => download(`/profiles/${activeId}/expenses/export?fmt=xlsx&year=${year}&lang=${lang}`, `Accanto-Spese-${year}.xlsx`, t("downloading"))} className={BTN_SECONDARY}><Sheet className="h-5 w-5" /> {t("export_xlsx")}</button>
        </div>
      )}
    </CarePage>
  );
}
