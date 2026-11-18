import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { translations } from "@/lib/i18n";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("dopo_lang") || "it");

  useEffect(() => {
    localStorage.setItem("dopo_lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key) => translations[lang][key] ?? translations.it[key] ?? key, [lang]);
  const toggle = useCallback(() => setLang((l) => (l === "it" ? "en" : "it")), []);

  const value = useMemo(() => ({ lang, setLang, toggle, t }), [lang, toggle, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLang = () => useContext(LanguageContext);
