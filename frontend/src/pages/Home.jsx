import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useProfiles } from "@/context/ProfileContext";
import api, { errorMessage } from "@/lib/api";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { Onboarding } from "@/components/Onboarding";
import { HomeReminders, HomeRecentDocs } from "@/components/HomeSections";

export default function Home() {
  const { t } = useLang();
  const { user } = useAuth();
  const { activeProfile, activeId } = useProfiles();
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [reminders, setReminders] = useState([]);

  const load = useCallback(async () => {
    if (!activeId) { setDocs([]); setReminders([]); return; }
    try {
      const [d, r] = await Promise.all([
        api.get("/documents", { params: { profile_id: activeId } }),
        api.get("/reminders", { params: { profile_id: activeId } }),
      ]);
      setDocs(d.data);
      setReminders(r.data.filter((x) => !x.done));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  if (!activeProfile) return <Onboarding />;

  return (
    <div className="animate-fade-up space-y-6" data-testid="patient-dashboard">
      <div>
        <p className="text-base text-slate-500">{t("welcome")}, {user?.name?.split(" ")[0]} 👋</p>
        <h1 className="font-heading text-2xl font-bold text-slate-900">{activeProfile.name}</h1>
      </div>

      <button
        data-testid="home-upload-cta" onClick={() => navigate("/upload")}
        className="group flex w-full items-center gap-4 rounded-2xl bg-[#2D6A4F] p-5 text-left text-white shadow-lg transition-colors hover:bg-[#1B4332]"
      >
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <UploadCloud className="h-7 w-7" />
        </span>
        <span className="flex-1">
          <span className="block font-heading text-lg font-bold">{t("home_upload_cta")}</span>
          <span className="block text-sm text-white/80">{t("home_upload_sub")}</span>
        </span>
        <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
      </button>

      <HomeReminders reminders={reminders} />
      <HomeRecentDocs docs={docs} />

      <DisclaimerBanner compact />
    </div>
  );
}
