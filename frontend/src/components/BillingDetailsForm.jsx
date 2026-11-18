import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import api, { errorMessage } from "@/lib/api";

const FIELDS = [
  ["first_name", true], ["last_name", true], ["fiscal_code", false], ["address", false], ["city", false], ["zip", false],
];

export const BillingDetailsForm = ({ initial, onSaved }) => {
  const { t } = useLang();
  const [form, setForm] = useState({ first_name: "", last_name: "", fiscal_code: "", address: "", city: "", zip: "", ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === "fiscal_code" ? e.target.value.toUpperCase() : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/billing/details", form);
      onSaved(data);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3" data-testid="billing-details-form">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map(([k, req]) => (
          <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
            <label className="mb-1 block text-xs font-semibold text-slate-600">{t(k)}{req && " *"}</label>
            <input data-testid={`billing-${k}`} required={req} value={form[k]} onChange={set(k)} autoComplete={k === "zip" ? "postal-code" : k.replace("_", "-")}
              className="h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]" />
          </div>
        ))}
      </div>
      <button data-testid="billing-details-save" type="submit" disabled={saving} className="flex min-h-[50px] w-full items-center justify-center rounded-2xl bg-[#2D6A4F] font-semibold text-white hover:bg-[#1B4332] disabled:opacity-60">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : t("save_continue")}
      </button>
    </form>
  );
};
