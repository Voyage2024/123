"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · КАРТОЧКА РЕЗИДЕНТКИ — app/(dashboard)/partner/residents/[id]/page.tsx
 *
 * Сюда ведут ссылки из пульта, манифеста, пульса и комнаты сделки.
 * Слепой отбор: имя, фото и туры — только если резидентка летала с этим
 * организатором (или смотрит owner/admin). Иначе — код, рост, языки, Trusted.
 *
 * Данные: RPC public.partner_resident_card(p_resident) через usePartnerFeed.
 * ──────────────────────────────────────────────────────────────────── */

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, ChevronRight, Lock, Plane, ShieldAlert, Users } from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { ROUTES } from "@/app/(dashboard)/partner/_lib/routes";
import { usePartnerFormat, type Common, type Fmt } from "@/app/(dashboard)/partner/_lib/format";
import { usePartnerFeed } from "@/app/(dashboard)/partner/_lib/usePartnerFeed";
import { parseResidentCard, type ResidentCard } from "@/app/(dashboard)/partner/_lib/residents";
import { toProjectKey } from "@/lib/project-types";
import { TrustBadge } from "@/app/(dashboard)/partner/_components/TrustSignals";
import {
  FeedGate,
  LINK_SUBTLE,
  PageHeader,
  PageShell,
  Panel,
  Pill,
  SectionHeader,
  cormorant,
  initials,
} from "@/app/(dashboard)/partner/_components/PartnerUI";

type Dict = {
  eyebrow: string;
  back: string;
  hiddenTitle: string;
  hiddenNote: string;
  invalid: string;
  facts: { height: string; languages: string; kyc: string; segment: string; reliability: string; open: string };
  yes: string;
  no: string;
  blacklisted: string;
  toursEyebrow: string;
  toursTitle: string;
  noTours: string;
  verified: string;
};

const T: Record<Lang, Dict> = {
  RU: {
    eyebrow: "Резидентка",
    back: "Все резидентки",
    hiddenTitle: "Анкета скрыта",
    hiddenNote: "Имя, фото и история туров откроются после рукопожатия в вашем туре.",
    invalid: "Некорректная ссылка на резидентку.",
    facts: { height: "Рост", languages: "Языки", kyc: "Верификация", segment: "Сегмент", reliability: "Надёжность", open: "Открыта к турам" },
    yes: "Да",
    no: "Нет",
    blacklisted: "В чёрном списке",
    toursEyebrow: "Совместные туры",
    toursTitle: "Туры с вами",
    noTours: "Совместных туров пока нет.",
    verified: "Верифицирована",
  },
  EN: {
    eyebrow: "Resident",
    back: "All residents",
    hiddenTitle: "Profile hidden",
    hiddenNote: "Name, photo and tour history unlock after the handshake in your tour.",
    invalid: "Invalid resident link.",
    facts: { height: "Height", languages: "Languages", kyc: "Verification", segment: "Segment", reliability: "Reliability", open: "Open to tours" },
    yes: "Yes",
    no: "No",
    blacklisted: "Blacklisted",
    toursEyebrow: "Shared tours",
    toursTitle: "Tours with you",
    noTours: "No shared tours yet.",
    verified: "Verified",
  },
  ES: {
    eyebrow: "Residente",
    back: "Todas las residentes",
    hiddenTitle: "Perfil oculto",
    hiddenNote: "Nombre, foto e historial de tours se revelan tras el acuerdo en tu tour.",
    invalid: "Enlace de residente no válido.",
    facts: { height: "Altura", languages: "Idiomas", kyc: "Verificación", segment: "Segmento", reliability: "Fiabilidad", open: "Abierta a tours" },
    yes: "Sí",
    no: "No",
    blacklisted: "En lista negra",
    toursEyebrow: "Tours compartidos",
    toursTitle: "Tours contigo",
    noTours: "Aún no hay tours compartidos.",
    verified: "Verificada",
  },
  PT: {
    eyebrow: "Residente",
    back: "Todas as residentes",
    hiddenTitle: "Perfil oculto",
    hiddenNote: "Nome, foto e histórico de tours aparecem após o acordo no seu tour.",
    invalid: "Link de residente inválido.",
    facts: { height: "Altura", languages: "Idiomas", kyc: "Verificação", segment: "Segmento", reliability: "Confiabilidade", open: "Aberta a tours" },
    yes: "Sim",
    no: "Não",
    blacklisted: "Na lista negra",
    toursEyebrow: "Tours em comum",
    toursTitle: "Tours com você",
    noTours: "Ainda não há tours em comum.",
    verified: "Verificada",
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ResidentCardPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const { lang, c, fmt } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const valid = UUID_RE.test(id);

  if (!valid) {
    return (
      <PageShell>
        <BackLink t={t} />
        <PageHeader eyebrow={t.eyebrow} title={t.hiddenTitle} subtitle={t.invalid} />
      </PageShell>
    );
  }
  return <ResidentCardLoader id={id} t={t} c={c} fmt={fmt} />;
}

function ResidentCardLoader({ id, t, c, fmt }: { id: string; t: Dict; c: Common; fmt: Fmt }) {
  const feed = usePartnerFeed("partner_resident_card", parseResidentCard, { p_resident: id });
  return (
    <FeedGate feed={feed} c={c} eyebrow={t.eyebrow} title={t.eyebrow}>
      {(card) => <ResidentCardView card={card} t={t} c={c} fmt={fmt} />}
    </FeedGate>
  );
}

function BackLink({ t }: { t: Dict }) {
  return (
    <Link href={ROUTES.residents} className={`${LINK_SUBTLE} mb-6 inline-flex items-center gap-2`}>
      <ArrowLeft className="size-4" aria-hidden />
      {t.back}
    </Link>
  );
}

function ResidentCardView({ card, t, c, fmt }: { card: ResidentCard; t: Dict; c: Common; fmt: Fmt }) {
  const title = card.revealed && card.name ? card.name : card.code;
  const facts: [string, string][] = [
    [t.facts.height, card.height ? `${card.height} cm` : "—"],
    [t.facts.languages, card.languages.join(" · ") || "—"],
    [t.facts.kyc, `${card.kycLevel} / 3`],
    [t.facts.segment, card.segment ?? "—"],
    [t.facts.reliability, card.reliability !== null ? `${fmt.num(card.reliability)}%` : "—"],
    [t.facts.open, card.openToTours ? t.yes : t.no],
  ];

  return (
    <PageShell>
      <BackLink t={t} />
      <PageHeader
        eyebrow={`${t.eyebrow} · ${card.code}`}
        title={title}
        subtitle={card.revealed ? "" : t.hiddenNote}
        aside={
          <div className="flex flex-wrap gap-1.5">
            <TrustBadge trust={card.trust} />
            {card.verifiedAt !== null && (
              <Pill tone="emerald" icon={BadgeCheck}>
                {t.verified}
              </Pill>
            )}
            {card.blacklisted && (
              <Pill tone="rose" icon={ShieldAlert}>
                {t.blacklisted}
              </Pill>
            )}
          </div>
        }
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Panel className="flex aspect-[3/4] items-center justify-center">
          {card.revealed && card.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.photo} alt={title} className="absolute inset-0 size-full object-cover" />
          ) : card.revealed && card.name ? (
            <span className={`${cormorant.className} text-6xl text-amber-100/80`}>{initials(card.name)}</span>
          ) : (
            <span className="flex flex-col items-center gap-3 px-6 text-center text-xs text-zinc-500">
              <Lock className="size-6 text-zinc-600" strokeWidth={1.5} aria-hidden />
              {t.hiddenTitle}
            </span>
          )}
        </Panel>

        <Panel className="p-5 sm:p-6">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{label}</dt>
                <dd className="mt-1 truncate text-sm text-zinc-100">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      {card.revealed && (
        <section className="mt-10">
          <SectionHeader eyebrow={t.toursEyebrow} title={t.toursTitle} icon={Plane} count={card.tours.length} />
          {card.tours.length === 0 ? (
            <Panel className="mt-4 flex items-center gap-3 p-5 text-sm text-zinc-400">
              <Users className="size-4 shrink-0 text-zinc-600" aria-hidden />
              {t.noTours}
            </Panel>
          ) : (
            <ul className="mt-4 grid gap-2">
              {card.tours.map((tour) => {
                const key = toProjectKey(tour.project);
                const project = key ? c.projects[key] : tour.project;
                return (
                  <li key={tour.tourId}>
                    <Link
                      href={ROUTES.tour(tour.tourId)}
                      className="group flex items-center gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 transition hover:border-amber-200/30"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-zinc-100">
                          {[fmt.city(tour.city), project].filter(Boolean).join(" · ") || "—"}
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {tour.departsAt !== null ? fmt.date(tour.departsAt, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          {tour.memberStatus ? ` · ${tour.memberStatus}` : ""}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-zinc-600 transition group-hover:text-amber-200" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </PageShell>
  );
}
