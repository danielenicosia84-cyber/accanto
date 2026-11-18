import { useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useProfiles } from "@/context/ProfileContext";
import { useLang } from "@/context/LanguageContext";
import { errorMessage } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { ProfileCard, ProfileForm } from "@/components/ProfileItems";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { GdprSection } from "@/components/GdprSection";

export default function Profiles() {
  const { profiles, activeId, setActiveId, removeProfile } = useProfiles();
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  const remove = async (id) => {
    try { await removeProfile(id); toast.success(t("delete")); }
    catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="animate-fade-up space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">{t("profiles_title")}</h1>
        <p className="mt-1 text-base text-slate-600">{t("profiles_sub")}</p>
      </div>

      {profiles.length === 0 && !open && <EmptyState icon={Users} text={t("no_profiles")} />}

      <div className="space-y-3">
        {profiles.map((p) => (
          <ProfileCard key={p.id} p={p} active={activeId === p.id} onSelect={setActiveId} onRemove={remove} />
        ))}
      </div>

      {open ? (
        <ProfileForm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      ) : (
        <button
          data-testid="add-family-member-button" onClick={() => setOpen(true)}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#2D6A4F] bg-[#E8F5E9]/40 text-lg font-semibold text-[#2D6A4F] transition-colors hover:bg-[#E8F5E9]"
        >
          <UserPlus className="h-5 w-5" /> {t("add_profile")}
        </button>
      )}

      <SubscriptionCard />
      <GdprSection />
    </div>
  );
}
