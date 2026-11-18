import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GitCompareArrows, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useProfiles } from "@/context/ProfileContext";
import { useBilling } from "@/context/BillingContext";
import api, { errorMessage, isPaywall } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { BTN_PRIMARY, INPUT } from "@/lib/care";
import { CarePage } from "@/components/care/CareShell";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { LegalNotice } from "@/components/LegalNotice";

const DocSelect = ({ label, value, onChange, docs, lang, testId }) => (
  <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
    <select data-testid={testId} className={INPUT} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {docs.map((d) => <option key={d.id} value={d.id}>{formatDate(d.created_at, lang)} · {d.title}</option>)}
    </select>
  </label>
);

export default function Compare() {
  const { t, lang } = useLang();
  const { activeId } = useProfiles();
  const { refreshBilling } = useBilling();
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!activeId) return;
    api.get("/documents", { params: { profile_id: activeId } }).then((r) => {
      setDocs(r.data);
      const exams = r.data.filter((d) => d.category === "Esame");
      const pick = exams.length >= 2 ? exams : r.data;
      if (pick.length >= 2) { setA(pick[1].id); setB(pick[0].id); }
    }).catch((err) => toast.error(errorMessage(err)));
  }, [activeId]);

  const run = async () => {
    setBusy(true); setAnswer("");
    try {
      const { data } = await api.post(`/profiles/${activeId}/compare`, { document_ids: [a, b], lang });
      setAnswer(data.answer.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/^\s*\*\s+/gm, "- "));
      refreshBilling();
    } catch (err) {
      toast.error(errorMessage(err));
      if (isPaywall(err)) navigate("/pricing");
    } finally { setBusy(false); }
  };

  return (
    <CarePage title={t("compare_title")} subtitle={t("compare_sub")} feature="history_compare" testId="compare-page">
      {docs.length < 2 ? <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500" data-testid="compare-need-two">{t("compare_need_two")}</p> : (
        <>
          <DocSelect label={t("compare_pick_first")} value={a} onChange={setA} docs={docs} lang={lang} testId="compare-first" />
          <DocSelect label={t("compare_pick_second")} value={b} onChange={setB} docs={docs} lang={lang} testId="compare-second" />
          <button data-testid="compare-run" onClick={run} disabled={!a || !b || a === b || busy} className={`${BTN_PRIMARY} w-full`}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><GitCompareArrows className="h-5 w-5" /> {t("compare_run")}</>}</button>
        </>
      )}
      {(busy || answer) && (
        <section className="rounded-2xl border border-[#CCFBF1] bg-[#CCFBF1]/40 p-5" data-testid="compare-result">
          <h2 className="mb-2 font-heading text-lg font-bold text-[#0F766E]">{t("compare_result")}</h2>
          {busy ? <p className="flex items-center gap-2 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> {t("loading")}</p> : <><p className="whitespace-pre-line text-base leading-relaxed text-slate-700">{answer}</p><LegalNotice variant="ai" className="mt-3" /></>}
        </section>
      )}
      <DisclaimerBanner compact />
    </CarePage>
  );
}
