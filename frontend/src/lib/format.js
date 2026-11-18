export function formatDate(iso, lang = "it") {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export const CATEGORY_STYLES = {
  "Referto": { bg: "#EFF6FF", text: "#1E40AF" },
  "Lettera di dimissione": { bg: "#FDF0ED", text: "#C85F46" },
  "Ricetta": { bg: "#FEF3C7", text: "#92400E" },
  "Esame": { bg: "#E8F5E9", text: "#2D6A4F" },
  "Altro": { bg: "#F1F5F9", text: "#475569" },
};

export function catStyle(cat) {
  return CATEGORY_STYLES[cat] || CATEGORY_STYLES["Altro"];
}
