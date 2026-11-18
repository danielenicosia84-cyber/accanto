import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pill, Activity, Receipt, FileHeart, Languages, GitCompareArrows, Landmark, ClipboardList, Lock, ChevronRight } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { useProfiles } from "@/context/ProfileContext";
import { useBilling } from "@/context/BillingContext";
import api from "@/lib/api";
import { log } from "@/lib/log";
import { eur } from "@/lib/care";
import { Onboarding } from "@/components/Onboarding";
import { DemoNote } from "@/components/care/CareShell";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

const TILES = [
  { to: "/care/therapy", icon: Pill, title: "care_therapy", sub: "care_therapy_sub", color: "#2D6A4F", bg: "#E8F5E9", feature: null, stat: (o, t) => o && `${o.medications} ${t("care_n_meds")}` },
  { to: "/care/vitals", icon: Activity, title: "care_vitals", sub: "care_vitals_sub", color: "#C85F46", bg: "#FDF0ED", feature: "vitals", stat: (o, t) => o?.last_vital && `${t("care_last")}: ${o.last_vital.value} ${o.last_vital.unit}` },
  { to: "/care/expenses", icon: Receipt, title: "care_expenses", sub: "care_expenses_sub", color: "#D97706", bg: "#FEF3C7", feature: "expenses_730", stat: (o, t) => o && `${o.expenses_year}: ${eur(o.expenses_total)}` },
  { to: "/care/dossier", icon: FileHeart, title: "care_dossier", sub: "care_dossier_sub", color: "#1E40AF", bg: "#EFF6FF", feature: "dossier", stat: (o, t) => o && `${o.emergency_contacts} ${t("clinical_contacts").toLowerCase()}` },
  { to: "/care/kit", icon: Languages, title: "care_kit", sub: "care_kit_sub", color: "#7C3AED", bg: "#F3E8FF", feature: "caregiver_kit", kit: true },
  { to: "/care/compare", icon: GitCompareArrows, title: "care_compare", sub: "care_compare_sub", color: "#0F766E", bg: "#CCFBF1", feature: "history_compare", stat: (o, t) => o && `${o.documents} ${t("care_docs_in_archive")}` },
  { to: "/care/bureaucracy", icon: Landmark, title: "care_bureaucracy", sub: "care_bureaucracy_sub", color: "#475569", bg: "#F1F5F9", feature: null },
  { to: "/care/clinical", icon: ClipboardList, title: "care_clinical", sub: "care_clinical_sub", color: "#BE185D", bg: "#FCE7F3", feature: null, stat: (o, t) => o && `${t("care_completeness")} ${o.clinical_completeness}%` },
];

const Tile = ({ tile, overview, allowed }) => {
  const { t } = useLang();
  const navigate = useNavigate();
  const Icon = tile.icon;
  const stat = tile.stat?.(overview, t);
  const slug = tile.to.split("/").pop();
  return (
    <button data-testid={`care-tile-${slug}`} onClick={() => navigate(allowed ? tile.to : "/pricing")}
      className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50">
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: tile.bg, color: tile.color }}><Icon className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-heading text-base font-bold text-slate-900">{t(tile.title)}{!allowed && <Lock className="h-4 w-4 text-[#D97706]" />}</span>
        <span className="block text-sm text-slate-500">{allowed && stat ? stat : t(tile.sub)}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-1" />
    </button>
  );
};

export default function Care() {
  const { t } = useLang();
  const { activeProfile, activeId, loading } = useProfiles();
  const { billing } = useBilling();
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    if (!activeId) return;
    api.get("/care/overview", { params: { profile_id: activeId } }).then((r) => setOverview(r.data)).catch((e) => log.warn("overview", e));
  }, [activeId]);

  if (!loading && !activeProfile) return <Onboarding />;
  const features = billing?.features || [];

  return (
    <div className="animate-fade-up space-y-5" data-testid="care-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">{t("care_title")}</h1>
        <p className="mt-1 text-base text-slate-600">{t("care_sub")}</p>
      </div>
      <DemoNote />
      <div className="space-y-3">
        {TILES.map((tile) => <Tile key={tile.to} tile={tile} overview={overview} allowed={!tile.feature || !billing || features.includes(tile.feature)} />)}
      </div>
      <DisclaimerBanner compact />
    </div>
  );
}
