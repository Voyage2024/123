"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  Clock,
  ConciergeBell,
  Download,
  FileText,
  Luggage,
  ScrollText,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import {
  GUIDE_CARD_COLUMNS,
  GUIDE_FALLBACK_LANGUAGE,
  guideDownloadUrl,
  isGuideNew,
  langToGuideLanguage,
  pickGuideIcon,
  type GuideCard,
  type GuideIconKey,
  type GuideLanguage,
} from "@/lib/guides";

/* ──────────────────────────────────────────────────────────────────────
 * Секция «Гайды и шпаргалки» на главной.
 * Данные — из таблицы public.guides (только is_published), управление —
 * в админке /admin/guides. Вёрстка карточки прежняя.
 * ──────────────────────────────────────────────────────────────────── */

// next/font переименовывает шрифт, поэтому берём его через CSS-переменную
const SERIF = "var(--font-cormorant), Georgia, serif";

// Фирменное золото клуба (то же, что в кабинете резидента)
const GOLD = "#c9a961";

// --- Тексты секции на 4 языка (по образцу словаря главной страницы) ---
const copy: Record<Lang, {
  eyebrow: string;
  title: string;
  subtitle: string;
  badgeNew: string;
  guideLabel: string;
  read: string;
  download: string;
  soonTitle: string;
  soonDesc: string;
}> = {
  EN: {
    eyebrow: "Club Library",
    title: "Guides & Cheat Sheets",
    subtitle: "Practical notes from the team, written for residents before every tour. Short, honest and to the point.",
    badgeNew: "New",
    guideLabel: "Guide",
    read: "Read the guide",
    download: "Download PDF",
    soonTitle: "More guides are on the way",
    soonDesc: "Etiquette, safety on arrival, working with the concierge. New materials appear here first.",
  },
  RU: {
    eyebrow: "Библиотека клуба",
    title: "Гайды и шпаргалки",
    subtitle: "Практичные заметки от команды, которые стоит прочитать перед каждым туром. Коротко, честно и по делу.",
    badgeNew: "Новое",
    guideLabel: "Гайд",
    read: "Читать гайд",
    download: "Скачать PDF",
    soonTitle: "Скоро новые гайды",
    soonDesc: "Этикет, безопасность по прилёте, работа с консьержем. Новые материалы появятся здесь первыми.",
  },
  ES: {
    eyebrow: "Biblioteca del club",
    title: "Guías y apuntes",
    subtitle: "Notas prácticas del equipo para leer antes de cada tour. Breves, honestas y al grano.",
    badgeNew: "Nuevo",
    guideLabel: "Guía",
    read: "Leer la guía",
    download: "Descargar PDF",
    soonTitle: "Pronto habrá más guías",
    soonDesc: "Etiqueta, seguridad a la llegada, trabajo con el concierge. Los nuevos materiales aparecerán aquí primero.",
  },
  PT: {
    eyebrow: "Biblioteca do clube",
    title: "Guias e resumos",
    subtitle: "Notas práticas da equipe para ler antes de cada tour. Curtas, honestas e diretas.",
    badgeNew: "Novo",
    guideLabel: "Guia",
    read: "Ler o guia",
    download: "Baixar PDF",
    soonTitle: "Mais guias em breve",
    soonDesc: "Etiqueta, segurança na chegada, trabalho com o concierge. Os novos materiais aparecem aqui primeiro.",
  },
};

// --- Иконка обложки подбирается по тегам/заголовку гайда (lib/guides.ts) ---
const ICONS: Record<GuideIconKey, LucideIcon> = {
  luggage: Luggage,
  passport: ScrollText,
  beauty: Sparkles,
  shield: ShieldCheck,
  concierge: ConciergeBell,
  book: BookOpen,
};

/**
 * Опубликованные гайды на языке интерфейса. Одним запросом берём язык
 * интерфейса и русский: если на выбранном языке гайдов нет — показываем RU.
 */
function useGuides(lang: Lang) {
  const language = langToGuideLanguage(lang);
  const [state, setState] = useState<{ language: GuideLanguage | null; guides: GuideCard[] }>({
    language: null,
    guides: [],
  });

  useEffect(() => {
    let cancelled = false;
    const languages = Array.from(new Set([language, GUIDE_FALLBACK_LANGUAGE]));

    void (async () => {
      const { data, error } = await supabase
        .from("guides")
        .select(GUIDE_CARD_COLUMNS)
        .eq("is_published", true)
        .in("language", languages)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) console.warn("[GuidesSection] guides load failed:", error.message);

      const rows = (data ?? []) as GuideCard[];
      const own = rows.filter((g) => g.language === language);
      setState({
        language,
        guides: own.length ? own : rows.filter((g) => g.language === GUIDE_FALLBACK_LANGUAGE),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [language]);

  return { guides: state.guides, loading: state.language !== language };
}

export default function GuidesSection() {
  const { lang } = useLanguage();
  // неизвестный язык (или в нижнем регистре) → английский, как на главной
  const upper = String(lang).toUpperCase() as Lang;
  const key: Lang = upper in copy ? upper : "EN";
  const t = copy[key];
  const { guides, loading } = useGuides(key);
  const now = Date.now();

  return (
    <section id="guides" className="relative px-6 py-28 border-t border-white/5 overflow-hidden scroll-mt-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 right-0 translate-x-1/3 -translate-y-1/2 w-[560px] h-[420px] rounded-full bg-amber-400/[0.04] blur-[130px]" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* Заголовок секции — в той же сетке, что и «Актуальные направления» */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-14 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
        >
          <div>
            <p className="text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium mb-3">
              {t.eyebrow}
            </p>
            <h2
              className="text-4xl md:text-5xl font-light text-zinc-100 leading-tight"
              style={{ fontFamily: SERIF }}
            >
              {t.title}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-zinc-500 font-light md:text-right">
            {t.subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Пока гайды грузятся — пустая карточка той же формы, чтобы сетка не прыгала */}
          {loading && (
            <div
              aria-hidden
              className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-zinc-900/40 backdrop-blur-xl lg:col-span-2 min-h-[22rem] animate-pulse"
            >
              <div className="pointer-events-none absolute inset-3 rounded-[1.25rem] border border-[#c9a961]/[0.07]" />
            </div>
          )}

          {!loading && guides.map((g, i) => {
            const Icon = ICONS[pickGuideIcon(g)];
            return (
              <motion.article
                key={g.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.65, delay: i * 0.12, ease: "easeOut" }}
                className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-zinc-900/40 backdrop-blur-xl lg:col-span-2 hover:border-[#c9a961]/30 transition-colors duration-500 shadow-[0_24px_100px_-56px_rgba(201,169,97,0.35)]"
              >
                {/* тонкая внутренняя рамка, как у блока заявки */}
                <div className="pointer-events-none absolute inset-3 rounded-[1.25rem] border border-[#c9a961]/[0.07]" />
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#c9a961]/10 blur-3xl opacity-40 group-hover:opacity-80 transition-opacity duration-700" />

                <div className="relative grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-8 p-7 sm:p-10">
                  {/* Обложка: иконка + номер гайда */}
                  <div className="flex sm:flex-col items-center sm:items-start gap-5">
                    <div
                      className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-2xl border bg-gradient-to-br from-[#c9a961]/[0.12] to-transparent transition-transform duration-500 group-hover:-translate-y-1"
                      style={{ borderColor: `${GOLD}40`, color: GOLD }}
                    >
                      <Icon size={36} strokeWidth={1.25} />
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.45em] uppercase text-zinc-500 font-medium">
                        {t.guideLabel}
                      </p>
                      <p
                        className="text-4xl font-light leading-none mt-1"
                        style={{ fontFamily: SERIF, color: GOLD }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </p>
                    </div>
                  </div>

                  {/* Текст карточки */}
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-3 mb-5 text-[11px] tracking-wider uppercase">
                      {isGuideNew(g.created_at, now) && (
                        <span className="rounded-full bg-[#c9a961] px-3 py-1 font-semibold text-zinc-950">
                          {t.badgeNew}
                        </span>
                      )}
                      {g.reading_time && (
                        <span className="inline-flex items-center gap-1.5 text-zinc-400">
                          <Clock size={13} strokeWidth={1.75} style={{ color: GOLD }} />
                          {g.reading_time}
                        </span>
                      )}
                      {g.pdf_url && (
                        <span className="inline-flex items-center gap-1.5 text-zinc-500">
                          <FileText size={13} strokeWidth={1.75} />
                          PDF
                        </span>
                      )}
                    </div>

                    <h3
                      className="text-2xl md:text-3xl font-light leading-snug text-zinc-50 mb-4"
                      style={{ fontFamily: SERIF }}
                    >
                      {g.title}
                    </h3>
                    <p className="text-sm leading-7 text-zinc-400 font-light mb-6">
                      {g.description}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-8">
                      {g.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto flex flex-col sm:flex-row gap-3">
                      <Link
                        href={`/guides/${g.slug}`}
                        className="group/btn inline-flex items-center justify-center gap-2.5 rounded-full bg-amber-200 px-7 py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-950 shadow-[0_0_24px_rgba(251,191,36,0.1)] transition duration-300 hover:bg-amber-100 hover:shadow-[0_0_34px_rgba(251,191,36,0.18)]"
                      >
                        <BookOpen size={15} strokeWidth={1.75} />
                        {t.read}
                        <ArrowUpRight size={15} className="transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                      </Link>
                      {g.pdf_url && (
                        <a
                          href={guideDownloadUrl(g.pdf_url)}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2.5 rounded-full border border-amber-200/30 bg-amber-200/[0.06] px-7 py-3.5 text-[11px] font-medium uppercase tracking-[0.2em] text-amber-100 transition-all duration-300 hover:border-amber-200/60 hover:bg-amber-200/[0.1]"
                        >
                          <Download size={15} strokeWidth={1.75} />
                          {t.download}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })}

          {/* Заглушка «скоро» — держит сетку и показывает, что библиотека будет расти */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, delay: (loading ? 1 : guides.length) * 0.12, ease: "easeOut" }}
            className="relative flex flex-col justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/20 backdrop-blur-sm p-8 text-center"
          >
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/20 text-amber-200/60">
              <BookOpen size={18} strokeWidth={1.5} />
            </div>
            <h3
              className="text-2xl font-light text-zinc-200 mb-3"
              style={{ fontFamily: SERIF }}
            >
              {t.soonTitle}
            </h3>
            <p className="text-sm leading-relaxed text-zinc-500 font-light">
              {t.soonDesc}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
