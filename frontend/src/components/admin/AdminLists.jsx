import { useEffect, useState } from "react";
import { Loader2, Check, X, Download, Zap } from "lucide-react";
import { toast } from "sonner";
import api, { errorMessage, downloadFile } from "@/lib/api";
import { formatDate } from "@/lib/format";

const eur = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;

export const AdminRequests = () => {
  const [rows, setRows] = useState(null);
  const load = () => api.get("/admin/requests").then((r) => setRows(r.data)).catch((err) => toast.error(errorMessage(err)));
  useEffect(() => { load(); }, []);
  const decide = async (r, approve) => {
    try { await api.post(`/admin/requests/${r.id}`, { approve }); toast.success(approve ? `Piano attivato per ${r.email}` : "Richiesta rifiutata"); load(); }
    catch (err) { toast.error(errorMessage(err)); }
  };
  if (!rows) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#2D6A4F]" />;
  if (rows.length === 0) return <p data-testid="admin-requests-empty" className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Nessuna richiesta di attivazione via bonifico in attesa.</p>;
  return (
    <ul className="space-y-2" data-testid="admin-requests">
      {rows.map((r) => (
        <li key={r.id} data-testid={`admin-request-${r.reference}`} className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{r.email}</p>
              <p className="text-xs text-slate-500">{r.plan} · {r.interval} · <span className="font-bold text-slate-900">{eur(r.amount)}</span> · causale <span className="font-mono font-bold">{r.reference}</span></p>
              <p className="text-xs text-slate-400">{formatDate(r.created_at)}</p>
            </div>
            <div className="flex gap-1">
              <button data-testid={`admin-request-approve-${r.reference}`} onClick={() => decide(r, true)} className="flex h-10 items-center gap-1 rounded-lg bg-[#2D6A4F] px-3 text-sm font-semibold text-white hover:bg-[#1B4332]"><Check className="h-4 w-4" /> Attiva</button>
              <button onClick={() => decide(r, false)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-500" aria-label="Rifiuta"><X className="h-4 w-4" /></button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

export const AdminPayments = () => {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => { api.get("/admin/payments").then((r) => setRows(r.data)).catch((err) => toast.error(errorMessage(err))); }, []);
  if (!rows) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#2D6A4F]" />;
  const dl = async (p) => {
    setBusy(p.id);
    try { await downloadFile(`/billing/receipts/${p.id}.pdf`, `${p.receipt_number}.pdf`); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(null); }
  };
  if (rows.length === 0) return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Nessun pagamento registrato.</p>;
  return (
    <ul className="space-y-2" data-testid="admin-payments">
      {rows.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{p.receipt_number} · {eur(p.amount)} · {p.provider}</p>
            <p className="truncate text-xs text-slate-500">{p.email} · {p.plan_name} · {formatDate(p.created_at)}</p>
          </div>
          {p.has_pdf && <button onClick={() => dl(p)} disabled={busy === p.id} className="flex min-h-[40px] items-center gap-1 rounded-full bg-slate-50 px-3 text-xs font-bold text-[#2D6A4F] hover:bg-[#E8F5E9]">{busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF</button>}
        </li>
      ))}
    </ul>
  );
};

export const AdminOverview = ({ onSimulated }) => {
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/admin/stats").then((r) => setStats(r.data)).catch((err) => toast.error(errorMessage(err)));
  useEffect(() => { load(); }, []);
  const simulate = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/simulate-payment", { plan: "famiglia", interval: "monthly" });
      toast.success(`Pagamento simulato OK · ricevuta ${data.payment?.receipt_number}`);
      if (data.payment?.id) await downloadFile(`/billing/receipts/${data.payment.id}.pdf`, `${data.payment.receipt_number}.pdf`);
      load(); onSimulated?.();
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-4" data-testid="admin-overview">
      <div className="grid grid-cols-2 gap-3">
        {[["Utenti registrati", stats?.users], ["Abbonamenti attivi", stats?.active_subscriptions], ["Richieste bonifico", stats?.pending_requests], ["Incassato", stats ? eur(stats.revenue) : null]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{l}</p>
            <p className="font-heading text-2xl font-bold text-slate-900">{v ?? "—"}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[#D97706] bg-[#FFFBEB] p-4">
        <p className="font-heading text-base font-bold text-slate-900">Simula Pagamento 1-Clic</p>
        <p className="mt-1 text-sm text-slate-600">Collauda lo sblocco automatico e la ricevuta PDF: genera una ricevuta di test intestata al tuo account (il tuo piano resta illimitato).</p>
        <button data-testid="admin-simulate-payment" onClick={simulate} disabled={busy} className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#D97706] font-semibold text-white hover:bg-[#B45309] disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />} Simula pagamento e scarica ricevuta
        </button>
      </div>
    </div>
  );
};
