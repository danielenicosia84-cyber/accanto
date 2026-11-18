import { useEffect, useState, useCallback, useMemo } from "react";
import { Activity, Plus, Trash2, FileDown, Sheet } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useProfiles } from "@/context/ProfileContext";
import api, { errorMessage } from "@/lib/api";
import { BTN_PRIMARY, BTN_SECONDARY, VITAL_TYPES, vitalValue, download } from "@/lib/care";
import { CarePage } from "@/components/care/CareShell";
import { VitalForm, Sparkline } from "@/components/care/VitalForm";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { EmptyState } from "@/components/EmptyState";

const fmt = (iso, lang) => new Date(iso).toLocaleString(lang === "it" ? "it-IT" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const VitalRow = ({ v, onDelete, lang, t }) => {
  const meta = VITAL_TYPES[v.type] || {};
  return (
    <div data-testid={`vital-row-${v.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <span className="h-10 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{t(`vital_${v.type}`)} <span className="text-lg font-bold">{vitalValue(v)}</span> <span className="text-sm text-slate-500">{meta.unit}</span></p>
        <p className="text-xs text-slate-500">{fmt(v.measured_at, lang)}{v.notes ? ` · ${v.notes}` : ""}</p>
      </div>
      <ConfirmDeleteDialog title={t("delete")} description="" onConfirm={() => onDelete(v.id)} confirmTestId={`confirm-delete-vital-${v.id}`}>
        <button data-testid={`vital-delete-${v.id}`} aria-label={t("delete")} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
      </ConfirmDeleteDialog>
    </div>
  );
};

export default function Vitals() {
  const { t, lang } = useLang();
  const { activeId } = useProfiles();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("pressure");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) return;
    try { setRows((await api.get(`/profiles/${activeId}/vitals`)).data); } catch (err) { if (err?.response?.status !== 402) toast.error(errorMessage(err)); }
  }, [activeId]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (filter === "all" ? rows : rows.filter((r) => r.type === filter)), [rows, filter]);
  const trend = useMemo(() => (filter === "all" ? [] : shown.slice(0, 14).reverse().map((r) => r.value)), [shown, filter]);

  const del = async (id) => {
    try { await api.delete(`/vitals/${id}`); setRows((x) => x.filter((r) => r.id !== id)); } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <CarePage title={t("vitals_title")} subtitle={t("vitals_sub")} feature="vitals" testId="vitals-page">
      {adding ? (
        <VitalForm profileId={activeId} defaultType={filter === "all" ? "pressure" : filter} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />
      ) : (
        <button data-testid="vitals-add" onClick={() => setAdding(true)} className={`${BTN_PRIMARY} w-full`}><Plus className="h-5 w-5" /> {t("vitals_add")}</button>
      )}
      <div className="scrollbar-hide scroll-fade flex gap-2 overflow-x-auto pb-1" data-testid="vitals-filters">
        {["all", ...Object.keys(VITAL_TYPES)].map((k) => (
          <button key={k} data-testid={`vitals-filter-${k}`} onClick={() => setFilter(k)} className={`min-h-[44px] flex-shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${filter === k ? "border-[#2D6A4F] bg-[#2D6A4F] text-white" : "border-slate-200 bg-white text-slate-600"}`}>
            {k === "all" ? t("vitals_all") : t(`vital_${k}`)}
          </button>
        ))}
      </div>
      {trend.length > 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-sm font-semibold text-slate-600">{t("vitals_trend")} · {t(`vital_${filter}`)}{VITAL_TYPES[filter]?.two ? ` (${t("vital_sys")})` : ""}</p>
          <Sparkline points={trend} color={VITAL_TYPES[filter]?.color} />
        </div>
      )}
      {shown.length === 0 && !adding && <EmptyState icon={Activity} text={t("vitals_empty")} testId="vitals-empty" />}
      <div className="space-y-2">{shown.slice(0, 60).map((v) => <VitalRow key={v.id} v={v} onDelete={del} lang={lang} t={t} />)}</div>
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <button data-testid="vitals-pdf" onClick={() => download(`/profiles/${activeId}/vitals/export?fmt=pdf&lang=${lang}`, "Accanto-Parametri.pdf", t("downloading"))} className={BTN_SECONDARY}><FileDown className="h-5 w-5" /> {t("export_pdf")}</button>
          <button data-testid="vitals-xlsx" onClick={() => download(`/profiles/${activeId}/vitals/export?fmt=xlsx&lang=${lang}`, "Accanto-Parametri.xlsx", t("downloading"))} className={BTN_SECONDARY}><Sheet className="h-5 w-5" /> {t("export_xlsx")}</button>
        </div>
      )}
    </CarePage>
  );
}
