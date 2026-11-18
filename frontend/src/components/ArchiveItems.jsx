import { FileText } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { formatDate, catStyle, CATEGORY_STYLES } from "@/lib/format";

export const CATEGORIES = ["all", ...Object.keys(CATEGORY_STYLES)];

export const filterDocuments = (docs, q, cat) => {
  const needle = q.trim().toLowerCase();
  return docs.filter((d) => {
    if (cat !== "all" && d.category !== cat) return false;
    if (!needle) return true;
    return d.title.toLowerCase().includes(needle) || (d.summary || "").toLowerCase().includes(needle);
  });
};

export const CategoryFilters = ({ value, onChange }) => {
  const { t } = useLang();
  return (
    <div className="scrollbar-hide scroll-fade -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {CATEGORIES.map((c) => (
        <button key={c} onClick={() => onChange(c)} data-testid={`filter-${c}`}
          className={`min-h-[44px] whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${value === c ? "bg-[#2D6A4F] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
          {c === "all" ? t("all") : c}
        </button>
      ))}
    </div>
  );
};

export const ArchiveItem = ({ d, onOpen }) => {
  const { lang } = useLang();
  const cs = catStyle(d.category);
  return (
    <button data-testid={`archive-doc-${d.id}`} onClick={() => onOpen(d.id)}
      className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50">
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2D6A4F]"><FileText className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-semibold leading-snug text-slate-900">{d.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span>{formatDate(d.created_at, lang)}</span>
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: cs.bg, color: cs.text }}>{d.category}</span>
        </p>
        {d.summary && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{d.summary}</p>}
      </div>
    </button>
  );
};
