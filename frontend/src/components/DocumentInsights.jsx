import { CalendarClock } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { formatDate } from "@/lib/format";

const KeyTerms = ({ terms, t }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="mb-3 font-heading text-lg font-bold text-slate-900">{t("key_terms")}</h2>
    <div className="space-y-3">
      {terms.map((kt, i) => (
        <div key={`${kt.term}-${i}`} className="border-l-4 border-[#D97706] pl-3">
          <p className="font-semibold text-slate-900">{kt.term}</p>
          <p className="text-sm text-slate-600">{kt.meaning}</p>
        </div>
      ))}
    </div>
  </section>
);

const Deadlines = ({ deadlines, t, lang }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-slate-900">
      <CalendarClock className="h-5 w-5 text-[#D97706]" /> {t("deadlines")}
    </h2>
    <div className="space-y-2">
      {deadlines.map((dl, i) => (
        <div key={`${dl.title}-${i}`} className="flex items-center gap-3 rounded-xl bg-[#FEF3C7]/50 p-3">
          <CalendarClock className="h-5 w-5 flex-shrink-0 text-[#D97706]" />
          <div>
            <p className="font-semibold text-slate-900">{dl.title}</p>
            {(dl.timeframe || dl.due_date) && <p className="text-sm text-[#92400E]">{dl.timeframe || formatDate(dl.due_date, lang)}</p>}
          </div>
        </div>
      ))}
    </div>
  </section>
);

export const DocumentInsights = ({ doc }) => {
  const { t, lang } = useLang();
  return (
    <>
      {doc.key_terms?.length > 0 && <KeyTerms terms={doc.key_terms} t={t} />}
      {doc.deadlines?.length > 0 && <Deadlines deadlines={doc.deadlines} t={t} lang={lang} />}
    </>
  );
};
