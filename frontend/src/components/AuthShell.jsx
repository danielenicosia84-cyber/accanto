import { useLang } from "@/context/LanguageContext";
import { LangToggle } from "@/components/LangToggle";

export const AuthShell = ({ title, subtitle, children, footer }) => {
  const { t } = useLang();
  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#FDFBF7] px-5 py-10">
      <div className="mx-auto w-full max-w-md animate-fade-up">
        <div className="mb-4 flex justify-end"><LangToggle /></div>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-3xl shadow-lg">
            <img src="/logo.png" alt="Accanto" className="h-full w-full object-cover" />
          </div>
          <span className="mb-3 inline-block rounded-full bg-[#E8F5E9] px-3 py-1 text-sm font-semibold text-[#2D6A4F]">{t("payoff")}</span>
          <h1 className="font-heading text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-base text-slate-600">{subtitle}</p>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
};

export const AuthField = ({ label, children }) => (
  <div>
    <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
    {children}
  </div>
);

export const authInputClass = "h-[52px] w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition-colors focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]";
