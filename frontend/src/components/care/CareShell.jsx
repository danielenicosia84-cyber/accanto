import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Eye } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useBilling } from "@/context/BillingContext";
import { useProfiles } from "@/context/ProfileContext";
import { Onboarding } from "@/components/Onboarding";
import { BTN_PRIMARY } from "@/lib/care";

export const useFeature = (key) => {
  const { billing } = useBilling();
  if (!key) return true;
  return Boolean(billing?.features?.includes(key));
};

export const Field = ({ label, children, testId }) => (
  <label className="block" data-testid={testId}>
    <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
    {children}
  </label>
);

export const FeatureLocked = ({ kit }) => {
  const { t } = useLang();
  const navigate = useNavigate();
  return (
    <div data-testid="feature-locked" className="animate-fade-up rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] p-5 text-center">
      <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#D97706]"><Lock className="h-7 w-7" /></span>
      <p className="font-semibold text-[#92400E]">{kit ? t("care_locked_kit") : t("care_locked")}</p>
      <button data-testid="feature-locked-upgrade" onClick={() => navigate("/pricing")} className={`${BTN_PRIMARY} mx-auto mt-4 w-full max-w-xs`}>{t("care_upgrade")}</button>
    </div>
  );
};

export const DemoNote = () => {
  const { t } = useLang();
  const { user } = useAuth();
  if (!user?.is_demo) return null;
  return <p data-testid="care-demo-note" className="flex items-center gap-2 rounded-xl bg-[#F7F5F0] p-3 text-sm text-slate-600"><Eye className="h-4 w-4 flex-shrink-0" /> {t("care_demo_readonly")}</p>;
};

export const CarePage = ({ title, subtitle, feature, kit, children, testId, back = "/care" }) => {
  const { t } = useLang();
  const navigate = useNavigate();
  const { activeProfile, loading } = useProfiles();
  const allowed = useFeature(feature);
  const { billing } = useBilling();

  if (!loading && !activeProfile) return <Onboarding />;

  return (
    <div className="animate-fade-up space-y-5" data-testid={testId}>
      <button onClick={() => navigate(back)} className="-ml-2 flex min-h-[44px] items-center gap-1 px-2 text-sm font-semibold text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> {back === "/care" ? t("nav_care") : t("go_home")}</button>
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">{title}</h1>
        {activeProfile && <p className="text-sm font-semibold text-[#2D6A4F]">{activeProfile.name}</p>}
        {subtitle && <p className="mt-1 text-base text-slate-600">{subtitle}</p>}
      </div>
      <DemoNote />
      {billing && !allowed ? <FeatureLocked kit={kit} /> : children}
    </div>
  );
};
