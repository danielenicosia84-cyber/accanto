import { FileHeart, FileDown, Check } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { useProfiles } from "@/context/ProfileContext";
import { BTN_PRIMARY, BTN_SECONDARY, download } from "@/lib/care";
import { CarePage } from "@/components/care/CareShell";
import { useNavigate } from "react-router-dom";

const ITEMS_IT = ["Dati anagrafici, codice fiscale e gruppo sanguigno", "Allergie e condizioni di salute", "Medico curante e contatti di emergenza", "Terapia in corso (tabella farmaci)", "Ultimi parametri misurati", "Documenti recenti e prossimi controlli"];
const ITEMS_EN = ["Personal data, fiscal code and blood type", "Allergies and health conditions", "Family doctor and emergency contacts", "Current therapy (medicine table)", "Latest measured vitals", "Recent documents and upcoming checks"];

export default function Dossier() {
  const { t, lang } = useLang();
  const { activeId, activeProfile } = useProfiles();
  const navigate = useNavigate();
  const items = lang === "it" ? ITEMS_IT : ITEMS_EN;
  return (
    <CarePage title={t("dossier_title")} subtitle={t("dossier_sub")} feature="dossier" testId="dossier-page">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#1E40AF]"><FileHeart className="h-7 w-7" /></span>
        <p className="font-heading text-base font-bold text-slate-900">{t("dossier_includes")}</p>
        <ul className="mt-2 space-y-2">{items.map((x) => <li key={x} className="flex items-start gap-2 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#2D6A4F]" /> {x}</li>)}</ul>
      </div>
      <button data-testid="dossier-download" onClick={() => download(`/profiles/${activeId}/dossier/pdf?lang=${lang}`, `Accanto-Dossier-${activeProfile?.name || ""}.pdf`, t("downloading"))} className={`${BTN_PRIMARY} w-full`}><FileDown className="h-5 w-5" /> {t("dossier_download")}</button>
      <button data-testid="dossier-clinical-link" onClick={() => navigate("/care/clinical")} className={`${BTN_SECONDARY} w-full`}>{t("care_clinical")}</button>
      <p className="text-sm text-slate-500">{t("dossier_tip")}</p>
    </CarePage>
  );
}
