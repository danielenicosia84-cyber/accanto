import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { errorMessage } from "@/lib/api";
import { PasswordInput } from "@/components/PasswordInput";
import { LegalFooter } from "@/components/LegalFooter";
import { AuthShell, AuthField, authInputClass } from "@/components/AuthShell";

const DEMO = { email: "demo@dopo.app", password: "demo1234" };

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async (mail, pass) => {
    setError("");
    setLoading(true);
    try {
      await login(mail, pass);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submit = (e) => { e.preventDefault(); doLogin(email, password); };
  const fillDemo = () => { setEmail(DEMO.email); setPassword(DEMO.password); doLogin(DEMO.email, DEMO.password); };

  const footer = (
    <>
      <p className="mt-6 text-center text-base text-slate-600">
        {t("no_account")}{" "}
        <Link to="/register" data-testid="go-register" className="font-semibold text-[#2D6A4F] hover:underline">{t("register")}</Link>
      </p>
      <LegalFooter />
    </>
  );

  return (
    <AuthShell title={t("login_title")} subtitle={t("login_sub")} footer={footer}>
      <form onSubmit={submit} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <AuthField label={t("email")}>
          <input data-testid="auth-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={authInputClass} placeholder="nome@email.com" />
        </AuthField>
        <AuthField label={t("password")}>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
        </AuthField>
        {error && <p data-testid="auth-error" className="rounded-xl bg-[#FFF5F5] px-4 py-3 text-sm font-medium text-[#C53030]">{error}</p>}
        <button
          data-testid="auth-submit-button" type="submit" disabled={loading}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2D6A4F] text-lg font-semibold text-white transition-colors hover:bg-[#1B4332] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("login")}
        </button>
        <button type="button" onClick={fillDemo} data-testid="use-demo-button" className="min-h-[44px] w-full text-center text-sm font-semibold text-[#D97706] hover:underline">
          {t("use_demo")}
        </button>
      </form>
    </AuthShell>
  );
}
