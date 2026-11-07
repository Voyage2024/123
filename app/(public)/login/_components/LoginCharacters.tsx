"use client";

import { useId } from "react";
import type { RookieMood, VeteranMood } from "@/app/(public)/login/_components/loginDialogue.copy";

// ---------------------------------------------------------------------------
// Две оригинальные fashion-иллюстрации (inline SVG, без внешних ассетов).
// variant="bust"   — поясной портрет для десктопа
// variant="avatar" — кроп головы для компактного баббла на мобильных
// ---------------------------------------------------------------------------

const SKIN = "#dcc6b2";
const SKIN_SHADE = "#c7ad97";
const HAIR = "#0c0a09";
const INK = "#1c1917";
const GOLD = "#fde68a"; // amber-200
const LIPS = "#a85d63";

const BUST_VIEWBOX = "0 0 200 260";
const AVATAR_VIEWBOX = "56 52 88 88";

type Variant = "bust" | "avatar";

interface FigureProps<M> {
  mood: M;
  variant?: Variant;
  className?: string;
}

// ---------------------------------------------------------------------------
// «Новичок»: каре с чёлкой, оверсайз-жакет, посадочный в кармане
// ---------------------------------------------------------------------------

const ROOKIE_BROWS: Record<RookieMood, [string, string]> = {
  worried: ["M80 103 Q87 99 94 97", "M106 97 Q113 99 120 103"],
  curious: ["M80 101 Q87 98 94 100", "M106 98 Q113 93 120 96"],
  panic: ["M79 99 Q86 94 94 92", "M106 92 Q114 94 121 99"],
  hopeful: ["M80 100 Q87 96 94 98", "M106 98 Q113 96 120 100"],
  shocked: ["M79 96 Q86 90 94 91", "M106 91 Q114 90 121 96"],
};

function RookieMouth({ mood }: { mood: RookieMood }) {
  switch (mood) {
    case "worried":
      return <path d="M93 134 Q96.5 131 100 134 Q103.5 137 107 134" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />;
    case "curious":
      return <path d="M95 133 Q100 135.5 106 131.5" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />;
    case "panic":
      return <ellipse cx="100" cy="135" rx="4.6" ry="5.6" fill={INK} />;
    case "hopeful":
      return <path d="M92.5 131.5 Q100 139 107.5 131.5" fill="none" stroke={INK} strokeWidth="1.9" strokeLinecap="round" />;
    case "shocked":
      return <ellipse cx="100" cy="135" rx="3.6" ry="4.6" fill={INK} />;
  }
}

export function RookieFigure({ mood, variant = "bust", className }: FigureProps<RookieMood>) {
  const uid = useId().replace(/:/g, "");
  const wide = mood === "panic" || mood === "shocked";
  const [browL, browR] = ROOKIE_BROWS[mood];

  return (
    <svg
      viewBox={variant === "avatar" ? AVATAR_VIEWBOX : BUST_VIEWBOX}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`rk-jacket-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#27272a" />
          <stop offset="1" stopColor="#09090b" />
        </linearGradient>
        <linearGradient id={`rk-hair-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#292524" />
          <stop offset="1" stopColor={HAIR} />
        </linearGradient>
      </defs>

      {/* Волосы сзади */}
      <path
        d="M62 152 C55 104 66 66 100 64 C134 66 145 104 138 152 C130 158 120 156 116 149 L84 149 C80 156 70 158 62 152 Z"
        fill={`url(#rk-hair-${uid})`}
      />

      {variant === "bust" && (
        <>
          {/* Шея */}
          <path d="M89 142 L111 142 L113 182 L87 182 Z" fill={SKIN_SHADE} />
          {/* Оверсайз-жакет */}
          <path
            d="M26 260 C30 208 56 186 100 183 C144 186 170 208 174 260 Z"
            fill={`url(#rk-jacket-${uid})`}
            stroke={GOLD}
            strokeOpacity="0.28"
            strokeWidth="1"
          />
          {/* Лацканы и вырез */}
          <path d="M86 183 L100 214 L114 183" fill={SKIN_SHADE} />
          <path d="M84 184 L100 222 L80 252" fill="none" stroke={GOLD} strokeOpacity="0.45" strokeWidth="1" />
          <path d="M116 184 L100 222 L120 252" fill="none" stroke={GOLD} strokeOpacity="0.45" strokeWidth="1" />
          {/* Посадочный талон в нагрудном кармане */}
          <g transform="rotate(-8 140 226)">
            <rect x="128" y="210" width="26" height="34" rx="2" fill="#18181b" stroke={GOLD} strokeOpacity="0.7" strokeWidth="1" />
            <line x1="132" y1="218" x2="150" y2="218" stroke={GOLD} strokeOpacity="0.6" strokeWidth="1" />
            <line x1="132" y1="223" x2="145" y2="223" stroke={GOLD} strokeOpacity="0.4" strokeWidth="1" />
            <path d="M136 230 l8 0 l-2 -2.5 M144 230 l-2 2.5" fill="none" stroke={GOLD} strokeOpacity="0.7" strokeWidth="1" />
          </g>
          <path d="M124 236 L158 232" stroke={GOLD} strokeOpacity="0.35" strokeWidth="1" />
        </>
      )}

      {/* Лицо */}
      <ellipse cx="100" cy="112" rx="29" ry="36" fill={SKIN} />
      <ellipse cx="71.5" cy="116" rx="4" ry="6.5" fill={SKIN_SHADE} />
      <ellipse cx="128.5" cy="116" rx="4" ry="6.5" fill={SKIN_SHADE} />
      {/* Маленькие золотые гвоздики */}
      <circle cx="71" cy="122" r="1.6" fill={GOLD} />
      <circle cx="129" cy="122" r="1.6" fill={GOLD} />

      {/* Чёлка */}
      <path
        d="M70 104 C70 80 86 70 100 70 C117 70 131 81 131 104 C125 92 116 87 108 88 C104 85 98 84 93 87 C85 87 76 92 70 101 Z"
        fill={`url(#rk-hair-${uid})`}
      />

      {/* Брови */}
      <path d={browL} fill="none" stroke={HAIR} strokeWidth="2.2" strokeLinecap="round" />
      <path d={browR} fill="none" stroke={HAIR} strokeWidth="2.2" strokeLinecap="round" />

      {/* Глаза */}
      <g fill={INK}>
        <ellipse cx="88" cy="113" rx={wide ? 3.6 : 3} ry={wide ? 4.4 : 3.6} />
        <ellipse cx="112" cy="113" rx={wide ? 3.6 : 3} ry={wide ? 4.4 : 3.6} />
      </g>
      <circle cx="89.2" cy="111.6" r="1" fill="#fff" fillOpacity="0.85" />
      <circle cx="113.2" cy="111.6" r="1" fill="#fff" fillOpacity="0.85" />

      {/* Нос и румянец */}
      <path d="M100 117 Q98 123 101 125" fill="none" stroke={SKIN_SHADE} strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="82" cy="125" rx="5" ry="2.6" fill="#e8a3a0" fillOpacity={wide ? 0.55 : 0.35} />
      <ellipse cx="118" cy="125" rx="5" ry="2.6" fill="#e8a3a0" fillOpacity={wide ? 0.55 : 0.35} />

      <RookieMouth mood={mood} />

      {/* Капля пота — когда переживает */}
      {(mood === "worried" || mood === "panic" || mood === "shocked") && (
        <path d="M134 90 C131 96 131 99 134 100 C137 99 137 96 134 90 Z" fill="#bae6fd" fillOpacity="0.8" />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// «Опытная»: длинные гладкие волосы, очки на макушке, слип-платье, золото
// ---------------------------------------------------------------------------

function VeteranEyes({ mood }: { mood: VeteranMood }) {
  const lid = { fill: "none", stroke: INK, strokeWidth: 1.9, strokeLinecap: "round" as const };
  const openEye = (cx: number) => (
    <g key={cx}>
      <path d={`M${cx - 6} 107 Q${cx} 102.5 ${cx + 6} 107`} {...lid} />
      <ellipse cx={cx} cy="108" rx="2.6" ry="2.4" fill={INK} />
      <path d={`M${cx + 5} 105.5 l2.6 -1.6`} {...lid} strokeWidth={1.3} />
    </g>
  );
  const smileEye = (cx: number) => <path key={cx} d={`M${cx - 6} 108 Q${cx} 103 ${cx + 6} 108`} {...lid} />;
  const calmEye = (cx: number) => (
    <g key={cx}>
      <path d={`M${cx - 6} 107 Q${cx} 104 ${cx + 6} 107`} {...lid} />
      <path d={`M${cx - 5} 107.5 Q${cx} 110 ${cx + 5} 107.5`} fill="none" stroke={INK} strokeOpacity="0.5" strokeWidth="1.1" />
      <path d={`M${cx + 5} 106 l2.6 -1.4`} {...lid} strokeWidth={1.3} />
    </g>
  );

  switch (mood) {
    case "calm":
    case "reassure":
      return <>{[calmEye(88), calmEye(112)]}</>;
    case "knowing":
      return <>{[calmEye(88), openEye(112)]}</>;
    case "delighted":
      return <>{[smileEye(88), smileEye(112)]}</>;
    case "amused":
      // Подмигивает
      return <>{[openEye(88), smileEye(112)]}</>;
  }
}

const VETERAN_BROWS: Record<VeteranMood, [string, string]> = {
  calm: ["M80 97 Q87 94 95 96", "M105 96 Q113 94 120 97"],
  knowing: ["M80 97 Q87 94 95 96", "M105 94 Q113 89 120 93"],
  reassure: ["M80 96 Q87 93 95 95", "M105 95 Q113 93 120 96"],
  delighted: ["M80 95 Q87 91 95 93", "M105 93 Q113 91 120 95"],
  amused: ["M80 94 Q87 89 95 92", "M105 97 Q113 95 120 98"],
};

function VeteranMouth({ mood }: { mood: VeteranMood }) {
  switch (mood) {
    case "calm":
      return <path d="M93 129 Q100 131.5 107 129 Q100 134 93 129 Z" fill={LIPS} />;
    case "knowing":
      return <path d="M93 129.5 Q101 131 108 127.5 Q101 134.5 93 129.5 Z" fill={LIPS} />;
    case "reassure":
      return <path d="M92 128.5 Q100 132 108 128.5 Q100 136 92 128.5 Z" fill={LIPS} />;
    case "delighted":
      return (
        <>
          <path d="M91 128 Q100 131 109 128 Q100 140 91 128 Z" fill={LIPS} />
          <path d="M93.5 129.5 Q100 131.5 106.5 129.5 Q100 132.5 93.5 129.5 Z" fill="#f5f5f4" />
        </>
      );
    case "amused":
      return <path d="M92 130 Q101 131 109 126.5 Q102 136 92 130 Z" fill={LIPS} />;
  }
}

export function VeteranFigure({ mood, variant = "bust", className }: FigureProps<VeteranMood>) {
  const uid = useId().replace(/:/g, "");
  const [browL, browR] = VETERAN_BROWS[mood];

  return (
    <svg
      viewBox={variant === "avatar" ? AVATAR_VIEWBOX : BUST_VIEWBOX}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`vt-hair-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1917" />
          <stop offset="1" stopColor={HAIR} />
        </linearGradient>
        <linearGradient id={`vt-dress-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#18181b" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <linearGradient id={`vt-gold-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="0.5" stopColor={GOLD} />
          <stop offset="1" stopColor="#d6a84c" />
        </linearGradient>
      </defs>

      {/* Длинные волосы сзади */}
      <path
        d={
          variant === "bust"
            ? "M64 100 C62 66 80 56 100 56 C120 56 138 66 136 100 C138 150 146 200 150 248 C130 254 116 250 112 244 L88 244 C84 250 70 254 50 248 C54 200 62 150 64 100 Z"
            : "M64 100 C62 66 80 56 100 56 C120 56 138 66 136 100 C138 130 140 150 142 160 L58 160 C60 150 62 130 64 100 Z"
        }
        fill={`url(#vt-hair-${uid})`}
      />

      {variant === "bust" && (
        <>
          {/* Шея и плечи */}
          <path d="M90 136 L110 136 L113 176 L87 176 Z" fill={SKIN_SHADE} />
          <path d="M34 260 C36 214 56 190 100 180 C144 190 164 214 166 260 Z" fill={SKIN} />
          {/* Слип-платье */}
          <path
            d="M48 260 C52 232 60 214 70 206 C84 216 116 216 130 206 C140 214 148 232 152 260 Z"
            fill={`url(#vt-dress-${uid})`}
            stroke={GOLD}
            strokeOpacity="0.3"
            strokeWidth="1"
          />
          <path d="M70 206 L72 186" stroke={`url(#vt-gold-${uid})`} strokeWidth="1.2" />
          <path d="M130 206 L128 186" stroke={`url(#vt-gold-${uid})`} strokeWidth="1.2" />
          {/* Цепочка с подвеской */}
          <path d="M86 176 Q100 196 114 176" fill="none" stroke={`url(#vt-gold-${uid})`} strokeWidth="1.1" />
          <path d="M100 189 l3.5 5 l-3.5 5 l-3.5 -5 Z" fill={`url(#vt-gold-${uid})`} />
          {/* Пряди спереди на плечах */}
          <path d="M68 120 C64 160 62 196 58 226 C66 222 72 200 76 150 Z" fill={`url(#vt-hair-${uid})`} />
          <path d="M132 120 C136 160 138 196 142 226 C134 222 128 200 124 150 Z" fill={`url(#vt-hair-${uid})`} />
        </>
      )}

      {/* Лицо — чуть более вытянутое, «модельное» */}
      <path d="M71 104 C71 78 84 66 100 66 C116 66 129 78 129 104 C129 126 116 144 100 146 C84 144 71 126 71 104 Z" fill={SKIN} />

      {/* Пробор посередине */}
      <path
        d="M70 108 C66 80 80 60 100 60 C120 60 134 80 130 108 C126 90 116 74 101 70 L99 70 C84 74 74 90 70 108 Z"
        fill={`url(#vt-hair-${uid})`}
      />

      {/* Солнцезащитные очки на макушке */}
      <g>
        <path d="M70 76 Q100 62 130 76" fill="none" stroke={`url(#vt-gold-${uid})`} strokeWidth="1.4" />
        <ellipse cx="86" cy="70" rx="11" ry="6.5" fill="#0a0a0a" stroke={`url(#vt-gold-${uid})`} strokeWidth="1.3" transform="rotate(-8 86 70)" />
        <ellipse cx="114" cy="70" rx="11" ry="6.5" fill="#0a0a0a" stroke={`url(#vt-gold-${uid})`} strokeWidth="1.3" transform="rotate(8 114 70)" />
        <path d="M80 68 l6 -2" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M108 66 l6 2" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" />
      </g>

      {/* Серьги-капли */}
      <g fill={`url(#vt-gold-${uid})`}>
        <circle cx="71" cy="118" r="1.5" />
        <path d="M71 120 C68.5 125 68.5 129 71 130.5 C73.5 129 73.5 125 71 120 Z" />
        <circle cx="129" cy="118" r="1.5" />
        <path d="M129 120 C126.5 125 126.5 129 129 130.5 C131.5 129 131.5 125 129 120 Z" />
      </g>

      {/* Брови */}
      <path d={browL} fill="none" stroke={HAIR} strokeWidth="1.8" strokeLinecap="round" />
      <path d={browR} fill="none" stroke={HAIR} strokeWidth="1.8" strokeLinecap="round" />

      <VeteranEyes mood={mood} />

      {/* Нос, скулы */}
      <path d="M100 112 Q98 119 101.5 121" fill="none" stroke={SKIN_SHADE} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M78 120 Q82 126 86 127" fill="none" stroke={SKIN_SHADE} strokeOpacity="0.8" strokeWidth="1.2" />
      <path d="M122 120 Q118 126 114 127" fill="none" stroke={SKIN_SHADE} strokeOpacity="0.8" strokeWidth="1.2" />

      <VeteranMouth mood={mood} />

      {/* Родинка */}
      <circle cx="111" cy="124" r="0.9" fill={INK} fillOpacity="0.7" />
    </svg>
  );
}
