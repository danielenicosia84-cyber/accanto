import { useEffect, useState } from "react";
import { Loader2, Trash2, Copy, Check, KeyRound } from "lucide-react";
import { toast } from "sonner";
import api, { errorMessage } from "@/lib/api";

const inputCls = "h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2D6A4F]";

const CodeRow = ({ c, onDelete }) => {
  const [ok, setOk] = useState(false);
  const copy = async () => { await navigator.clipboard?.writeText(c.code); setOk(true); setTimeout(() => setOk(false), 1500); };
  const used = c.max_uses ? `${c.used_count}/${c.max_uses}` : `${c.used_count}/∞`;
  return (
    <li data-testid={`admin-code-${c.code}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="font-mono text-sm font-bold text-slate-900">{c.code}</p>
        <p className="text-xs text-slate-500">{c.plan} · {c.interval}{c.months ? ` · ${c.months} mesi` : ""} · usi {used}{c.note ? ` · ${c.note}` : ""}</p>
      </div>
      <div className="flex items-center">
        <button onClick={copy} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Copia">{ok ? <Check className="h-4 w-4 text-[#2D6A4F]" /> : <Copy className="h-4 w-4" />}</button>
        <button data-testid={`admin-code-delete-${c.code}`} onClick={() => onDelete(c)} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500" aria-label="Elimina"><Trash2 className="h-4 w-4" /></button>
      </div>
    </li>
  );
};

export const AdminCodes = () => {
  const [codes, setCodes] = useState(null);
  const [form, setForm] = useState({ plan: "famiglia", interval: "monthly", months: 1, max_uses: 1, expires_days: 0, note: "", quantity: 1 });
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/admin/codes").then((r) => setCodes(r.data)).catch((err) => toast.error(errorMessage(err)));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/admin/codes", form);
      toast.success(`${data.length} codice/i creati`);
      load();
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };

  const del = async (c) => {
    try { await api.delete(`/admin/codes/${c.id}`); setCodes((l) => l.filter((x) => x.id !== c.id)); }
    catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="space-y-4" data-testid="admin-codes">
      <form onSubmit={create} className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-900"><KeyRound className="h-4 w-4 text-[#2D6A4F]" /> Genera Codici Licenza / Coupon VIP</p>
        <div className="grid grid-cols-2 gap-2">
          <select data-testid="admin-code-plan" value={form.plan} onChange={set("plan")} className={inputCls}>
            <option value="base">Base</option><option value="famiglia">Famiglia & Caregiver</option><option value="completo">Completo</option><option value="lifetime">Lifetime</option>
          </select>
          {form.plan !== "lifetime" && (
            <select value={form.interval} onChange={set("interval")} className={inputCls}><option value="monthly">Mensile</option><option value="yearly">Annuale</option></select>
          )}
          {form.plan !== "lifetime" && (
            <label className="text-xs text-slate-600">Durata (mesi)<input type="number" min={0} value={form.months} onChange={set("months")} className={`${inputCls} mt-1 w-full`} /></label>
          )}
          <label className="text-xs text-slate-600">Usi massimi (0 = illimitati)<input type="number" min={0} value={form.max_uses} onChange={set("max_uses")} className={`${inputCls} mt-1 w-full`} /></label>
          <label className="text-xs text-slate-600">Scade tra (giorni, 0 = mai)<input type="number" min={0} value={form.expires_days} onChange={set("expires_days")} className={`${inputCls} mt-1 w-full`} /></label>
          <label className="text-xs text-slate-600">Quantita'<input data-testid="admin-code-quantity" type="number" min={1} max={50} value={form.quantity} onChange={set("quantity")} className={`${inputCls} mt-1 w-full`} /></label>
          <label className="col-span-2 text-xs text-slate-600">Nota interna<input value={form.note} onChange={set("note")} className={`${inputCls} mt-1 w-full`} placeholder="Es. Regalo zia Maria" /></label>
        </div>
        <button data-testid="admin-code-create" type="submit" disabled={busy} className="mt-3 flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#2D6A4F] font-semibold text-white hover:bg-[#1B4332] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Genera codici"}</button>
      </form>
      {!codes ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#2D6A4F]" /> : codes.length === 0 ? <p className="text-sm text-slate-500">Nessun codice generato.</p> : (
        <ul className="space-y-2">{codes.map((c) => <CodeRow key={c.id} c={c} onDelete={del} />)}</ul>
      )}
    </div>
  );
};
