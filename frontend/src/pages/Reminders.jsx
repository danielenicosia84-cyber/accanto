import { useEffect, useState, useCallback } from "react";
import { Plus, BellRing, Users } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { LegalNotice } from "@/components/LegalNotice";
import { useProfiles } from "@/context/ProfileContext";
import api, { errorMessage } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { ReminderRow, ReminderForm } from "@/components/ReminderItems";

export default function Reminders() {
  const { t } = useLang();
  const { activeProfile, activeId } = useProfiles();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) { setItems([]); return; }
    try {
      const { data } = await api.get("/reminders", { params: { profile_id: activeId } });
      setItems(data);
    } catch (err) { toast.error(errorMessage(err)); }
  }, [activeId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (r) => {
    try {
      const { data } = await api.patch(`/reminders/${r.id}`, { done: !r.done });
      setItems((prev) => prev.map((x) => (x.id === r.id ? data : x)));
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const remove = async (id) => {
    try { await api.delete(`/reminders/${id}`); setItems((prev) => prev.filter((x) => x.id !== id)); }
    catch (err) { toast.error(errorMessage(err)); }
  };

  const onAdded = (r) => { setItems((prev) => [r, ...prev]); setOpen(false); };

  if (!activeProfile) return <EmptyState icon={Users} text={t("select_profile_first")} />;

  const active = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <div className="animate-fade-up space-y-4">
      <h1 className="font-heading text-2xl font-bold text-slate-900">{t("reminders_title")}</h1>
      <LegalNotice variant="reminders" />

      {items.length === 0 && !open && <EmptyState icon={BellRing} text={t("empty_reminders")} />}

      <div className="space-y-2">
        {active.map((r) => <ReminderRow key={r.id} r={r} onToggle={toggle} onRemove={remove} />)}
      </div>

      {done.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-sm font-semibold text-slate-400">{t("done")}</p>
          {done.map((r) => <ReminderRow key={r.id} r={r} onToggle={toggle} onRemove={remove} />)}
        </div>
      )}

      {open ? (
        <ReminderForm profileId={activeId} onAdded={onAdded} onCancel={() => setOpen(false)} />
      ) : (
        <button data-testid="add-reminder-button" onClick={() => setOpen(true)}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#2D6A4F] bg-[#E8F5E9]/40 text-lg font-semibold text-[#2D6A4F] hover:bg-[#E8F5E9]">
          <Plus className="h-5 w-5" /> {t("add_reminder")}
        </button>
      )}
    </div>
  );
}
