"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import SpotlightCard, { GOLD } from "@/app/(public)/_components/SpotlightCard";

/* ──────────────────────────────────────────────────────────────────────
 * Секция «Команда и поддержка» на главной (идёт сразу после манифеста).
 * Фото: положите файлы в public/team/ под именами из TEAM[].photo —
 * пока файла нет, вместо фото показываются золотые инициалы.
 * ──────────────────────────────────────────────────────────────────── */

const SERIF = "var(--font-cormorant), Georgia, serif";

type Member = {
  id: string;
  /** Путь от корня public/, например /team/mark-vetrov.jpg (квадрат от 600×600) */
  photo: string;
  vk: string;
  name: Record<Lang, string>;
  role: Record<Lang, string>;
};

const TEAM: Member[] = [
  {
    id: "mark-vetrov",
    photo: "/team/mark-vetrov.jpg",
    vk: "https://vk.ru/mark_status",
    name: { RU: "Марк Ветров", EN: "Mark Vetrov", ES: "Mark Vetrov", PT: "Mark Vetrov" },
    role: {
      RU: "Фаундер и директор",
      EN: "Founder & Director",
      ES: "Fundador y director",
      PT: "Fundador e diretor",
    },
  },
  {
    id: "regina-merkulova",
    photo: "/team/regina-merkulova.jpg",
    vk: "https://vk.ru/id529831765",
    name: { RU: "Регина Меркулова", EN: "Regina Merkulova", ES: "Regina Merkulova", PT: "Regina Merkulova" },
    role: {
      RU: "Руководитель команды консьержей",
      EN: "Head of the Concierge Team",
      ES: "Directora del equipo de concierge",
      PT: "Líder da equipe de concierge",
    },
  },
  {
    id: "mira-kuznetsova",
    photo: "/team/mira-kuznetsova.jpg",
    vk: "https://vk.ru/id587865565",
    name: { RU: "Мира Кузнецова", EN: "Mira Kuznetsova", ES: "Mira Kuznetsova", PT: "Mira Kuznetsova" },
    role: {
      RU: "Международный отдел скаутинга",
      EN: "International Scouting Department",
      ES: "Departamento internacional de scouting",
      PT: "Departamento internacional de scouting",
    },
  },
];

const copy: Record<Lang, { eyebrow: string; title: string; subtitle: string; vk: string }> = {
  RU: {
    eyebrow: "Люди VOYAGE",
    title: "Команда и поддержка",
    subtitle: "Люди, которые обеспечивают твою безопасность, комфорт и организацию на каждом этапе.",
    vk: "ВКонтакте",
  },
  EN: {
    eyebrow: "The people of VOYAGE",
    title: "Team & Support",
    subtitle: "The people who take care of your safety, comfort and organization at every stage.",
    vk: "VK profile",
  },
  ES: {
    eyebrow: "Las personas de VOYAGE",
    title: "Equipo y soporte",
    subtitle: "Las personas que cuidan de tu seguridad, tu comodidad y la organización en cada etapa.",
    vk: "Perfil en VK",
  },
  PT: {
    eyebrow: "As pessoas da VOYAGE",
    title: "Equipe e suporte",
    subtitle: "As pessoas que cuidam da sua segurança, do seu conforto e da organização em cada etapa.",
    vk: "Perfil no VK",
  },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Круглая аватарка с тонкой золотой рамкой; без фото — инициалы */
function Avatar({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Ошибка загрузки могла случиться до гидрации, и onError тогда не сработает
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <div className="relative mx-auto h-32 w-32 md:h-36 md:w-36">
      {/* Мягкий ореол, разгорается при наведении на карточку */}
      <div
        aria-hidden
        className="absolute -inset-4 rounded-full opacity-0 blur-2xl transition-opacity duration-700 group-hover/spot:opacity-100"
        style={{ background: `radial-gradient(circle, ${GOLD}40, transparent 70%)` }}
      />
      {/* Золотое кольцо: при наведении по нему медленно бежит перелив */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full p-px transition-transform duration-[1600ms] ease-out group-hover/spot:rotate-180 motion-reduce:transition-none"
        style={{
          background: `conic-gradient(from 200deg, ${GOLD}22, ${GOLD}cc, ${GOLD}22 40%, ${GOLD}88 70%, ${GOLD}22)`,
        }}
      >
        <div className="h-full w-full rounded-full bg-zinc-950" />
      </div>
      <div className="absolute inset-[5px] overflow-hidden rounded-full border border-[#c9a961]/20 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950">
        {!failed ? (
          // Обычный <img>: фото лежат в public/, а onError показывает заглушку, пока файла нет
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt={name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover grayscale-[35%] transition duration-700 group-hover/spot:scale-105 group-hover/spot:grayscale-0"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-4xl font-light tracking-wider text-[#c9a961]/80" style={{ fontFamily: SERIF }}>
              {initials(name)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamSection() {
  const { lang } = useLanguage();
  const t = copy[lang] ?? copy.EN;
  const reduce = useReducedMotion();

  return (
    <section id="team" className="relative overflow-hidden px-6 pb-28 pt-8 md:pb-36 scroll-mt-8">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c9a961]/[0.04] blur-[130px]" />

      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-70px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.5em]" style={{ color: `${GOLD}b3` }}>
            {t.eyebrow}
          </p>
          <h2 className="text-4xl font-light leading-tight text-zinc-50 md:text-5xl" style={{ fontFamily: SERIF }}>
            {t.title}
          </h2>
          <div className="mx-auto my-7 h-px w-16" style={{ background: `${GOLD}66` }} />
          <p className="text-base font-light leading-relaxed text-zinc-400">{t.subtitle}</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((m, i) => {
            const name = m.name[lang] ?? m.name.EN;
            const role = m.role[lang] ?? m.role.EN;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: reduce ? 0 : 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.65, delay: i * 0.13, ease: "easeOut" }}
                className={i === 2 ? "sm:col-span-2 sm:mx-auto sm:w-[calc(50%-0.75rem)] lg:col-span-1 lg:mx-0 lg:w-full" : ""}
              >
                <SpotlightCard className="h-full px-7 pb-8 pt-10 text-center" glowSize={360}>
                  <Avatar src={m.photo} name={name} />
                  <h3 className="mt-7 text-[1.65rem] font-light leading-tight text-zinc-50" style={{ fontFamily: SERIF }}>
                    {name}
                  </h3>
                  <p className="mx-auto mt-2 min-h-10 max-w-[16rem] text-[11px] font-medium uppercase leading-5 tracking-[0.28em]" style={{ color: `${GOLD}cc` }}>
                    {role}
                  </p>
                  <div className="mx-auto my-6 h-px w-10 bg-white/10 transition-all duration-500 group-hover/spot:w-16 group-hover/spot:bg-[#c9a961]/40" />
                  <a
                    href={m.vk}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${name} — ${t.vk}`}
                    className="group/link inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-300 transition-all duration-300 hover:border-[#c9a961]/50 hover:bg-[#c9a961]/[0.08] hover:text-[#e6d3a3] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a961]/60"
                  >
                    {t.vk}
                    <ArrowUpRight size={14} strokeWidth={1.8} className="transition-transform duration-300 group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
                  </a>
                </SpotlightCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
