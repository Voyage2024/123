"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · МОИ ЗАЯВКИ — app/(dashboard)/dashboard/applications/page.tsx
 *
 * Шапка-объяснялка (PageExplainerHeader) + список заявок резидента
 * (MyApplications). Повторная заявка после отказа — через месяц
 * (тот же период ожидания, что на карточке в «Темы / Тусовки»).
 * ──────────────────────────────────────────────────────────────────── */

import { BadgeCheck, CalendarClock, FileText, Hourglass, ListChecks, Send } from "lucide-react";
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
      "All your applications to club events in one place. The team’s decision appears right here — no chasing, no back-and-forth.",
    steps: ["Apply for an event", "The club team reviews it", "See the decision here"],
    cards: [
      {
        title: "Three statuses · total clarity",
        text: "Under review — your application is with the club team, nothing is needed from you. Approved — the spot is yours. Declined — a decision about one event, not about you.",
      },
      {
        title: "A second chance · in a month",
        text: "After a decline, you can apply to the same event again in a month — the date is shown on the event card. Meanwhile, the club’s other events and castings stay open to you.",
        cta: "Themes / Parties",
      },
    ],
  },
  RU: {
    eyebrow: "Статус заявок",
    title: "Мои заявки",
    subtitle:
      "Все ваши заявки на мероприятия клуба — в одном месте. Решение команды вы увидите здесь, без переписки и уточнений.",
    steps: ["Подайте заявку на мероприятие", "Команда клуба её рассматривает", "Решение появится здесь"],
    cards: [
      {
        title: "Три статуса · полная ясность",
        text: "На рассмотрении — заявка у команды клуба, от вас ничего не требуется. Одобрено — место за вами. Отказ — решение по конкретному мероприятию, а не по вам.",
      },
      {
        title: "Второй шанс · через месяц",
        text: "После отказа повторная заявка на это же мероприятие откроется через месяц — дату вы увидите на карточке мероприятия. А пока для вас открыты другие мероприятия и кастинги клуба.",
        cta: "Темы / Тусовки",
      },
    ],
  },
  ES: {
    eyebrow: "Estado de solicitudes",
    title: "Mis solicitudes",
    subtitle:
      "Todas tus solicitudes a los eventos del club, en un solo lugar. La decisión del equipo aparece aquí mismo, sin tener que preguntar.",
    steps: ["Solicita un evento", "El equipo del club la revisa", "Consulta la decisión aquí"],
    cards: [
      {
        title: "Tres estados · total claridad",
        text: "En revisión: tu solicitud está con el equipo del club y no tienes que hacer nada. Aprobada: la plaza es tuya. Rechazada: es una decisión sobre un evento concreto, no sobre ti.",
      },
      {
        title: "Segunda oportunidad · en un mes",
        text: "Tras un rechazo, podrás volver a solicitar el mismo evento al cabo de un mes; la fecha aparece en la tarjeta del evento. Mientras tanto, los demás eventos y castings del club siguen abiertos para ti.",
        cta: "Temas / Fiestas",
      },
    ],
  },
  PT: {
    eyebrow: "Status das solicitações",
    title: "Minhas solicitações",
    subtitle:
      "Todas as suas solicitações para eventos do clube em um só lugar. A decisão da equipe aparece aqui mesmo — sem precisar perguntar.",
    steps: ["Solicite um evento", "A equipe do clube analisa", "Veja a decisão aqui"],
    cards: [
      {
        title: "Três status · total clareza",
        text: "Em análise — a solicitação está com a equipe do clube, você não precisa fazer nada. Aprovada — a vaga é sua. Recusada — uma decisão sobre um evento específico, não sobre você.",
      },
      {
        title: "Segunda chance · em um mês",
        text: "Depois de uma recusa, você pode solicitar o mesmo evento de novo em um mês — a data aparece no cartão do evento. Enquanto isso, os outros eventos e castings do clube continuam abertos para você.",
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
        stepIcons={[Send, Hourglass, BadgeCheck]}
        cards={[{ icon: ListChecks }, { icon: CalendarClock, href: "/dashboard/parties" }]}
      />

      <div className="mt-10">
        <MyApplications locale={lang.toLowerCase() as "ru" | "en" | "es" | "pt"} />
      </div>
    </ResidentPageShell>
  );
}
