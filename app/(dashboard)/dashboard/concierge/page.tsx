"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · КОНСЬЕРЖ — app/(dashboard)/dashboard/concierge/page.tsx
 *
 * Шапка-объяснялка (PageExplainerHeader) + запросы резидента
 * (ResidentConcierge). Запросы — визы, логистика, обмен наличных на
 * USDT через партнёров клуба; ведут их owner / admin.
 * ──────────────────────────────────────────────────────────────────── */

import { CheckCheck, Coins, ConciergeBell, PenLine, Plane, Users } from "lucide-react";
import ResidentConcierge from "@/app/components/concierge/ResidentConcierge";
import PageExplainerHeader, {
  ResidentPageShell,
  type ExplainerDict,
} from "@/app/(dashboard)/dashboard/_components/PageExplainerHeader";

const COPY: ExplainerDict = {
  EN: {
    eyebrow: "Concierge service",
    title: "Concierge",
    subtitle:
      "Visas, logistics and money on the road — in one request. Describe the task, and the club team takes it on and sees it through.",
    steps: ["Describe the task", "The club team takes it on", "Track the status here"],
    cards: [
      {
        title: "Visas & logistics",
        text: "Consular documents, flights, transfers and accommodation. Consular Clearance destinations — the ones behind a visa barrier — are especially valuable: the concierge helps you through, and the passport stamp counts double toward your index.",
        cta: "Voyage Passport",
      },
      {
        title: "Exchange · cash ↔ USDT",
        text: "Need cash on a trip — or the other way round, to move it into USDT? The concierge arranges the exchange through the club’s vetted partners: no strangers, no dubious exchange desks.",
      },
    ],
  },
  RU: {
    eyebrow: "Консьерж-служба",
    title: "Консьерж",
    subtitle:
      "Визы, логистика и деньги в поездке — одним запросом. Опишите задачу, а команда клуба возьмёт её на себя и доведёт до результата.",
    steps: ["Опишите задачу", "Команда клуба берёт её в работу", "Следите за статусом здесь"],
    cards: [
      {
        title: "Визы и логистика",
        text: "Консульские документы, перелёты, трансферы и проживание. Особенно ценны направления Consular Clearance — с визовым барьером: консьерж поможет его пройти, а штамп в паспорте удвоит вклад в индекс.",
        cta: "Паспорт Voyage",
      },
      {
        title: "Обмен · наличные ↔ USDT",
        text: "Нужны наличные в поездке или, наоборот, перевести их в USDT? Консьерж организует обмен через проверенных партнёров клуба — без случайных людей и сомнительных обменников.",
      },
    ],
  },
  ES: {
    eyebrow: "Servicio de conserjería",
    title: "Conserje",
    subtitle:
      "Visados, logística y dinero en el viaje, en una sola solicitud. Describe la tarea: el equipo del club se encarga y la lleva hasta el final.",
    steps: ["Describe la tarea", "El equipo del club se encarga", "Sigue el estado aquí"],
    cards: [
      {
        title: "Visados y logística",
        text: "Documentos consulares, vuelos, traslados y alojamiento. Los destinos Consular Clearance —con barrera de visado— son especialmente valiosos: el conserje te ayuda a superarla y el sello en el pasaporte cuenta doble en tu índice.",
        cta: "Pasaporte Voyage",
      },
      {
        title: "Cambio · efectivo ↔ USDT",
        text: "¿Necesitas efectivo en el viaje o, al revés, pasarlo a USDT? El conserje organiza el cambio con socios verificados del club: sin desconocidos ni casas de cambio dudosas.",
      },
    ],
  },
  PT: {
    eyebrow: "Serviço de concierge",
    title: "Concierge",
    subtitle:
      "Vistos, logística e dinheiro na viagem — em um só pedido. Descreva a tarefa, e a equipe do clube assume e leva até o fim.",
    steps: ["Descreva a tarefa", "A equipe do clube assume", "Acompanhe o status aqui"],
    cards: [
      {
        title: "Vistos e logística",
        text: "Documentos consulares, voos, traslados e hospedagem. Destinos Consular Clearance — com barreira de visto — valem mais: o concierge ajuda você a passar por ela, e o carimbo no passaporte conta em dobro no seu índice.",
        cta: "Passaporte Voyage",
      },
      {
        title: "Câmbio · dinheiro ↔ USDT",
        text: "Precisa de dinheiro vivo na viagem ou, ao contrário, converter em USDT? O concierge organiza o câmbio com parceiros verificados do clube — sem desconhecidos nem casas de câmbio duvidosas.",
      },
    ],
  },
};

export default function ResidentConciergePage() {
  return (
    <ResidentPageShell>
      <PageExplainerHeader
        copy={COPY}
        icon={ConciergeBell}
        stepIcons={[PenLine, Users, CheckCheck]}
        cards={[{ icon: Plane, href: "/dashboard/gamification" }, { icon: Coins }]}
      />

      <div className="mt-10">
        <ResidentConcierge />
      </div>
    </ResidentPageShell>
  );
}
