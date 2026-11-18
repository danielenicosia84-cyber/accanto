import { Link, useLocation } from "react-router-dom";
import { Clock, Lock, Eye } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { useBilling } from "@/context/BillingContext";

const STYLES = {
  trial: { wrap: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]", Icon: Clock },
  expired: { wrap: "bg-[#FDF0ED] text-[#C85F46] border-[#F5CBC0]", Icon: Lock },
  demo: { wrap: "bg-[#E8F0FE] text-[#1E40AF] border-[#C7D7FD]", Icon: Eye },
};

export const TrialBanner = () => {
  const { t } = useLang();
  const { billing } = useBilling();
  const { pathname } = useLocation();
  if (!billing || pathname.startsWith("/pricing") || pathname.startsWith("/payment") || pathname.startsWith("/checkout") || pathname.startsWith("/admin")) return null;

  let kind = null;
  let text = "";
  if (billing.status === "demo") { kind = "demo"; text = t("demo_banner"); }
  else if (billing.status === "expired") { kind = "expired"; text = t("trial_expired_banner"); }
  else if (billing.status === "trial" && billing.trial_days_left <= 3) {
    kind = "trial";
    text = billing.trial_days_left <= 1 ? t("trial_banner_today") : t("trial_banner").replace("{n}", billing.trial_days_left);
  }
  if (!kind) return null;

  const { wrap, Icon } = STYLES[kind];
  const cta = kind === "demo" ? { to: "/register", label: t("register_cta") } : { to: "/pricing", label: t("choose_plan_cta") };
  return (
    <div data-testid={`banner-${kind}`} className={`border-b ${wrap}`}>
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2.5 text-sm font-medium">
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 leading-snug">{text}</span>
        <Link to={cta.to} data-testid={`banner-${kind}-cta`} className="flex min-h-[40px] items-center whitespace-nowrap rounded-full bg-white/80 px-3 text-xs font-bold shadow-sm transition-colors hover:bg-white">
          {cta.label}
        </Link>
      </div>
    </div>
  );
};
