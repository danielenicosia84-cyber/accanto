import { AlertTriangle, Info } from "lucide-react";
import { useLang } from "@/context/LanguageContext";

const STYLES = {
  ai: { box: "border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]", Icon: AlertTriangle, key: "notice_ai" },
  reminders: { box: "border-slate-200 bg-[#F7F5F0] text-slate-600", Icon: Info, key: "notice_reminders" },
  consent: { box: "border-slate-200 bg-[#F7F5F0] text-slate-600", Icon: Info, key: "notice_consent" },
};

export const LegalNotice = ({ variant = "ai", className = "" }) => {
  const { t } = useLang();
  const { box, Icon, key } = STYLES[variant];
  return (
    <p data-testid={`legal-notice-${variant}`} className={`flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed sm:text-sm ${box} ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" /> <span>{t(key)}</span>
    </p>
  );
};
