"use client";

import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Coins,
  ConciergeBell,
  Globe,
  HeartHandshake,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import SpotlightCard, { GOLD } from "@/app/(public)/_components/SpotlightCard";

/* ──────────────────────────────────────────────────────────────────────
 * Секция «Философия VOYAGE»: манифест, забота о резиденте (консьерж и
 * финансы), главное правило, четыре столпа (2×2) и финальная цитата.
 * В текстах **так** выделяется полужирным.
 * ──────────────────────────────────────────────────────────────────── */

const SERIF = "var(--font-cormorant), Georgia, serif";

type Item = { title: string; desc: string };

type ManifestoCopy = {
  eyebrow: string;
  title: [string, string, string];
  subtitle: string;
  intro: [string, string];
  careLead: string;
  care: [Item, Item];
  rule: string;
  pillarsEyebrow: string;
  pillars: [Item, Item, Item, Item];
  quote: string;
  quoteSign: string;
};

// --- Тексты секции на 4 языка ---
const copy: Record<Lang, ManifestoCopy> = {
  RU: {
    eyebrow: "Философия VOYAGE",
    title: ["Большие возможности.", "Чёткие правила.", "Твой выбор."],
    subtitle: "Закрытый клуб зарубежных поездок, высокоуровневых мероприятий и международного лайфстайла.",
    intro: [
      "Ты здесь за конкретными вещами: зарубежные туры, закрытые тусовки, сильное окружение и реальный заработок. Дубай, Европа, лучшие локации и интересные люди. Никаких пустых обещаний и сказок про «познание мира» — только честные условия, финансовая прозрачность и уважение к твоему времени.",
      "Мы все знаем, как устроена эта индустрия: за красивыми фотками часто прячутся размытые договорённости, непонятные посредники и сюрпризы уже по прилёту. В VOYAGE другой подход. Всё обсуждается «на берегу»: бюджет, задачи, формат, проживание и сроки выплат. Организаторы проходят проверку, а платформа страхует от дичи.",
    ],
    careLead: "Но главное — **мы не бросаем тебя одну после того, как ты купила билеты**:",
    care: [
      {
        title: "Консьерж-сервис 24/7",
        desc: "Любые задачи до поездки, во время неё и после решает наша команда. Билеты, брони, логистика или организационные вопросы — всё под контролем, тебе не нужно ни о чём переживать.",
      },
      {
        title: "Финансы и валюта без головной боли",
        desc: "Поможем с выводом заработанных средств, подскажем по безопасному обмену и решим вопросы с деньгами в любой точке маршрута. Ты получаешь честный заработок без комиссионных сюрпризов и рисков.",
      },
    ],
    rule: "Главное правило простое: **твоё «да» ничего не стоит, если оно выдано под давлением**. Ты сама решаешь, куда лететь, с кем работать и стоит ли оно того. Уважение к твоим границам и твоим деньгам — это база, без которой клуб не работает.",
    pillarsEyebrow: "Четыре столпа VOYAGE",
    pillars: [
      {
        title: "Деньги, честные условия и помощь с валютой",
        desc: "Ты чётко знаешь, на что соглашаешься, и получаешь всё вовремя. Гонорар, сроки, задачи, уровень проживания и все расходы обсуждаются до того, как ты приняла решение. Плюс полная поддержка по выводу средств и обмену валюты.",
      },
      {
        title: "Безопасность и консьерж-поддержка 24/7",
        desc: "Никаких поездок вслепую. Слепой отбор и двустороннее рукопожатие защищают твою приватность. А наша консьерж-служба сопровождает тебя на каждом этапе: от билетов до личного помощника на месте.",
      },
      {
        title: "Твои правила и твоё «нет»",
        desc: "Твой выбор всегда главный. Одобрение анкеты не обязывает тебя ни к чему. Ты имеешь полное право отказаться или выйти из проекта на любом этапе, если тебе что-то не нравится. Твой комфорт дороже любых контрактов.",
      },
      {
        title: "Закрытый круг и международный уровень",
        desc: "Зарубежные поездки и лайфстайл для тех, кто ценит качество. Дубай, Европа, частные ивенты и поездки с проверенными людьми. Клубный формат для девчонок, которые умеют ценить себя и своё время.",
      },
    ],
    quote: "Твоё время стоит денег. Твоё доверие требует фактов. Твоё согласие — только твоё личное решение. А все заботы мы берём на себя.",
    quoteSign: "Команда VOYAGE",
  },
  EN: {
    eyebrow: "The VOYAGE Philosophy",
    title: ["Big opportunities.", "Clear rules.", "Your choice."],
    subtitle: "A private club for travel abroad, high-level events and an international lifestyle.",
    intro: [
      "You are here for concrete things: tours abroad, private parties, a strong circle and real income. Dubai, Europe, the best locations and fascinating people. No empty promises and no fairy tales about “discovering the world” — only honest terms, financial transparency and respect for your time.",
      "We all know how this industry works: behind beautiful photos there are often vague arrangements, murky middlemen and surprises right after landing. VOYAGE takes a different approach. Everything is agreed before you go: budget, tasks, format, accommodation and payout dates. Organizers are vetted, and the platform protects you from nonsense.",
    ],
    careLead: "But most importantly, **we don’t leave you on your own once you’ve bought your tickets**:",
    care: [
      {
        title: "24/7 concierge service",
        desc: "Our team handles any task before, during and after the trip. Tickets, bookings, logistics or organizational questions — everything is under control, so you have nothing to worry about.",
      },
      {
        title: "Money and currency without the headache",
        desc: "We help you withdraw what you’ve earned, advise on safe currency exchange and sort out money matters anywhere along the route. You get honest earnings with no hidden fees and no risks.",
      },
    ],
    rule: "The main rule is simple: **your “yes” is worth nothing if it was given under pressure**. You decide where to fly, who to work with and whether it’s worth it. Respect for your boundaries and your money is the foundation the club cannot work without.",
    pillarsEyebrow: "The four pillars of VOYAGE",
    pillars: [
      {
        title: "Money, fair terms and currency support",
        desc: "You know exactly what you are agreeing to, and you get everything on time. Fee, dates, tasks, level of accommodation and all expenses are discussed before you make your decision. Plus full support with withdrawals and currency exchange.",
      },
      {
        title: "Safety and 24/7 concierge support",
        desc: "No blind trips. Blind selection and a two-way handshake protect your privacy. And our concierge service is with you at every stage: from tickets to a personal assistant on location.",
      },
      {
        title: "Your rules and your “no”",
        desc: "Your choice always comes first. An approved application doesn’t oblige you to anything. You have every right to decline or leave a project at any stage if something doesn’t feel right. Your comfort is worth more than any contract.",
      },
      {
        title: "A private circle and an international level",
        desc: "Travel abroad and a lifestyle for those who value quality. Dubai, Europe, private events and trips with vetted people. A club format for girls who know their own worth and the value of their time.",
      },
    ],
    quote: "Your time is worth money. Your trust requires facts. Your consent is your personal decision alone. And we take care of everything else.",
    quoteSign: "The VOYAGE Team",
  },
  ES: {
    eyebrow: "Filosofía VOYAGE",
    title: ["Grandes oportunidades.", "Reglas claras.", "Tu decisión."],
    subtitle: "Un club privado de viajes al extranjero, eventos de alto nivel y estilo de vida internacional.",
    intro: [
      "Estás aquí por cosas concretas: tours en el extranjero, fiestas privadas, un entorno sólido e ingresos reales. Dubái, Europa, las mejores locaciones y gente interesante. Nada de promesas vacías ni cuentos sobre «descubrir el mundo»: solo condiciones honestas, transparencia financiera y respeto por tu tiempo.",
      "Todos sabemos cómo funciona esta industria: detrás de fotos bonitas suelen esconderse acuerdos difusos, intermediarios dudosos y sorpresas nada más aterrizar. En VOYAGE lo hacemos distinto. Todo se acuerda de antemano: presupuesto, tareas, formato, alojamiento y plazos de pago. Los organizadores pasan una verificación y la plataforma te protege de cualquier locura.",
    ],
    careLead: "Pero lo más importante: **no te dejamos sola después de que compras los billetes**:",
    care: [
      {
        title: "Concierge 24/7",
        desc: "Nuestro equipo resuelve cualquier tarea antes, durante y después del viaje. Billetes, reservas, logística o cuestiones organizativas: todo está bajo control, no tienes que preocuparte por nada.",
      },
      {
        title: "Finanzas y divisas sin dolores de cabeza",
        desc: "Te ayudamos a retirar lo que has ganado, te orientamos sobre un cambio de divisas seguro y resolvemos cualquier tema de dinero en cualquier punto de la ruta. Recibes ingresos honestos, sin comisiones sorpresa ni riesgos.",
      },
    ],
    rule: "La regla principal es simple: **tu «sí» no vale nada si se da bajo presión**. Tú decides adónde volar, con quién trabajar y si vale la pena. El respeto por tus límites y por tu dinero es la base sin la cual el club no funciona.",
    pillarsEyebrow: "Los cuatro pilares de VOYAGE",
    pillars: [
      {
        title: "Dinero, condiciones justas y ayuda con divisas",
        desc: "Sabes exactamente a qué te comprometes y recibes todo a tiempo. Honorarios, plazos, tareas, nivel de alojamiento y todos los gastos se acuerdan antes de que tomes tu decisión. Además, apoyo total con retiros y cambio de divisas.",
      },
      {
        title: "Seguridad y concierge 24/7",
        desc: "Nada de viajes a ciegas. La selección a ciegas y el apretón de manos bilateral protegen tu privacidad. Y nuestro servicio de concierge te acompaña en cada etapa: desde los billetes hasta una asistente personal en destino.",
      },
      {
        title: "Tus reglas y tu «no»",
        desc: "Tu decisión siempre es lo primero. Que aprueben tu solicitud no te obliga a nada. Tienes todo el derecho a rechazar o salir de un proyecto en cualquier etapa si algo no te convence. Tu comodidad vale más que cualquier contrato.",
      },
      {
        title: "Círculo cerrado y nivel internacional",
        desc: "Viajes al extranjero y estilo de vida para quienes valoran la calidad. Dubái, Europa, eventos privados y viajes con personas verificadas. Un formato de club para chicas que saben valorarse a sí mismas y valorar su tiempo.",
      },
    ],
    quote: "Tu tiempo vale dinero. Tu confianza exige hechos. Tu consentimiento es solo tu decisión personal. Y de todo lo demás nos encargamos nosotros.",
    quoteSign: "El equipo VOYAGE",
  },
  PT: {
    eyebrow: "Filosofia VOYAGE",
    title: ["Grandes oportunidades.", "Regras claras.", "Sua escolha."],
    subtitle: "Um clube fechado de viagens internacionais, eventos de alto nível e estilo de vida internacional.",
    intro: [
      "Você está aqui por coisas concretas: tours no exterior, festas fechadas, um círculo forte e ganhos reais. Dubai, Europa, as melhores locações e pessoas interessantes. Nada de promessas vazias ou contos sobre “conhecer o mundo”: só condições honestas, transparência financeira e respeito pelo seu tempo.",
      "Todos sabemos como essa indústria funciona: por trás de fotos bonitas muitas vezes se escondem acordos vagos, intermediários duvidosos e surpresas logo na chegada. Na VOYAGE a abordagem é outra. Tudo é combinado antes: orçamento, tarefas, formato, hospedagem e prazos de pagamento. Os organizadores passam por verificação, e a plataforma protege você de qualquer roubada.",
    ],
    careLead: "Mas o principal: **não deixamos você sozinha depois que você compra as passagens**:",
    care: [
      {
        title: "Concierge 24/7",
        desc: "Nossa equipe resolve qualquer tarefa antes, durante e depois da viagem. Passagens, reservas, logística ou questões de organização: tudo sob controle, você não precisa se preocupar com nada.",
      },
      {
        title: "Finanças e câmbio sem dor de cabeça",
        desc: "Ajudamos você a sacar o que ganhou, orientamos sobre câmbio seguro e resolvemos questões de dinheiro em qualquer ponto do roteiro. Você recebe ganhos honestos, sem taxas surpresa e sem riscos.",
      },
    ],
    rule: "A regra principal é simples: **o seu “sim” não vale nada se foi dado sob pressão**. Você decide para onde voar, com quem trabalhar e se vale a pena. Respeito pelos seus limites e pelo seu dinheiro é a base sem a qual o clube não funciona.",
    pillarsEyebrow: "Os quatro pilares da VOYAGE",
    pillars: [
      {
        title: "Dinheiro, condições justas e ajuda com câmbio",
        desc: "Você sabe exatamente com o que está concordando e recebe tudo em dia. Cachê, prazos, tarefas, nível de hospedagem e todas as despesas são combinados antes de você tomar a decisão. Além de suporte completo com saques e câmbio.",
      },
      {
        title: "Segurança e concierge 24/7",
        desc: "Nada de viagens às cegas. A seleção às cegas e o aperto de mão bilateral protegem sua privacidade. E nosso serviço de concierge acompanha você em cada etapa: das passagens a uma assistente pessoal no local.",
      },
      {
        title: "Suas regras e o seu “não”",
        desc: "Sua escolha vem sempre em primeiro lugar. A aprovação do cadastro não obriga você a nada. Você tem todo o direito de recusar ou sair de um projeto em qualquer etapa, se algo não agradar. Seu conforto vale mais do que qualquer contrato.",
      },
      {
        title: "Círculo fechado e nível internacional",
        desc: "Viagens ao exterior e estilo de vida para quem valoriza qualidade. Dubai, Europa, eventos privados e viagens com pessoas verificadas. Um formato de clube para garotas que sabem se valorizar e valorizar o seu tempo.",
      },
    ],
    quote: "Seu tempo vale dinheiro. Sua confiança exige fatos. Seu consentimento é uma decisão só sua. E todo o resto fica por nossa conta.",
    quoteSign: "Equipe VOYAGE",
  },
};

const CARE_ICONS: [LucideIcon, LucideIcon] = [ConciergeBell, Wallet];
const PILLAR_ICONS: [LucideIcon, LucideIcon, LucideIcon, LucideIcon] = [Coins, ShieldCheck, HeartHandshake, Globe];

/** **жирный** → <strong> с золотистым оттенком */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-medium text-zinc-50">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

export default function ManifestoSection() {
  const { lang } = useLanguage();
  const t = copy[lang] ?? copy.EN;
  const reduce = useReducedMotion();

  // Плавное появление при скролле; при «уменьшить движение» — без сдвига
  const reveal = (delay = 0, y = 24) => ({
    initial: { opacity: 0, y: reduce ? 0 : y },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-70px" },
    transition: { duration: 0.7, delay, ease: "easeOut" as const },
  });

  return (
    <section id="manifesto" className="relative overflow-hidden px-6 py-28 md:py-36 scroll-mt-8">
      {/* Фон: глубокий графит с тёплым свечением и тонкой сеткой */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-24 h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-[#c9a961]/[0.06] blur-[140px]" />
        <div className="absolute -right-40 bottom-40 h-[360px] w-[360px] rounded-full bg-[#c9a961]/[0.04] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse at 50% 20%, #000 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 20%, #000 30%, transparent 75%)",
          }}
        />
        <div className="absolute left-1/2 top-0 h-px w-full max-w-4xl -translate-x-1/2 bg-gradient-to-r from-transparent via-[#c9a961]/30 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        {/* ── Заголовок ── */}
        <header className="mx-auto max-w-4xl text-center">
          <motion.p
            {...reveal(0, 16)}
            className="mb-8 text-xs font-medium uppercase tracking-[0.5em]"
            style={{ color: `${GOLD}b3` }}
          >
            {t.eyebrow}
          </motion.p>
          <h2
            className="text-[2.6rem] font-light leading-[1.05] tracking-tight text-zinc-50 sm:text-6xl lg:text-7xl"
            style={{ fontFamily: SERIF }}
          >
            {t.title.map((line, i) => (
              <motion.span key={i} {...reveal(0.1 + i * 0.14, 20)} className="block">
                {i === 2 ? (
                  <span className="voyage-gold-shimmer italic">{line}</span>
                ) : (
                  line
                )}
              </motion.span>
            ))}
          </h2>
          <motion.div {...reveal(0.5, 0)} className="mx-auto my-9 h-px w-16" style={{ background: `${GOLD}66` }} />
          <motion.p {...reveal(0.55, 14)} className="mx-auto max-w-2xl text-base font-light leading-relaxed text-zinc-400 md:text-lg">
            {t.subtitle}
          </motion.p>
        </header>

        {/* ── Манифест + забота ── */}
        <div className="mt-20 grid grid-cols-1 gap-12 lg:mt-28 lg:grid-cols-12 lg:gap-16">
          <div className="space-y-7 lg:col-span-7">
            {t.intro.map((p, i) => (
              <motion.p
                key={i}
                {...reveal(i * 0.1)}
                className={`text-[15px] font-light leading-8 text-zinc-300/90 md:text-[17px] ${
                  i === 0
                    ? "first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-[4.2rem] first-letter:leading-[0.8] first-letter:text-[#c9a961] first-letter:[font-family:var(--font-cormorant)]"
                    : ""
                }`}
              >
                {p}
              </motion.p>
            ))}

            {/* Главное правило — выделенная плашка с золотой линией слева */}
            <motion.div
              {...reveal(0.15)}
              className="relative mt-10 rounded-2xl border border-[#c9a961]/15 bg-[#c9a961]/[0.04] py-7 pl-7 pr-6 md:pl-9"
            >
              <span
                aria-hidden
                className="absolute left-0 top-6 bottom-6 w-px"
                style={{ background: `linear-gradient(to bottom, transparent, ${GOLD}, transparent)` }}
              />
              <p className="text-[15px] font-light leading-8 text-zinc-300 md:text-[17px]">
                <Rich text={t.rule} />
              </p>
            </motion.div>
          </div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <motion.p {...reveal(0.05)} className="mb-6 text-lg font-light leading-relaxed text-zinc-300 md:text-xl" style={{ fontFamily: SERIF }}>
                <Rich text={t.careLead} />
              </motion.p>
              <div className="space-y-4">
                {t.care.map((item, i) => {
                  const Icon = CARE_ICONS[i];
                  return (
                    <motion.div key={item.title} {...reveal(0.12 + i * 0.12)}>
                      <SpotlightCard className="p-6 md:p-7" glowSize={320}>
                        <div className="flex gap-5">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#c9a961]/25 text-[#c9a961]/80 transition-colors duration-500 group-hover/spot:border-[#c9a961]/60 group-hover/spot:text-[#c9a961]">
                            <Icon size={18} strokeWidth={1.5} />
                          </div>
                          <div>
                            <h3 className="mb-2 text-xl font-normal text-zinc-100" style={{ fontFamily: SERIF }}>
                              {item.title}
                            </h3>
                            <p className="text-sm font-light leading-relaxed text-zinc-400">{item.desc}</p>
                          </div>
                        </div>
                      </SpotlightCard>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Четыре столпа ── */}
        <div className="mt-24 md:mt-32">
          <motion.div {...reveal(0, 16)} className="mb-10 flex items-center gap-5">
            <p className="whitespace-nowrap text-xs font-medium uppercase tracking-[0.45em]" style={{ color: `${GOLD}b3` }}>
              {t.pillarsEyebrow}
            </p>
            <div className="h-px flex-1 bg-gradient-to-r from-[#c9a961]/30 to-transparent" />
          </motion.div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
            {t.pillars.map((p, i) => {
              const Icon = PILLAR_ICONS[i];
              return (
                <motion.div key={p.title} {...reveal((i % 2) * 0.12 + Math.floor(i / 2) * 0.08, 30)}>
                  <SpotlightCard className="h-full p-8 md:p-10">
                    <div className="mb-8 flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#c9a961]/25 text-[#c9a961]/80 transition-all duration-500 group-hover/spot:border-[#c9a961]/60 group-hover/spot:text-[#c9a961] group-hover/spot:shadow-[0_0_24px_rgba(201,169,97,0.25)]">
                        <Icon size={19} strokeWidth={1.4} />
                      </div>
                      <span
                        className="text-5xl font-light leading-none text-white/[0.06] transition-colors duration-500 group-hover/spot:text-[#c9a961]/30"
                        style={{ fontFamily: SERIF }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mb-4 text-2xl font-light leading-snug text-zinc-50 md:text-[1.7rem]" style={{ fontFamily: SERIF }}>
                      {p.title}
                    </h3>
                    <p className="text-sm font-light leading-7 text-zinc-400 md:text-[15px]">{p.desc}</p>
                  </SpotlightCard>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Финальная цитата ── */}
        <motion.figure {...reveal(0, 28)} className="relative mx-auto mt-28 max-w-4xl text-center md:mt-36">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 select-none text-[9rem] leading-none text-[#c9a961]/15"
            style={{ fontFamily: SERIF }}
          >
            “
          </span>
          <blockquote
            className="relative text-2xl font-light italic leading-snug text-zinc-100 md:text-4xl md:leading-snug"
            style={{ fontFamily: SERIF }}
          >
            {t.quote}
          </blockquote>
          <figcaption className="mt-8 flex items-center justify-center gap-4 text-[11px] font-medium uppercase tracking-[0.4em]" style={{ color: `${GOLD}99` }}>
            <span className="h-px w-10 bg-[#c9a961]/40" />
            {t.quoteSign}
            <span className="h-px w-10 bg-[#c9a961]/40" />
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}
