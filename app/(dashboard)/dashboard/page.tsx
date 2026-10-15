"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · МОЙ VOYAGE (главная резидентки) — app/(dashboard)/dashboard/page.tsx
 *
 * Приветствие и лента кастингов: менеджер публикует кастинг, резидентка
 * видит бриф и отвечает «Готова в тур».
 *
 * Если на /dashboard уже есть свои блоки (карта клуба, паспорт) —
 * не заменяйте страницу, а вставьте в неё <CastingFeed /> из
 * ./_components/CastingFeed: он самостоятельный.
 * ──────────────────────────────────────────────────────────────────── */

import { useAuth } from "@/app/context/AuthContext";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { usePartnerFormat } from "../partner/_lib/format";
import { PageShell, cormorant } from "../partner/_components/PartnerUI";
import CastingFeed from "./_components/CastingFeed";

type Dict = {
  eyebrow: string;
  greet: { neutral: string; morning: string; day: string; evening: string; night: string };
  subtitle: string;
};

const T: Record<Lang, Dict> = {
  EN: {
    eyebrow: "My Voyage",
    greet: { neutral: "Welcome back", morning: "Good morning", day: "Good afternoon", evening: "Good evening", night: "Good night" },
    subtitle: "New club castings are here. Reply in one tap — once there’s a handshake, the terms and the contract will arrive in Telegram.",
  },
  RU: {
    eyebrow: "Мой Voyage",
    greet: { neutral: "С возвращением", morning: "Доброе утро", day: "Добрый день", evening: "Добрый вечер", night: "Доброй ночи" },
    subtitle: "Здесь новые кастинги клуба. Откликайтесь в одно касание — после рукопожатия условия и контракт придут в Telegram.",
  },
  ES: {
    eyebrow: "Mi Voyage",
    greet: { neutral: "Hola de nuevo", morning: "Buenos días", day: "Buenas tardes", evening: "Buenas noches", night: "Buenas noches" },
    subtitle: "Aquí están los nuevos castings del club. Responde con un toque: tras el apretón de manos, las condiciones y el contrato llegarán por Telegram.",
  },
  PT: {
    eyebrow: "Meu Voyage",
    greet: { neutral: "Bem-vinda de volta", morning: "Bom dia", day: "Boa tarde", evening: "Boa noite", night: "Boa noite" },
    subtitle: "Aqui estão os novos castings do clube. Responda com um toque — depois do aperto de mão, condições e contrato chegam pelo Telegram.",
  },
};

/** Имя-заглушка AuthContext, когда full_name пуст */
const AUTH_FALLBACK_NAME = "Резидент";

function useFirstName() {
  const { user } = useAuth();
  const full = user?.fullName?.trim();
  if (full && full !== AUTH_FALLBACK_NAME) return full.split(/\s+/)[0];
  return "";
}

export default function ResidentDashboardPage() {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const { fmt } = usePartnerFormat();
  const name = useFirstName();

  const hour = fmt.ready ? new Date(fmt.now).getHours() : null;
  const greeting =
    hour === null
      ? t.greet.neutral
      : hour < 5
        ? t.greet.night
        : hour < 12
          ? t.greet.morning
          : hour < 18
            ? t.greet.day
            : t.greet.evening;

  return (
    <PageShell>
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-3 text-[10px] uppercase tracking-[0.35em] text-amber-200/70">
            <span aria-hidden className="h-px w-8 bg-gradient-to-r from-amber-200/0 to-amber-200/60" />
            {t.eyebrow}
          </p>
        </div>
        <h1 className={`${cormorant.className} mt-4 text-[2.5rem] font-medium leading-[1.05] text-zinc-50 md:text-6xl`}>
          {greeting}
          {name && (
            <>
              ,{" "}
              <span className="bg-gradient-to-r from-amber-100 via-amber-200 to-amber-500 bg-clip-text text-transparent">{name}</span>
            </>
          )}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">{t.subtitle}</p>
      </header>

      <div className="mt-10">
        <CastingFeed />
      </div>
    </PageShell>
  );
}
