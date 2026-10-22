"use client";

import { motion, useAnimationControls } from "framer-motion";
import { Delete, LockOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cx } from "@/app/bunker/_components/ui";

/* ──────────────────────────────────────────────────────────────────────
 * Цифровая клавиатура PIN (4–8 цифр). Точки показывают только введённое,
 * чтобы по экрану нельзя было понять длину PIN. Работает и с клавиатуры.
 * ──────────────────────────────────────────────────────────────────── */

export const PIN_MIN = 4;
export const PIN_MAX = 8;

export function PinPad({
  onSubmit,
  busy,
  disabled,
  hint,
  error,
  errorTick = 0,
}: {
  onSubmit: (pin: string) => void;
  busy?: boolean;
  /** блокировка ввода (пауза после ошибок) */
  disabled?: boolean;
  hint?: string;
  error?: string | null;
  /** растёт при каждой ошибке — даже если текст тот же */
  errorTick?: number;
}) {
  const [pin, setPin] = useState("");
  const controls = useAnimationControls();
  const off = busy || disabled;

  useEffect(() => {
    if (!errorTick) return;
    void controls.start({ x: [0, -12, 12, -8, 8, -4, 0], transition: { duration: 0.42 } });
  }, [errorTick, controls]);

  const press = useCallback(
    (d: string) => {
      if (off) return;
      if (d === "del") return setPin((p) => p.slice(0, -1));
      if (d === "ok") {
        if (pin.length < PIN_MIN) return;
        onSubmit(pin);
        return setPin("");
      }
      setPin((p) => (p.length < PIN_MAX ? p + d : p));
    },
    [off, pin, onSubmit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") press("ok");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"];
  const slots = Math.max(PIN_MIN, pin.length);

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <motion.div animate={controls} className="mb-3 flex h-4 justify-center gap-3.5" aria-live="polite" aria-label={`Введено цифр: ${pin.length}`}>
        {Array.from({ length: slots }).map((_, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0.6 }}
            animate={{ scale: i < pin.length ? 1 : 0.8, backgroundColor: i < pin.length ? "#c9a961" : "rgba(255,255,255,0)" }}
            transition={{ type: "spring", stiffness: 600, damping: 26 }}
            className={cx("h-3.5 w-3.5 rounded-full border", i < pin.length ? "border-[#c9a961]" : "border-white/20")}
          />
        ))}
      </motion.div>
      <p className={cx("mb-6 min-h-5 text-center text-sm", error ? "text-red-300" : "text-zinc-600")}>
        {busy ? "Проверяю…" : error ?? hint ?? ""}
      </p>
      <div className="grid grid-cols-3 gap-4">
        {keys.map((k) => (
          <motion.button
            key={k}
            type="button"
            whileTap={off ? undefined : { scale: 0.86, backgroundColor: "rgba(201,169,97,0.25)" }}
            onClick={() => press(k)}
            disabled={off || (k === "ok" && pin.length < PIN_MIN)}
            aria-label={k === "del" ? "Стереть" : k === "ok" ? "Готово" : k}
            className={cx(
              "flex aspect-square select-none items-center justify-center rounded-full text-2xl font-light transition-colors disabled:opacity-30",
              k === "ok"
                ? "bg-[#c9a961] text-black"
                : k === "del"
                  ? "text-zinc-400"
                  : "border border-white/[0.08] bg-white/[0.03] text-white",
            )}
          >
            {k === "del" ? <Delete className="h-6 w-6" /> : k === "ok" ? <LockOpen className="h-6 w-6" /> : k}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
