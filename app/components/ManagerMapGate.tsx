"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Заглушка карты для менеджеров
 * app/components/ManagerMapGate.tsx
 *
 * Интерактивная карта и отклики на локации — пространство резиденток.
 * Менеджер (role = manager) видит вместо неё спокойную заглушку
 * со ссылкой в Штаб. Гости, резидентки, админ и владелец проходят как есть.
 * Сервер дополнительно не даёт менеджеру подать заявку
 * (submitMapHubApplication → getActor(["resident"])).
 * ──────────────────────────────────────────────────────────────────── */

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Compass, KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";

const T: Record<Lang, { eyebrow: string; title: string; body: string; hint: string; cta: string; castings: string }> = {
  RU: {
    eyebrow: "VOYAGE · Partner",
    title: "Карта открыта только резиденткам",
    body: "Интерактивная карта — личное пространство резиденток: здесь они выбирают направления и откликаются на локации. Для партнёров клуба работа ведётся в Штабе.",
    hint: "Состав на тур собирается через кастинг — резидентки откликаются сами, вы видите их по слепому коду до рукопожатия.",
    cta: "Перейти в Штаб",
    castings: "Открыть кастинги",
  },
  EN: {
    eyebrow: "VOYAGE · Partner",
    title: "The map is reserved for residents",
    body: "The interactive map is the residents' private space: they choose destinations and apply to locations here. Club partners work from Command.",
    hint: "Crews are built through castings — residents reply themselves, and you see them by blind code until the handshake.",
    cta: "Go to Command",
    castings: "Open castings",
  },
  ES: {
    eyebrow: "VOYAGE · Partner",
    title: "El mapa es solo para residentes",
    body: "El mapa interactivo es el espacio privado de las residentes: aquí eligen destinos y solicitan ubicaciones. Los socios del club trabajan desde el Cuartel.",
    hint: "Los equipos se forman mediante castings: las residentes responden y las ves con código ciego hasta el apretón de manos.",
    cta: "Ir al Cuartel",
    castings: "Abrir castings",
  },
  PT: {
    eyebrow: "VOYAGE · Partner",
    title: "O mapa é exclusivo das residentes",
    body: "O mapa interativo é o espaço privado das residentes: aqui elas escolhem destinos e se candidatam às localizações. Os parceiros do clube trabalham no Quartel.",
    hint: "As equipes são montadas por castings — as residentes respondem e você as vê por código cego até o aperto de mão.",
    cta: "Ir ao Quartel",
    castings: "Abrir castings",
  },
};

export default function ManagerMapGate({ children }: { children: ReactNode }) {
  const { role, loading } = useAuth();
  const { lang } = useLanguage();
  const t = T[lang] ?? T.RU;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-amber-200/60" />
      </div>
    );
  }
  if (role !== "manager") return <>{children}</>;

  return (
    <main className="relative flex min-h-[80vh] items-center justify-center overflow-hidden bg-zinc-950 px-4 py-16 text-zinc-100">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[min(860px,100vw)] -translate-x-1/2 rounded-full bg-amber-200/[0.05] blur-[120px]" />
      <section className="relative w-full max-w-xl rounded-3xl border border-amber-200/15 bg-gradient-to-b from-zinc-900/70 to-zinc-950 p-7 text-center shadow-2xl shadow-black/40 sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-200/25 bg-amber-200/[0.06] text-amber-100">
          <Compass size={22} strokeWidth={1.4} />
        </span>
        <p className="mt-6 text-[10px] uppercase tracking-[0.4em] text-amber-200/70">{t.eyebrow}</p>
        <h1 className="mt-3 font-serif text-3xl font-light leading-tight text-zinc-50 sm:text-4xl">{t.title}</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-400">{t.body}</p>
        <p className="mx-auto mt-5 flex max-w-md items-start gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-4 py-3 text-left text-xs leading-5 text-zinc-500">
          <KeyRound size={14} className="mt-0.5 shrink-0 text-amber-200/60" />
          {t.hint}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/partner"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-200/40 bg-amber-200 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-amber-100"
          >
            {t.cta}
            <ArrowUpRight size={15} />
          </Link>
          <Link
            href="/partner/castings"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-700 px-6 text-sm text-zinc-300 transition hover:border-amber-200/35 hover:text-amber-100"
          >
            {t.castings}
          </Link>
        </div>
      </section>
    </main>
  );
}
