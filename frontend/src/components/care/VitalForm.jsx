import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import api, { errorMessage } from "@/lib/api";
import { INPUT, BTN_PRIMARY, BTN_SECONDARY, VITAL_TYPES, nowLocalInput } from "@/lib/care";
import { Field } from "@/components/care/CareShell";

export const VitalForm = ({ profileId, onSaved, onCancel, defaultType = "pressure" }) => {
  const { t } = useLang();
  const [type, setType] = useState(defaultType);
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [when, setWhen] = useState(nowLocalInput());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = VITAL_TYPES[type];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { type, value: Number(value), value2: meta.two ? Number(value2) : null, measured_at: new Date(when).toISOString(), notes };
      const res = await api.post(`/profiles/${profileId}/vitals`, body);
      toast.success(t("saved_ok"));
      onSaved(res.data);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} data-testid="vital-form" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Field label={t("vital_type")}>
        <select data-testid="vital-type" className={INPUT} value={type} onChange={(e) => { setType(e.target.value); setValue(""); setValue2(""); }}>
          {Object.keys(VITAL_TYPES).map((k) => <option key={k} value={k}>{t(`vital_${k}`)} ({VITAL_TYPES[k].unit})</option>)}
        </select>
      </Field>
      <div className={`grid gap-3 ${meta.two ? "grid-cols-2" : "grid-cols-1"}`}>
        <Field label={meta.two ? t("vital_sys") : `${t("vital_value")} (${meta.unit})`}>
          <input data-testid="vital-value" required type="number" step={meta.step} inputMode="decimal" className={`${INPUT} text-xl font-bold`} value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        {meta.two && <Field label={t("vital_value2")}><input data-testid="vital-value2" required type="number" step="1" inputMode="numeric" className={`${INPUT} text-xl font-bold`} value={value2} onChange={(e) => setValue2(e.target.value)} /></Field>}
      </div>
      <Field label={t("vital_when")}><input data-testid="vital-when" type="datetime-local" className={INPUT} value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
      <Field label={t("vital_notes")}><input data-testid="vital-notes" className={INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className={`${BTN_SECONDARY} flex-1`}>{t("cancel")}</button>
        <button data-testid="vital-save" type="submit" disabled={busy} className={`${BTN_PRIMARY} flex-1`}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("save")}</button>
      </div>
    </form>
  );
};

export const Sparkline = ({ points, color }) => {
  if (points.length < 2) return null;
  const w = 320, h = 70, pad = 6;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${pad + (i * (w - 2 * pad)) / (points.length - 1)},${h - pad - ((p - min) / span) * (h - 2 * pad)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" data-testid="vitals-sparkline" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={pad + (i * (w - 2 * pad)) / (points.length - 1)} cy={h - pad - ((p - min) / span) * (h - 2 * pad)} r="3" fill={color} />)}
    </svg>
  );
};
