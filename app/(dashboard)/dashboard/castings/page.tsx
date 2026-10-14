"use client";

import { usePartnerFormat } from "../../partner/_lib/format";
import { PageShell, cormorant } from "../../partner/_components/PartnerUI";
import CastingFeed from "../_components/CastingFeed";

const COPY = {
  EN: {
    eyebrow: "Resident workspace",
    title: "Castings",
    subtitle: "Explore available club briefs and reply when you are ready to join a tour.",
  },
  RU: {
    eyebrow: "Кабинет резидентки",
    title: "Кастинги",
    subtitle: "Смотрите доступные брифы клуба и откликайтесь, когда готовы отправиться в тур.",
  },
  ES: {
    eyebrow: "Área de residente",
    title: "Castings",
    subtitle: "Consulta los briefs disponibles del club y responde cuando estés lista para participar en un tour.",
  },
  PT: {
    eyebrow: "Área da residente",
    title: "Castings",
    subtitle: "Veja os briefs disponíveis do clube e responda quando estiver pronta para participar de um tour.",
  },
} as const;

export default function ResidentCastingsPage() {
  const { lang, c: cm } = usePartnerFormat();
  const copy = COPY[lang] ?? COPY.EN;

  return (
    <PageShell>
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-3 text-[10px] uppercase tracking-[0.35em] text-amber-200/70">
            <span
              aria-hidden
              className="h-px w-8 bg-gradient-to-r from-amber-200/0 to-amber-200/60"
            />
            {copy.eyebrow}
          </p>
          <span
            title={cm.demoHint}
            className="rounded-full border border-zinc-700/80 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-zinc-500"
          >
            {cm.demo}
          </span>
        </div>
        <h1
          className={`${cormorant.className} mt-4 text-[2.5rem] font-medium leading-[1.05] text-zinc-50 md:text-6xl`}
        >
          {copy.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          {copy.subtitle}
        </p>
      </header>

      <div className="mt-10">
        <CastingFeed />
      </div>
    </PageShell>
  );
}
