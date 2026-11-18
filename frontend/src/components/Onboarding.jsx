import { useNavigate } from "react-router-dom";
import { UserPlus, UploadCloud, Sparkles, ArrowRight } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

const steps = [
  { icon: UserPlus, t: "onboarding_s1_t", d: "onboarding_s1_d" },
  { icon: UploadCloud, t: "onboarding_s2_t", d: "onboarding_s2_d" },
  { icon: Sparkles, t: "onboarding_s3_t", d: "onboarding_s3_d" },
];

export function Onboarding() {
  const { t } = useLang();
  const navigate = useNavigate();

  return (
    <div className="animate-fade-up space-y-6" data-testid="onboarding">
      <div className="text-center">
        <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-3xl shadow-lg">
          <img src="/logo.png" alt="Accanto" className="h-full w-full object-cover" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">{t("onboarding_welcome")}</h1>
        <p className="mx-auto mt-2 max-w-sm text-base text-slate-600">{t("onboarding_sub")}</p>
      </div>

      <div className="space-y-3">
        {steps.map(({ icon: Icon, t: tk, d: dk }, i) => (
          <div key={tk} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#2D6A4F]">
              <Icon className="h-6 w-6" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2D6A4F] text-xs font-bold text-white">{i + 1}</span>
            </div>
            <div>
              <p className="font-heading font-bold text-slate-900">{t(tk)}</p>
              <p className="text-sm text-slate-600">{t(dk)}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        data-testid="onboarding-start-button"
        onClick={() => navigate("/profiles")}
        className="group flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2D6A4F] text-lg font-semibold text-white transition-colors hover:bg-[#1B4332]"
      >
        {t("onboarding_cta")} <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </button>

      <DisclaimerBanner compact />
    </div>
  );
}
