"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; text: string; tone: "info" | "error"; action?: { label: string; run: () => void } };
type Notify = (text: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;

const ToastContext = createContext<Notify>(() => {});

export function useBunkerToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const notify = useCallback<Notify>((text, opts) => {
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-2), { id, text, tone: opts?.tone ?? "info", action: opts?.action }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), opts?.action ? 5000 : 3200);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[200] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm shadow-2xl backdrop-blur-xl ${
                t.tone === "error"
                  ? "border-red-500/30 bg-red-950/80 text-red-100"
                  : "border-white/10 bg-zinc-900/90 text-zinc-100"
              }`}
            >
              <span>{t.text}</span>
              {t.action && (
                <button
                  className="font-medium text-[#c9a961]"
                  onClick={() => {
                    t.action?.run();
                    setToasts((list) => list.filter((x) => x.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
