"use client";

import { motion } from "framer-motion";
import { Lock, ShieldCheck } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { bunkerPinStatus, getVaultPepper, setupMasterPin, unlockBunker, type UnlockResult } from "@/app/actions/bunker";
import { PinPad } from "@/app/bunker/_components/PinPad";
import { bunkerDb, setSessionLostHandler } from "@/app/bunker/_lib/db";
import { createVaultKeyMaterial, unlockVault } from "@/lib/bunker/crypto";
import type { BunkerVaultKeys } from "@/lib/bunker/types";

/* ──────────────────────────────────────────────────────────────────────
 * Глобальный PIN-замок бункера (оборачивает всё в app/bunker/layout.tsx).
 *
 *   • Пока PIN не введён, дети (страницы, навигация) НЕ рендерятся,
 *     и никакие данные не грузятся: без PIN-сессии сервер их не отдаст.
 *   • При каждой загрузке приложения старая сессия закрывается — PIN
 *     спрашивается всегда.
 *   • Блокировка: свернули приложение / ушли со вкладки (visibilitychange,
 *     blur, pagehide) и 3 минуты без действий. Сессия на сервере
 *     закрывается через sendBeacon.
 *   • Шторка: в момент ухода синхронно (без React) вешаем на <html>
 *     класс bunker-curtain — чёрный слой поверх всего, чтобы в
 *     переключателе приложений iOS не было видно содержимого.
 *   • Master или Duress PIN — экран не знает и не показывает разницы:
 *     режим известен только базе.
 *   • Ключ сейфа выводится из того же PIN сразу после входа и живёт
 *     только в памяти до блокировки.
 * ──────────────────────────────────────────────────────────────────── */

const IDLE_LOCK_MS = 3 * 60 * 1000;
const CURTAIN_CLASS = "bunker-curtain";

export type VaultAccess = {
  key: CryptoKey | null;
  keys: BunkerVaultKeys | null;
  pepper: string | null;
  /** ready — ключ готов; mismatch — сейф зашифрован другим PIN (старая версия);
   *  pepper-missing — сейф создан с pepper, а на сервере его нет. */
  status: "ready" | "mismatch" | "pepper-missing";
};

type LockContextValue = {
  lock: () => void;
  vault: VaultAccess | null;
  setVault: (v: VaultAccess) => void;
};

const LockContext = createContext<LockContextValue>({ lock: () => {}, vault: null, setVault: () => {} });

export function useBunkerLock() {
  return useContext(LockContext);
}

function curtain(on: boolean) {
  document.documentElement.classList.toggle(CURTAIN_CLASS, on);
}

type Phase = "boot" | "setup" | "locked" | "unlocked";

export default function BunkerLock({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("boot");
  const [vault, setVault] = useState<VaultAccess | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const lock = useCallback(() => {
    const wasUnlocked = phaseRef.current === "unlocked";
    phaseRef.current = wasUnlocked ? "locked" : phaseRef.current;
    setVault(null);
    setPhase((p) => (p === "unlocked" ? "locked" : p));
    if (wasUnlocked) {
      try {
        navigator.sendBeacon("/bunker/lock");
      } catch {
        void fetch("/bunker/lock", { method: "POST", keepalive: true }).catch(() => {});
      }
    }
  }, []);

  /* ── старт: закрываем прежнюю сессию, узнаём, задан ли Master PIN ── */
  useEffect(() => {
    let cancelled = false;
    bunkerPinStatus()
      .then((s) => !cancelled && setPhase(s.hasMaster ? "locked" : "setup"))
      .catch(() => !cancelled && setPhase("locked"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSessionLostHandler(lock);
    return () => setSessionLostHandler(() => {});
  }, [lock]);

  /* ── шторка снимается, когда приложение снова на экране ── */
  useEffect(() => {
    const off = () => {
      if (document.visibilityState === "visible") requestAnimationFrame(() => curtain(false));
    };
    document.addEventListener("visibilitychange", off);
    window.addEventListener("focus", off);
    window.addEventListener("pageshow", off);
    return () => {
      document.removeEventListener("visibilitychange", off);
      window.removeEventListener("focus", off);
      window.removeEventListener("pageshow", off);
      curtain(false);
    };
  }, []);

  /* ── авто-блокировка ── */
  useEffect(() => {
    if (phase !== "unlocked") return;

    const leave = () => {
      curtain(true); // синхронно, до того как iOS снимет снимок экрана
      lock();
    };
    const onVisibility = () => document.visibilityState === "hidden" && leave();

    let idle = setTimeout(lock, IDLE_LOCK_MS);
    const bump = () => {
      clearTimeout(idle);
      idle = setTimeout(lock, IDLE_LOCK_MS);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", leave);
    window.addEventListener("pagehide", leave);
    const activity = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    activity.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    return () => {
      clearTimeout(idle);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", leave);
      window.removeEventListener("pagehide", leave);
      activity.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [phase, lock]);

  /* ── после успешного PIN: ключ сейфа из того же PIN ── */
  const prepareVault = async (pin: string): Promise<boolean> => {
    const [{ pepper }, keysRes] = await Promise.all([
      getVaultPepper().catch(() => ({ pepper: null })),
      bunkerDb<BunkerVaultKeys[]>({ kind: "select", table: "bunker_vault_keys" }),
    ]);
    if (keysRes.locked) return false;

    const existing = keysRes.data?.[0] ?? null;
    if (!existing) {
      const { key, row } = await createVaultKeyMaterial(pin, pepper);
      const ins = await bunkerDb<BunkerVaultKeys>({ kind: "insert", table: "bunker_vault_keys", values: row });
      setVault({ key: ins.data ? key : null, keys: ins.data, pepper, status: ins.data ? "ready" : "mismatch" });
      return !ins.locked;
    }
    if (existing.uses_pepper && !pepper) {
      setVault({ key: null, keys: existing, pepper, status: "pepper-missing" });
      return true;
    }
    const key = await unlockVault(pin, existing, existing.uses_pepper ? pepper : null);
    setVault({ key, keys: existing, pepper, status: key ? "ready" : "mismatch" });
    return true;
  };

  const enter = async (result: UnlockResult, pin: string): Promise<UnlockResult> => {
    if (result.status !== "ok") return result;
    const ok = await prepareVault(pin);
    if (!ok) return { status: "error", message: "Сессия не открылась, попробуй ещё раз" };
    curtain(false);
    setPhase("unlocked");
    return result;
  };

  const value: LockContextValue = { lock, vault, setVault };

  return (
    <LockContext.Provider value={value}>
      <div aria-hidden className="bunker-curtain-layer" />
      {phase === "unlocked" ? (
        children
      ) : phase === "boot" ? (
        <Splash />
      ) : phase === "setup" ? (
        <SetupScreen
          onSubmit={async (pin) => enter(await setupMasterPin(pin), pin)}
        />
      ) : (
        <LockScreen onSubmit={async (pin) => enter(await unlockBunker(pin), pin)} />
      )}
    </LockContext.Provider>
  );
}

/* ═══════════════ экраны ═══════════════ */

function Frame({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="bunker-root flex min-h-[100dvh] flex-col items-center justify-center bg-[#09090b] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(201,169,97,0.10),transparent_65%)]"
      />
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#c9a961]/30 bg-[#c9a961]/10 text-[#c9a961] shadow-[0_0_40px_-8px_rgba(201,169,97,0.5)]"
      >
        {icon}
      </motion.div>
      <h1 className="voyage-cormorant relative text-center text-4xl text-white">{title}</h1>
      <div className="relative mb-8 mt-2 max-w-xs text-center text-sm text-zinc-500">{subtitle}</div>
      <div className="relative w-full">{children}</div>
    </div>
  );
}

function Splash() {
  return (
    <Frame icon={<Lock className="h-7 w-7" strokeWidth={1.5} />} title="Бункер" subtitle="Закрыто">
      <div className="h-[420px]" />
    </Frame>
  );
}

function useCountdown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [until]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return { left, start: (sec: number) => (setNow(Date.now()), setUntil(Date.now() + sec * 1000)) };
}

function LockScreen({ onSubmit }: { onSubmit: (pin: string) => Promise<UnlockResult> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const countdown = useCountdown();

  const submit = async (pin: string) => {
    setBusy(true);
    setError(null);
    const res = await onSubmit(pin).catch(() => ({ status: "error", message: "Нет связи с сервером" }) as UnlockResult);
    setBusy(false);
    if (res.status === "ok") return;
    if (res.status === "locked") countdown.start(res.retryAfter);
    setError(
      res.status === "invalid"
        ? res.attemptsLeft > 0 && res.attemptsLeft <= 3
          ? `Неверный PIN · осталось попыток: ${res.attemptsLeft}`
          : "Неверный PIN"
        : res.status === "locked"
          ? null
          : res.status === "error"
            ? res.message
            : "Неверный PIN",
    );
    setTick((t) => t + 1);
  };

  const lockedOut = countdown.left > 0;

  return (
    <Frame icon={<Lock className="h-7 w-7" strokeWidth={1.5} />} title="Бункер закрыт" subtitle="Введи Master PIN">
      <PinPad
        busy={busy}
        disabled={lockedOut}
        error={lockedOut ? `Слишком много попыток. Подожди ${countdown.left} с` : error}
        errorTick={tick}
        onSubmit={submit}
      />
    </Frame>
  );
}

function SetupScreen({ onSubmit }: { onSubmit: (pin: string) => Promise<UnlockResult> }) {
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const fail = (text: string) => {
    setError(text);
    setTick((t) => t + 1);
  };

  return (
    <Frame
      icon={<ShieldCheck className="h-7 w-7" strokeWidth={1.5} />}
      title={first ? "Повтори PIN" : "Создай Master PIN"}
      subtitle={
        <>
          4–8 цифр, лучше 6 и больше. Им открывается бункер и шифруется сейф.
          <br />
          Восстановить его нельзя.
        </>
      }
    >
      <PinPad
        busy={busy}
        error={error}
        errorTick={tick}
        hint={first ? "Ещё раз тот же PIN" : undefined}
        onSubmit={async (pin) => {
          if (!first) {
            setError(null);
            return setFirst(pin);
          }
          if (pin !== first) {
            setFirst(null);
            return fail("Не совпало, начнём заново");
          }
          setBusy(true);
          const res = await onSubmit(pin).catch(() => ({ status: "error", message: "Нет связи с сервером" }) as UnlockResult);
          setBusy(false);
          if (res.status !== "ok") {
            setFirst(null);
            fail(res.status === "error" ? res.message : "Не получилось");
          }
        }}
      />
    </Frame>
  );
}
