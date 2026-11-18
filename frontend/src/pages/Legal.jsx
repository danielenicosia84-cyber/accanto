import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, FileText, Stethoscope } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { LangToggle } from "@/components/LangToggle";
import { LegalFooter } from "@/components/LegalFooter";
import api from "@/lib/api";
import { LEGAL } from "@/lib/legalContent";

const ICONS = { privacy: ShieldCheck, terms: FileText, disclaimer: Stethoscope };

export default function Legal({ page }) {
  const { t, lang } = useLang();
  const [issuer, setIssuer] = useState(null);

  useEffect(() => { api.get("/legal/issuer").then((r) => setIssuer(r.data)).catch(() => setIssuer({})); }, []);

  const content = LEGAL[lang === "en" ? "en" : "it"][page](issuer || {});
  const Icon = ICONS[page];

  return (
    <div className="min-h-screen bg-[#FDFBF7] px-5 py-8" data-testid={`legal-page-${page}`}>
      <div className="mx-auto w-full max-w-2xl animate-fade-up">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/" data-testid="legal-back" className="flex min-h-[44px] items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Accanto</Link>
          <LangToggle />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#2D6A4F]"><Icon className="h-6 w-6" /></span>
          <h1 className="font-heading text-2xl font-bold text-slate-900 sm:text-3xl">{content.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{content.subtitle}</p>
          <p className="mt-2 text-xs text-slate-400" data-testid="legal-version">{t("legal_version")}: {issuer?.legal_version || "-"}</p>
          {issuer && !issuer.name && <p data-testid="legal-issuer-missing" className="mt-3 rounded-xl bg-[#FEF3C7] p-3 text-xs text-[#92400E]">{t("legal_issuer_missing")}</p>}
          <div className="mt-6 space-y-6">
            {content.sections.map(([title, paras]) => (
              <section key={title}>
                <h2 className="font-heading text-base font-bold text-slate-900 md:text-lg">{title}</h2>
                {paras.map((p, i) => <p key={i} className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">{p}</p>)}
              </section>
            ))}
          </div>
        </div>
        <LegalFooter />
      </div>
    </div>
  );
}
