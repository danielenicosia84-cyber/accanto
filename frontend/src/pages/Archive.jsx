import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useProfiles } from "@/context/ProfileContext";
import api, { errorMessage } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { CategoryFilters, ArchiveItem, filterDocuments } from "@/components/ArchiveItems";

export default function Archive() {
  const { t } = useLang();
  const { activeProfile, activeId } = useProfiles();
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const load = useCallback(async () => {
    if (!activeId) { setDocs([]); return; }
    try {
      const { data } = await api.get("/documents", { params: { profile_id: activeId } });
      setDocs(data);
    } catch (err) { toast.error(errorMessage(err)); }
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  if (!activeProfile) return <EmptyState icon={Users} text={t("select_profile_first")} />;

  const filtered = filterDocuments(docs, q, cat);

  return (
    <div className="animate-fade-up space-y-4">
      <h1 className="font-heading text-2xl font-bold text-slate-900">{t("archive_title")}</h1>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input data-testid="archive-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_ph")}
          className="h-[52px] w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-base outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]" />
      </div>

      <CategoryFilters value={cat} onChange={setCat} />

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">{t("empty_docs")}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => <ArchiveItem key={d.id} d={d} onOpen={(id) => navigate(`/document/${id}`)} />)}
        </div>
      )}
    </div>
  );
}
