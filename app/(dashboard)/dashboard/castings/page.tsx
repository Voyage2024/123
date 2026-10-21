"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · КАСТИНГИ — app/(dashboard)/dashboard/castings/page.tsx
 *
 * Шапка-объяснялка (PageExplainerHeader) + лента кастингов.
 * Механика ленты — в ../_components/CastingFeed:
 *   «Открыта к турам» → «Готова в тур» → опцион → рукопожатие.
 * Лента живая: данные из partner_resident_feed (см. _components/CastingFeed).
 * Ниже — «Мои туры»: итоги, баллы и отзыв о менеджере (_components/MyPartnerTours).
 * ──────────────────────────────────────────────────────────────────── */

import { EyeOff, Handshake, Hourglass, MousePointerClick, Sparkles, ToggleRight } from "lucide-react";
import CastingFeed from "@/app/(dashboard)/dashboard/_components/CastingFeed";
import MyPartnerTours from "@/app/(dashboard)/dashboard/_components/MyPartnerTours";
import PageExplainerHeader, {
  ResidentPageShell,
  type ExplainerDict,
} from "@/app/(dashboard)/dashboard/_components/PageExplainerHeader";

const COPY: ExplainerDict = {
  EN: {
    eyebrow: "Closed casting",
    title: "Castings",
    subtitle:
      "Club managers put together crews for tours, shoots and shows. You see the full brief — city, dates, fee, who covers the flight and hotel — and reply in a single tap.",
    steps: ["Switch on “Open to tours”", "Tap “Ready for the tour”", "Handshake & contract in Telegram"],
    cards: [
      {
        title: "Blind casting · no pressure",
        text: "No private messages before the handshake. You see the manager only by reputation — Key tier, rating and number of tours; their name and contacts open once you’re chosen. Until the manager responds, you can withdraw your reply at no cost.",
      },
      {
        title: "Option · a spot held for you",
        text: "An option is a soft hold: the manager keeps a spot for you until a set date, with the timer right on the card. The handshake confirms you in the crew — and the tour itself earns tour points for your Influence Index.",
        cta: "Tour points",
      },
    ],
  },
  RU: {
    eyebrow: "Закрытый кастинг",
    title: "Кастинги",
    subtitle:
      "Менеджеры клуба собирают составы на туры, съёмки и показы. Вы видите бриф целиком — город, даты, гонорар, кто оплачивает перелёт и отель — и отвечаете в одно касание.",
    steps: ["Включите «Открыта к турам»", "Нажмите «Готова в тур»", "Рукопожатие и контракт в Telegram"],
    cards: [
      {
        title: "Слепой кастинг · без давления",
        text: "До рукопожатия никаких личных сообщений. Менеджера видно только по репутации — уровень Ключа, рейтинг и число туров; имя и контакты откроются, когда вас выберут. Пока менеджер не ответил, отклик можно отозвать без последствий.",
      },
      {
        title: "Опцион · место за вами",
        text: "Опцион — мягкая бронь: менеджер держит для вас место до указанной даты, таймер виден прямо на карточке. Рукопожатие закрепляет вас в составе, а сам тур приносит баллы тура в ваш Influence Index.",
        cta: "Баллы тура",
      },
    ],
  },
  ES: {
    eyebrow: "Casting privado",
    title: "Castings",
    subtitle:
      "Los gerentes del club forman equipos para tours, sesiones de fotos y desfiles. Ves el brief completo —ciudad, fechas, honorarios, quién paga el vuelo y el hotel— y respondes con un toque.",
    steps: ["Activa “Disponible para tours”", "Pulsa “Lista para el tour”", "Apretón de manos y contrato en Telegram"],
    cards: [
      {
        title: "Casting a ciegas · sin presión",
        text: "Nada de mensajes privados antes del apretón de manos. Al gerente lo ves solo por su reputación —nivel de Llave, valoración y número de tours—; su nombre y contactos se abren cuando te eligen. Mientras el gerente no responda, puedes retirar tu respuesta sin consecuencias.",
      },
      {
        title: "Opción · tu plaza reservada",
        text: "La opción es una reserva suave: el gerente te guarda la plaza hasta una fecha, con el temporizador en la propia tarjeta. El apretón de manos te confirma en el equipo, y el tour suma puntos de tour a tu Influence Index.",
        cta: "Puntos del tour",
      },
    ],
  },
  PT: {
    eyebrow: "Casting fechado",
    title: "Castings",
    subtitle:
      "Os gerentes do clube montam equipes para tours, ensaios e desfiles. Você vê o brief completo — cidade, datas, cachê, quem paga voo e hotel — e responde com um toque.",
    steps: ["Ative “Disponível para tours”", "Toque em “Pronta para o tour”", "Aperto de mão e contrato no Telegram"],
    cards: [
      {
        title: "Casting às cegas · sem pressão",
        text: "Nada de mensagens privadas antes do aperto de mão. Você vê o gerente só pela reputação — nível de Chave, avaliação e número de tours; nome e contatos abrem quando você é escolhida. Enquanto o gerente não responder, dá para retirar a resposta sem consequências.",
      },
      {
        title: "Opção · sua vaga reservada",
        text: "A opção é uma reserva leve: o gerente segura a vaga para você até uma data, com o cronômetro no próprio cartão. O aperto de mão confirma você na equipe — e o tour rende pontos de tour para o seu Influence Index.",
        cta: "Pontos do tour",
      },
    ],
  },
};

export default function ResidentCastingsPage() {
  return (
    <ResidentPageShell>
      <PageExplainerHeader
        copy={COPY}
        icon={Sparkles}
        stepIcons={[ToggleRight, MousePointerClick, Handshake]}
        cards={[{ icon: EyeOff }, { icon: Hourglass, href: "/dashboard/tours" }]}
      />

      <div className="mt-10">
        <CastingFeed />
      </div>

      <div className="mt-10">
        <MyPartnerTours />
      </div>
    </ResidentPageShell>
  );
}
