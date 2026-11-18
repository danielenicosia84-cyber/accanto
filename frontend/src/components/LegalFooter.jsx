import { Link } from "react-router-dom";
import { useLang } from "@/context/LanguageContext";

export const LegalFooter = ({ className = "" }) => {
  const { t } = useLang();
  const cls = "flex min-h-[44px] items-center px-1 font-semibold text-slate-500 underline-offset-2 hover:text-[#2D6A4F] hover:underline";
  return (
    <footer data-testid="legal-footer" className={`flex flex-wrap items-center justify-center gap-x-3 py-2 text-xs text-slate-400 ${className}`}>
      <Link to="/privacy" data-testid="footer-privacy" className={cls}>{t("legal_privacy")}</Link>
      <Link to="/terms" data-testid="footer-terms" className={cls}>{t("legal_terms")}</Link>
      <Link to="/disclaimer" data-testid="footer-disclaimer" className={cls}>{t("legal_disclaimer")}</Link>
    </footer>
  );
};
