import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import api, { errorMessage } from "@/lib/api";
import { INPUT, BTN_PRIMARY, BTN_SECONDARY, EXPENSE_CATEGORIES, todayInput } from "@/lib/care";
import { Field } from "@/components/care/CareShell";

const EMPTY = { date: todayInput(), description: "", category: "ticket", amount: "", traceable: true, deductible: true, notes: "" };

export const ExpenseForm = ({ profileId, initial, onSaved, onCancel }) => {
  const { t } = useLang();
  const [e, setE] = useState({ ...EMPTY, ...(initial || {}) });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setE((x) => ({ ...x, [k]: v }));

  const submit = async (ev) => {
    ev.preventDefault();
    setBusy(true);
    try {
      const body = { date: e.date, description: e.description, category: e.category, amount: Number(String(e.amount).replace(",", ".")), traceable: e.traceable, deductible: e.deductible, notes: e.notes || "", document_id: e.document_id || null };
      const res = initial?.id ? await api.put(`/expenses/${initial.id}`, body) : await api.post(`/profiles/${profileId}/expenses`, body);
      toast.success(t("saved_ok"));
      onSaved(res.data);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} data-testid="expense-form" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("exp_date")}><input data-testid="exp-date" type="date" required className={INPUT} value={e.date} onChange={(ev) => set("date")(ev.target.value)} /></Field>
        <Field label={t("exp_amount")}><input data-testid="exp-amount" required type="number" step="0.01" min="0.01" inputMode="decimal" className={`${INPUT} text-xl font-bold`} value={e.amount} onChange={(ev) => set("amount")(ev.target.value)} /></Field>
      </div>
      <Field label={t("exp_desc")}><input data-testid="exp-desc" required className={INPUT} value={e.description} onChange={(ev) => set("description")(ev.target.value)} /></Field>
      <Field label={t("exp_category")}>
        <select data-testid="exp-category" className={INPUT} value={e.category} onChange={(ev) => set("category")(ev.target.value)}>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}`)}</option>)}
        </select>
      </Field>
      <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700"><input data-testid="exp-traceable" type="checkbox" checked={e.traceable} onChange={(ev) => set("traceable")(ev.target.checked)} className="h-5 w-5 accent-[#2D6A4F]" /> {t("exp_traceable")}</label>
      <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700"><input data-testid="exp-deductible" type="checkbox" checked={e.deductible} onChange={(ev) => set("deductible")(ev.target.checked)} className="h-5 w-5 accent-[#2D6A4F]" /> {t("exp_deductible")}</label>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className={`${BTN_SECONDARY} flex-1`}>{t("cancel")}</button>
        <button data-testid="exp-save" type="submit" disabled={busy} className={`${BTN_PRIMARY} flex-1`}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("save")}</button>
      </div>
    </form>
  );
};
