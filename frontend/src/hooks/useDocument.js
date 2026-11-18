import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";

export function useDocument(id) {
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/documents/${id}`)
      .then(({ data }) => { if (active) setDoc(data); })
      .catch(() => { toast.error("Documento non trovato"); navigate("/archive"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, navigate]);

  return { doc, loading };
}
