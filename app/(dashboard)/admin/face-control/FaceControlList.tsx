"use client";

import { useEffect, useState } from "react";
import {
  Check,
  X,
  MapPin,
  Flag,
  UserRound,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import CandidateModal from "./CandidateModal";
import { resolvePhotoUrls } from "./photoUrl";

export type Application = {
  id: string;
  full_name: string | null;
  location: string | null;
  citizenship: string | null;
  avatar_url: string | null; // первый путь — превью в карточке
  photos: string[]; // все пути — для галереи в модалке
  kyc_level: number | null;
  status: string | null;
  // Доступы гостя (генерирует и записывает Telegram-бот)
  email: string | null; // логин
  temp_password: string | null; // пароль открытым текстом (MVP)
  // Расширенная анкета
  birth_date: string | null;
  height: number | string | null;
  weight: number | string | null;
  measurements: string | null;
  smoking: string | boolean | null;
  alcohol: string | boolean | null;
  about: string | null;
};

type Props = {
  applications: Application[];
  // Асинхронные: резолвятся при успехе, кидают ошибку при неудаче.
  onApprove: (app: Application) => Promise<unknown>;
  onDecline: (app: Application) => Promise<unknown>;
};

function initials(name: string | null) {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default function FaceControlList({
  applications,
  onApprove,
  onDecline,
}: Props) {
  const [selected, setSelected] = useState<Application | null>(null);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});

  // Какая карточка сейчас обрабатывается (id + действие) и ошибка.
  const [pending, setPending] = useState<{
    id: string;
    action: "approve" | "decline";
  } | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);

  // Пакетно подписываем первое фото каждого кандидата (приватный бакет).
  useEffect(() => {
    let cancelled = false;

    const firstPhotos = applications.map((a) => a.photos[0] ?? null);
    if (firstPhotos.every((p) => !p)) {
      setAvatarUrls({});
      return;
    }

    resolvePhotoUrls(firstPhotos).then((urls) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      applications.forEach((a, i) => {
        if (urls[i]) map[a.id] = urls[i];
      });
      setAvatarUrls(map);
    });

    return () => {
      cancelled = true;
    };
  }, [applications]);

  async function cardAction(app: Application, action: "approve" | "decline") {
    if (pending) return;
    setCardError(null);
    setPending({ id: app.id, action });
    try {
      if (action === "approve") await onApprove(app);
      else await onDecline(app);
      // Успех — карточка убирается на уровне page. Если анкета этого же
      // кандидата открыта в модалке, закрываем и её.
      setSelected((cur) => (cur?.id === app.id ? null : cur));
    } catch (e) {
      setCardError(
        e instanceof Error ? e.message : "Не удалось выполнить действие.",
      );
    } finally {
      setPending(null);
    }
  }

  /* Обёртки для модалки: после успешного действия модалка закрывается
     здесь (setSelected(null)), карточку из списка убирает page — это и
     есть optimistic update. При ошибке промис отклоняется дальше, модалка
     остаётся открытой и показывает ошибку своими средствами. Никаких
     дополнительных диалогов (паролей и т.п.) не выводится. */
  async function modalApprove(app: Application) {
    const res = await onApprove(app);
    setSelected(null);
    return res;
  }

  async function modalDecline(app: Application) {
    const res = await onDecline(app);
    setSelected(null);
    return res;
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/40 px-6 py-20 text-center backdrop-blur-xl">
        <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-400/10 blur-xl" />
          <div className="absolute inset-0 rounded-full border border-dashed border-amber-400/30" />
          <ShieldCheck
            size={26}
            strokeWidth={1.25}
            className="relative text-amber-200/80"
          />
        </div>
        <p className="text-lg font-medium text-zinc-200">Очередь пуста</p>
        <p className="mt-1.5 text-sm text-zinc-500">Все заявки обработаны.</p>
      </div>
    );
  }

  return (
    <>
      {cardError && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          <AlertTriangle size={16} strokeWidth={1.5} />
          <span>{cardError}</span>
        </div>
      )}

      <ul className="space-y-3">
        {applications.map((app) => {
          const avatar = avatarUrls[app.id];
          const rowPending = pending?.id === app.id;
          return (
            <li
              key={app.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(app)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(app);
                }
              }}
              title="Открыть анкету"
              className="flex cursor-pointer items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-xl transition-colors hover:border-amber-500/30 hover:bg-zinc-900/60 focus:outline-none focus-visible:border-amber-500/40 focus-visible:ring-2 focus-visible:ring-amber-500/30"
            >
              {/* Аватар / плейсхолдер */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700/70 bg-zinc-800/60">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt={app.full_name ?? "avatar"}
                    className="h-full w-full object-cover"
                  />
                ) : initials(app.full_name) ? (
                  <span className="text-sm font-medium tracking-wide text-zinc-300">
                    {initials(app.full_name)}
                  </span>
                ) : (
                  <UserRound size={22} strokeWidth={1.5} className="text-zinc-500" />
                )}
              </div>

              {/* Данные гостя */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-zinc-100">
                  {app.full_name ?? "Без имени"}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                  {app.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={13} strokeWidth={1.5} className="text-zinc-500" />
                      {app.location}
                    </span>
                  )}
                  {app.citizenship && (
                    <span className="inline-flex items-center gap-1.5">
                      <Flag size={13} strokeWidth={1.5} className="text-zinc-500" />
                      {app.citizenship}
                    </span>
                  )}
                </div>
              </div>

              {/* Действия — stopPropagation, чтобы клик не открывал модалку */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={rowPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    cardAction(app, "approve");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {rowPending && pending?.action === "approve" ? (
                    <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <Check size={16} strokeWidth={2} />
                  )}
                  <span className="hidden sm:inline">Approve</span>
                </button>

                <button
                  type="button"
                  disabled={rowPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    cardAction(app, "decline");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {rowPending && pending?.action === "decline" ? (
                    <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <X size={16} strokeWidth={2} />
                  )}
                  <span className="hidden sm:inline">Decline</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Модалка Face Control: обработчики обёрнуты — при успехе модалка
          закрывается здесь, карточку убирает page (optimistic update).
          Блок Access Credentials рендерится внутри CandidateModal:
          <AccessCredentials application={application} /> */}
      {selected && (
        <CandidateModal
          application={selected}
          onClose={() => setSelected(null)}
          onApprove={modalApprove}
          onDecline={modalDecline}
        />
      )}
    </>
  );
}
