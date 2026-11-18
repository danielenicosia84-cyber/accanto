import { MessageCircle, Mail, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useProfiles } from "@/context/ProfileContext";
import { formatDate } from "@/lib/format";

export const ShareSummary = ({ doc }) => {
  const { t, lang } = useLang();
  const { activeProfile } = useProfiles();
  if (!doc?.summary) return null;

  const text = `${activeProfile?.name ? `${activeProfile.name} · ` : ""}${doc.title} (${formatDate(doc.created_at, lang)})\n\n${doc.summary}\n\n— ${lang === "it" ? "Sintesi in parole semplici creata con Accanto. Non sostituisce il parere del medico." : "Plain-words summary created with Accanto. Not medical advice."}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const mail = `mailto:?subject=${encodeURIComponent(doc.title)}&body=${encodeURIComponent(text)}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success(t("share_copied")); } catch { toast.error("Errore"); }
  };

  const native = async () => {
    if (navigator.share) { try { await navigator.share({ title: doc.title, text }); } catch { /* user cancelled */ } }
    else copy();
  };

  const cls = "flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50";
  return (
    <section className="rounded-2xl border border-slate-200 bg-[#F7F5F0] p-4" data-testid="share-summary">
      <p className="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-900"><Share2 className="h-4 w-4" /> {t("share_title")}</p>
      <div className="flex gap-2">
        <a data-testid="share-whatsapp" href={wa} target="_blank" rel="noreferrer" className={cls}><MessageCircle className="h-4 w-4 text-[#25D366]" /> {t("share_whatsapp")}</a>
        <a data-testid="share-email" href={mail} className={cls}><Mail className="h-4 w-4 text-[#1E40AF]" /> {t("share_email")}</a>
        <button data-testid="share-copy" onClick={navigator.share ? native : copy} className={cls}><Copy className="h-4 w-4" /> {t("share_copy")}</button>
      </div>
    </section>
  );
};
