import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import api from "@/lib/api";
import { log } from "@/lib/log";
import { useAuth } from "@/context/AuthContext";

const BillingContext = createContext(null);

export function BillingProvider({ children }) {
  const { user } = useAuth();
  const [billing, setBilling] = useState(null);

  const refreshBilling = useCallback(async () => {
    if (!user) { setBilling(null); return; }
    try {
      const { data } = await api.get("/billing/me");
      setBilling(data);
    } catch (err) {
      log.warn("Billing info unavailable", err);
    }
  }, [user]);

  useEffect(() => { refreshBilling(); }, [refreshBilling]);

  const value = useMemo(() => ({ billing, refreshBilling }), [billing, refreshBilling]);
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export const useBilling = () => useContext(BillingContext);
