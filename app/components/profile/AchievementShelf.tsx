"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ДОСТИЖЕНИЯ — компактные мини-карточки
 * app/components/profile/AchievementShelf.tsx
 *
 * Хранение: profiles.achievements (text[]) — массив ключей ниже.
 * Вручает и отзывает только персонал клуба (owner/admin): в UI — кнопкой
 * на карточке, в базе — триггер voyage_guard_profile_privileges.
 * Старые ключи (disco_queen, gem, party) просто не отображаются.
 *
 * Мобильная: горизонтальная лента со snap-прокруткой.
 * md+: сетка 5 × 2.
 * ──────────────────────────────────────────────────────────────────── */

import {
  Aperture,
  Check,
  Gem,
  Globe,
  KeyRound,
  Lock,
  MessagesSquare,
  Moon,
  Plane,
  ScanFace,
  ShieldCheck,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { cormorant } from "./fonts";

export const ACHIEVEMENT_KEYS = [
  "first_step",
  "style_ambassador",
  "voyage_wings",
  "chosen_face",
  "night_resident",
  "in_focus",
  "chat_empress",
  "global_reach",
  "tradition_keeper",
  "status_legend",
] as const;

export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[number];

export const isAchievementKey = (v: unknown): v is AchievementKey =>
  typeof v === "string" && (ACHIEVEMENT_KEYS as readonly string[]).includes(v);

const ICONS: Record<AchievementKey, LucideIcon> = {
  first_step: KeyRound,
  style_ambassador: UserPlus,
  voyage_wings: Plane,
  chosen_face: ScanFace,
  night_resident: Moon,
  in_focus: Aperture,
  chat_empress: MessagesSquare,
  global_reach: Globe,
  tradition_keeper: ShieldCheck,
  status_legend: Gem,
};

type ShelfDict = {
  title: string;
  of: string;
  earned: string;
  locked: string;
  adminHint: string;
  items: Record<AchievementKey, readonly [title: string, criterion: string]>;
};

const DICT: Record<Lang, ShelfDict> = {
  RU: {
    title: "Достижения",
    of: "из",
    earned: "Получено",
    locked: "Ещё не получено",
    adminHint: "Нажмите, чтобы вручить или отозвать",
    items: {
      first_step: ["Первый шаг", "Регистрация в клубе"],
      style_ambassador: ["Посол стиля", "Первая приглашённая подруга"],
      voyage_wings: ["Крылья Voyage", "Первый перелёт или тур"],
      chosen_face: ["Избранное лицо", "Полный аппрув портфолио"],
      night_resident: ["Резидент ночи", "Активность на клубных событиях"],
      in_focus: ["В объективе", "Обновлённые цифровые снепы"],
      chat_empress: ["Императрица чата", "Жизнь комьюнити"],
      global_reach: ["Глобальный охват", "Международные проекты агентства"],
      tradition_keeper: ["Хранительница традиций", "Профиль и безопасность заполнены"],
      status_legend: ["Легенда Status", "Особый вклад в комьюнити"],
    },
  },
  EN: {
    title: "Achievements",
    of: "of",
    earned: "Earned",
    locked: "Not yet earned",
    adminHint: "Click to award or revoke",
    items: {
      first_step: ["First Step", "Joined the club"],
      style_ambassador: ["Style Ambassador", "Invited a first friend"],
      voyage_wings: ["Voyage Wings", "First flight or tour"],
      chosen_face: ["Chosen Face", "Full portfolio approval"],
      night_resident: ["Resident of the Night", "Active at club events"],
      in_focus: ["In Focus", "Fresh digital snaps"],
      chat_empress: ["Empress of the Chat", "The life of the community"],
      global_reach: ["Global Reach", "International agency projects"],
      tradition_keeper: ["Keeper of Traditions", "Profile and security complete"],
      status_legend: ["Status Legend", "A special mark on the community"],
    },
  },
  ES: {
    title: "Logros",
    of: "de",
    earned: "Obtenido",
    locked: "Aún no obtenido",
    adminHint: "Haz clic para otorgar o revocar",
    items: {
      first_step: ["Primer paso", "Ingreso al club"],
      style_ambassador: ["Embajadora de estilo", "Primera amiga invitada"],
      voyage_wings: ["Alas de Voyage", "Primer vuelo o tour"],
      chosen_face: ["Rostro elegido", "Portafolio aprobado por completo"],
      night_resident: ["Residente de la noche", "Activa en los eventos del club"],
      in_focus: ["En el objetivo", "Digitales actualizados"],
      chat_empress: ["Emperatriz del chat", "Alma de la comunidad"],
      global_reach: ["Alcance global", "Proyectos internacionales de la agencia"],
      tradition_keeper: ["Guardiana de tradiciones", "Perfil y seguridad completos"],
      status_legend: ["Leyenda Status", "Aporte especial a la comunidad"],
    },
  },
  PT: {
    title: "Conquistas",
    of: "de",
    earned: "Conquistado",
    locked: "Ainda não conquistado",
    adminHint: "Clique para conceder ou revogar",
    items: {
      first_step: ["Primeiro passo", "Entrada no clube"],
      style_ambassador: ["Embaixadora de estilo", "Primeira amiga convidada"],
      voyage_wings: ["Asas Voyage", "Primeiro voo ou tour"],
      chosen_face: ["Rosto escolhido", "Portfólio aprovado por completo"],
      night_resident: ["Residente da noite", "Ativa nos eventos do clube"],
      in_focus: ["Na lente", "Digitais atualizados"],
      chat_empress: ["Imperatriz do chat", "Alma da comunidade"],
      global_reach: ["Alcance global", "Projetos internacionais da agência"],
      tradition_keeper: ["Guardiã das tradições", "Perfil e segurança completos"],
      status_legend: ["Lenda Status", "Contribuição especial à comunidade"],
    },
  },
};

/* ── мини-карточка ───────────────────────────────────────────────── */

function AchievementTile({
  achievementKey,
  on,
  isAdmin,
  d,
  onToggle,
}: {
  achievementKey: AchievementKey;
  on: boolean;
  isAdmin: boolean;
  d: ShelfDict;
  onToggle: (key: AchievementKey) => void;
}) {
  const Icon = ICONS[achievementKey];
  const [title, criterion] = d.items[achievementKey];

  const shell = [
    "flex h-full w-full flex-col gap-3 rounded-[14px] border p-3.5 text-left transition-all duration-300",
    on
      ? "border-[#d4a853]/30 bg-[linear-gradient(160deg,rgba(212,168,83,0.1)_0%,rgba(212,168,83,0.02)_65%)] shadow-[0_0_30px_-14px_rgba(212,168,83,0.5)]"
      : "border-zinc-800/60 bg-zinc-900/35",
  ].join(" ");

  const body = (
    <>
      <span className="flex items-center justify-between">
        <span
          className={[
            "flex h-8 w-8 items-center justify-center rounded-full border",
            on
              ? "border-[#d4a853]/45 bg-[radial-gradient(circle_at_32%_28%,#3a3424_0%,#1c1810_65%,#0d0b07_100%)] text-[#ecd08c]"
              : "border-zinc-600/35 bg-zinc-950/60 text-[#8b8b94]",
          ].join(" ")}
        >
          <Icon aria-hidden size={15} strokeWidth={1.4} />
        </span>
        {on ? (
          <Check aria-hidden size={13} strokeWidth={2} className="text-[#d4a853]" />
        ) : (
          <Lock aria-hidden size={12} strokeWidth={1.6} className="text-zinc-600" />
        )}
      </span>
      <span className="block">
        <span
          className={`${cormorant.className} block text-[17px] font-semibold leading-[1.1] ${
            on ? "text-[#f3e3b5]" : "text-zinc-300"
          }`}
        >
          {title}
        </span>
        <span
          className={`mt-1.5 block text-[10.5px] leading-[1.45] ${on ? "text-[#9a927f]" : "text-[#82828c]"}`}
        >
          {criterion}
        </span>
      </span>
      <span className="sr-only">{on ? d.earned : d.locked}</span>
    </>
  );

  if (!isAdmin) return <div className={shell}>{body}</div>;

  return (
    <button
      type="button"
      aria-pressed={on}
      title={d.adminHint}
      onClick={() => onToggle(achievementKey)}
      className={`${shell} cursor-pointer hover:border-[#d4a853]/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d4a853]/60`}
    >
      {body}
    </button>
  );
}

/* ── лента / сетка ───────────────────────────────────────────────── */

export function AchievementShelf({
  lang,
  earned,
  isAdmin,
  onToggle,
}: {
  lang: Lang;
  earned: readonly string[] | null | undefined;
  isAdmin: boolean;
  onToggle: (key: AchievementKey) => void;
}) {
  const d = DICT[lang] ?? DICT.EN;
  const have = new Set((earned ?? []).filter(isAchievementKey));

  return (
    <section aria-labelledby="achievements-title">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Sparkles aria-hidden size={14} strokeWidth={1.5} className="text-amber-200/55" />
          <h2
            id="achievements-title"
            className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400"
          >
            {d.title}
          </h2>
        </div>
        <p className={`${cormorant.className} text-base italic text-zinc-500`}>
          <span className="text-[#ecd08c]">{have.size}</span> {d.of} {ACHIEVEMENT_KEYS.length}
        </p>
      </div>

      <ul
        role="list"
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {ACHIEVEMENT_KEYS.map((key) => (
          <li key={key} className="w-[9.25rem] shrink-0 snap-start md:w-auto">
            <AchievementTile
              achievementKey={key}
              on={have.has(key)}
              isAdmin={isAdmin}
              d={d}
              onToggle={onToggle}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
