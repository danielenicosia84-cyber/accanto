import { useEffect, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useProfiles } from "@/context/ProfileContext";
import api, { errorMessage } from "@/lib/api";
import { BTN_PRIMARY, INPUT, KIT_LANGS, download } from "@/lib/care";
import { CarePage, useFeature } from "@/components/care/CareShell";

export default function Kit() {
  const { t } = useLang();
  const { activeId, activeProfile } = useProfiles();
  const allowed = useFeature("caregiver_kit");
  const [lang, setLang] = useState("ro");
  const [kit, setKit] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeId || !allowed) return;
    setLoading(true);
    api.get(`/profiles/${activeId}/kit`, { params: { lang } }).then((r) => setKit(r.data)).catch((err) => { if (err?.response?.status !== 402) toast.error(errorMessage(err)); }).finally(() => setLoading(false));
  }, [activeId, lang, allowed]);

  return (
    <CarePage title={t("kit_title")} subtitle={t("kit_sub")} feature="caregiver_kit" kit testId="kit-page">
      <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">{t("kit_lang")}</span>
        <select data-testid="kit-lang" className={INPUT} value={lang} onChange={(e) => setLang(e.target.value)}>{Object.entries(KIT_LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </label>
      <button data-testid="kit-download" onClick={() => download(`/profiles/${activeId}/kit/pdf?lang=${lang}`, `Accanto-Kit-${lang}-${activeProfile?.name || ""}.pdf`, t("downloading"))} className={`${BTN_PRIMARY} w-full`}><FileDown className="h-5 w-5" /> {t("kit_download")}</button>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-heading text-base font-bold text-slate-900">{t("kit_phrases")} · Italiano / {KIT_LANGS[lang]}</h2>
        {loading || !kit ? (
          <p className="flex items-center gap-2 text-sm text-slate-500" data-testid="kit-loading"><Loader2 className="h-4 w-4 animate-spin" /> {t("kit_preparing")}</p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="kit-phrases">
            {kit.phrases.map((p, i) => (
              <li key={i} className="py-2.5">
                <p className="font-semibold text-slate-900">{p.it}</p>
                <p className="text-sm text-[#2D6A4F]">{p.tr}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </CarePage>
  );
}
