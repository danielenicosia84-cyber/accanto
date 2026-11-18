import { Globe } from "lucide-react";
import { useLang } from "@/context/LanguageContext";

export const LangToggle = ({ className = "" }) => {
  const { lang, toggle } = useLang();
  return (
    <button
      data-testid="lang-toggle" onClick={toggle} aria-label="Lingua / Language"
      className={`flex items-center gap-1 min-h-[44px] rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 ${className}`}
    >
      <Globe className="h-4 w-4" /> {lang === "it" ? "IT · Italiano" : "EN · English"}
    </button>
  );
};
