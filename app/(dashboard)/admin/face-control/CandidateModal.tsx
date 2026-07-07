"use client";
import AccessCredentials from "./AccessCredentials";
import { useCallback, useEffect, useState } from "react";
import {
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Flag,
  ImageOff,
  Loader2,
  Ruler,
  Weight,
  Sparkles,
  Cigarette,
  Wine,
} from "lucide-react";
import { Cormorant_Garamond } from "next/font/google";
import type { Application } from "./FaceControlList";
import { resolvePhotoUrls } from "./photoUrl";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
});

type Props = {
  application: Application;
  onClose: () => void;
  // Асинхронные: резолвятся при успехе, кидают ошибку при неудаче.
  onApprove: (app: Application) => Promise<unknown>;
  onDecline: (app: Application) => Promise<unknown>;
};

/* ── helpers ─────────────────────────────────────────────────────────── */

function computeAge(birth: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  const age = Math.floor((Date.now() - d.getTime()) / 31557600000); // 365.25д
  return age >= 0 && age < 120 ? age : null;
}

function withUnit(v: unknown, unit: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (!s) return null;
  return /^\d+([.,]\d+)?$/.test(s) ? `${s} ${unit}` : s;
}

function humanFlag(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v ? "Да" : "Нет";
  return String(v);
}

/* ── подкомпоненты ───────────────────────────────────────────────────── */

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ruler;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-zinc-500" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-zinc-200">{value}</p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-zinc-800/70 pt-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300/70">
        {title}
      </h3>
      {children}
    </section>
  );
}

/* ── модалка ─────────────────────────────────────────────────────────── */

export default function CandidateModal({
  application,
  onClose,
  onApprove,
  onDecline,
}: Props) {
  // Готовые подписанные ссылки (асинхронно) + состояние загрузки галереи.
  const [urls, setUrls] = useState<string[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [idx, setIdx] = useState(0);

  // Состояние отправки решения (Approve/Decline идут на сервер).
  const [submitting, setSubmitting] = useState<"approve" | "decline" | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const runAction = useCallback(
    async (action: "approve" | "decline") => {
      if (submitting) return;
      setActionError(null);
      setSubmitting(action);
      try {
        if (action === "approve") await onApprove(application);
        else await onDecline(application);
        onClose(); // успех — карточка уже убрана на уровне списка
      } catch (e) {
        setActionError(
          e instanceof Error ? e.message : "Не удалось выполнить действие.",
        );
        setSubmitting(null);
      }
    },
    [submitting, application, onApprove, onDecline, onClose],
  );

  // Подписываем все фото кандидата при открытии/смене анкеты.
  useEffect(() => {
    let cancelled = false;
    setGalleryLoading(true);
    setIdx(0);

    resolvePhotoUrls(application.photos)
      .then((res) => {
        if (cancelled) return;
        setUrls(res.filter(Boolean)); // оставляем только удачно подписанные
      })
      .finally(() => {
        if (!cancelled) setGalleryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [application]);

  const count = urls.length;
  const prev = useCallback(
    () => setIdx((i) => (i - 1 + count) % count),
    [count],
  );
  const next = useCallback(() => setIdx((i) => (i + 1) % count), [count]);

  // Esc для закрытия, стрелки для листания + блокировка скролла фона.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && count > 1) prev();
      if (e.key === "ArrowRight" && count > 1) next();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next, count]);

  const age = computeAge(application.birth_date);
  const height = withUnit(application.height, "см");
  const weight = withUnit(application.weight, "кг");
  const measurements = application.measurements?.trim() || null;
  const smoking = humanFlag(application.smoking);
  const alcohol = humanFlag(application.alcohol);
  const about = application.about?.trim() || null;

  const hasPhysical = height || weight || measurements;
  const hasLifestyle = smoking || alcohol;

  const meta = [
    age !== null ? `${age} лет` : null,
    application.citizenship,
    application.location,
  ].filter(Boolean) as string[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Анкета: ${application.full_name ?? "кандидат"}`}
    >
      {/* Затемнение фона */}
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
      />

      {/* Панель */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-900/80 shadow-2xl shadow-black/60 ring-1 ring-amber-500/10 backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_60px_-30px_rgba(251,191,36,0.35)]" />

        {/* Кнопка закрытия */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-900/70 text-zinc-400 backdrop-blur transition-colors hover:border-zinc-600 hover:text-zinc-100"
        >
          <X size={16} strokeWidth={1.75} />
        </button>

        {/* Тело: галерея + анкета */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row">
            {/* Галерея */}
            <div className="md:sticky md:top-0 md:w-[45%] md:self-start">
              <div className="relative aspect-[3/4] w-full bg-zinc-950/60">
                {galleryLoading ? (
                  <div className="flex h-full w-full items-center justify-center text-zinc-600">
                    <Loader2 size={26} strokeWidth={1.5} className="animate-spin" />
                  </div>
                ) : count > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={urls[idx]}
                    src={urls[idx]}
                    alt={`${application.full_name ?? "кандидат"} — фото ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-600">
                    <ImageOff size={30} strokeWidth={1.25} />
                    <span className="text-xs">Нет фото</span>
                  </div>
                )}

                {/* Стрелки листания */}
                {!galleryLoading && count > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prev}
                      aria-label="Предыдущее фото"
                      className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-700/60 bg-black/50 text-zinc-200 backdrop-blur transition hover:bg-black/70"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      aria-label="Следующее фото"
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-700/60 bg-black/50 text-zinc-200 backdrop-blur transition hover:bg-black/70"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] tabular-nums text-zinc-300 backdrop-blur">
                      {idx + 1} / {count}
                    </span>
                  </>
                )}
              </div>

              {/* Полоса миниатюр */}
              {!galleryLoading && count > 1 && (
                <div className="flex gap-2 overflow-x-auto p-3">
                  {urls.map((src, i) => (
                    <button
                      key={src + i}
                      type="button"
                      onClick={() => setIdx(i)}
                      aria-label={`Фото ${i + 1}`}
                      className={`h-16 w-12 shrink-0 overflow-hidden rounded-md border transition ${
                        i === idx
                          ? "border-amber-500/70 ring-1 ring-amber-500/40"
                          : "border-zinc-700/60 opacity-60 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Анкета */}
            <div className="flex-1 space-y-6 p-6">
              <div>
                <h2
                  className={`${cormorant.className} text-3xl font-medium tracking-wide text-zinc-50`}
                >
                  {application.full_name ?? "Без имени"}
                </h2>
                {meta.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
                    {age !== null && <span>{age} лет</span>}
                    {application.citizenship && (
                      <span className="inline-flex items-center gap-1.5">
                        <Flag size={13} strokeWidth={1.5} className="text-zinc-500" />
                        {application.citizenship}
                      </span>
                    )}
                    {application.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={13} strokeWidth={1.5} className="text-zinc-500" />
                        {application.location}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ДОБАВЛЕН БЛОК С ПАРОЛЕМ И ЛОГИНОМ */}
              <AccessCredentials application={application} />

              {hasPhysical && (
                <Section title="Physical Attributes">
                  <div className="grid grid-cols-2 gap-4">
                    {height && <Field icon={Ruler} label="Рост" value={height} />}
                    {weight && <Field icon={Weight} label="Вес" value={weight} />}
                    {measurements && (
                      <Field icon={Sparkles} label="Параметры" value={measurements} />
                    )}
                  </div>
                </Section>
              )}

              {hasLifestyle && (
                <Section title="Lifestyle">
                  <div className="grid grid-cols-2 gap-4">
                    {smoking && (
                      <Field icon={Cigarette} label="Курение" value={smoking} />
                    )}
                    {alcohol && <Field icon={Wine} label="Алкоголь" value={alcohol} />}
                  </div>
                </Section>
              )}

              {about && (
                <Section title="About">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">
                    {about}
                  </p>
                </Section>
              )}
            </div>
          </div>
        </div>

        {/* Футер с действиями */}
        <div className="shrink-0 border-t border-zinc-800/80 bg-zinc-950/40 p-4">
          {actionError && (
            <p className="mb-3 rounded-md border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {actionError}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => runAction("decline")}
              disabled={submitting !== null}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting === "decline" ? (
                <Loader2 size={17} strokeWidth={2} className="animate-spin" />
              ) : (
                <X size={17} strokeWidth={2} />
              )}
              Decline
            </button>
            <button
              type="button"
              onClick={() => runAction("approve")}
              disabled={submitting !== null}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting === "approve" ? (
                <Loader2 size={17} strokeWidth={2} className="animate-spin" />
              ) : (
                <Check size={17} strokeWidth={2} />
              )}
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}