"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "EN" | "RU" | "ES" | "PT";

export const LANGS: Lang[] = ["EN", "RU", "ES", "PT"];

const STORAGE_KEY = "voyage-lang";
const DEFAULT_LANG: Lang = "EN";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as string[]).includes(value);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Всегда стартуем с EN, чтобы серверный и клиентский рендер совпадали
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // После монтирования подтягиваем сохранённый выбор пользователя
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isLang(saved)) setLangState(saved);
    } catch {
      /* localStorage недоступен — остаёмся на EN */
    }
  }, []);

  // Синхронизируем атрибут lang у <html> для SEO и доступности
  useEffect(() => {
    document.documentElement.lang = lang.toLowerCase();
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* игнорируем */
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}