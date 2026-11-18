import { toast } from "sonner";
import { downloadFile, errorMessage } from "@/lib/api";

export const INPUT = "h-[52px] w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]";
export const TEXTAREA = "min-h-[88px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]";
export const BTN_PRIMARY = "flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#2D6A4F] px-5 font-semibold text-white transition-colors hover:bg-[#1B4332] disabled:opacity-60";
export const BTN_SECONDARY = "flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60";

export const VITAL_TYPES = {
  pressure: { unit: "mmHg", two: true, color: "#C85F46", step: 1 },
  heart_rate: { unit: "bpm", color: "#D97706", step: 1 },
  glucose: { unit: "mg/dL", color: "#1E40AF", step: 1 },
  weight: { unit: "kg", color: "#2D6A4F", step: 0.1 },
  temperature: { unit: "°C", color: "#7C3AED", step: 0.1 },
  spo2: { unit: "%", color: "#0F766E", step: 1 },
};

export const EXPENSE_CATEGORIES = ["visite", "farmaci", "esami", "ticket", "dispositivi", "dentista", "ricoveri", "assistenza", "altro"];

export const KIT_LANGS = { en: "English", ro: "Română", uk: "Українська", ru: "Русский", es: "Español", pl: "Polski", fr: "Français", de: "Deutsch", pt: "Português", sq: "Shqip" };

export const eur = (n) => `${Number(n || 0).toFixed(2).replace(".", ",")} €`;

export const vitalValue = (v) => (VITAL_TYPES[v.type]?.two ? `${v.value}/${v.value2 ?? ""}` : `${v.value}`);

export const todayInput = () => new Date().toISOString().slice(0, 10);

export const nowLocalInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export async function download(url, filename, loadingText) {
  const id = toast.loading(loadingText || "...");
  try {
    await downloadFile(url, filename);
    toast.dismiss(id);
  } catch (err) {
    toast.dismiss(id);
    toast.error(errorMessage(err));
    throw err;
  }
}
