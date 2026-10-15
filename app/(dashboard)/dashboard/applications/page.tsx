"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · МОИ ЗАЯВКИ — app/(dashboard)/dashboard/applications/page.tsx
 *
 * Шапка-объяснялка (PageExplainerHeader) + заявки резидента
 * (MyApplications): вкладки «Туры» (направления с карты, заявку на
 * рассмотрении можно отменить) и «Мероприятия» (из «Темы / Тусовки»,
 * после отказа — повторная заявка через месяц).
 * ──────────────────────────────────────────────────────────────────── */

import { BadgeCheck, CalendarClock, FileText, Hourglass, ListChecks, MapPin } from "lucide-react";
import MyApplications from "@/app/components/MyApplications";
import { useLanguage } from "@/app/context/LanguageContext";
import PageExplainerHeader, {
  ResidentPageShell,
  type ExplainerDict,
} from "@/app/(dashboard)/dashboard/_components/PageExplainerHeader";

const COPY: ExplainerDict = {
  EN: {
    eyebrow: "Application status",
    title: "My Applications",
    subtitle:
      "Your tour and event applications in one place. The team’s decision appears right here — no chasing, no back-and-forth.",
    steps: ["Pick a tour on the map or an event", "The club team reviews it", "See the decision here"],
    cards: [
      {
        title: "Three statuses · total clarity",
        text: "Under review — your application is with the club team; a tour application can still be cancelled at this stage. Approved — the spot is yours. Declined — a decision about one trip or event, not about you.",
      },
      {
        title: "A second chance · in a month",
        text: "After a decline, you can apply to the same event again in a month — the date is shown on its card. Meanwhile, the club’s other tours, events and castings stay open to you.",
        cta: "Themes / Parties",
      },
    ],
  },
  RU: {
    eyebrow: "Статус заявок",
    title: "Мои заявки",
    subtitle:
      "Заявки на туры и мероприятия клуба — в одном месте. Решение команды вы увидите здесь, без переписки и уточнений.",
    steps: ["Выберите тур на карте или мероприятие", "Команда клуба рассматривает заявку", "Решение появится здесь"],
    cards: [
      {
        title: "Три статуса · полная ясность",
        text: "На рассмотрении — заявка у команды клуба; заявку на тур в этот момент ещё можно отменить. Одобрена — место за вами. Отклонена — решение по конкретной поездке или мероприятию, а не по вам.",
      },
      {
        title: "Второй шанс · через месяц",
        text: "После отказа повторная заявка на то же мероприятие откроется через месяц — дату вы увидите на его карточке. А пока для вас открыты другие туры, мероприятия и кастинги клуба.",
        cta: "Темы / Тусовки",
      },
    ],
  },
  ES: {
    eyebrow: "Estado de solicitudes",
    title: "Mis solicitudes",
    subtitle:
      "Tus solicitudes para tours y eventos del club, en un solo lugar. La decisión del equipo aparece aquí mismo, sin tener que preguntar.",
    steps: ["Elige un tour en el mapa o un evento", "El equipo del club la revisa", "Consulta la decisión aquí"],
    cards: [
      {
        title: "Tres estados · total claridad",
        text: "En revisión: la solicitud está con el equipo del club; si es para un tour, todavía puedes cancelarla. Aprobada: la plaza es tuya. Rechazada: es una decisión sobre un viaje o evento concreto, no sobre ti.",
      },
      {
        title: "Segunda oportunidad · en un mes",
        text: "Tras un rechazo, podrás volver a solicitar el mismo evento al cabo de un mes; la fecha aparece en su tarjeta. Mientras tanto, los demás tours, eventos y castings del club siguen abiertos para ti.",
        cta: "Temas / Fiestas",
      },
    ],
  },
  PT: {
    eyebrow: "Status das solicitações",
    title: "Minhas solicitações",
    subtitle:
      "Suas solicitações para tours e eventos do clube em um só lugar. A decisão da equipe aparece aqui mesmo — sem precisar perguntar.",
    steps: ["Escolha um tour no mapa ou um evento", "A equipe do clube analisa", "Veja a decisão aqui"],
    cards: [
      {
        title: "Três status · total clareza",
        text: "Em análise — a solicitação está com a equipe do clube; se for para um tour, ainda dá para cancelar. Aprovada — a vaga é sua. Recusada — uma decisão sobre uma viagem ou evento específico, não sobre você.",
      },
      {
        title: "Segunda chance · em um mês",
        text: "Depois de uma recusa, você pode solicitar o mesmo evento de novo em um mês — a data aparece no cartão dele. Enquanto isso, os outros tours, eventos e castings do clube continuam abertos para você.",
        cta: "Temas / Festas",
      },
    ],
  },
};

export default function ResidentApplicationsPage() {
  const { lang } = useLanguage();

  return (
    <ResidentPageShell>
      <PageExplainerHeader
        copy={COPY}
        icon={FileText}
        stepIcons={[MapPin, Hourglass, BadgeCheck]}
        cards={[{ icon: ListChecks }, { icon: CalendarClock, href: "/dashboard/parties" }]}
      />

      <div className="mt-10">
        <MyApplications locale={lang.toLowerCase() as "ru" | "en" | "es" | "pt"} />
      </div>
    </ResidentPageShell>
  );
}
