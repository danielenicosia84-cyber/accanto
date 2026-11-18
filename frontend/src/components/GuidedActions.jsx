import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircleHeart, HelpCircle, ListChecks, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { LegalNotice } from "@/components/LegalNotice";
import { useBilling } from "@/context/BillingContext";
import api, { errorMessage, isPaywall } from "@/lib/api";

const AiAnswerBox = ({ answering, answer, t }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="ai-answer-box">
    <h3 className="mb-2 font-heading text-base font-bold text-slate-900">{t("ai_answer")}</h3>
    {answering ? (
      <div className="flex items-center gap-2 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> {t("loading")}</div>
    ) : (
      <>
        <p className="whitespace-pre-line text-base leading-relaxed text-slate-700">{answer}</p>
        <LegalNotice variant="ai" className="mt-3" />
      </>
    )}
  </section>
);

const TermForm = ({ onAsk, disabled, t }) => {
  const [term, setTerm] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (term.trim()) onAsk(term);
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input data-testid="term-input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t("term_placeholder")}
        className="h-[52px] flex-1 rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#FEF3C7]" />
      <button data-testid="term-ask-button" type="submit" disabled={disabled} className="flex h-[52px] items-center gap-1 rounded-xl bg-[#D97706] px-4 font-semibold text-white hover:bg-[#B45309] disabled:opacity-60">
        <Send className="h-4 w-4" /> {t("ask")}
      </button>
    </form>
  );
};

export const GuidedActions = ({ docId }) => {
  const { t, lang } = useLang();
  const { refreshBilling } = useBilling();
  const navigate = useNavigate();
  const [answer, setAnswer] = useState("");
  const [answering, setAnswering] = useState(false);
  const [showTerm, setShowTerm] = useState(false);

  const runAction = async (endpoint, body = {}) => {
    setAnswering(true);
    setAnswer("");
    try {
      const { data } = await api.post(`/documents/${docId}/${endpoint}`, { lang, ...body });
      setAnswer(data.answer);
      refreshBilling();
    } catch (err) {
      toast.error(errorMessage(err));
      if (isPaywall(err)) navigate("/pricing");
    } finally {
      setAnswering(false);
    }
  };

  return (
    <>
      <section className="space-y-3">
        <button data-testid="btn-explain-simple" onClick={() => runAction("explain")} disabled={answering}
          className="flex min-h-[54px] w-full items-center gap-3 rounded-2xl bg-[#2D6A4F] px-5 text-left font-semibold text-white transition-colors hover:bg-[#1B4332] disabled:opacity-60">
          <MessageCircleHeart className="h-6 w-6 flex-shrink-0" /> {t("btn_explain")}
        </button>
        <button data-testid="btn-explain-terms" onClick={() => { setShowTerm((s) => !s); setAnswer(""); }}
          className="flex min-h-[54px] w-full items-center gap-3 rounded-2xl border-2 border-[#D97706] bg-[#FEF3C7]/50 px-5 text-left font-semibold text-[#92400E] transition-colors hover:bg-[#FEF3C7]">
          <HelpCircle className="h-6 w-6 flex-shrink-0" /> {t("btn_term")}
        </button>
        {showTerm && <TermForm onAsk={(term) => runAction("term", { term })} disabled={answering} t={t} />}
        <button data-testid="btn-next-steps" onClick={() => runAction("next-steps")} disabled={answering}
          className="flex min-h-[54px] w-full items-center gap-3 rounded-2xl border-2 border-[#E07A5F] bg-[#FDF0ED]/60 px-5 text-left font-semibold text-[#C85F46] transition-colors hover:bg-[#FDF0ED] disabled:opacity-60">
          <ListChecks className="h-6 w-6 flex-shrink-0" /> {t("btn_steps")}
        </button>
      </section>
      {(answering || answer) && <AiAnswerBox answering={answering} answer={answer} t={t} />}
    </>
  );
};
