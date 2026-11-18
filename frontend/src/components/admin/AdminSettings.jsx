import { useEffect, useState } from "react";
import { Loader2, Save, RefreshCw, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import api, { errorMessage } from "@/lib/api";

const inputCls = "h-[46px] w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#E8F5E9]";
const Field = ({ label, children, hint }) => (
  <div>
    <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
    {children}
    {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
  </div>
);

const Card = ({ title, children, action }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="font-heading text-base font-bold text-slate-900">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const SaveBtn = ({ busy, testId }) => (
  <button data-testid={testId} type="submit" disabled={busy} className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#2D6A4F] px-4 font-semibold text-white hover:bg-[#1B4332] disabled:opacity-60">
    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salva
  </button>
);

const CopyBtn = ({ value }) => {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={async () => { await navigator.clipboard?.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); }} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Copia">
      {ok ? <Check className="h-4 w-4 text-[#2D6A4F]" /> : <Copy className="h-4 w-4" />}
    </button>
  );
};

export const AdminSettings = () => {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState("");
  const load = () => api.get("/admin/settings").then((r) => setS({ issuer: {}, ...r.data, paypal_secret: "" }));
  useEffect(() => { load(); }, []);
  if (!s) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#2D6A4F]" />;
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setIssuer = (k) => (e) => setS((x) => ({ ...x, issuer: { ...(x.issuer || {}), [k]: e.target.value } }));

  const save = async (fields, label) => {
    setBusy(label);
    try {
      const body = Object.fromEntries(fields.map((k) => [k, s[k]]).filter(([, v]) => v !== undefined && v !== ""));
      if (fields.includes("manual_enabled")) body.manual_enabled = s.manual_enabled !== false;
      const { data } = await api.put("/admin/settings", body);
      setS((x) => ({ ...x, ...data, paypal_secret: "" }));
      toast.success("Impostazioni salvate");
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(""); }
  };

  const sync = async () => {
    setBusy("sync");
    try {
      const { data } = await api.post("/admin/paypal/sync", { origin_url: window.location.origin });
      toast.success(`Piani PayPal pronti (${Object.keys(data.plan_ids).length}) · webhook ${data.webhook_id ? "registrato" : "non registrato"}`);
      await load();
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(""); }
  };

  const webhookUrl = `${window.location.origin}/api/paypal/webhook`;

  return (
    <div className="space-y-4" data-testid="admin-settings">
      <Card title="PayPal (Smart Checkout + Carte)">
        <form onSubmit={(e) => { e.preventDefault(); save(["paypal_client_id", "paypal_secret", "paypal_mode"], "paypal"); }} className="space-y-3">
          <Field label="Modalita'">
            <select data-testid="admin-paypal-mode" value={s.paypal_mode || "sandbox"} onChange={set("paypal_mode")} className={inputCls}>
              <option value="sandbox">Sandbox (test, nessun addebito)</option>
              <option value="live">Live (pagamenti reali)</option>
            </select>
          </Field>
          <Field label="Client ID"><input data-testid="admin-paypal-client-id" value={s.paypal_client_id || ""} onChange={set("paypal_client_id")} className={inputCls} /></Field>
          <Field label={`Secret ${s.paypal_secret_set ? "(gia' impostato - lascia vuoto per non cambiare)" : ""}`}><input data-testid="admin-paypal-secret" type="password" value={s.paypal_secret || ""} onChange={set("paypal_secret")} className={inputCls} placeholder="••••••••" /></Field>
          <div className="flex flex-wrap gap-2">
            <SaveBtn busy={busy === "paypal"} testId="admin-save-paypal" />
            <button type="button" data-testid="admin-paypal-sync" onClick={sync} disabled={busy === "sync"} className="flex min-h-[46px] items-center gap-2 rounded-xl border-2 border-[#2D6A4F] px-4 font-semibold text-[#2D6A4F] hover:bg-[#E8F5E9] disabled:opacity-60">
              {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Crea/aggiorna piani PayPal + webhook
            </button>
          </div>
        </form>
        <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
          <p className="font-semibold text-slate-700">ID piani ricorrenti su PayPal</p>
          {Object.keys(s.paypal_plan_ids || {}).length === 0 ? <p className="text-slate-500">Nessun piano creato: premi "Crea/aggiorna piani".</p> : Object.entries(s.paypal_plan_ids).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2"><span className="text-slate-600">{k}</span><span className="flex items-center gap-1 font-mono text-slate-900">{v}<CopyBtn value={v} /></span></div>
          ))}
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2"><span className="text-slate-600">Webhook URL</span><span className="flex items-center gap-1 break-all font-mono text-slate-900">{webhookUrl}<CopyBtn value={webhookUrl} /></span></div>
          <div className="flex items-center justify-between gap-2"><span className="text-slate-600">Webhook ID</span><span className="font-mono text-slate-900">{s.paypal_webhook_id || "—"}</span></div>
        </div>
      </Card>

      <Card title="Bonifico / Revolut (attivazione con 1 clic)">
        <form onSubmit={(e) => { e.preventDefault(); save(["revolut_link", "iban", "bank_holder", "manual_enabled", "manual_instructions"], "manual"); }} className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input data-testid="admin-manual-enabled" type="checkbox" checked={s.manual_enabled !== false} onChange={set("manual_enabled")} className="h-5 w-5 accent-[#2D6A4F]" /> Mostra l'opzione Bonifico / Revolut agli utenti</label>
          <Field label="Link Revolut.me"><input data-testid="admin-revolut" value={s.revolut_link || ""} onChange={set("revolut_link")} className={inputCls} placeholder="https://revolut.me/tuonome" /></Field>
          <Field label="IBAN"><input data-testid="admin-iban" value={s.iban || ""} onChange={set("iban")} className={inputCls} placeholder="IT60 X054 2811 1010 0000 0123 456" /></Field>
          <Field label="Intestatario conto"><input data-testid="admin-bank-holder" value={s.bank_holder || ""} onChange={set("bank_holder")} className={inputCls} /></Field>
          <Field label="Istruzioni aggiuntive"><textarea value={s.manual_instructions || ""} onChange={set("manual_instructions")} rows={2} className={`${inputCls} h-auto py-2`} /></Field>
          <SaveBtn busy={busy === "manual"} testId="admin-save-manual" />
        </form>
      </Card>

      <Card title="Dati emittente e dicitura fiscale (Ricevute PDF)">
        <form onSubmit={(e) => { e.preventDefault(); save(["issuer"], "issuer"); }} className="space-y-3">
          {[["name", "Nome / Ragione sociale"], ["address", "Indirizzo"], ["fiscal_code", "Codice Fiscale"], ["vat", "Partita IVA"], ["email", "Email di contatto"]].map(([k, l]) => (
            <Field key={k} label={l}><input data-testid={`admin-issuer-${k}`} value={s.issuer?.[k] || ""} onChange={setIssuer(k)} className={inputCls} /></Field>
          ))}
          <Field label="Dicitura fiscale (IT)"><textarea data-testid="admin-issuer-footer-it" value={s.issuer?.footer_it || ""} onChange={setIssuer("footer_it")} rows={2} className={`${inputCls} h-auto py-2`} placeholder="Operazione non soggetta a fattura ai sensi dell'art. 22 DPR 633/72…" /></Field>
          <Field label="Dicitura fiscale (EN)"><textarea value={s.issuer?.footer_en || ""} onChange={setIssuer("footer_en")} rows={2} className={`${inputCls} h-auto py-2`} /></Field>
          <SaveBtn busy={busy === "issuer"} testId="admin-save-issuer" />
        </form>
      </Card>
    </div>
  );
};
