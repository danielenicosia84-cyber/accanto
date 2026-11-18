import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Crown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminCodes } from "@/components/admin/AdminCodes";
import { AdminOverview, AdminRequests, AdminPayments } from "@/components/admin/AdminLists";

const TABS = [
  ["overview", "Panoramica"], ["settings", "Impostazioni"], ["users", "Utenti"], ["codes", "Codici"], ["requests", "Bonifici"], ["payments", "Pagamenti"],
];

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  if (user && !user.is_owner) return <Navigate to="/" replace />;

  return (
    <div className="animate-fade-up space-y-4" data-testid="admin-page">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#D97706]"><Crown className="h-5 w-5" /></span>
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Pannello Admin & Pagamenti</h1>
          <p className="text-xs text-slate-500">Area riservata al proprietario</p>
        </div>
      </div>
      <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scroll-fade">
        {TABS.map(([k, l]) => (
          <button key={k} data-testid={`admin-tab-${k}`} onClick={() => setTab(k)}
            className={`min-h-[44px] whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${tab === k ? "bg-[#2D6A4F] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>
      {tab === "overview" && <AdminOverview />}
      {tab === "settings" && <AdminSettings />}
      {tab === "users" && <AdminUsers />}
      {tab === "codes" && <AdminCodes />}
      {tab === "requests" && <AdminRequests />}
      {tab === "payments" && <AdminPayments />}
    </div>
  );
}
