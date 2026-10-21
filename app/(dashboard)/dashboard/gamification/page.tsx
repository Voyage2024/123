"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ПАСПОРТ VOYAGE — app/(dashboard)/dashboard/gamification/page.tsx
 *
 * Шапка-объяснялка уходит в GamificationClient через проп header —
 * она встаёт на место его собственного заголовка, внутри той же сетки
 * (max-w-5xl), что членская карта, паспорт и комбо ниже.
 * ──────────────────────────────────────────────────────────────────── */

import { BadgeCheck, Crown, Gem, Landmark, Plane, Stamp } from "lucide-react";
import GamificationClient from "@/app/(dashboard)/dashboard/gamification/GamificationClient";
import PageExplainerHeader, { type ExplainerDict } from "@/app/(dashboard)/dashboard/_components/PageExplainerHeader";

const COPY: ExplainerDict = {
  EN: {
    eyebrow: "Voyage Passport",
    title: "Voyage Passport",
    subtitle:
      "A world divided by visas — and your path through it. Every destination you reach with the club becomes a stamp in your passport and weight in your Influence Index.",
    steps: ["Fly the club’s tours", "Earn a stamp — in person only", "Collect legendary combos"],
    cards: [
      {
        title: "Consular Clearance · the visa barrier",
        text: "Destinations behind a visa barrier are a mark of prestige: they count double toward your index. Need a visa or documents? The club concierge will help.",
        cta: "Concierge",
      },
      {
        title: "Legendary combos · Circle",
        text: "A combo is a visa campaign across several destinations. Complete it in full for an index bonus and a place in the club annals. Your index sets your Circle and your place in the global ranking.",
        cta: "Global ranking",
      },
    ],
  },
  RU: {
    eyebrow: "Voyage Passport",
    title: "Паспорт Voyage",
    subtitle:
      "Мир, разделённый на визы, — и ваш путь сквозь него. Каждое направление, где вы побывали с клубом, становится штампом в паспорте и весом в вашем Influence Index.",
    steps: ["Летайте в туры клуба", "Получайте штамп — только вживую", "Собирайте легендарные комбо"],
    cards: [
      {
        title: "Consular Clearance · визовый ценз",
        text: "Направления с визовым барьером — знак престижа: они удваивают вклад в индекс. Нужна виза или документы — консьерж клуба поможет.",
        cta: "Консьерж",
      },
      {
        title: "Легендарные комбо · Circle",
        text: "Комбо — визовая кампания из нескольких направлений. Закройте её целиком — получите бонус к индексу и запись в летописи клуба. Индекс определяет ваш Circle и место в глобальном рейтинге.",
        cta: "Глобальный рейтинг",
      },
    ],
  },
  ES: {
    eyebrow: "Voyage Passport",
    title: "Pasaporte Voyage",
    subtitle:
      "Un mundo dividido por visados, y su camino a través de él. Cada destino al que llega con el club se convierte en un sello en su pasaporte y en peso en su Influence Index.",
    steps: ["Viaje en los tours del club", "Reciba el sello, solo en persona", "Reúna combos legendarios"],
    cards: [
      {
        title: "Consular Clearance · la barrera del visado",
        text: "Los destinos con barrera de visado son un signo de prestigio: cuentan doble en su índice. ¿Necesita visado o documentos? El conserje del club le ayudará.",
        cta: "Conserje",
      },
      {
        title: "Combos legendarios · Circle",
        text: "Un combo es una campaña de visados por varios destinos. Complétela entera y obtendrá un bono al índice y un lugar en los anales del club. El índice define su Circle y su puesto en el ranking global.",
        cta: "Ranking global",
      },
    ],
  },
  PT: {
    eyebrow: "Voyage Passport",
    title: "Passaporte Voyage",
    subtitle:
      "Um mundo dividido por vistos — e o seu caminho através dele. Cada destino que você alcança com o clube vira um carimbo no passaporte e peso no seu Influence Index.",
    steps: ["Viaje nos tours do clube", "Ganhe o carimbo — só pessoalmente", "Reúna combos lendários"],
    cards: [
      {
        title: "Consular Clearance · a barreira do visto",
        text: "Destinos com barreira de visto são marca de prestígio: contam em dobro no seu índice. Precisa de visto ou documentos? O concierge do clube ajuda.",
        cta: "Concierge",
      },
      {
        title: "Combos lendários · Circle",
        text: "Um combo é uma campanha de vistos por vários destinos. Complete-a inteira e ganhe um bônus no índice e um lugar nos anais do clube. O índice define seu Circle e sua posição no ranking global.",
        cta: "Ranking global",
      },
    ],
  },
};

export default function GamificationPage() {
  return (
    <GamificationClient
      header={
        <PageExplainerHeader
          copy={COPY}
          icon={BadgeCheck}
          stepIcons={[Plane, Stamp, Gem]}
          cards={[
            { icon: Landmark, href: "/dashboard/concierge" },
            { icon: Crown, href: "/dashboard/leaderboard" },
          ]}
        />
      }
    />
  );
}
