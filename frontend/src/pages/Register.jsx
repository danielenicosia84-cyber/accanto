import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { errorMessage } from "@/lib/api";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { PasswordInput } from "@/components/PasswordInput";
import { AuthShell, AuthField, authInputClass } from "@/components/AuthShell";
import { LegalFooter } from "@/components/LegalFooter";

const QUESTIONS = [
  "Qual è il nome del tuo primo animale domestico?",
  "In quale città sei nato o cresciuto?",
  "Qual è il nome della tua scuola elementare?",
  "Qual è il tuo piatto o dolce preferito?",
  "Qual è il nome del tuo migliore amico d'infanzia?",
];

const LegalLink = ({ to, children, testId }) => (
  <Link to={to} target="_blank" rel="noreferrer" data-testid={testId} onClick={(e) => e.stopPropagation()} className="font-semibold text-[#2D6A4F] underline underline-offset-2">{children}</Link>
);

const ConsentBox = ({ checked, onChange, testId, children }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#F7F9F8] p-3">
    <input data-testid={testId} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[#2D6A4F]" />
    <span className="text-sm leading-relaxed text-slate-600">{children}</span>
  </label>
);

export default function Register() {
  const { register } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    security_question: QUESTIONS[0],
    security_answer: "",
  });
  const [consents, setConsents] = useState({ terms: false, health: false, disclaimer: false });
  const setC = (k) => (v) => setConsents((c) => ({ ...c, [k]: v }));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!consents.terms || !consents.health || !consents.disclaimer) {
      setError(t("consents_required"));
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, consents, {
        security_question: form.security_question,
        security_answer: form.security_answer,
      });
      navigate("/profiles");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      <div className="mt-4"><DisclaimerBanner compact /></div>
      <p className="mt-5 text-center text-base text-slate-600">
        {t("have_account")}{" "}
        <Link to="/login" data-testid="go-login" className="font-semibold text-[#2D6A4F] hover:underline">{t("login")}</Link>
      </p>
      <LegalFooter />
    </>
  );

  return (
    <AuthShell title={t("register_title")} subtitle={t("register_sub")} footer={footer}>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <AuthField label={t("name")}>
          <input data-testid="register-name-input" type="text" required value={form.name} onChange={set("name")} className={authInputClass} placeholder="Maria Rossi" />
        </AuthField>
        <AuthField label={t("email")}>
          <input data-testid="register-email-input" type="email" required value={form.email} onChange={set("email")} className={authInputClass} placeholder="nome@email.com" />
        </AuthField>
        <AuthField label={t("password")}>
          <PasswordInput value={form.password} onChange={set("password")} minLength={6} autoComplete="new-password" />
          <p className="mt-1.5 text-xs text-slate-500">{t("password_hint")}</p>
        </AuthField>
        <AuthField label="Domanda di sicurezza (per recuperare la password)">
          <select
            value={form.security_question}
            onChange={set("security_question")}
            className={authInputClass}
          >
            {QUESTIONS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </AuthField>
        <AuthField label="Risposta di sicurezza">
          <input
            type="text"
            required
            value={form.security_answer}
            onChange={set("security_answer")}
            className={authInputClass}
            placeholder="Scrivi la tua risposta"
          />
        </AuthField>

        <div className="space-y-2" data-testid="consents-block">
          <ConsentBox testId="consent-terms-checkbox" checked={consents.terms} onChange={setC("terms")}>
            {t("consent_terms_a")}<LegalLink to="/privacy" testId="consent-link-privacy">{t("legal_privacy")}</LegalLink>{t("consent_terms_b")}<LegalLink to="/terms" testId="consent-link-terms">{t("legal_terms")}</LegalLink>{t("consent_terms_c")}
          </ConsentBox>
          <ConsentBox testId="consent-health-checkbox" checked={consents.health} onChange={setC("health")}>{t("consent_health_checkbox")}</ConsentBox>
          <ConsentBox testId="consent-disclaimer-checkbox" checked={consents.disclaimer} onChange={setC("disclaimer")}>
            {t("consent_disclaimer_a")}<LegalLink to="/disclaimer" testId="consent-link-disclaimer">{t("legal_disclaimer")}</LegalLink>{t("consent_disclaimer_b")}
          </ConsentBox>
        </div>

        {error && <p data-testid="auth-error" className="rounded-xl bg-[#FFF5F5] px-4 py-3 text-sm font-medium text-[#C53030]">{error}</p>}

        <button
          data-testid="auth-submit-button" type="submit" disabled={loading}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2D6A4F] text-lg font-semibold text-white transition-colors hover:bg-[#1B4332] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("register")}
        </button>
      </form>
    </AuthShell>
  );
}
