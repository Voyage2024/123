import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarDays, Clock, Download, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { renderGuideContent } from "@/lib/server/guide-content";
import GuideContent from "@/app/components/guides/GuideContent";
import {
  GUIDE_COLUMNS,
  guideDownloadUrl,
  resolveGuideSeo,
  type GuideLanguage,
  type GuideRow,
} from "@/lib/guides";

/* ──────────────────────────────────────────────────────────────────────
 * Страница гайда — app/(public)/guides/[slug]/page.tsx
 *
 * Серверный компонент: гайд читается из public.guides под сессией
 * посетителя. Гость видит только опубликованные (RLS), администратор
 * видит и черновики — так можно проверить гайд до публикации.
 * Подписи на странице — на языке самого гайда.
 *
 * SEO: <title>, description и keywords — из seo_title / seo_description /
 * seo_keywords (пустые → title и description карточки), плюс canonical,
 * Open Graph / Twitter (картинка — первая из статьи) и JSON-LD Article.
 * Текст — Markdown + HTML, очищается на сервере (lib/server/guide-content).
 * ──────────────────────────────────────────────────────────────────── */

const SERIF = "var(--font-cormorant), Georgia, serif";
const GOLD = "#c9a961";

const copy: Record<GuideLanguage, {
  locale: string;
  back: string;
  eyebrow: string;
  guide: string;
  draft: string;
  download: string;
  pdfTitle: string;
  pdfDesc: string;
  pdfOnly: string;
  more: string;
}> = {
  ru: {
    locale: "ru-RU",
    back: "Все гайды",
    eyebrow: "Библиотека клуба",
    guide: "Гайд",
    draft: "Черновик · виден только администраторам",
    download: "Скачать PDF",
    pdfTitle: "Возьмите гайд с собой",
    pdfDesc: "PDF-версия открывается без интернета: удобно в самолёте и в дороге.",
    pdfOnly: "Полная версия этого гайда доступна в PDF.",
    more: "Другие гайды",
  },
  en: {
    locale: "en-US",
    back: "All guides",
    eyebrow: "Club Library",
    guide: "Guide",
    draft: "Draft · visible to administrators only",
    download: "Download PDF",
    pdfTitle: "Take the guide with you",
    pdfDesc: "The PDF version works offline, handy on the plane and on the road.",
    pdfOnly: "The full version of this guide is available as a PDF.",
    more: "More guides",
  },
  es: {
    locale: "es-ES",
    back: "Todas las guías",
    eyebrow: "Biblioteca del club",
    guide: "Guía",
    draft: "Borrador · solo lo ven los administradores",
    download: "Descargar PDF",
    pdfTitle: "Llévate la guía",
    pdfDesc: "La versión PDF funciona sin conexión: cómoda en el avión y en el camino.",
    pdfOnly: "La versión completa de esta guía está disponible en PDF.",
    more: "Más guías",
  },
  pt: {
    locale: "pt-BR",
    back: "Todos os guias",
    eyebrow: "Biblioteca do clube",
    guide: "Guia",
    draft: "Rascunho · visível apenas para administradores",
    download: "Baixar PDF",
    pdfTitle: "Leve o guia com você",
    pdfDesc: "A versão em PDF funciona offline, prática no avião e na estrada.",
    pdfOnly: "A versão completa deste guia está disponível em PDF.",
    more: "Mais guias",
  },
};

type PageProps = { params: Promise<{ slug: string }> };

// cache: generateMetadata и страница делят один запрос к базе
const loadGuide = cache(async (slug: string): Promise<GuideRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guides")
    .select(GUIDE_COLUMNS)
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (error) {
    console.error("[guides/[slug]] load failed:", error.message);
    return null;
  }
  return (data as GuideRow | null) ?? null;
});

const OG_LOCALE: Record<GuideLanguage, string> = { ru: "ru_RU", en: "en_US", es: "es_ES", pt: "pt_BR" };

function siteUrl(): URL | undefined {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  try {
    return raw ? new URL(raw) : undefined;
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await loadGuide(slug);
  if (!guide) return { title: "Voyage — Private Club", robots: { index: false, follow: false } };

  const seo = resolveGuideSeo(guide);
  const image = renderGuideContent(guide.content).firstImage;
  const path = `/guides/${guide.slug}`;

  return {
    metadataBase: siteUrl(),
    // seo_title пишется целиком, без дописывания «· Voyage»: так задумал редактор
    title: seo.title,
    description: seo.description || undefined,
    keywords: seo.keywords.length ? seo.keywords : undefined,
    alternates: { canonical: path },
    robots: guide.is_published ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: "article",
      url: path,
      title: seo.title,
      description: seo.description || undefined,
      siteName: "VOYAGE",
      locale: OG_LOCALE[guide.language],
      publishedTime: guide.created_at,
      modifiedTime: guide.updated_at,
      tags: guide.tags,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: seo.title,
      description: seo.description || undefined,
      images: image ? [image] : undefined,
    },
  };
}

function DownloadButton({ href, label }: { href: string; label: string }) {
  // Та же кнопка «Скачать PDF», что и на карточке гайда на главной
  return (
    <a
      href={guideDownloadUrl(href)}
      download
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2.5 rounded-full border border-amber-200/30 bg-amber-200/[0.06] px-7 py-3.5 text-[11px] font-medium uppercase tracking-[0.2em] text-amber-100 transition-all duration-300 hover:border-amber-200/60 hover:bg-amber-200/[0.1]"
    >
      <Download size={15} strokeWidth={1.75} />
      {label}
    </a>
  );
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = await loadGuide(slug);
  if (!guide) notFound();

  const t = copy[guide.language] ?? copy.ru;
  const published = new Date(guide.created_at).toLocaleDateString(t.locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const rendered = renderGuideContent(guide.content);
  const hasContent = rendered.hasContent;
  const seo = resolveGuideSeo(guide);
  const base = siteUrl();

  // Разметка для поисковиков: статья, язык, даты, ключевые слова
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: seo.title,
    description: seo.description || undefined,
    inLanguage: guide.language,
    datePublished: guide.created_at,
    dateModified: guide.updated_at,
    keywords: seo.keywords.length ? seo.keywords.join(", ") : undefined,
    image: rendered.firstImage ?? undefined,
    mainEntityOfPage: base ? new URL(`/guides/${guide.slug}`, base).toString() : undefined,
    publisher: { "@type": "Organization", name: "VOYAGE" },
  };

  return (
    <article className="relative overflow-hidden px-6 pb-28 pt-10">
      {guide.is_published && (
        <script
          type="application/ld+json"
          // < экранируем, чтобы текст гайда не мог закрыть тег script
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-[#c9a961]/[0.06] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        <Link
          href="/#guides"
          className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-zinc-500 transition-colors hover:text-amber-100"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          {t.back}
        </Link>

        {!guide.is_published && (
          <p className="mt-8 inline-flex rounded-full border border-amber-200/25 bg-amber-200/[0.06] px-4 py-1.5 text-[10px] uppercase tracking-[0.25em] text-amber-100/80">
            {t.draft}
          </p>
        )}

        {/* Шапка гайда */}
        <header className="mt-10">
          <p className="mb-5 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.5em] text-amber-200/60">
            <BookOpen size={14} strokeWidth={1.5} style={{ color: GOLD }} />
            {t.eyebrow} · {t.guide}
          </p>
          <h1
            className="text-4xl font-light leading-[1.12] text-zinc-50 md:text-6xl"
            style={{ fontFamily: SERIF }}
          >
            {guide.title}
          </h1>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] uppercase tracking-wider">
            {guide.reading_time && (
              <span className="inline-flex items-center gap-1.5 text-zinc-400">
                <Clock size={13} strokeWidth={1.75} style={{ color: GOLD }} />
                {guide.reading_time}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-zinc-500">
              <CalendarDays size={13} strokeWidth={1.75} />
              {published}
            </span>
            {guide.pdf_url && (
              <span className="inline-flex items-center gap-1.5 text-zinc-500">
                <FileText size={13} strokeWidth={1.75} />
                PDF
              </span>
            )}
          </div>

          {guide.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {guide.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] uppercase tracking-wider text-zinc-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {guide.description && (
            <p
              className="mt-10 border-l-2 pl-6 text-xl font-light leading-relaxed text-zinc-300 md:text-2xl"
              style={{ fontFamily: SERIF, borderColor: `${GOLD}80` }}
            >
              {guide.description}
            </p>
          )}

          {guide.pdf_url && (
            <div className="mt-10">
              <DownloadButton href={guide.pdf_url} label={t.download} />
            </div>
          )}
        </header>

        <div className="my-14 flex items-center gap-4" aria-hidden>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#c9a961]/30 to-transparent" />
          <span className="h-1.5 w-1.5 rotate-45" style={{ background: GOLD }} />
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#c9a961]/30 to-transparent" />
        </div>

        {/* Текст гайда */}
        {hasContent ? (
          <GuideContent segments={rendered.segments} language={guide.language} slug={guide.slug} guideTitle={guide.title} />
        ) : (
          guide.pdf_url && <p className="text-center text-sm font-light text-zinc-500">{t.pdfOnly}</p>
        )}

        {/* Финальный блок с PDF — в стиле карточки гайда */}
        {guide.pdf_url && (
          <section className="relative mt-20 overflow-hidden rounded-3xl border border-white/[0.06] bg-zinc-900/40 p-8 backdrop-blur-xl shadow-[0_24px_100px_-56px_rgba(201,169,97,0.35)] sm:p-10">
            <div className="pointer-events-none absolute inset-3 rounded-[1.25rem] border border-[#c9a961]/[0.07]" />
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#c9a961]/10 blur-3xl opacity-60" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-gradient-to-br from-[#c9a961]/[0.12] to-transparent"
                  style={{ borderColor: `${GOLD}40`, color: GOLD }}
                >
                  <FileText size={28} strokeWidth={1.25} />
                </div>
                <div>
                  <h2 className="text-2xl font-light text-zinc-50" style={{ fontFamily: SERIF }}>
                    {t.pdfTitle}
                  </h2>
                  <p className="mt-1 text-sm font-light leading-relaxed text-zinc-500">{t.pdfDesc}</p>
                </div>
              </div>
              <DownloadButton href={guide.pdf_url} label={t.download} />
            </div>
          </section>
        )}

        <div className="mt-16 text-center">
          <Link
            href="/#guides"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-zinc-500 transition-colors hover:text-amber-100"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            {t.more}
          </Link>
        </div>
      </div>
    </article>
  );
}
