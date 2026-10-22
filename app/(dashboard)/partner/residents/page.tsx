"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · БАЗА РЕЗИДЕНТОК — app/(dashboard)/partner/residents/page.tsx
 *
 * Кого партнёр может позвать в тур: верифицированные (KYC 3) резидентки,
 * открытые к турам, и все, с кем он уже летал. Слепой отбор сохраняется:
 * до рукопожатия — только код, рост, языки и Trusted; имя после тура.
 * Владелец и админ видят имена всегда.
 *
 * Данные: RPC public.partner_residents_list() через usePartnerFeed.
 * ──────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronRight, Handshake, Plane, Users } from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { ROUTES } from "@/app/(dashboard)/partner/_lib/routes";
import { usePartnerFormat } from "@/app/(dashboard)/partner/_lib/format";
import { usePartnerFeed } from "@/app/(dashboard)/partner/_lib/usePartnerFeed";
import { parseResidents, type ResidentRow, type ResidentsData } from "@/app/(dashboard)/partner/_lib/residents";
import { TrustBadge } from "@/app/(dashboard)/partner/_components/TrustSignals";
import {
  EmptyFilter,
  FeedGate,
  FilterTabs,
  PageHeader,
  PageShell,
  Panel,
  Pill,
  SearchField,
} from "@/app/(dashboard)/partner/_components/PartnerUI";

type Filter = "all" | "mine" | "open";

type Dict = {
  eyebrow: string;
  title: string;
  subtitle: string;
  filters: Record<Filter, string>;
  filterLabel: string;
  searchPlaceholder: string;
  empty: string;
  worked: string;
  open: string;
  verified: string;
  height: (cm: number) => string;
  hidden: string;
  newCasting: string;
};

const T: Record<Lang, Dict> = {
  RU: {
    eyebrow: "База резиденток",
    title: "Резидентки",
    subtitle: "Верифицированные участницы, открытые к турам, и все, с кем вы уже летали. Имя открывается после рукопожатия.",
    filters: { all: "Все", mine: "Летали со мной", open: "Открыты к турам" },
    filterLabel: "Фильтр резиденток",
    searchPlaceholder: "Код, имя или язык",
    empty: "Пока нет верифицированных резиденток, открытых к турам. Опубликуйте кастинг — отклики придут сюда.",
    worked: "Летала с вами",
    open: "Открыта к турам",
    verified: "KYC",
    height: (cm) => `${cm} см`,
    hidden: "Имя скрыто до рукопожатия",
    newCasting: "Создать кастинг",
  },
  EN: {
    eyebrow: "Resident base",
    title: "Residents",
    subtitle: "Verified members open to tours, plus everyone you have already flown with. Names unlock after the handshake.",
    filters: { all: "All", mine: "Flown with me", open: "Open to tours" },
    filterLabel: "Resident filter",
    searchPlaceholder: "Code, name or language",
    empty: "No verified residents open to tours yet. Publish a casting and responses will land here.",
    worked: "Flew with you",
    open: "Open to tours",
    verified: "KYC",
    height: (cm) => `${cm} cm`,
    hidden: "Name hidden until handshake",
    newCasting: "New casting",
  },
  ES: {
    eyebrow: "Base de residentes",
    title: "Residentes",
    subtitle: "Miembros verificadas abiertas a tours y todas con las que ya volaste. El nombre se revela tras el acuerdo.",
    filters: { all: "Todas", mine: "Volaron conmigo", open: "Abiertas a tours" },
    filterLabel: "Filtro de residentes",
    searchPlaceholder: "Código, nombre o idioma",
    empty: "Aún no hay residentes verificadas abiertas a tours. Publica un casting y las respuestas llegarán aquí.",
    worked: "Voló contigo",
    open: "Abierta a tours",
    verified: "KYC",
    height: (cm) => `${cm} cm`,
    hidden: "Nombre oculto hasta el acuerdo",
    newCasting: "Crear casting",
  },
  PT: {
    eyebrow: "Base de residentes",
    title: "Residentes",
    subtitle: "Membros verificadas abertas a tours e todas com quem você já voou. O nome aparece após o acordo.",
    filters: { all: "Todas", mine: "Voaram comigo", open: "Abertas a tours" },
    filterLabel: "Filtro de residentes",
    searchPlaceholder: "Código, nome ou idioma",
    empty: "Ainda não há residentes verificadas abertas a tours. Publique um casting e as respostas chegarão aqui.",
    worked: "Voou com você",
    open: "Aberta a tours",
    verified: "KYC",
    height: (cm) => `${cm} cm`,
    hidden: "Nome oculto até o acordo",
    newCasting: "Criar casting",
  },
};

export default function ResidentsPage() {
  const { lang, c } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const feed = usePartnerFeed("partner_residents_list", parseResidents);

  return (
    <FeedGate feed={feed} c={c} eyebrow={t.eyebrow} title={t.title}>
      {(data) => <ResidentsView data={data} t={t} reset={c.reset} nothing={c.nothing} search={c.search} clear={c.clear} />}
    </FeedGate>
  );
}

function ResidentsView({
  data,
  t,
  reset,
  nothing,
  search,
  clear,
}: {
  data: ResidentsData;
  t: Dict;
  reset: string;
  nothing: string;
  search: string;
  clear: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      all: data.residents.length,
      mine: data.residents.filter((r) => r.workedWithMe).length,
      open: data.residents.filter((r) => r.openToTours).length,
    }),
    [data.residents],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.residents.filter((r) => {
      if (filter === "mine" && !r.workedWithMe) return false;
      if (filter === "open" && !r.openToTours) return false;
      if (!q) return true;
      return [r.code, r.name ?? "", ...r.languages].some((v) => v.toLowerCase().includes(q));
    });
  }, [data.residents, filter, query]);

  return (
    <PageShell>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Link
            href={ROUTES.newCasting}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-200/40 bg-amber-200 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-amber-100"
          >
            {t.newCasting}
          </Link>
        }
      />

      {data.residents.length === 0 ? (
        <Panel className="mt-8 flex items-start gap-4 p-6">
          <Users className="mt-0.5 size-5 shrink-0 text-amber-200/70" strokeWidth={1.5} aria-hidden />
          <p className="text-sm leading-relaxed text-zinc-400">{t.empty}</p>
        </Panel>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <FilterTabs
              label={t.filterLabel}
              value={filter}
              onChange={setFilter}
              items={(Object.keys(t.filters) as Filter[]).map((key) => ({ key, label: t.filters[key], count: counts[key] }))}
            />
            <div className="min-w-[14rem] flex-1">
              <SearchField value={query} onChange={setQuery} placeholder={t.searchPlaceholder} label={search} clearLabel={clear} />
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="mt-6">
              <EmptyFilter
                text={nothing}
                reset={reset}
                onReset={() => {
                  setFilter("all");
                  setQuery("");
                }}
              />
            </div>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((r) => (
                <li key={r.id}>
                  <ResidentTile r={r} t={t} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageShell>
  );
}

function ResidentTile({ r, t }: { r: ResidentRow; t: Dict }) {
  return (
    <Link
      href={ROUTES.resident(r.id)}
      className="group flex h-full flex-col gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition hover:border-amber-200/30 hover:bg-zinc-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.2em] text-amber-200/80">{r.code}</p>
          <p className="mt-1 truncate text-base font-medium text-zinc-50">{r.revealed && r.name ? r.name : t.hidden}</p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-zinc-600 transition group-hover:text-amber-200" aria-hidden />
      </div>
      <p className="text-xs text-zinc-400">
        {[r.height ? t.height(r.height) : null, r.languages.join(" · ") || null].filter(Boolean).join(" · ") || "—"}
      </p>
      <div className="mt-auto flex flex-wrap gap-1.5">
        <TrustBadge trust={r.trust} />
        {r.workedWithMe && (
          <Pill tone="gold" icon={Handshake}>
            {t.worked}
          </Pill>
        )}
        {r.openToTours && (
          <Pill tone="emerald" icon={Plane}>
            {t.open}
          </Pill>
        )}
        {r.verifiedAt !== null && (
          <Pill tone="zinc" icon={BadgeCheck}>
            {t.verified}
          </Pill>
        )}
      </div>
    </Link>
  );
}
