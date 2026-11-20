import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import api, { setToken, clearToken, getToken } from "@/lib/api";
import { log } from "@/lib/log";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = anon, obj = logged
  const [checked, setChecked] = useState(false);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setUser(false);
      setChecked(true);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      clearToken();
      setUser(false);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

const register = useCallback(async (name, email, password, consents = {}) => {
    const { data } = await api.post("/auth/register", { name, email, password, accept_terms: !!consents.terms, accept_health: !!consents.health, accept_disclaimer: !!consents.disclaimer });
    setToken(data.token);
    setUser(data.user);
    if (data.recovery_code) {
      sessionStorage.setItem("accanto_recovery_code", data.recovery_code);
    }
    return { ...data.user, recovery_code: data.recovery_code };
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      log.warn("Logout request failed; clearing local session anyway", err);
    }
    clearToken();
    setUser(false);
  }, []);

  const value = useMemo(() => ({ user, checked, login, register, logout }), [user, checked, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
