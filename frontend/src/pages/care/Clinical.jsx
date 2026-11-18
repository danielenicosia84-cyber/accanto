import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useProfiles } from "@/context/ProfileContext";
import api, { errorMessage } from "@/lib/api";
import { INPUT, TEXTAREA, BTN_PRIMARY } from "@/lib/care";
import { CarePage, Field } from "@/components/care/CareShell";

const FIELDS = [
  ["birth_date", "clinical_birth", "date"], ["fiscal_code", "clinical_cf", "text"], ["blood_type", "clinical_blood", "select"],
  ["weight_kg", "clinical_weight", "number"], ["height_cm", "clinical_height", "number"],
  ["allergies", "clinical_allergies", "textarea"], ["conditions", "clinical_conditions", "textarea"],
  ["doctor_name", "clinical_doctor", "text"], ["doctor_phone", "clinical_doctor_phone", "tel"],
  ["exemption_codes", "clinical_exemptions", "text"], ["health_card_expiry", "clinical_card_expiry", "date"], ["address", "clinical_address", "text"],
  ["habits", "clinical_habits", "textarea"], ["notes", "clinical_notes", "textarea"],
];
const BLOOD = ["", "0+", "0-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

const ContactsEditor = ({ contacts, onChange, t }) => {
  const update = (i, k, v) => onChange(contacts.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  return (
    <div className="space-y-2" data-testid="clinical-contacts">
      <span className="block text-sm font-semibold text-slate-700">{t("clinical_contacts")}</span>
      {contacts.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <input data-testid={`contact-name-${i}`} placeholder={t("clinical_contact_name")} className="h-11 min-w-0 rounded-lg border border-slate-200 px-2 text-sm" value={c.name || ""} onChange={(e) => update(i, "name", e.target.value)} />
          <input data-testid={`contact-relation-${i}`} placeholder={t("clinical_contact_relation")} className="h-11 min-w-0 rounded-lg border border-slate-200 px-2 text-sm" value={c.relation || ""} onChange={(e) => update(i, "relation", e.target.value)} />
          <input data-testid={`contact-phone-${i}`} placeholder={t("clinical_contact_phone")} type="tel" className="h-11 min-w-0 rounded-lg border border-slate-200 px-2 text-sm" value={c.phone || ""} onChange={(e) => update(i, "phone", e.target.value)} />
          <button type="button" data-testid={`contact-remove-${i}`} onClick={() => onChange(contacts.filter((_, j) => j !== i))} aria-label={t("delete")} className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" data-testid="contact-add" onClick={() => onChange([...contacts, { name: "", relation: "", phone: "" }])} className="flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[#2D6A4F] hover:underline"><Plus className="h-4 w-4" /> {t("clinical_add_contact")}</button>
    </div>
  );
};

export default function Clinical() {
  const { t } = useLang();
  const { activeProfile, refresh } = useProfiles();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!activeProfile) return;
    setForm({ ...Object.fromEntries(FIELDS.map(([k]) => [k, activeProfile[k] ?? ""])), emergency_contacts: activeProfile.emergency_contacts || [] });
  }, [activeProfile]);

  if (!form) return <CarePage title={t("clinical_title")} testId="clinical-page"><Loader2 className="h-6 w-6 animate-spin text-[#2D6A4F]" /></CarePage>;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form, weight_kg: form.weight_kg === "" ? null : Number(form.weight_kg), height_cm: form.height_cm === "" ? null : Number(form.height_cm), emergency_contacts: form.emergency_contacts.filter((c) => c.name || c.phone) };
      Object.keys(body).forEach((k) => { if (body[k] === null) delete body[k]; });
      await api.put(`/profiles/${activeProfile.id}`, body);
      await refresh();
      toast.success(t("clinical_saved"));
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <CarePage title={t("clinical_title")} subtitle={t("clinical_sub")} testId="clinical-page">
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" data-testid="clinical-form">
        {FIELDS.map(([k, label, type]) => (
          <Field key={k} label={t(label)}>
            {type === "textarea" ? <textarea data-testid={`clinical-${k}`} className={TEXTAREA} value={form[k]} onChange={set(k)} />
              : type === "select" ? <select data-testid={`clinical-${k}`} className={INPUT} value={form[k]} onChange={set(k)}>{BLOOD.map((b) => <option key={b} value={b}>{b || "—"}</option>)}</select>
                : <input data-testid={`clinical-${k}`} type={type} step={type === "number" ? "0.1" : undefined} className={INPUT} value={form[k]} onChange={set(k)} />}
          </Field>
        ))}
        <ContactsEditor contacts={form.emergency_contacts} onChange={(c) => setForm((f) => ({ ...f, emergency_contacts: c }))} t={t} />
        <button data-testid="clinical-save" type="submit" disabled={busy} className={`${BTN_PRIMARY} w-full`}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("save")}</button>
      </form>
    </CarePage>
  );
}
