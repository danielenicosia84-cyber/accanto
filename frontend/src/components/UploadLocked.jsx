import { Lock, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLang } from "@/context/LanguageContext";
import { useBilling } from "@/context/BillingContext";

export const UploadLocked = () => {
  const { t } = useLang();
  const { billing } = useBilling();
  const navigate = useNavigate();
  const demo = billing.status === "demo";
  const title = demo ? t("upload_locked_demo") : billing.status === "expired" ? t("upload_locked_expired") : t("upload_locked_limit");
  return (
    <div data-testid="upload-locked" className="animate-fade-up rounded-3xl border border-slate-200 bg-white p-8 text-center">
      <span className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${demo ? "bg-[#E8F0FE] text-[#1E40AF]" : "bg-[#FDF0ED] text-[#C85F46]"}`}>
        {demo ? <Eye className="h-8 w-8" /> : <Lock className="h-8 w-8" />}
      </span>
      <h2 className="font-heading text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-base text-slate-600">{demo ? t("upload_locked_demo_sub") : t("upload_locked_sub")}</p>
      <button data-testid="upload-locked-cta" onClick={() => navigate(demo ? "/register" : "/pricing")}
        className="mt-6 min-h-[52px] w-full rounded-2xl bg-[#2D6A4F] font-semibold text-white hover:bg-[#1B4332]">
        {demo ? t("register_cta") : t("choose_plan_cta")}
      </button>
    </div>
  );
};
