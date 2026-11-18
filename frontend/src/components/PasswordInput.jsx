import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLang } from "@/context/LanguageContext";

export const PasswordInput = ({ value, onChange, minLength, autoComplete = "current-password", testId = "auth-password-input" }) => {
  const [show, setShow] = useState(false);
  const { t } = useLang();
  return (
    <div className="relative">
      <input
        data-testid={testId} type={show ? "text" : "password"} required minLength={minLength} value={value} onChange={onChange}
        autoComplete={autoComplete}
        className="h-[52px] w-full rounded-xl border border-slate-200 bg-white pl-4 pr-14 text-base text-slate-900 outline-none transition-colors focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]"
        placeholder="••••••••"
      />
      <button
        type="button" data-testid="toggle-password-visibility" onClick={() => setShow((s) => !s)}
        aria-label={show ? t("hide_password") : t("show_password")} title={show ? t("hide_password") : t("show_password")}
        className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#2D6A4F]"
      >
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
};
