import { useLang } from "@/context/LanguageContext";
import { ShieldAlert } from "lucide-react";

export function DisclaimerBanner({ compact = false }) {
  const { t } = useLang();
  return (
    <div
      data-testid="medical-disclaimer-banner"
      className={`flex items-start gap-3 rounded-2xl border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] ${compact ? "p-3" : "p-4"}`}
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <p className="text-sm leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
