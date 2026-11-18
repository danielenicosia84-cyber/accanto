import { useEffect, useState, useCallback } from "react";
import { Pill, Plus, Pencil, Trash2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useProfiles } from "@/context/ProfileContext";
import api, { errorMessage } from "@/lib/api";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, KIT_LANGS, download } from "@/lib/care";
import { CarePage, useFeature } from "@/components/care/CareShell";
import { MedicationForm } from "@/components/care/MedicationForm";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { EmptyState } from "@/components/EmptyState";
import { LegalNotice } from "@/components/LegalNotice";

const Slot = ({ label, value }) => (
  <div className={`flex flex-col items-center rounded-xl px-2 py-1.5 ${value ? "bg-[#E8F5E9] text-[#1B4332]" : "bg-slate-50 text-slate-300"}`}>
    <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
    <span className="text-base font-bold">{value || "—"}</span>
  </div>
);

const MedicationCard = ({ m, onEdit, onDelete }) => {
  const { t } = useLang();
  return (
    <div data-testid={`med-card-${m.id}`} className={`rounded-2xl border bg-white p-4 ${m.active === false ? "border-slate-200 opacity-60" : "border-slate-200"}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2D6A4F]"><Pill className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-base font-bold text-slate-900">{m.name} <span className="font-sans text-sm font-semibold text-slate-500">{m.dosage}</span></p>
          <p className="text-sm text-slate-500">{[m.form, t(`med_food_${m.food || "any"}`), m.active === false ? t("med_suspended") : ""].filter(Boolean).join(" · ")}</p>
        </div>
        <button data-testid={`med-edit-${m.id}`} onClick={() => onEdit(m)} aria-label={t("edit")} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
        <ConfirmDeleteDialog title={t("med_delete_title")} description={t("med_delete_desc")} onConfirm={() => onDelete(m.id)} confirmTestId={`confirm-delete-med-${m.id}`}>
          <button data-testid={`med-delete-${m.id}`} aria-label={t("delete")} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
        </ConfirmDeleteDialog>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <Slot label={t("med_morning")} value={m.morning} /><Slot label={t("med_noon")} value={m.noon} /><Slot label={t("med_evening")} value={m.evening} /><Slot label={t("med_night")} value={m.night} />
      </div>
      {m.notes && <p className="mt-2 text-sm text-slate-600">{m.notes}</p>}
    </div>
  );
};

export default function Therapy() {
  const { t } = useLang();
  const { activeId } = useProfiles();
  const canPdf = useFeature("fridge_table");
  const [meds, setMeds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [lang2, setLang2] = useState("en");

  const load = useCallback(async () => {
    if (!activeId) return;
    try { setMeds((await api.get(`/profiles/${activeId}/medications`)).data); } catch (err) { toast.error(errorMessage(err)); }
  }, [activeId]);
  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    try { await api.delete(`/medications/${id}`); setMeds((x) => x.filter((m) => m.id !== id)); toast.success(t("deleted_ok")); } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <CarePage title={t("therapy_title")} subtitle={t("therapy_sub")} testId="therapy-page">
      <LegalNotice variant="reminders" />
      {editing !== null ? (
        <MedicationForm profileId={activeId} initial={editing || undefined} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      ) : (
        <button data-testid="therapy-add" onClick={() => setEditing(false)} className={`${BTN_PRIMARY} w-full`}><Plus className="h-5 w-5" /> {t("therapy_add")}</button>
      )}
      {meds.length === 0 && editing === null && <EmptyState icon={Pill} text={t("therapy_empty")} testId="therapy-empty" />}
      <div className="space-y-3">{meds.map((m) => <MedicationCard key={m.id} m={m} onEdit={setEditing} onDelete={del} />)}</div>
      {meds.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-[#E8F5E9] bg-[#E8F5E9]/40 p-4">
          <p className="font-heading text-base font-bold text-[#1B4332]">{t("therapy_pdf")}</p>
          <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">{t("therapy_pdf_lang")}</span>
            <select data-testid="therapy-pdf-lang" className={INPUT} value={lang2} onChange={(e) => setLang2(e.target.value)}>{Object.entries(KIT_LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
          <button data-testid="therapy-pdf" onClick={() => (canPdf ? download(`/profiles/${activeId}/medications/pdf?lang2=${lang2}`, "Accanto-Farmaci.pdf", t("downloading")) : toast.error(t("care_locked")))} className={`${BTN_SECONDARY} w-full`}><FileDown className="h-5 w-5" /> {t("export_pdf")}</button>
        </div>
      )}
    </CarePage>
  );
}
