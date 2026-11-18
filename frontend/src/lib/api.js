import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const getToken = () => localStorage.getItem("dopo_token");
export const setToken = (t) => localStorage.setItem("dopo_token", t);
export const clearToken = () => localStorage.removeItem("dopo_token");

const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || "";
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/register");
    if (error.response?.status === 401 && getToken() && !isAuthCall) {
      clearToken();
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

export function apiError(detail) {
  if (detail == null) return "Si è verificato un errore. Riprova.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

// Friendly, user-facing message from any axios error.
export function errorMessage(err) {
  if (err?.code === "ECONNABORTED") return "La lettura sta impiegando troppo tempo. Riprova tra poco.";
  if (err && !err.response) return "Connessione assente. Controlla la rete e riprova.";
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    const isEmail = detail.some((d) => Array.isArray(d?.loc) && d.loc.includes("email"));
    return isEmail ? "Inserisci un indirizzo email valido." : "Controlla i dati inseriti e riprova.";
  }
  if (detail) return apiError(detail);
  if (err?.response?.status >= 500) return "Problema temporaneo del server. Riprova tra poco.";
  if (err?.response?.status === 413) return "Il file è troppo grande. Prova con un file più piccolo (max 15MB).";
  return "Si è verificato un errore. Riprova.";
}

export const isPaywall = (err) => err?.response?.status === 402;

export async function downloadFile(url, filename) {
  const { data } = await api.get(url, { responseType: "blob" });
  const href = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

export default api;
