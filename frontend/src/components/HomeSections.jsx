import { useNavigate } from "react-router-dom";
import { FileText, BellRing } from "lucide-react";
import { useLang } from "@/context/LanguageContext";
import { formatDate, catStyle } from "@/lib/format";

const SectionHeader = ({ title, showAll, onAll, allLabel }) => (
  <div className="mb-2 flex items-center justify-between">
    <h2 className="font-heading text-lg font-bold text-slate-900">{title}</h2>
    {showAll && <button onClick={onAll} className="-mr-2 min-h-[44px] px-2 text-sm font-semibold text-[#2D6A4F] hover:underline">{allLabel}</button>}
  </div>
);

const EmptyNote = ({ text }) => <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{text}</p>;

export const HomeReminders = ({ reminders }) => {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  return (
    <section>
      <SectionHeader title={t("upcoming")} showAll={reminders.length > 0} onAll={() => navigate("/reminders")} allLabel={t("see_all")} />
      {reminders.length === 0 ? <EmptyNote text={t("empty_reminders")} /> : (
        <div className="space-y-2">
          {reminders.slice(0, 3).map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-[#D97706]"><BellRing className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-semibold leading-snug text-slate-900">{r.title}</p>
                {(r.due_label || r.due_date) && <p className="text-sm text-[#D97706]">{r.due_label || formatDate(r.due_date, lang)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export const HomeRecentDocs = ({ docs }) => {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  return (
    <section>
      <SectionHeader title={t("recent_docs")} showAll={docs.length > 0} onAll={() => navigate("/archive")} allLabel={t("see_all")} />
      {docs.length === 0 ? <EmptyNote text={t("empty_docs")} /> : (
        <div className="space-y-2">
          {docs.slice(0, 4).map((d) => {
            const cs = catStyle(d.category);
            return (
              <button key={d.id} data-testid={`doc-item-${d.id}`} onClick={() => navigate(`/document/${d.id}`)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2D6A4F]"><FileText className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-semibold leading-snug text-slate-900">{d.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                    <span>{formatDate(d.created_at, lang)}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: cs.bg, color: cs.text }}>{d.category}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
