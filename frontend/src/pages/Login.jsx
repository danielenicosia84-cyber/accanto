import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, KeyRound, MailSearch, ArrowLeft, Copy, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import api, { errorMessage } from "@/lib/api";
import { PasswordInput } from "@/components/PasswordInput";
import { LegalFooter } from "@/components/LegalFooter";
import { AuthShell, AuthField, authInputClass } from "@/components/AuthShell";

const DEMO = { email: "demo@dopo.app", password: "Demo2026!" };

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Stato recupero credenziali
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryTab, setRecoveryTab] = useState("password"); // "password" | "email"
  const [recName, setRecName] = useState("");
  const [recEmail, setRecEmail] = useState("");
  const [recCode, setRecCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState("");
  const [recResult, setRecResult] = useState(null);
  const [copiedNewCode, setCopiedNewCode] = useState(false);

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

  const openRecovery = () => {
    setRecoveryMode(true);
    setRecError("");
    setRecResult(null);
    setRecEmail(email);
  };

  const handleRecoverEmail = async (e) => {
    e.preventDefault();
    setRecError("");
    setRecResult(null);
    setRecLoading(true);
    try {
      const { data } = await api.post("/auth/recover-email", {
        name: recName,
        recovery_code: recCode,
      });
      setRecResult({ type: "email", maskedEmail: data.masked_email });
    } catch (err) {
      setRecError(errorMessage(err));
    } finally {
      setRecLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setRecError("");
    setRecResult(null);
    setRecLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", {
        email: recEmail,
        recovery_code: recCode,
        new_password: newPassword,
      });
      setRecResult({
        type: "password",
        message: data.message,
        newRecoveryCode: data.new_recovery_code,
      });
      setEmail(recEmail);
      setPassword("");
    } catch (err) {
      setRecError(errorMessage(err));
    } finally {
      setRecLoading(false);
    }
  };

  const copyNewRecoveryCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedNewCode(true);
      setTimeout(() => setCopiedNewCode(false), 2500);
    } catch {
      setCopiedNewCode(false);
    }
  };

if (recoveryMode) {
    return (
      <AuthShell
        title="Recupero Account"
        subtitle="Usa il Codice di Recupero oppure il Nome registrato (per account precedenti)"
        footer={footer}
      >
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() => { setRecoveryMode(false); setRecError(""); setRecResult(null); }}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Torna al login
          </button>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => { setRecoveryTab("password"); setRecError(""); setRecResult(null); }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${recoveryTab === "password" ? "bg-white text-[#2D6A4F] shadow-sm" : "text-slate-600"}`}
            >
              <KeyRound className="h-4 w-4" /> Nuova Password
            </button>
            <button
              type="button"
              onClick={() => { setRecoveryTab("email"); setRecError(""); setRecResult(null); }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${recoveryTab === "email" ? "bg-white text-[#2D6A4F] shadow-sm" : "text-slate-600"}`}
            >
              <MailSearch className="h-4 w-4" /> Recupera Email
            </button>
          </div>

          {recoveryTab === "password" ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <AuthField label="Email dell'account">
                <input type="email" required value={recEmail} onChange={(e) => setRecEmail(e.target.value)} className={authInputClass} placeholder="nome@email.com" />
              </AuthField>
              <AuthField label="Codice di Recupero (es. ACC-XXXX-XXXX) oppure Nome registrato">
                <input
                  type="text"
                  value={recCode}
                  onChange={(e) => setRecCode(e.target.value)}
                  className={`${authInputClass} font-mono`}
                  placeholder="ACC-XXXX-XXXX o Nome registrato"
                />
              </AuthField>
              <AuthField label="Nuova Password (min. 6 caratteri)">
                <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} autoComplete="new-password" />
              </AuthField>
              {recError && <p className="rounded-xl bg-[#FFF5F5] px-4 py-3 text-sm font-medium text-[#C53030]">{recError}</p>}
              {recResult?.type === "password" && (
                <div className="space-y-3 rounded-xl bg-[#E8F5E9] p-4 text-sm text-[#1B4332]">
                  <p className="font-semibold">{recResult.message}</p>
                  {recResult.newRecoveryCode && (
                    <div className="space-y-1.5">
                      <p className="text-xs">Salva il tuo <strong>nuovo Codice di Recupero</strong> (quello precedente non è più valido):</p>
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                        <span className="font-mono font-bold text-slate-900">{recResult.newRecoveryCode}</span>
                        <button type="button" onClick={() => copyNewRecoveryCode(recResult.newRecoveryCode)} className="flex items-center gap-1 rounded bg-[#2D6A4F] px-2.5 py-1 text-xs font-semibold text-white">
                          {copiedNewCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedNewCode ? "Copiato" : "Copia"}
                        </button>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setRecoveryMode(false)}
                    className="w-full rounded-xl bg-[#2D6A4F] py-2.5 text-center font-semibold text-white hover:bg-[#1B4332]"
                  >
                    Vai al Login
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={recLoading}
                className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2D6A4F] text-base font-semibold text-white transition-colors hover:bg-[#1B4332] disabled:opacity-60"
              >
                {recLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Reimposta Password"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRecoverEmail} className="space-y-4">
              <AuthField label="Nome e Cognome registrati">
                <input type="text" required value={recName} onChange={(e) => setRecName(e.target.value)} className={authInputClass} placeholder="Maria Rossi" />
              </AuthField>
              <AuthField label="Codice di Recupero (opzionale per account precedenti)">
                <input
                  type="text"
                  value={recCode}
                  onChange={(e) => setRecCode(e.target.value)}
                  className={`${authInputClass} font-mono`}
                  placeholder="ACC-XXXX-XXXX (se disponibile)"
                />
              </AuthField>
              {recError && <p className="rounded-xl bg-[#FFF5F5] px-4 py-3 text-sm font-medium text-[#C53030]">{recError}</p>}
              {recResult?.type === "email" && (
                <div className="space-y-2 rounded-xl bg-[#E8F5E9] p-4 text-sm text-[#1B4332]">
                  <p>Account trovato! L'email associata è:</p>
                  <p className="font-mono text-base font-bold text-slate-900">{recResult.maskedEmail}</p>
                  <button
                    type="button"
                    onClick={() => setRecoveryMode(false)}
                    className="mt-1 w-full rounded-xl bg-[#2D6A4F] py-2 text-center font-semibold text-white hover:bg-[#1B4332]"
                  >
                    Torna al Login
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={recLoading}
                className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2D6A4F] text-base font-semibold text-white transition-colors hover:bg-[#1B4332] disabled:opacity-60"
              >
                {recLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Trova Email Account"}
              </button>
            </form>
          )}
        </div>
      </AuthShell>
    );
  }
                <input type="text" required value={recCode} onChange={(e) => setRecCode(e.target.value.toUpperCase())} className={`${authInputClass} font-mono uppercase`} placeholder="ACC-XXXX-XXXX" />
              </AuthField>
              {recError && <p className="rounded-xl bg-[#FFF5F5] px-4 py-3 text-sm font-medium text-[#C53030]">{recError}</p>}
              {recResult?.type === "email" && (
                <div className="space-y-2 rounded-xl bg-[#E8F5E9] p-4 text-sm text-[#1B4332]">
                  <p>Account trovato! L'email associata è:</p>
                  <p className="font-mono text-base font-bold text-slate-900">{recResult.maskedEmail}</p>
                  <button
                    type="button"
                    onClick={() => setRecoveryMode(false)}
                    className="mt-1 w-full rounded-xl bg-[#2D6A4F] py-2 text-center font-semibold text-white hover:bg-[#1B4332]"
                  >
                    Torna al Login
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={recLoading}
                className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2D6A4F] text-base font-semibold text-white transition-colors hover:bg-[#1B4332] disabled:opacity-60"
              >
                {recLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Trova Email Account"}
              </button>
            </form>
          )}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("login_title")} subtitle={t("login_sub")} footer={footer}>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
        <button
          type="button"
          onClick={openRecovery}
          className="w-full pt-1 text-center text-sm font-semibold text-[#2D6A4F] hover:underline"
        >
          Hai dimenticato email o password? Recupera account
        </button>
        <button type="button" onClick={fillDemo} data-testid="use-demo-button" className="min-h-[44px] w-full text-center text-sm font-semibold text-[#52796F] hover:underline">
          {t("use_demo")}
        </button>
      </form>
    </AuthShell>
  );
}
