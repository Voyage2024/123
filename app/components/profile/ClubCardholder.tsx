"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · CLUB CARDHOLDER — карта статуса резидента
 * app/components/profile/ClubCardholder.tsx
 *
 * Цвет карты = текущий Circle из базы (useClubStanding → v_global_leaderboard).
 * Повысился круг — карта сама плавно перекрашивается.
 *
 * Слои (снизу вверх):
 *   1. подложка круга (градиент)        — CARD_SKINS[circle]
 *   2. брашированный металл              — тонкие линии
 *   3. голографическая плёнка            — радужная/золотая, следует за курсором
 *   4. белый блик                        — чисто белый свет под курсором
 *   5. белая полоса-отражение            — бежит по диагонали
 *   6. внутренняя кромка + надписи       — неподвижны, всегда на своих местах
 *
 * Мышь: блик и наклон следуют за курсором (как карта во вкладке «Паспорт»).
 * Тач:  по касанию блик проходит по карте слева направо.
 * prefers-reduced-motion: без наклона и анимации, только статичный блик.
 * ──────────────────────────────────────────────────────────────────── */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Crown } from "lucide-react";
import type { CircleKey } from "@/lib/gamification";
import { cormorant } from "./fonts";

/* ══════════════════════════════════════════════════════════════════
 * ПАЛИТРА КРУГОВ
 * Градиенты — инлайн-стили: Tailwind не умеет многослойные градиенты
 * без нечитаемых классов, а значения должны жить в одном месте.
 * ══════════════════════════════════════════════════════════════════ */

export const CIRCLE_ORDER: readonly CircleKey[] = [
  "voyager",
  "resident",
  "preferred",
  "inner",
  "private",
  "black",
];

export type CardSkin = {
  /** подложка карты */
  base: string;
  /** основной цвет надписей */
  ink: string;
  /** второстепенные надписи */
  sub: string;
  /** внутренняя кромка */
  hair: string;
  /** тень + внешний контур/свечение */
  shadow: string;
  /** голографическая плёнка */
  film: string;
  blend: CSSProperties["mixBlendMode"];
  filmIdle: number;
  filmLive: number;
  /** сила белого блика 0…1 */
  glare: number;
  /** голограмма-печать в углу */
  seal: string;
  pipOn: string;
  pipOff: string;
  /** акцент круга вне карты (панель статуса) */
  accent: string;
  glow: string;
};

const RAINBOW =
  "linear-gradient(115deg, rgba(255,255,255,0) 22%, rgba(255,128,210,0.55) 34%, rgba(130,200,255,0.55) 46%, rgba(140,255,210,0.5) 58%, rgba(255,232,140,0.55) 70%, rgba(255,255,255,0) 82%)";
const WARM =
  "linear-gradient(115deg, rgba(255,255,255,0) 24%, rgba(255,250,230,0.75) 42%, rgba(255,214,140,0.5) 52%, rgba(255,255,255,0.6) 60%, rgba(255,255,255,0) 78%)";
const GOLD =
  "linear-gradient(115deg, rgba(0,0,0,0) 28%, rgba(240,223,174,0.55) 46%, rgba(212,168,83,0.35) 56%, rgba(0,0,0,0) 72%)";
const DROP = "0 30px 60px -24px rgba(0,0,0,0.85)";

export const CARD_SKINS: Record<CircleKey, CardSkin> = {
  /* I · серебро, светлый переливающийся металл */
  voyager: {
    base: "linear-gradient(135deg, #f7f8fa 0%, #cdd2d9 22%, #f2f4f6 44%, #a7aeb8 70%, #e4e7eb 100%)",
    ink: "#15181d",
    sub: "rgba(21,24,29,0.68)",
    hair: "rgba(255,255,255,0.65)",
    shadow: `${DROP}, 0 0 0 1px rgba(255,255,255,0.35), 0 20px 50px -22px rgba(214,219,226,0.4)`,
    film: RAINBOW,
    blend: "soft-light",
    filmIdle: 0.5,
    filmLive: 1,
    glare: 0.55,
    seal: "conic-gradient(from 210deg, #f9a8d4, #93c5fd, #a7f3d0, #fde68a, #f9a8d4)",
    pipOn: "#15181d",
    pipOff: "rgba(21,24,29,0.2)",
    accent: "#d4d8de",
    glow: "rgba(214,219,226,0.3)",
  },
  /* II · бирюза, насыщенный циан */
  resident: {
    base: "radial-gradient(110% 120% at 92% 0%, rgba(103,232,249,0.9) 0%, rgba(34,211,238,0.35) 28%, rgba(34,211,238,0) 55%), linear-gradient(165deg, #0a8199 0%, #0b6c80 35%, #075564 65%, #032d35 100%)",
    ink: "#f0fdff",
    sub: "rgba(224,250,255,0.8)",
    hair: "rgba(165,243,252,0.4)",
    shadow: `${DROP}, 0 0 0 1px rgba(103,232,249,0.35), 0 22px 60px -22px rgba(6,182,212,0.6)`,
    film: RAINBOW,
    blend: "soft-light",
    filmIdle: 0.35,
    filmLive: 0.9,
    glare: 0.38,
    seal: "conic-gradient(from 210deg, #cffafe, #67e8f9, #a7f3d0, #e0f2fe, #cffafe)",
    pipOn: "#ecfeff",
    pipOff: "rgba(236,254,255,0.25)",
    accent: "#67e8f9",
    glow: "rgba(34,211,238,0.45)",
  },
  /* III · малина, фуксия */
  preferred: {
    base: "radial-gradient(110% 130% at 92% 0%, rgba(244,114,182,0.95) 0%, rgba(236,72,153,0.4) 26%, rgba(236,72,153,0) 52%), radial-gradient(80% 90% at 0% 100%, rgba(192,38,211,0.4) 0%, rgba(192,38,211,0) 60%), linear-gradient(160deg, #be185d 0%, #9d174d 38%, #6b0f3a 70%, #3a0620 100%)",
    ink: "#fff1f6",
    sub: "rgba(255,228,240,0.82)",
    hair: "rgba(249,168,212,0.4)",
    shadow: `${DROP}, 0 0 0 1px rgba(244,114,182,0.35), 0 22px 60px -22px rgba(236,72,153,0.6)`,
    film: RAINBOW,
    blend: "soft-light",
    filmIdle: 0.35,
    filmLive: 0.9,
    glare: 0.36,
    seal: "conic-gradient(from 210deg, #fbcfe8, #f0abfc, #fda4af, #fde68a, #fbcfe8)",
    pipOn: "#fff1f6",
    pipOff: "rgba(255,241,246,0.25)",
    accent: "#f472b6",
    glow: "rgba(236,72,153,0.45)",
  },
  /* IV · аметист с неоновым отливом */
  inner: {
    base: "radial-gradient(90% 110% at 100% 0%, rgba(192,132,252,0.75) 0%, rgba(168,85,247,0.25) 30%, rgba(168,85,247,0) 55%), radial-gradient(70% 80% at 0% 100%, rgba(124,58,237,0.45) 0%, rgba(124,58,237,0) 60%), linear-gradient(160deg, #3b1782 0%, #2a0f63 40%, #180840 72%, #0c0420 100%)",
    ink: "#f5f0ff",
    sub: "rgba(233,222,255,0.8)",
    hair: "rgba(192,132,252,0.45)",
    shadow: `${DROP}, 0 0 0 1px rgba(192,132,252,0.6), 0 0 36px -6px rgba(168,85,247,0.6)`,
    film: RAINBOW,
    blend: "soft-light",
    filmIdle: 0.4,
    filmLive: 1,
    glare: 0.32,
    seal: "conic-gradient(from 210deg, #e9d5ff, #a5b4fc, #f0abfc, #c4b5fd, #e9d5ff)",
    pipOn: "#d8b4fe",
    pipOff: "rgba(216,180,254,0.22)",
    accent: "#c084fc",
    glow: "rgba(168,85,247,0.55)",
  },
  /* V · жидкое золото, бронза */
  private: {
    base: "radial-gradient(120% 140% at 12% 0%, rgba(255,246,214,0.9) 0%, rgba(255,246,214,0) 42%), linear-gradient(135deg, #c99a45 0%, #e8c46c 28%, #f6e0a0 48%, #d4a853 70%, #a87430 100%)",
    ink: "#1d1206",
    sub: "rgba(29,18,6,0.74)",
    hair: "rgba(255,240,200,0.65)",
    shadow: `${DROP}, 0 0 0 1px rgba(255,236,179,0.45), 0 22px 60px -22px rgba(212,168,83,0.6)`,
    film: WARM,
    blend: "overlay",
    filmIdle: 0.45,
    filmLive: 1,
    glare: 0.5,
    seal: "conic-gradient(from 210deg, #fff7d6, #e8c46c, #fde68a, #c99a45, #fff7d6)",
    pipOn: "#1d1206",
    pipOff: "rgba(29,18,6,0.22)",
    accent: "#e2bb62",
    glow: "rgba(212,168,83,0.45)",
  },
  /* VI · матовый чёрный с золотым контуром */
  black: {
    base: "radial-gradient(120% 140% at 18% 0%, #1d1d20 0%, #0c0c0d 46%, #050505 100%)",
    ink: "#f0dfae",
    sub: "rgba(230,211,163,0.7)",
    hair: "rgba(212,168,83,0.5)",
    shadow: `${DROP}, 0 0 0 1px rgba(212,168,83,0.75), 0 0 28px -6px rgba(212,168,83,0.5)`,
    film: GOLD,
    blend: "screen",
    filmIdle: 0.15,
    filmLive: 0.55,
    glare: 0.16,
    seal: "conic-gradient(from 210deg, #f0dfae, #8a6a2c, #e6c983, #5c4518, #f0dfae)",
    pipOn: "#f0dfae",
    pipOff: "rgba(240,223,174,0.16)",
    accent: "#e6c983",
    glow: "rgba(212,168,83,0.4)",
  },
};

export const skinFor = (key: CircleKey): CardSkin => CARD_SKINS[key] ?? CARD_SKINS.voyager;

/* ══════════════════════════════════════════════════════════════════
 * УТИЛИТЫ
 * ══════════════════════════════════════════════════════════════════ */

export function toRoman(n: number) {
  const map: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let rest = Math.max(0, Math.floor(n));
  let out = "";
  for (const [value, glyph] of map) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

/** Номер члена клуба: из профиля, иначе 4 знака id — как в «Паспорте» */
export function formatMemberNo(raw: unknown, userId: string | null | undefined) {
  if (typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "")) {
    return String(raw).replace(/^n[ºo°.]?\s*/i, "").trim().padStart(4, "0");
  }
  return userId ? userId.replace(/-/g, "").slice(0, 4).toUpperCase() : "0000";
}

/** ISO-дата → римский год вступления */
export function sinceRoman(iso: string | null | undefined) {
  if (!iso) return null;
  const year = new Date(iso).getUTCFullYear();
  return Number.isFinite(year) ? toRoman(year) : null;
}

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(reducedQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );
}

/* ══════════════════════════════════════════════════════════════════
 * КОМПОНЕНТ
 * ══════════════════════════════════════════════════════════════════ */

type Point = { x: number; y: number };

/** покой: источник света чуть над верхней кромкой */
const REST: Point = { x: 0.5, y: -0.2 };
const SWEEP_MS = 1100;
const STATIC_FLASH_MS = 1200;

type Props = {
  circleKey: CircleKey;
  circleTitle: string;
  /** уровень круга 1…6 — риски ранга */
  circleLevel: number;
  holderName: string;
  memberNo: string;
  since: string | null;
  loading?: boolean;
};

export function ClubCardholder({
  circleKey,
  circleTitle,
  circleLevel,
  holderName,
  memberNo,
  since,
  loading = false,
}: Props) {
  const reduced = usePrefersReducedMotion();
  const skin = skinFor(circleKey);

  const [pos, setPos] = useState<Point>(REST);
  const [live, setLive] = useState(false);
  const [tilt, setTilt] = useState(false); // наклон — только для мыши

  const frame = useRef<number | null>(null);
  const pending = useRef<Point | null>(null);
  const sweep = useRef<number | null>(null);
  const flash = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── смена круга: новая подложка проявляется поверх прежней ───── */
  const [layers, setLayers] = useState<{ cur: CircleKey; prev: CircleKey | null }>({
    cur: circleKey,
    prev: null,
  });
  if (layers.cur !== circleKey) {
    // derived state: обновляем во время рендера, без лишнего эффекта
    setLayers({ cur: circleKey, prev: layers.cur });
  }
  const fadeIn = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !layers.prev || reduced || typeof el.animate !== "function") return;
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 900,
        easing: "cubic-bezier(0.22,1,0.36,1)",
      });
    },
    [layers.prev, reduced],
  );

  /* ── отрисовка позиции блика не чаще одного раза за кадр ──────── */
  const queue = useCallback((p: Point) => {
    pending.current = p;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (pending.current) setPos(pending.current);
    });
  }, []);

  const stopSweep = useCallback(() => {
    if (sweep.current !== null) {
      cancelAnimationFrame(sweep.current);
      sweep.current = null;
    }
    if (flash.current) {
      clearTimeout(flash.current);
      flash.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      stopSweep();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [stopSweep],
  );

  /** тап: блик проходит по карте слева направо */
  const runSweep = useCallback(() => {
    stopSweep();
    setLive(true);
    if (reduced) {
      setPos({ x: 0.5, y: 0.35 });
      flash.current = setTimeout(() => {
        flash.current = null;
        setLive(false);
        setPos(REST);
      }, STATIC_FLASH_MS);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / SWEEP_MS);
      const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
      setPos({ x: -0.2 + e * 1.4, y: 0.25 + e * 0.3 });
      if (k < 1) {
        sweep.current = requestAnimationFrame(step);
      } else {
        sweep.current = null;
        setLive(false);
        setPos(REST);
      }
    };
    sweep.current = requestAnimationFrame(step);
  }, [reduced, stopSweep]);

  const pointOf = (e: ReactPointerEvent<HTMLDivElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const onPointerEnter = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    stopSweep();
    setLive(true);
    setTilt(!reduced);
    queue(pointOf(e));
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || reduced) return;
    queue(pointOf(e));
  };

  const onPointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    setLive(false);
    setTilt(false);
    queue(REST);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    runSweep();
  };

  /* ── производные стили слоёв ──────────────────────────────────── */
  const rx = tilt && live ? (0.5 - pos.y) * 7 : 0;
  const ry = tilt && live ? (pos.x - 0.5) * 9 : 0;
  const a = skin.glare;

  const cardStyle: CSSProperties = {
    color: skin.ink,
    boxShadow: skin.shadow,
    transform: `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`,
    transition: `${
      tilt && live
        ? "transform 120ms ease-out"
        : "transform 700ms cubic-bezier(0.22,1,0.36,1)"
    }, color 900ms ease, box-shadow 900ms ease`,
  };

  const filmStyle: CSSProperties = {
    background: skin.film,
    backgroundSize: "260% 260%",
    backgroundPosition: `${(pos.x * 100).toFixed(1)}% ${(50 + (pos.y - 0.5) * 40).toFixed(1)}%`,
    mixBlendMode: skin.blend,
    opacity: live ? skin.filmLive : skin.filmIdle,
  };

  const glareStyle: CSSProperties = {
    background: `radial-gradient(420px circle at ${(pos.x * 100).toFixed(1)}% ${(pos.y * 100).toFixed(1)}%, rgba(255,255,255,${a}) 0%, rgba(255,255,255,${(a * 0.3).toFixed(3)}) 32%, rgba(255,255,255,0) 62%)`,
    opacity: live ? 1 : 0.55,
  };

  const streakStyle: CSSProperties = {
    background:
      "linear-gradient(105deg, rgba(255,255,255,0) 42%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 58%)",
    backgroundSize: "260% 100%",
    backgroundPosition: `${(100 - pos.x * 100).toFixed(1)}% 0%`,
    opacity: live && !reduced ? 1 : 0,
  };

  const rank = Math.max(0, Math.min(CIRCLE_ORDER.length - 1, circleLevel - 1));

  return (
    <div className="[perspective:1100px]">
      <div
        onPointerEnter={onPointerEnter}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        style={cardStyle}
        className="relative aspect-[8/5] w-full touch-pan-y select-none overflow-hidden rounded-[18px] [-webkit-tap-highlight-color:transparent] sm:rounded-[22px]"
      >
        {/* 1. подложка круга (+ прежняя, пока новая проявляется) */}
        {layers.prev && (
          <div aria-hidden className="absolute inset-0" style={{ background: skinFor(layers.prev).base }} />
        )}
        <div
          key={layers.cur}
          ref={fadeIn}
          aria-hidden
          className="absolute inset-0"
          style={{ background: skin.base }}
        />

        {/* 2. брашированный металл */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)",
          }}
        />

        {/* 3. голографическая плёнка */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none"
          style={filmStyle}
        />

        {/* 4. белый блик */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-[450ms] motion-reduce:transition-none"
          style={glareStyle}
        />

        {/* 5. полоса-отражение */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-[450ms]"
          style={streakStyle}
        />

        {/* 6. внутренняя кромка */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-2 rounded-[12px] sm:inset-2.5 sm:rounded-[15px]"
          style={{ boxShadow: `inset 0 0 0 1px ${skin.hair}`, transition: "box-shadow 900ms ease" }}
        />

        {/* надписи и логотипы — неподвижны */}
        <div className="relative flex h-full flex-col justify-between p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.45em] sm:text-[11px] sm:tracking-[0.5em]">
                Voyage
              </p>
              <p
                className="mt-1.5 text-[8px] uppercase tracking-[0.3em] sm:text-[9px] sm:tracking-[0.32em]"
                style={{ color: skin.sub }}
              >
                Private Members
              </p>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span
                aria-hidden
                className="h-5 w-7 rounded-[5px] opacity-[0.85] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)] sm:h-6 sm:w-[34px] sm:rounded-md"
                style={{ background: skin.seal }}
              />
              <Crown aria-hidden size={18} strokeWidth={1.2} style={{ color: skin.sub }} />
            </div>
          </div>

          <div className="min-w-0">
            {loading ? (
              <span aria-hidden className="block h-8 w-3/4 animate-pulse rounded-md bg-current opacity-10 sm:h-10" />
            ) : (
              <p
                title={holderName}
                className={`${cormorant.className} truncate text-[26px] font-medium leading-[1.1] tracking-[0.01em] sm:text-[34px]`}
              >
                {holderName}
              </p>
            )}

            <div className="mt-2.5 flex items-end justify-between gap-3 sm:mt-3.5 sm:gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 sm:gap-2.5">
                  <span
                    className="text-[8px] uppercase tracking-[0.32em] sm:text-[9px] sm:tracking-[0.35em]"
                    style={{ color: skin.sub }}
                  >
                    Circle
                  </span>
                  <span aria-hidden className="flex gap-[3px]">
                    {CIRCLE_ORDER.map((k, i) => (
                      <span
                        key={k}
                        className="h-1 w-1 rounded-full"
                        style={{ background: i <= rank ? skin.pipOn : skin.pipOff }}
                      />
                    ))}
                  </span>
                </p>
                <p
                  className={`${cormorant.className} mt-0.5 truncate text-lg italic leading-[1.15] sm:text-[22px]`}
                >
                  {circleTitle}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {since && (
                  <p
                    className="text-[8px] uppercase tracking-[0.26em] sm:text-[9px] sm:tracking-[0.3em]"
                    style={{ color: skin.sub }}
                  >
                    <span className="hidden sm:inline">Resident since </span>
                    <span className="sm:hidden">Since </span>
                    {since}
                  </p>
                )}
                <p className="mt-1 font-mono text-[11px] tracking-[0.22em] sm:text-xs sm:tracking-[0.25em]">
                  Nº {memberNo}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
