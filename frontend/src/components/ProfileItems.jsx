import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { LegalNotice } from "@/components/LegalNotice";
import { useProfiles } from "@/context/ProfileContext";
import { useBilling } from "@/context/BillingContext";
import { errorMessage, isPaywall } from "@/lib/api";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

export const PROFILE_COLORS = ["#2D6A4F", "#D97706", "#E07A5F", "#1E40AF", "#7C3AED", "#BE185D"];

export const ProfileCard = ({ p, active, onSelect, onRemove }) => {
  const { t } = useLang();
  const navigate = useNavigate();
  return (
    <div
      data-testid={`profile-card-${p.id}`}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border bg-white p-4 transition-all ${active ? "border-[#2D6A4F] ring-2 ring-[#E8F5E9]" : "border-slate-200"}`}
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full font-heading text-lg font-bold text-white" style={{ backgroundColor: p.color }}>
        {p.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1 basis-32">
        <p className="truncate font-semibold text-slate-900">{p.name}</p>
        {p.relation && <p className="truncate text-sm text-slate-500">{p.relation}</p>}
      </div>
      {active ? (
        <button data-testid={`clinical-link-${p.id}`} onClick={() => navigate("/care/clinical")} className="order-last flex min-h-[44px] w-full items-center justify-center gap-1 rounded-full bg-[#E8F5E9] px-3 text-sm font-semibold text-[#2D6A4F] hover:bg-[#C8E6C9] sm:order-none sm:w-auto">
          <Check className="h-4 w-4" /> {t("care_clinical")}
        </button>
      ) : (
        <button data-testid={`switch-profile-${p.id}`} onClick={() => onSelect(p.id)}
          className="min-h-[44px] rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
          {t("switch_profile")}
        </button>
      )}
      <ConfirmDeleteDialog title={t("delete_profile_title")} description={t("delete_profile_desc").replace("{name}", p.name)}
        onConfirm={() => onRemove(p.id)} confirmTestId={`confirm-delete-profile-${p.id}`}>
        <button data-testid={`delete-profile-${p.id}`} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500" aria-label={t("delete")}>
          <Trash2 className="h-4 w-4" />
        </button>
      </ConfirmDeleteDialog>
    </div>
  );
};

export const ProfileForm = ({ onDone, onCancel }) => {
  const { t } = useLang();
  const { addProfile } = useProfiles();
  const { refreshBilling } = useBilling();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [color, setColor] = useState(PROFILE_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const create = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addProfile({ name, relation, color });
      refreshBilling();
      toast.success(t("create"));
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
      if (isPaywall(err)) navigate("/pricing");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={create} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <input data-testid="profile-name-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("profile_name")}
        className="h-[52px] w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]" />
      <input data-testid="profile-relation-input" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder={t("profile_relation")}
        className="h-[52px] w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]" />
      <div className="flex gap-2">
        {PROFILE_COLORS.map((c) => (
          <button type="button" key={c} onClick={() => setColor(c)} style={{ backgroundColor: c }}
            className={`h-9 w-9 rounded-full transition-transform ${color === c ? "scale-110 ring-2 ring-offset-2 ring-slate-400" : ""}`} aria-label={c} />
        ))}
      </div>
      <LegalNotice variant="consent" />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="min-h-[52px] flex-1 rounded-2xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50">{t("cancel")}</button>
        <button data-testid="create-profile-submit" type="submit" disabled={loading} className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-[#2D6A4F] font-semibold text-white hover:bg-[#1B4332] disabled:opacity-60">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("create")}
        </button>
      </div>
    </form>
  );
};
