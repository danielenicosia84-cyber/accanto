import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(() => localStorage.getItem("dopo_active_profile") || null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get("/profiles");
      setProfiles(data);
      setActiveId((cur) => {
        if (cur && data.some((p) => p.id === cur)) return cur;
        return data[0]?.id || null;
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) refresh();
    else { setProfiles([]); setActiveId(null); }
  }, [user, refresh]);

  useEffect(() => {
    if (activeId) localStorage.setItem("dopo_active_profile", activeId);
  }, [activeId]);

  const addProfile = useCallback(async (payload) => {
    const { data } = await api.post("/profiles", payload);
    setProfiles((p) => [...p, data]);
    setActiveId(data.id);
    return data;
  }, []);

  const removeProfile = useCallback(async (id) => {
    await api.delete(`/profiles/${id}`);
    await refresh();
  }, [refresh]);

  const activeProfile = useMemo(() => profiles.find((p) => p.id === activeId) || null, [profiles, activeId]);

  const value = useMemo(
    () => ({ profiles, activeProfile, activeId, setActiveId, addProfile, removeProfile, refresh, loading }),
    [profiles, activeProfile, activeId, addProfile, removeProfile, refresh, loading]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export const useProfiles = () => useContext(ProfileContext);
