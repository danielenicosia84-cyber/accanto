import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";
import { useLang } from "@/context/LanguageContext";

export default function NotFound() {
  const { t } = useLang();
  return (
    <div className="flex min-h-[60vh] animate-fade-up flex-col items-center justify-center text-center" data-testid="not-found-page">
      <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#F7F5F0] text-[#2D6A4F]"><SearchX className="h-10 w-10" /></span>
      <h1 className="font-heading text-2xl font-bold text-slate-900">{t("not_found_title")}</h1>
      <p className="mt-2 max-w-sm text-base text-slate-600">{t("not_found_sub")}</p>
      <Link to="/" data-testid="not-found-home" className="mt-6 flex min-h-[52px] w-full max-w-xs items-center justify-center rounded-2xl bg-[#2D6A4F] font-semibold text-white hover:bg-[#1B4332]">{t("go_home")}</Link>
    </div>
  );
}
