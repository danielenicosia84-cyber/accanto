import { useEffect, useMemo, useState } from "react";
import { BookOpen, FileDown, Search, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import api, { errorMessage } from "@/lib/api";
import { INPUT, BTN_PRIMARY, download } from "@/lib/care";
import { CATEGORY_STYLES } from "@/lib/format";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

const Section = ({ id, title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white" data-testid={`guide-section-${id}`}>
      <button onClick={() => setOpen((o) => !o)} data-testid={`guide-toggle-${id}`} className="flex min-h-[56px] w-full items-center justify-between px-5 text-left">
        <h2 className="font-heading text-lg font-bold text-slate-900">{title}</h2>
        <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-slate-100 px-5 pb-5 pt-3">{children}</div>}
    </section>
  );
};

const Pairs = ({ rows, styled }) => (
  <dl className="divide-y divide-slate-100">
    {rows.map(([k, v, extra]) => (
      <div key={k} className="py-3">
        <dt className="font-semibold text-slate-900">
          {styled && CATEGORY_STYLES[k.split(" (")[0]] ? <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: CATEGORY_STYLES[k.split(" (")[0]].bg, color: CATEGORY_STYLES[k.split(" (")[0]].text }}>{k}</span> : k}
          {extra && <span className="ml-2 text-xs font-normal text-slate-500">{extra}</span>}
        </dt>
        <dd className="mt-1 text-sm leading-relaxed text-slate-600">{v}</dd>
      </div>
    ))}
  </dl>
);

export default function Guide() {
  const { t, lang } = useLang();
  const [g, setG] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => { api.get("/guide", { params: { lang } }).then((r) => setG(r.data)).catch((err) => toast.error(errorMessage(err))); }, [lang]);

  const glossary = useMemo(() => (g ? g.glossary.filter(([k, v]) => !q || `${k} ${v}`.toLowerCase().includes(q.toLowerCase())) : []), [g, q]);

  if (!g) return <div className="flex min-h-[50vh] items-center justify-center" data-testid="guide-loading"><BookOpen className="h-8 w-8 animate-pulse text-[#2D6A4F]" /></div>;

  return (
    <div className="animate-fade-up space-y-4" data-testid="guide-page">
      <div className="rounded-2xl bg-[#2D6A4F] p-5 text-white">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><BookOpen className="h-6 w-6" /></span>
        <h1 className="font-heading text-2xl font-bold">{g.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/85">{g.intro}</p>
        <button data-testid="guide-download" onClick={() => download(`/guide/pdf?lang=${lang}`, "Accanto-Guida.pdf", t("downloading"))} className={`${BTN_PRIMARY} mt-4 w-full !bg-white !text-[#1B4332] hover:!bg-[#E8F5E9]`}><FileDown className="h-5 w-5" /> {t("guide_download")}</button>
      </div>

      <Section id="how" title={t("guide_how")} defaultOpen>
        <ol className="space-y-3">{g.steps.map(([a, b], i) => (
          <li key={a} className="flex gap-3"><span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] font-heading text-sm font-bold text-[#2D6A4F]">{i + 1}</span><div><p className="font-semibold text-slate-900">{a}</p><p className="text-sm text-slate-600">{b}</p></div></li>
        ))}</ol>
      </Section>
      <Section id="categories" title={t("guide_categories")}><Pairs rows={g.categories} styled /></Section>
      <Section id="icons" title={t("guide_icons")}><Pairs rows={g.icons} /></Section>
      <Section id="glossary" title={t("guide_glossary")} defaultOpen>
        <div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input data-testid="guide-search" className={`${INPUT} pl-9`} placeholder={t("guide_search")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Pairs rows={glossary} />
      </Section>
      <Section id="vitals" title={t("guide_vitals")}>
        <p className="mb-2 rounded-xl bg-[#FEF3C7] p-3 text-sm text-[#92400E]">{g.vitals_note}</p>
        <Pairs rows={g.vitals.map(([a, u, d]) => [a, d, u])} />
      </Section>
      <Section id="bureaucracy" title={t("guide_bureaucracy")}><Pairs rows={g.bureaucracy.map((b) => [b.title, b.description])} /></Section>
      <Section id="faq" title={t("guide_faq")}><Pairs rows={g.faq} /></Section>
      <DisclaimerBanner compact />
    </div>
  );
}
