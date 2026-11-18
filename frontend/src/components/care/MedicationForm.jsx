import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import api, { errorMessage } from "@/lib/api";
import { INPUT, TEXTAREA, BTN_PRIMARY, BTN_SECONDARY } from "@/lib/care";
import { Field } from "@/components/care/CareShell";

const EMPTY = { name: "", dosage: "", form: "", morning: "", noon: "", evening: "", night: "", food: "any", notes: "", prescribed_by: "", active: true };

const SlotInput = ({ label, value, onChange, testId }) => (
  <label className="block text-center">
    <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
    <input data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="—" inputMode="decimal"
      className="h-[52px] w-full rounded-xl border border-slate-200 bg-white text-center text-lg font-semibold outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]" />
  </label>
);

export const MedicationForm = ({ profileId, initial, onSaved, onCancel }) => {
  const { t } = useLang();
  const [m, setM] = useState({ ...EMPTY, ...(initial || {}) });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setM((x) => ({ ...x, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name: m.name, dosage: m.dosage, form: m.form, morning: m.morning, noon: m.noon, evening: m.evening, night: m.night, food: m.food, notes: m.notes, prescribed_by: m.prescribed_by, active: m.active, start_date: m.start_date || null, end_date: m.end_date || null };
      const res = initial?.id ? await api.put(`/medications/${initial.id}`, body) : await api.post(`/profiles/${profileId}/medications`, body);
      toast.success(t("saved_ok"));
      onSaved(res.data);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} data-testid="medication-form" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Field label={t("med_name")}><input data-testid="med-name" required className={INPUT} value={m.name} onChange={(e) => set("name")(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("med_dosage")}><input data-testid="med-dosage" className={INPUT} value={m.dosage} onChange={(e) => set("dosage")(e.target.value)} /></Field>
        <Field label={t("med_form")}><input data-testid="med-form" className={INPUT} value={m.form} onChange={(e) => set("form")(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <SlotInput label={t("med_morning")} value={m.morning} onChange={set("morning")} testId="med-morning" />
        <SlotInput label={t("med_noon")} value={m.noon} onChange={set("noon")} testId="med-noon" />
        <SlotInput label={t("med_evening")} value={m.evening} onChange={set("evening")} testId="med-evening" />
        <SlotInput label={t("med_night")} value={m.night} onChange={set("night")} testId="med-night" />
      </div>
      <Field label={t("med_food")}>
        <select data-testid="med-food" className={INPUT} value={m.food} onChange={(e) => set("food")(e.target.value)}>
          <option value="any">{t("med_food_any")}</option>
          <option value="before">{t("med_food_before")}</option>
          <option value="after">{t("med_food_after")}</option>
        </select>
      </Field>
      <Field label={t("med_notes")}><textarea data-testid="med-notes" className={TEXTAREA} value={m.notes} onChange={(e) => set("notes")(e.target.value)} /></Field>
      <Field label={t("med_prescribed")}><input data-testid="med-prescribed" className={INPUT} value={m.prescribed_by} onChange={(e) => set("prescribed_by")(e.target.value)} /></Field>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input data-testid="med-active" type="checkbox" checked={m.active} onChange={(e) => set("active")(e.target.checked)} className="h-5 w-5 accent-[#2D6A4F]" /> {t("med_active")}</label>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className={`${BTN_SECONDARY} flex-1`}>{t("cancel")}</button>
        <button data-testid="med-save" type="submit" disabled={busy} className={`${BTN_PRIMARY} flex-1`}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("save")}</button>
      </div>
    </form>
  );
};
