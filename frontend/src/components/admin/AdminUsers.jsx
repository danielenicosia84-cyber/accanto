import { useEffect, useState } from "react";
import { Loader2, Search, Crown, Eye, Zap } from "lucide-react";
import { toast } from "sonner";
import api, { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";

const PLAN_OPTIONS = [["trial", "Prova (7 gg)"], ["base", "Base"], ["famiglia", "Famiglia & Caregiver"], ["completo", "Completo"], ["lifetime", "Lifetime"], ["expired", "Scaduto / Demo"]];
const STATUS_TONE = { active: "bg-[#E8F5E9] text-[#1B4332]", trial: "bg-[#FEF3C7] text-[#92400E]", expired: "bg-[#FDF0ED] text-[#C85F46]", demo: "bg-[#E8F0FE] text-[#1E40AF]", owner: "bg-[#FEF3C7] text-[#92400E]" };

const UserRow = ({ u, onChanged, onSimulate }) => {
  const [plan, setPlan] = useState(u.plan in Object.fromEntries(PLAN_OPTIONS) ? u.plan : "trial");
  const [interval, setInterval] = useState(u.interval === "yearly" || u.interval === "year" ? "yearly" : "monthly");
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    setBusy(true);
    try { const { data } = await api.put(`/admin/users/${u.id}/plan`, { plan, interval }); onChanged(data); toast.success(`Piano aggiornato per ${u.email}`); }
    catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return (
    <li data-testid={`admin-user-${u.id}`} className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-semibold text-slate-900">{u.is_owner && <Crown className="h-3.5 w-3.5 text-[#D97706]" />}{u.is_demo && <Eye className="h-3.5 w-3.5 text-[#1E40AF]" />}{u.email}</p>
          <p className="text-xs text-slate-500">{u.name} · {u.created_at ? formatDate(u.created_at) : ""}</p>
        </div>
        <span data-testid={`admin-user-status-${u.id}`} className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[u.status] || "bg-slate-100 text-slate-600"}`}>
          {u.plan}{u.status === "trial" ? ` · ${u.trial_days_left}gg` : ""}{u.current_period_end ? ` · ${formatDate(u.current_period_end)}` : ""}
        </span>
      </div>
      {!u.is_owner && !u.is_demo && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select data-testid={`admin-user-plan-${u.id}`} value={plan} onChange={(e) => setPlan(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm">
            {PLAN_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {!["trial", "expired", "lifetime"].includes(plan) && (
            <select value={interval} onChange={(e) => setInterval(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm">
              <option value="monthly">Mensile</option><option value="yearly">Annuale</option>
            </select>
          )}
          <button data-testid={`admin-user-apply-${u.id}`} onClick={apply} disabled={busy} className="flex h-10 items-center rounded-lg bg-[#2D6A4F] px-3 text-sm font-semibold text-white hover:bg-[#1B4332] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Applica"}</button>
          <button data-testid={`admin-user-simulate-${u.id}`} onClick={() => onSimulate(u)} className="flex h-10 items-center gap-1 rounded-lg border border-[#D97706] px-3 text-sm font-semibold text-[#92400E] hover:bg-[#FEF3C7]"><Zap className="h-3.5 w-3.5" /> Simula pagamento</button>
        </div>
      )}
    </li>
  );
};

export const AdminUsers = () => {
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState("");
  const load = (query = "") => api.get("/admin/users", { params: { q: query } }).then((r) => setUsers(r.data)).catch((err) => toast.error(errorMessage(err)));
  useEffect(() => { load(); }, []);
  const onChanged = (u) => setUsers((list) => list.map((x) => (x.id === u.id ? u : x)));
  const simulate = async (u) => {
    try {
      const { data } = await api.post("/admin/simulate-payment", { user_id: u.id, plan: "famiglia", interval: "monthly" });
      toast.success(`Pagamento simulato: ricevuta ${data.payment?.receipt_number}`);
      load(q);
    } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <div className="space-y-3" data-testid="admin-users">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input data-testid="admin-users-search" value={q} onChange={(e) => { setQ(e.target.value); load(e.target.value); }} placeholder="Cerca per email…" className="h-[46px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-base outline-none focus:border-[#2D6A4F]" />
      </div>
      {!users ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#2D6A4F]" /> : (
        <ul className="space-y-2">{users.map((u) => <UserRow key={u.id} u={u} onChanged={onChanged} onSimulate={simulate} />)}</ul>
      )}
    </div>
  );
};
