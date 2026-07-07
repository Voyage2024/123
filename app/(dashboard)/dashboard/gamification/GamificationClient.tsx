"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · GAMIFICATION HUB — резидентская версия (read-only)
 * app/(dashboard)/gamification/GamificationClient.tsx
 *
 * Слои:
 *   1. Членская карта + Индекс глобального влияния
 *   2. Voyage Passport — хроника пройденного
 *   3. Consular Clearance — карта экспансии с визовыми цензами
 *   4. Легендарные комбо — визовые кампании
 *
 * Гость ничего не редактирует. Все данные замоканы в RESIDENT /
 * DESTINATIONS — админ-панель, которая будет их проставлять, пишется
 * отдельным шагом. Зависимости: React + Tailwind + lucide-react +
 * Cormorant Garamond (next/font).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useMemo, useRef, useState } from "react";
import { Cormorant_Garamond } from "next/font/google";
import {
  Check,
  Compass,
  ConciergeBell,
  Crown,
  Landmark,
  Moon,
  Plane,
  Sparkles,
} from "lucide-react";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

/* ── Текстура: SVG-шум как data URI, без внешних файлов ──────────── */

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/* ── Визовые цензы ───────────────────────────────────────────────── */

type Tier = "free" | "evisa" | "hard";

const TIERS: Record<
  Tier,
  {
    label: string;
    points: number;
    multiplier: number;
    accent: string; // цвет имени/иконки
    frame: string; // цвет микро-рамки
  }
> = {
  free: {
    label: "Visa-Free · ETA",
    points: 100,
    multiplier: 1,
    accent: "text-zinc-300",
    frame: "ring-white/[0.06]",
  },
  evisa: {
    label: "E-Visa · On Arrival",
    points: 250,
    multiplier: 1,
    accent: "text-[#e6d3a3]/85",
    frame: "ring-[#e6d3a3]/[0.14]",
  },
  hard: {
    label: "Consular Clearance",
    points: 600,
    multiplier: 2, // ×2 к Индексу влияния
    accent: "text-[#dfe4ea]/90",
    frame: "ring-[#dfe4ea]/[0.16]",
  },
};

/* ── Направления клуба ───────────────────────────────────────────── */

type Destination = {
  id: string;
  name: string;
  sub: string;
  region: string;
  tier: Tier;
  visited: boolean;
};

const DESTINATIONS: Destination[] = [
  // Ближний Восток
  { id: "dubai", name: "Дубай", sub: "ОАЭ", region: "Ближний Восток", tier: "free", visited: true },
  { id: "doha", name: "Доха", sub: "Катар", region: "Ближний Восток", tier: "free", visited: false },
  { id: "muscat", name: "Маскат", sub: "Оман", region: "Ближний Восток", tier: "evisa", visited: false },
  { id: "riyadh", name: "Эр-Рияд", sub: "Саудовская Аравия", region: "Ближний Восток", tier: "hard", visited: false },
  // Европа
  { id: "paris", name: "Париж", sub: "Франция · Шенген", region: "Европа", tier: "hard", visited: false },
  { id: "nice", name: "Ницца", sub: "Лазурный берег · Шенген", region: "Европа", tier: "hard", visited: false },
  { id: "monaco", name: "Монако", sub: "Княжество", region: "Европа", tier: "hard", visited: false },
  { id: "amalfi", name: "Амальфи", sub: "Италия · Шенген", region: "Европа", tier: "hard", visited: false },
  { id: "london", name: "Лондон", sub: "Великобритания", region: "Европа", tier: "hard", visited: false },
  { id: "istanbul", name: "Стамбул", sub: "Турция", region: "Европа", tier: "evisa", visited: false },
  // Азия
  { id: "bali", name: "Бали", sub: "Индонезия", region: "Азия", tier: "free", visited: true },
  { id: "singapore", name: "Сингапур", sub: "Республика", region: "Азия", tier: "free", visited: true },
  { id: "vietnam", name: "Хойан", sub: "Вьетнам", region: "Азия", tier: "evisa", visited: true },
  { id: "cambodia", name: "Сием-Реап", sub: "Камбоджа", region: "Азия", tier: "evisa", visited: true },
  { id: "phuket", name: "Пхукет", sub: "Таиланд", region: "Азия", tier: "free", visited: false },
  { id: "tokyo", name: "Токио", sub: "Япония", region: "Азия", tier: "hard", visited: false },
  // Новый Свет и Океания
  { id: "la", name: "Лос-Анджелес", sub: "США", region: "Новый Свет и Океания", tier: "hard", visited: false },
  { id: "miami", name: "Майами", sub: "США", region: "Новый Свет и Океания", tier: "hard", visited: false },
  { id: "sydney", name: "Сидней", sub: "Австралия", region: "Новый Свет и Океания", tier: "evisa", visited: false },
];

const REGIONS = ["Ближний Восток", "Европа", "Азия", "Новый Свет и Океания"];

/* ── Легендарные комбо ───────────────────────────────────────────── */

const COMBOS = [
  {
    id: "schengen-sovereign",
    title: "The Schengen Sovereign",
    lore: "Покорить сердце Старого Света одним визовым досье",
    ids: ["paris", "nice", "monaco", "amalfi"],
    Icon: Crown,
  },
  {
    id: "anglosphere-elite",
    title: "Anglosphere Elite",
    lore: "Три самых придирчивых консульства мира — пройдены",
    ids: ["london", "la", "sydney"],
    Icon: Landmark,
  },
  {
    id: "silk-road",
    title: "The Silk Road E-Visa",
    lore: "Шёлковый путь, собранный по электронным визам",
    ids: ["bali", "cambodia", "vietnam"],
    Icon: Compass,
  },
];

/* ── Резидент ────────────────────────────────────────────────────── */

const RESIDENT = {
  name: "Анна Ковалёва",
  memberNo: "Nº 0027",
  circle: "Inner Circle",
  since: "MMXXV",
  stamps: [
    { id: "bali", city: "Бали", code: "DPS · INDONESIA", date: "14 · 02 · 2026", ink: "#2f5d50", rotate: -7, shape: "round" as const },
    { id: "singapore", city: "Сингапур", code: "SIN · ADMITTED", date: "09 · 04 · 2026", ink: "#7a2e2e", rotate: 4, shape: "rect" as const },
    { id: "cambodia", city: "Сием-Реап", code: "REP · E-VISA", date: "17 · 05 · 2026", ink: "#5c4a7d", rotate: 6, shape: "rect" as const },
    { id: "vietnam", city: "Хойан", code: "DAD · E-VISA", date: "23 · 05 · 2026", ink: "#8a5a24", rotate: -4, shape: "oval" as const },
    { id: "dubai", city: "Дубай", code: "DXB · U.A.E.", date: "21 · 06 · 2026", ink: "#2e3f6e", rotate: -2, shape: "round" as const },
  ],
};

/* ── Расчёт Индекса глобального влияния ──────────────────────────── */

function useInfluence() {
  return useMemo(() => {
    const visited = DESTINATIONS.filter((d) => d.visited);
    const byTier = (t: Tier) => visited.filter((d) => d.tier === t).length;
    const index = visited.reduce(
      (sum, d) => sum + TIERS[d.tier].points * TIERS[d.tier].multiplier,
      0,
    );
    return {
      index,
      free: byTier("free"),
      evisa: byTier("evisa"),
      hard: byTier("hard"),
      total: visited.length,
    };
  }, []);
}

/* ── Членская карта: 3D-перелив за курсором ──────────────────────── */

function MembershipCard() {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [moving, setMoving] = useState(false);

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setMoving(true);
    setStyle({
      transform: `perspective(1100px) rotateX(${(0.5 - py) * 7}deg) rotateY(${(px - 0.5) * 9}deg)`,
      ["--gx" as string]: `${px * 100}%`,
      ["--gy" as string]: `${py * 100}%`,
    });
  }, []);

  const onLeave = useCallback(() => {
    setMoving(false);
    setStyle({
      transform: "perspective(1100px) rotateX(0deg) rotateY(0deg)",
      ["--gx" as string]: "50%",
      ["--gy" as string]: "-20%",
    });
  }, []);

  return (
    <div style={{ perspective: "1100px" }}>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={style}
        className={[
          "group relative aspect-[8/5] w-full select-none overflow-hidden rounded-[1.4rem]",
          moving
            ? "transition-transform duration-100 ease-out"
            : "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "motion-reduce:transition-none motion-reduce:transform-none",
          "bg-[radial-gradient(120%_140%_at_20%_0%,#1c1c20_0%,#0c0c0f_45%,#050506_100%)]",
          "ring-1 ring-white/[0.07]",
          "shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.6)]",
        ].join(" ")}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{ backgroundImage: NOISE }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(420px circle at var(--gx,50%) var(--gy,-20%), rgba(230,211,163,0.14), rgba(230,211,163,0.04) 40%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -inset-y-1/2 w-1/3 rotate-[24deg] opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-100"
          style={{
            left: "calc(var(--gx, 50%) - 16%)",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          }}
        />
        <div className="pointer-events-none absolute inset-[10px] rounded-[1rem] ring-1 ring-white/[0.04]" />

        <div className="relative flex h-full flex-col justify-between p-7 sm:p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.45em] text-zinc-500">Voyage</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[#e6d3a3]/50">
                Private Members
              </p>
            </div>
            <Crown size={18} strokeWidth={1} className="mt-0.5 text-[#e6d3a3]/60" />
          </div>

          <div>
            <p className={`${cormorant.className} text-3xl font-medium tracking-wide text-zinc-100 sm:text-4xl`}>
              {RESIDENT.name}
            </p>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-[0.35em] text-zinc-600">Circle</p>
                <p className={`${cormorant.className} mt-0.5 text-xl italic text-[#e6d3a3]/90`}>
                  {RESIDENT.circle}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-[0.35em] text-zinc-600">
                  Resident since {RESIDENT.since}
                </p>
                <p className="mt-0.5 font-mono text-xs tracking-[0.25em] text-zinc-400">
                  {RESIDENT.memberNo}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Индекс глобального влияния ──────────────────────────────────── */

function InfluencePanel() {
  const inf = useInfluence();

  const rows: Array<[string, number, string]> = [
    ["Visa-Free · ETA", inf.free, "text-zinc-400"],
    ["E-Visa · On Arrival", inf.evisa, "text-[#e6d3a3]/70"],
    ["Consular Clearance", inf.hard, "text-[#dfe4ea]/80"],
  ];

  return (
    <div className="flex h-full flex-col justify-between rounded-[1.4rem] bg-white/[0.015] p-7 ring-1 ring-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-600">
          Индекс глобального влияния
        </p>
        <div className="mt-4 flex items-baseline gap-3">
          <p className={`${cormorant.className} text-6xl font-medium tabular-nums text-zinc-50 [text-shadow:0_0_30px_rgba(230,211,163,0.12)]`}>
            {inf.index}
          </p>
          <p className={`${cormorant.className} text-lg italic text-zinc-500`}>
            · {inf.total} направлений
          </p>
        </div>

        <ul className="mt-7 space-y-3.5 border-t border-white/[0.05] pt-6">
          {rows.map(([label, value, tone]) => (
            <li key={label} className="flex items-baseline justify-between gap-4">
              <span className={`text-xs uppercase tracking-[0.2em] ${tone}`}>{label}</span>
              <span className="h-px flex-1 bg-white/[0.05]" />
              <span className="font-mono text-sm tabular-nums text-zinc-300">{value}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className={`${cormorant.className} mt-8 text-sm italic text-zinc-500`}>
        Направления Consular Clearance удваивают вклад в индекс —{" "}
        <span className="text-[#dfe4ea]/70">×2 за каждый пройденный ценз</span>.
      </p>
    </div>
  );
}

/* ── Штамп паспорта ──────────────────────────────────────────────── */

function Stamp({
  stamp,
  index,
  visible,
}: {
  stamp: (typeof RESIDENT.stamps)[number];
  index: number;
  visible: boolean;
}) {
  const shape =
    stamp.shape === "round"
      ? "h-28 w-28 rounded-full"
      : stamp.shape === "oval"
        ? "h-24 w-36 rounded-[50%]"
        : "h-24 w-36 rounded-md";

  return (
    <div
      style={{
        transform: `rotate(${stamp.rotate}deg) scale(${visible ? 1 : 1.25})`,
        color: stamp.ink,
        transitionDelay: visible ? `${420 + index * 150}ms` : "0ms",
      }}
      className={[
        shape,
        "relative flex shrink-0 flex-col items-center justify-center border-[2.5px] border-current p-2.5 text-center",
        "opacity-0 transition-all duration-500 ease-out",
        visible ? "opacity-[0.82]" : "",
        "mix-blend-multiply motion-reduce:transition-none",
      ].join(" ")}
    >
      <div
        className={`pointer-events-none absolute inset-[5px] border border-current opacity-70 ${
          stamp.shape === "round" ? "rounded-full" : stamp.shape === "oval" ? "rounded-[50%]" : "rounded-[3px]"
        }`}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen"
        style={{ backgroundImage: NOISE, backgroundSize: "90px" }}
      />
      <p className="text-[7px] font-semibold uppercase tracking-[0.28em]">{stamp.code}</p>
      <p className={`${cormorant.className} mt-0.5 text-xl font-semibold leading-none`}>
        {stamp.city}
      </p>
      <p className="mt-1 font-mono text-[8px] tracking-[0.18em]">{stamp.date}</p>
      <p className="mt-0.5 text-[6px] uppercase tracking-[0.35em] opacity-80">
        Voyage · Admit One
      </p>
    </div>
  );
}

/* ── Паспорт: физичное открытие обложки ──────────────────────────── */

function VoyagePassport() {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-[10px] uppercase tracking-[0.4em] text-zinc-600">Voyage Passport</h2>
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-600">
          {RESIDENT.stamps.length} штампов · сезон 2026
        </p>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Закрыть паспорт" : "Открыть паспорт"}
        className="group block w-full rounded-[1.2rem] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e6d3a3]/40"
        style={{ perspective: "1600px" }}
      >
        <div className="relative mx-auto aspect-[16/10] w-full max-w-3xl">
          {/* страница: плотная бумага */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[1.2rem] rounded-l-md ring-1 ring-black/40 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.85)]"
            style={{
              background:
                "linear-gradient(105deg, #d9d0ba 0%, #e9e1cc 18%, #efe8d5 50%, #e6ddc7 82%, #d5ccb5 100%)",
            }}
          >
            <div
              className="absolute inset-0 opacity-[0.14] mix-blend-multiply"
              style={{ backgroundImage: NOISE, backgroundSize: "140px" }}
            />
            <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/25 via-black/5 to-transparent" />
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, #4a4436 0 1px, transparent 1px 9px), repeating-linear-gradient(90deg, #4a4436 0 1px, transparent 1px 9px)",
              }}
            />

            <div className="relative flex h-full flex-col p-5 sm:p-8">
              <div className="flex items-baseline justify-between border-b border-[#7c6f52]/25 pb-2.5">
                <p className="text-[9px] uppercase tracking-[0.45em] text-[#5d5340]">
                  Arrivals · Прибытия
                </p>
                <p className={`${cormorant.className} text-sm italic text-[#6b5f47]`}>
                  {RESIDENT.name}
                </p>
              </div>

              <div className="flex flex-1 flex-wrap items-center justify-center gap-4 py-3 sm:gap-7">
                {RESIDENT.stamps.map((s, i) => (
                  <Stamp key={s.id} stamp={s} index={i} visible={open} />
                ))}
                <div
                  className={`hidden h-28 w-28 shrink-0 items-center justify-center rounded-full border border-dashed border-[#8a7c5d]/35 transition-opacity delay-[1200ms] duration-700 lg:flex ${
                    open ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <p className={`${cormorant.className} px-4 text-center text-sm italic leading-snug text-[#8a7c5d]/70`}>
                    место следующей главы
                  </p>
                </div>
              </div>

              <p className="border-t border-[#7c6f52]/25 pt-2.5 text-center font-mono text-[9px] tracking-[0.35em] text-[#6b5f47]/70">
                P&lt;VYGKOVALEVA&lt;&lt;ANNA&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;0027
              </p>
            </div>
          </div>

          {/* обложка: тёмная кожа */}
          <div
            className="absolute inset-0 origin-left rounded-[1.2rem] transition-transform duration-[1100ms] ease-[cubic-bezier(0.25,0.9,0.3,1)] motion-reduce:transition-none"
            style={{
              transformStyle: "preserve-3d",
              transform: open ? "rotateY(-152deg)" : "rotateY(0deg)",
            }}
          >
            <div
              className="absolute inset-0 overflow-hidden rounded-[1.2rem] ring-1 ring-white/[0.06] shadow-[0_36px_70px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)]"
              style={{
                backfaceVisibility: "hidden",
                background:
                  "radial-gradient(130% 120% at 30% 10%, #23201c 0%, #14120f 48%, #0a0908 100%)",
              }}
            >
              <div
                className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
                style={{ backgroundImage: NOISE, backgroundSize: "70px" }}
              />
              <div
                className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
                style={{ backgroundImage: NOISE, backgroundSize: "220px" }}
              />
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <div className="absolute inset-[14px] rounded-[0.9rem] border border-dashed border-[#e6d3a3]/[0.12]" />

              <div className="relative flex h-full flex-col items-center justify-center gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#e6d3a3]/25">
                  <Compass size={22} strokeWidth={1} className="text-[#e6d3a3]/50" />
                </div>
                <div className="text-center">
                  <p className={`${cormorant.className} text-3xl font-medium tracking-[0.3em] text-[#e6d3a3]/70 [text-shadow:0_1px_0_rgba(255,255,255,0.06),0_-1px_1px_rgba(0,0,0,0.9)]`}>
                    VOYAGE
                  </p>
                  <p className="mt-2 text-[9px] uppercase tracking-[0.5em] text-[#e6d3a3]/35">
                    Passeport de Résident
                  </p>
                </div>
                <p className="absolute bottom-6 text-[9px] uppercase tracking-[0.4em] text-zinc-600 transition-colors duration-300 group-hover:text-[#e6d3a3]/45">
                  {open ? "" : "коснитесь, чтобы открыть"}
                </p>
              </div>
            </div>

            <div
              className="absolute inset-0 rounded-[1.2rem] ring-1 ring-black/50"
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                background:
                  "linear-gradient(115deg, #16130f 0%, #1d1914 55%, #12100c 100%)",
              }}
            >
              <div
                className="absolute inset-0 rounded-[1.2rem] opacity-[0.1] mix-blend-overlay"
                style={{ backgroundImage: NOISE, backgroundSize: "90px" }}
              />
              <div className="flex h-full items-end justify-center pb-8">
                <p className={`${cormorant.className} text-sm italic tracking-wide text-[#e6d3a3]/30`}>
                  Le monde appartient à ceux qui voyagent
                </p>
              </div>
            </div>
          </div>
        </div>
      </button>
    </section>
  );
}

/* ── Карточка направления ────────────────────────────────────────── */

function DestinationCard({ dest }: { dest: Destination }) {
  const tier = TIERS[dest.tier];
  const isHard = dest.tier === "hard";

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-2xl p-5",
        "bg-white/[0.015] ring-1 transition-all duration-500",
        "motion-reduce:transition-none",
        dest.visited
          ? "ring-[#e6d3a3]/25 shadow-[0_0_36px_-14px_rgba(230,211,163,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
          : `${tier.frame} shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:-translate-y-0.5 hover:bg-white/[0.03]`,
      ].join(" ")}
    >
      {/* платиновая кромка цитадели */}
      {isHard && !dest.visited && (
        <div className="pointer-events-none absolute inset-[7px] rounded-xl border border-[#dfe4ea]/[0.08]" />
      )}

      {/* тёплое свечение пройденного направления */}
      {dest.visited && (
        <div className="pointer-events-none absolute -top-10 right-0 h-24 w-32 rounded-full bg-[#e6d3a3]/[0.08] blur-2xl" />
      )}

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <p className={`${cormorant.className} text-2xl font-medium leading-tight ${dest.visited ? "text-[#e6d3a3]" : tier.accent}`}>
            {dest.name}
          </p>
          {dest.visited ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-[#e6d3a3]/40 drop-shadow-[0_0_8px_rgba(230,211,163,0.45)]">
              <Check size={12} strokeWidth={2} className="text-[#e6d3a3]" />
            </span>
          ) : isHard ? (
            <Landmark size={16} strokeWidth={1.2} className="mt-1 shrink-0 text-[#dfe4ea]/50" />
          ) : null}
        </div>

        <p className="mt-1 text-[11px] text-zinc-500">{dest.sub}</p>

        <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3">
          <p
            className={`text-[8px] uppercase tracking-[0.28em] ${
              isHard ? "text-[#dfe4ea]/55" : dest.tier === "evisa" ? "text-[#e6d3a3]/45" : "text-zinc-600"
            }`}
          >
            {tier.label}
          </p>
          <p className="font-mono text-[10px] tabular-nums text-zinc-600">
            {tier.points * tier.multiplier}
            {isHard && <span className="ml-1 text-[#dfe4ea]/60">×2</span>}
          </p>
        </div>
      </div>

      {/* вуаль консульского допуска — только Hard Visa, только непройденные */}
      {isHard && !dest.visited && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-2xl bg-black/70 opacity-0 backdrop-blur-[3px] transition-opacity duration-500 group-hover:opacity-100">
          <ConciergeBell size={18} strokeWidth={1.2} className="text-[#dfe4ea]/70" />
          <p className={`${cormorant.className} px-6 text-center text-base italic leading-snug text-[#dfe4ea]/90`}>
            Требуется консульский допуск
          </p>
          <p className="text-[8px] uppercase tracking-[0.35em] text-[#e6d3a3]/60">
            Запросить консьержа клуба
          </p>
        </div>
      )}
    </article>
  );
}

/* ── Consular Clearance: карта экспансии ─────────────────────────── */

function ConsularGrid() {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[10px] uppercase tracking-[0.4em] text-zinc-600">
          Consular Clearance
        </h2>
        <p className={`${cormorant.className} text-sm italic text-zinc-600`}>
          визовый барьер — элемент престижа
        </p>
      </div>

      {/* легенда цензов */}
      <div className="mb-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-white/[0.05] pb-4">
        {(Object.keys(TIERS) as Tier[]).map((t) => (
          <p key={t} className="flex items-center gap-2 text-[9px] uppercase tracking-[0.25em] text-zinc-600">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                t === "hard" ? "bg-[#dfe4ea]/70" : t === "evisa" ? "bg-[#e6d3a3]/60" : "bg-zinc-500"
              }`}
            />
            {TIERS[t].label}
            {t === "hard" && <span className="text-[#dfe4ea]/60">· ×2</span>}
          </p>
        ))}
      </div>

      <div className="space-y-10">
        {REGIONS.map((region) => (
          <div key={region}>
            <div className="mb-4 flex items-baseline gap-4">
              <h3 className={`${cormorant.className} text-xl italic text-zinc-400`}>{region}</h3>
              <span className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DESTINATIONS.filter((d) => d.region === region).map((d) => (
                <DestinationCard key={d.id} dest={d} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Легендарные комбо ───────────────────────────────────────────── */

function LegendaryCombos() {
  const byId = useMemo(
    () => Object.fromEntries(DESTINATIONS.map((d) => [d.id, d])),
    [],
  );

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-[10px] uppercase tracking-[0.4em] text-zinc-600">
          Легендарные комбо
        </h2>
        <p className={`${cormorant.className} text-sm italic text-zinc-600`}>
          визовые кампании, о которых говорят
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {COMBOS.map(({ id, title, lore, ids, Icon }) => {
          const done = ids.filter((i) => byId[i]?.visited).length;
          const complete = done === ids.length;

          return (
            <article
              key={id}
              className={[
                "relative overflow-hidden rounded-[1.2rem] p-7 ring-1 transition-all duration-500",
                complete
                  ? "bg-[#e6d3a3]/[0.03] ring-[#e6d3a3]/25 shadow-[0_0_50px_-16px_rgba(230,211,163,0.4),inset_0_1px_0_rgba(255,255,255,0.07)]"
                  : "bg-white/[0.015] ring-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
              ].join(" ")}
            >
              {complete && (
                <div className="pointer-events-none absolute -top-14 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-[#e6d3a3]/[0.1] blur-3xl" />
              )}

              <div className="relative">
                <div
                  className={[
                    "mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-1",
                    complete
                      ? "ring-[#e6d3a3]/40 drop-shadow-[0_0_14px_rgba(230,211,163,0.35)]"
                      : "ring-white/[0.08]",
                  ].join(" ")}
                  style={{
                    background: complete
                      ? "radial-gradient(circle at 32% 28%, #3a3424 0%, #1c1810 60%, #0d0b07 100%)"
                      : "radial-gradient(circle at 32% 28%, #232323 0%, #131313 60%, #0a0a0a 100%)",
                  }}
                >
                  <Icon
                    size={20}
                    strokeWidth={1.1}
                    className={complete ? "text-[#e6d3a3]" : "text-zinc-500"}
                  />
                </div>

                <h3 className={`${cormorant.className} mt-5 text-center text-2xl font-medium ${complete ? "text-[#e6d3a3]" : "text-zinc-200"}`}>
                  {title}
                </h3>
                <p className="mx-auto mt-2 max-w-[26ch] text-center text-xs leading-relaxed text-zinc-500">
                  {lore}
                </p>

                {/* маршрут комбо */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
                  {ids.map((destId, i) => {
                    const d = byId[destId];
                    const v = d?.visited;
                    return (
                      <span key={destId} className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] ring-1 ${
                            v
                              ? "text-[#e6d3a3]/90 ring-[#e6d3a3]/30"
                              : "text-zinc-500 ring-white/[0.07]"
                          }`}
                        >
                          {d?.name}
                        </span>
                        {i < ids.length - 1 && (
                          <span className="h-px w-2.5 bg-white/[0.1]" />
                        )}
                      </span>
                    );
                  })}
                </div>

                <p
                  className={`${cormorant.className} mt-6 border-t border-white/[0.05] pt-4 text-center text-sm italic ${
                    complete ? "text-[#e6d3a3]/80" : "text-zinc-600"
                  }`}
                >
                  {complete ? (
                    <span className="inline-flex items-center gap-2">
                      <Sparkles size={13} strokeWidth={1.3} />
                      Вручено · внесено в летопись клуба
                    </span>
                  ) : (
                    `пройдено ${done} из ${ids.length} визовых рубежей`
                  )}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ── Страница ────────────────────────────────────────────────────── */

export default function GamificationClient() {
  return (
    <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-12 sm:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(90%_60%_at_50%_-10%,#191714_0%,#0a0a0b_55%,#060607_100%)]" />

      <header className="mb-14">
        <p className="text-[10px] uppercase tracking-[0.5em] text-zinc-600">
          Voyage · Season 2026
        </p>
        <h1 className={`${cormorant.className} mt-3 text-5xl font-medium tracking-wide text-zinc-50 sm:text-6xl`}>
          Хроника резидента
        </h1>
        <p className={`${cormorant.className} mt-3 text-lg italic text-zinc-500`}>
          Мир, разделённый на визы. И ваш путь сквозь него.
        </p>
      </header>

      <div className="mb-20 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <MembershipCard />
        <InfluencePanel />
      </div>

      <div className="mb-20">
        <VoyagePassport />
      </div>

      <div className="mb-20">
        <ConsularGrid />
      </div>

      <LegendaryCombos />

      <p className={`${cormorant.className} mt-20 border-t border-white/[0.05] pt-8 text-center text-sm italic text-zinc-600`}>
        Следующий штамп ставится только вживую.
      </p>
    </div>
  );
}
