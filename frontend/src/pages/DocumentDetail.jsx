import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileSearch, Trash2, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useDocument } from "@/hooks/useDocument";
import api, { errorMessage, API, getToken } from "@/lib/api";
import { formatDate, catStyle } from "@/lib/format";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { GuidedActions } from "@/components/GuidedActions";
import { DocumentInsights } from "@/components/DocumentInsights";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { ShareSummary } from "@/components/ShareSummary";
import { LegalNotice } from "@/components/LegalNotice";

export default function DocumentDetail() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { doc, loading } = useDocument(id);

  const remove = async () => {
    try {
      await api.delete(`/documents/${id}`);
      toast.success(t("delete"));
      navigate("/archive");
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const openOriginal = () => window.open(`${API}/documents/${id}/file?auth=${getToken()}`, "_blank");

  if (loading || !doc) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#2D6A4F]" /></div>;
  }

  const cs = catStyle(doc.category);

  return (
    <div className="animate-fade-up space-y-5" data-testid="document-detail">
      <button onClick={() => navigate(-1)} className="-ml-2 flex min-h-[44px] items-center gap-1 px-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> {t("nav_archive")}
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <span className="mb-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: cs.bg, color: cs.text }}>{doc.category}</span>
        <h1 className="font-heading text-xl font-bold text-slate-900">{doc.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{formatDate(doc.created_at, lang)}</p>
      </div>

      {doc.summary && (
        <section className="rounded-2xl border border-[#E8F5E9] bg-[#E8F5E9]/40 p-5">
          <h2 className="mb-2 flex items-center gap-2 font-heading text-lg font-bold text-[#1B4332]"><BookOpen className="h-5 w-5" /> {t("doc_summary")}</h2>
          <p className="whitespace-pre-line text-base leading-relaxed text-slate-700" data-testid="doc-summary-text">{doc.summary}</p>
        </section>
      )}

      <GuidedActions docId={id} />
      <DocumentInsights doc={doc} />
      <LegalNotice variant="ai" />
      <ShareSummary doc={doc} />

      <div className="flex gap-3">
        <button data-testid="view-original-button" onClick={openOriginal} className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50">
          <FileSearch className="h-5 w-5" /> {t("view_original")}
        </button>
        <ConfirmDeleteDialog title={t("delete_doc_title")} description={t("delete_doc_desc")} onConfirm={remove} confirmTestId="confirm-delete-document">
          <button data-testid="delete-document-button" className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100" aria-label={t("delete_doc")}>
            <Trash2 className="h-5 w-5" />
          </button>
        </ConfirmDeleteDialog>
      </div>

      <DisclaimerBanner />
    </div>
  );
}
