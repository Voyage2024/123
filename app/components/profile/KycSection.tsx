"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · KYC — три уровня доверия
 * app/components/profile/KycSection.tsx
 *
 *   Уровень 1 · Личность  — паспорт (JPG/PNG/PDF ≤ 10 МБ), плашка безопасности
 *   Уровень 2 · Лояльность — видео (MP4/MOV/WEBM ≤ 50 МБ) через модалку
 *   Уровень 3 · Доверие   — информационный блок: созвон через консьержа
 *
 * БЕЗОПАСНОСТЬ (см. миграцию 20261009_profile_kyc_vault.sql):
 *   • файлы — в приватном бакете `kyc-vault`, путь <uid>/passport|video/…;
 *   • резидент может только ЗАГРУЗИТЬ свой файл — ни читать, ни менять,
 *     ни удалять его потом нельзя;
 *   • паспорт читает только основатель (role = owner), видео — owner/admin;
 *   • имя файла с устройства не сохраняется — только случайное имя;
 *   • kyc_level меняет только персонал клуба (триггер в БД).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CheckCircle2,
  Clock,
  ConciergeBell,
  Hourglass,
  Loader2,
  Lock,
  Phone,
  Shield,
  ShieldCheck,
  Upload,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Lang } from "@/app/context/LanguageContext";
import { cormorant } from "./fonts";

/* ══════════════════════════════════════════════════════════════════
 * КОНСТАНТЫ
 * ══════════════════════════════════════════════════════════════════ */

export const KYC_BUCKET = "kyc-vault";
const MB = 1024 * 1024;

type UploadLevel = 1 | 2;

type UploadSpec = {
  folder: "passport" | "video";
  maxBytes: number;
  accept: string;
  mimes: readonly string[];
};

const UPLOAD_SPEC: Record<UploadLevel, UploadSpec> = {
  1: {
    folder: "passport",
    maxBytes: 10 * MB,
    accept: "image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf",
    mimes: ["image/jpeg", "image/png", "application/pdf"],
  },
  2: {
    folder: "video",
    maxBytes: 50 * MB,
    accept: "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm",
    mimes: ["video/mp4", "video/quicktime", "video/webm"],
  },
};

/** Некоторые браузеры отдают пустой file.type — определяем по расширению */
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const mimeOf = (f: File) => f.type || EXT_MIME[extOf(f.name)] || "";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

/* ══════════════════════════════════════════════════════════════════
 * ЛОКАЛИЗАЦИЯ
 * ══════════════════════════════════════════════════════════════════ */

type KycDict = {
  title: string;
  subtitle: string;
  level: string;
  l1Title: string;
  l1Desc: string;
  l2Title: string;
  l2Desc: string;
  l3Title: string;
  l3Desc: string;
  completed: string;
  pending: string;
  review: string;
  locked: string;
  confirm: string;
  revoke: string;
  completePrev: (n: number) => string;
  opensAfter: (n: number) => string;
  confidential: string;
  privacy: string;
  brief: string;
  makeup: string;
  videoSize: string;
  videoSizeShort: string;
  passportFormats: string;
  passportSize: string;
  l3Brief: string;
  uploadPassport: string;
  uploadVideo: string;
  passportDialogTitle: string;
  passportDialogDesc: string;
  videoDialogTitle: string;
  videoDialogDesc: string;
  videoAudience: string;
  chooseFile: string;
  replace: string;
  send: string;
  sending: string;
  close: string;
  fileSize: (size: string, max: number) => string;
  errType: string;
  errSize: (max: number) => string;
  errUpload: string;
  reviewNote: string;
  rejectedNote: string;
  doneTitle: string;
  doneNote: string;
  backToProfile: string;
};

const RU: KycDict = {
  title: "KYC-верификация",
  subtitle: "— Уровни доверия",
  level: "Уровень",
  l1Title: "Личность",
  l1Desc: "Загрузка заграничного паспорта",
  l2Title: "Лояльность клубу",
  l2Desc: "Видео с упоминанием клуба",
  l3Title: "Доверие",
  l3Desc: "Проверка по видеозвонку",
  completed: "Пройдено",
  pending: "Ожидает",
  review: "На проверке",
  locked: "Закрыто",
  confirm: "Подтвердить",
  revoke: "Отозвать",
  completePrev: (n) => `Сначала уровень ${n}`,
  opensAfter: (n) => `Откроется после уровня ${n}`,
  confidential: "Конфиденциально",
  privacy:
    "Ваши данные под абсолютной защитой. Никто, кроме основателя проекта, не имеет доступа к паспортным данным.",
  brief: "Техзадание",
  makeup: "Лёгкий макияж возможен.",
  videoSize: "Размер файла — не более 50 МБ.",
  videoSizeShort: "Файл — не более 50 МБ",
  passportFormats: "JPG, PNG или PDF.",
  passportSize: "Размер файла — не более 10 МБ.",
  l3Brief: "Для получения третьего уровня KYC необходимо согласовать и провести созвон через консьержа.",
  uploadPassport: "Загрузить паспорт",
  uploadVideo: "Загрузить видео",
  passportDialogTitle: "Загрузка паспорта",
  passportDialogDesc: "Разворот заграничного паспорта с фотографией.",
  videoDialogTitle: "Видео-подтверждение",
  videoDialogDesc: "Короткое видео, в котором вы упоминаете клуб Voyage.",
  videoAudience: "Видео доступно только команде верификации клуба.",
  chooseFile: "Выбрать файл",
  replace: "Заменить",
  send: "Отправить на проверку",
  sending: "Загрузка…",
  close: "Закрыть",
  fileSize: (size, max) => `${size} МБ из ${max} МБ`,
  errType: "Этот формат не подходит.",
  errSize: (max) => `Файл больше ${max} МБ.`,
  errUpload: "Не удалось загрузить файл. Попробуйте ещё раз.",
  reviewNote: "Файл получен — ждём подтверждения команды клуба.",
  rejectedNote: "Предыдущий файл не принят — загрузите новый.",
  doneTitle: "Файл на проверке",
  doneNote: "Как только команда подтвердит файл, уровень откроется автоматически.",
  backToProfile: "Вернуться в профиль",
};

const EN: KycDict = {
  title: "KYC Verification",
  subtitle: "— Trust Tiers",
  level: "Level",
  l1Title: "Identity",
  l1Desc: "International passport upload",
  l2Title: "Club Loyalty",
  l2Desc: "Video mention of the club",
  l3Title: "Trust",
  l3Desc: "Video call verification",
  completed: "Completed",
  pending: "Pending",
  review: "In review",
  locked: "Locked",
  confirm: "Confirm",
  revoke: "Revoke",
  completePrev: (n) => `Complete level ${n} first`,
  opensAfter: (n) => `Opens after level ${n}`,
  confidential: "Confidential",
  privacy:
    "Your data is under absolute protection. No one but the project's founder has access to passport details.",
  brief: "Brief",
  makeup: "Light makeup is fine.",
  videoSize: "File size — no more than 50 MB.",
  videoSizeShort: "File — up to 50 MB",
  passportFormats: "JPG, PNG or PDF.",
  passportSize: "File size — no more than 10 MB.",
  l3Brief: "To reach KYC level three, arrange and hold a call through the concierge.",
  uploadPassport: "Upload passport",
  uploadVideo: "Upload video",
  passportDialogTitle: "Passport upload",
  passportDialogDesc: "The photo page of your international passport.",
  videoDialogTitle: "Video confirmation",
  videoDialogDesc: "A short video in which you mention the Voyage club.",
  videoAudience: "Only the club's verification team can see the video.",
  chooseFile: "Choose file",
  replace: "Replace",
  send: "Send for review",
  sending: "Uploading…",
  close: "Close",
  fileSize: (size, max) => `${size} MB of ${max} MB`,
  errType: "This format isn't supported.",
  errSize: (max) => `The file is larger than ${max} MB.`,
  errUpload: "The file couldn't be uploaded. Please try again.",
  reviewNote: "File received — awaiting confirmation from the club team.",
  rejectedNote: "The previous file wasn't accepted — please upload a new one.",
  doneTitle: "File in review",
  doneNote: "As soon as the team confirms the file, the level opens automatically.",
  backToProfile: "Back to profile",
};

const ES: KycDict = {
  title: "Verificación KYC",
  subtitle: "— Niveles de confianza",
  level: "Nivel",
  l1Title: "Identidad",
  l1Desc: "Subir pasaporte internacional",
  l2Title: "Lealtad al club",
  l2Desc: "Video mencionando el club",
  l3Title: "Confianza",
  l3Desc: "Verificación por videollamada",
  completed: "Completado",
  pending: "Pendiente",
  review: "En revisión",
  locked: "Bloqueado",
  confirm: "Confirmar",
  revoke: "Revocar",
  completePrev: (n) => `Primero el nivel ${n}`,
  opensAfter: (n) => `Se abre tras el nivel ${n}`,
  confidential: "Confidencial",
  privacy:
    "Sus datos están bajo protección absoluta. Nadie, excepto el fundador del proyecto, tiene acceso a los datos del pasaporte.",
  brief: "Requisitos",
  makeup: "Se permite maquillaje ligero.",
  videoSize: "Tamaño del archivo — no más de 50 MB.",
  videoSizeShort: "Archivo — hasta 50 MB",
  passportFormats: "JPG, PNG o PDF.",
  passportSize: "Tamaño del archivo — no más de 10 MB.",
  l3Brief:
    "Para obtener el tercer nivel de KYC, es necesario acordar y realizar una llamada a través del concierge.",
  uploadPassport: "Subir pasaporte",
  uploadVideo: "Subir video",
  passportDialogTitle: "Subir pasaporte",
  passportDialogDesc: "La página con foto de su pasaporte internacional.",
  videoDialogTitle: "Video de confirmación",
  videoDialogDesc: "Un video corto en el que menciona el club Voyage.",
  videoAudience: "Solo el equipo de verificación del club puede ver el video.",
  chooseFile: "Elegir archivo",
  replace: "Cambiar",
  send: "Enviar a revisión",
  sending: "Subiendo…",
  close: "Cerrar",
  fileSize: (size, max) => `${size} MB de ${max} MB`,
  errType: "Este formato no es compatible.",
  errSize: (max) => `El archivo supera los ${max} MB.`,
  errUpload: "No se pudo subir el archivo. Inténtelo de nuevo.",
  reviewNote: "Archivo recibido — esperando la confirmación del equipo.",
  rejectedNote: "El archivo anterior no fue aceptado — suba uno nuevo.",
  doneTitle: "Archivo en revisión",
  doneNote: "En cuanto el equipo confirme el archivo, el nivel se abrirá automáticamente.",
  backToProfile: "Volver al perfil",
};

const PT: KycDict = {
  title: "Verificação KYC",
  subtitle: "— Níveis de confiança",
  level: "Nível",
  l1Title: "Identidade",
  l1Desc: "Envio do passaporte internacional",
  l2Title: "Lealdade ao clube",
  l2Desc: "Vídeo mencionando o clube",
  l3Title: "Confiança",
  l3Desc: "Verificação por videochamada",
  completed: "Concluído",
  pending: "Pendente",
  review: "Em análise",
  locked: "Bloqueado",
  confirm: "Confirmar",
  revoke: "Revogar",
  completePrev: (n) => `Primeiro o nível ${n}`,
  opensAfter: (n) => `Abre após o nível ${n}`,
  confidential: "Confidencial",
  privacy:
    "Seus dados estão sob proteção absoluta. Ninguém, além do fundador do projeto, tem acesso aos dados do passaporte.",
  brief: "Requisitos",
  makeup: "Maquiagem leve é permitida.",
  videoSize: "Tamanho do arquivo — no máximo 50 MB.",
  videoSizeShort: "Arquivo — até 50 MB",
  passportFormats: "JPG, PNG ou PDF.",
  passportSize: "Tamanho do arquivo — no máximo 10 MB.",
  l3Brief:
    "Para obter o terceiro nível de KYC, é necessário agendar e realizar uma chamada por meio do concierge.",
  uploadPassport: "Enviar passaporte",
  uploadVideo: "Enviar vídeo",
  passportDialogTitle: "Envio do passaporte",
  passportDialogDesc: "A página com foto do seu passaporte internacional.",
  videoDialogTitle: "Vídeo de confirmação",
  videoDialogDesc: "Um vídeo curto em que você menciona o clube Voyage.",
  videoAudience: "Somente a equipe de verificação do clube pode ver o vídeo.",
  chooseFile: "Escolher arquivo",
  replace: "Trocar",
  send: "Enviar para análise",
  sending: "Enviando…",
  close: "Fechar",
  fileSize: (size, max) => `${size} MB de ${max} MB`,
  errType: "Este formato não é compatível.",
  errSize: (max) => `O arquivo tem mais de ${max} MB.`,
  errUpload: "Não foi possível enviar o arquivo. Tente novamente.",
  reviewNote: "Arquivo recebido — aguardando a confirmação da equipe.",
  rejectedNote: "O arquivo anterior não foi aceito — envie um novo.",
  doneTitle: "Arquivo em análise",
  doneNote: "Assim que a equipe confirmar o arquivo, o nível será liberado automaticamente.",
  backToProfile: "Voltar ao perfil",
};

const DICT: Record<Lang, KycDict> = { RU, EN, ES, PT };

/* ══════════════════════════════════════════════════════════════════
 * ТИПЫ И СОСТОЯНИЯ
 * ══════════════════════════════════════════════════════════════════ */

type SubmissionStatus = "pending" | "approved" | "rejected";
type Submission = { level: number; status: SubmissionStatus; created_at: string };
type CardState = "completed" | "review" | "pending" | "locked";

const fmtMb = (bytes: number) =>
  (bytes / MB).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/* ══════════════════════════════════════════════════════════════════
 * МЕЛКИЕ ЭЛЕМЕНТЫ
 * ══════════════════════════════════════════════════════════════════ */

function StatusBadge({ state, t }: { state: CardState; t: KycDict }) {
  const cfg: Record<CardState, { Icon: LucideIcon; text: string; cls: string }> = {
    completed: {
      Icon: CheckCircle2,
      text: t.completed,
      cls: "border-emerald-800/40 bg-emerald-950/50 text-emerald-300",
    },
    pending: { Icon: Clock, text: t.pending, cls: "border-amber-800/35 bg-amber-950/40 text-amber-300" },
    review: { Icon: Hourglass, text: t.review, cls: "border-[#d4a853]/35 bg-[#d4a853]/10 text-[#ecd08c]" },
    locked: { Icon: Lock, text: t.locked, cls: "border-zinc-700/50 bg-zinc-900/60 text-zinc-400" },
  };
  const { Icon, text, cls } = cfg[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] sm:px-2.5 sm:py-1 sm:text-[10px] ${cls}`}
    >
      <Icon aria-hidden className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      {text}
    </span>
  );
}

/** Плашка безопасности паспорта */
function PrivacyPlaque({ t }: { t: KycDict }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#d4a853]/30 bg-[linear-gradient(135deg,rgba(212,168,83,0.09)_0%,rgba(212,168,83,0.02)_100%)] p-3.5 sm:gap-3.5 sm:px-[18px] sm:py-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#d4a853]/45 text-[#ecd08c] sm:h-8 sm:w-8">
        <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.6} />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#ecd08c]/80">{t.confidential}</p>
        <p className={`${cormorant.className} mt-1.5 text-base leading-[1.36] text-[#ece3cc] sm:text-[17px]`}>
          {t.privacy}
        </p>
      </div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-zinc-700/50 bg-zinc-950/50 px-2.5 py-1 text-[10.5px] text-zinc-300 sm:px-3 sm:py-1.5 sm:text-[11px]">
      {children}
    </span>
  );
}

function GoldButton({ onClick, Icon, children }: { onClick: () => void; Icon: LucideIcon; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#d4a853]/50 bg-[#d4a853]/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f0d78c] transition-all duration-300 hover:border-[#d4a853]/80 hover:bg-[#d4a853]/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d4a853]/70"
    >
      <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.6} />
      {children}
    </button>
  );
}

function Note({ tone = "muted", children }: { tone?: "muted" | "gold" | "warn"; children: ReactNode }) {
  const cls =
    tone === "gold" ? "text-[#ecd08c]/85" : tone === "warn" ? "text-amber-300/90" : "text-zinc-500";
  return <p className={`text-[10px] uppercase tracking-[0.16em] ${cls}`}>{children}</p>;
}

/* ══════════════════════════════════════════════════════════════════
 * КАРТОЧКА УРОВНЯ
 * ══════════════════════════════════════════════════════════════════ */

function KycCard({
  level,
  state,
  Icon,
  title,
  desc,
  t,
  isAdmin,
  onConfirm,
  onRevoke,
  children,
}: {
  level: 1 | 2 | 3;
  state: CardState;
  Icon: LucideIcon;
  title: string;
  desc: string;
  t: KycDict;
  isAdmin: boolean;
  onConfirm: () => void;
  onRevoke: () => void;
  children?: ReactNode;
}) {
  const locked = state === "locked";
  const done = state === "completed";

  const frame = done
    ? "border-zinc-800/50 bg-zinc-900/40"
    : locked
      ? "border-zinc-800/40 bg-zinc-900/25"
      : "border-amber-900/35 bg-zinc-900/40";
  const line = done ? "bg-emerald-500/30" : locked ? "bg-zinc-700/30" : "bg-amber-500/30";
  const iconBox = done
    ? "border-emerald-800/40 bg-emerald-950/45 text-emerald-400"
    : locked
      ? "border-zinc-700/45 bg-zinc-900/60 text-zinc-500"
      : "border-amber-800/35 bg-amber-950/35 text-amber-300/85";

  return (
    <article className={`relative overflow-hidden rounded-2xl border backdrop-blur-md ${frame}`}>
      <div aria-hidden className={`absolute inset-x-0 top-0 h-px ${line}`} />
      <div className="flex flex-col gap-3.5 p-4 sm:gap-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <span
            className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border sm:h-10 sm:w-10 ${iconBox}`}
          >
            <Icon aria-hidden className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px]" strokeWidth={1.5} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span
                className={`text-[10px] font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] ${
                  locked ? "text-zinc-500" : "text-zinc-400"
                }`}
              >
                {t.level} {level}
              </span>
              <StatusBadge state={state} t={t} />
            </div>
            <h3
              className={`mt-1.5 text-sm font-medium tracking-wide sm:mt-2 ${
                locked ? "text-zinc-400" : "text-zinc-200"
              }`}
            >
              {title}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[#8b8b94]">{desc}</p>
          </div>

          {/* управление персонала */}
          {isAdmin && (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {(state === "pending" || state === "review") && (
                <button
                  type="button"
                  onClick={onConfirm}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-emerald-800/40 bg-emerald-950/40 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300 transition-all hover:border-emerald-600/50 hover:bg-emerald-900/40"
                >
                  <Check aria-hidden className="h-3.5 w-3.5" />
                  {t.confirm}
                </button>
              )}
              {done && (
                <button
                  type="button"
                  onClick={onRevoke}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:text-amber-300/80"
                >
                  <X aria-hidden className="h-3 w-3" />
                  {t.revoke}
                </button>
              )}
              {locked && (
                <span className="max-w-[9rem] text-right text-[10px] tracking-wide text-zinc-500">
                  {t.completePrev(level - 1)}
                </span>
              )}
            </div>
          )}
        </div>

        {children}
      </div>
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * МОДАЛКА ЗАГРУЗКИ
 * мобильная — шторка снизу, sm+ — диалог по центру
 * ══════════════════════════════════════════════════════════════════ */

function UploadDialog({
  level,
  userId,
  t,
  onClose,
  onUploaded,
}: {
  level: UploadLevel;
  userId: string;
  t: KycDict;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const spec = UPLOAD_SPEC[level];
  const maxMb = spec.maxBytes / MB;
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // пока идёт загрузка, закрыть диалог нельзя
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // Esc, блокировка прокрутки фона, фокус в диалог и обратно
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [onClose]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const mime = mimeOf(f);
    if (!spec.mimes.includes(mime)) {
      setFile(null);
      setError(t.errType);
      return;
    }
    if (f.size > spec.maxBytes) {
      setFile(null);
      setError(t.errSize(maxMb));
      return;
    }
    setError(null);
    setFile(f);
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);

    const mime = mimeOf(file);
    const ext = MIME_EXT[mime] ?? extOf(file.name);
    // имя с устройства не сохраняем — только случайное
    const path = `${userId}/${spec.folder}/${Date.now()}_${randomId()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(KYC_BUCKET)
      .upload(path, file, { upsert: false, contentType: mime, cacheControl: "0" });

    if (upErr) {
      console.error("[KYC] upload failed:", upErr.message);
      setError(t.errUpload);
      setBusy(false);
      return;
    }

    const { error: rowErr } = await supabase.from("kyc_submissions").insert({
      profile_id: userId,
      level,
      file_path: path,
      mime_type: mime,
      size_bytes: file.size,
    });

    if (rowErr) {
      console.error("[KYC] submission row failed:", rowErr.message);
      setError(t.errUpload);
      setBusy(false);
      return;
    }

    setBusy(false);
    setDone(true);
    onUploaded();
  };

  const title = level === 1 ? t.passportDialogTitle : t.videoDialogTitle;
  const desc = level === 1 ? t.passportDialogDesc : t.videoDialogDesc;
  const rules = level === 1 ? [t.passportFormats, t.passportSize] : [t.makeup, t.videoSize];
  const FileIcon = level === 1 ? Shield : Video;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-[26px] border-t border-[#d4a853]/30 bg-gradient-to-b from-[#141416] to-[#0d0d0f] px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-2.5 text-zinc-100 shadow-[0_-30px_60px_-10px_rgba(0,0,0,0.7)] sm:max-w-md sm:rounded-[22px] sm:border sm:border-zinc-800/70 sm:px-7 sm:pb-7 sm:pt-6"
      >
        <div aria-hidden className="mx-auto mb-3.5 h-1 w-[38px] rounded-full bg-white/15 sm:hidden" />

        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-300/85">
            <FileIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.6} />
            KYC · {t.level} {level}
          </span>
          <button
            ref={closeRef}
            type="button"
            aria-label={t.close}
            onClick={onClose}
            disabled={busy}
            className="-mr-2.5 flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d4a853]/60 disabled:opacity-40"
          >
            <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3.5 px-1 pb-1.5 pt-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d4a853]/45 bg-[radial-gradient(circle_at_32%_28%,#3a3424_0%,#1c1810_65%,#0d0b07_100%)] text-[#ecd08c] shadow-[0_0_30px_-6px_rgba(212,168,83,0.45)]">
              <Check aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </span>
            <h2 id={titleId} className={`${cormorant.className} text-[28px] font-medium text-zinc-50`}>
              {t.doneTitle}
            </h2>
            <p className="max-w-[30ch] text-[13px] leading-relaxed text-zinc-400">{t.doneNote}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-1.5 inline-flex min-h-12 items-center justify-center rounded-full border border-[#d4a853]/50 bg-[#d4a853]/10 px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0d78c] transition-colors hover:bg-[#d4a853]/15"
            >
              {t.backToProfile}
            </button>
          </div>
        ) : (
          <div className="mt-1 flex flex-col gap-4 sm:gap-[18px]">
            <div>
              <h2
                id={titleId}
                className={`${cormorant.className} text-[30px] font-medium leading-[1.05] text-zinc-50 sm:text-[32px]`}
              >
                {title}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">{desc}</p>
            </div>

            <div className="rounded-[14px] border border-zinc-800/70 bg-zinc-900/60 px-4 py-3.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-zinc-500">{t.brief}</p>
              <ul className="mt-2.5 flex flex-col gap-2">
                {rules.map((r) => (
                  <li key={r} className="flex items-start gap-2.5 text-[13px] leading-snug text-zinc-200">
                    <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d4a853]" strokeWidth={2} />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {level === 1 && <PrivacyPlaque t={t} />}

            <input
              ref={inputRef}
              type="file"
              accept={spec.accept}
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            {file ? (
              <div className="flex items-center gap-3 rounded-[14px] border border-[#d4a853]/30 bg-[#d4a853]/5 px-3.5 py-3">
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-[#d4a853]/35 bg-zinc-950/60 text-[#ecd08c]">
                  <FileIcon aria-hidden className="h-[17px] w-[17px]" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-zinc-200">{file.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                    {t.fileSize(fmtMb(file.size), maxMb)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="min-h-11 shrink-0 px-1.5 text-[11px] uppercase tracking-[0.12em] text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-40"
                >
                  {t.replace}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-[#d4a853]/40 bg-[#d4a853]/[0.03] px-4 py-5 text-center transition-colors hover:border-[#d4a853]/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d4a853]/60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d4a853]/40 text-[#ecd08c]">
                  <Upload aria-hidden className="h-4 w-4" strokeWidth={1.6} />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f0d78c]">
                  {t.chooseFile}
                </span>
              </button>
            )}

            {busy && (
              <div aria-hidden className="h-[3px] w-full overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-[#d4a853] via-[#f0d78c] to-[#d4a853]" />
              </div>
            )}

            {error && (
              <p role="alert" className="text-[12px] text-rose-300">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!file || busy}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,#c99a45_0%,#e6c983_50%,#c99a45_100%)] text-xs font-semibold uppercase tracking-[0.18em] text-[#1a1206] shadow-[0_10px_30px_-10px_rgba(212,168,83,0.55)] transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f0d78c]/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
              {busy ? t.sending : t.send}
            </button>

            {level === 2 && (
              <p className="-mt-1 text-center text-[11px] leading-relaxed text-zinc-500">{t.videoAudience}</p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СЕКЦИЯ
 * ══════════════════════════════════════════════════════════════════ */

export function KycSection({
  userId,
  lang,
  kycLevel,
  isAdmin,
  onSetLevel,
}: {
  userId: string;
  lang: Lang;
  kycLevel: number;
  isAdmin: boolean;
  onSetLevel: (n: number) => void;
}) {
  const t = DICT[lang] ?? DICT.EN;
  const [subs, setSubs] = useState<Submission[]>([]);
  const [dialog, setDialog] = useState<UploadLevel | null>(null);

  const loadSubs = useCallback(async () => {
    const { data, error } = await supabase
      .from("kyc_submissions")
      .select("level, status, created_at")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[KYC] submissions:", error.message);
      return;
    }
    setSubs((data ?? []) as Submission[]);
  }, [userId]);

  useEffect(() => {
    void loadSubs();
  }, [loadSubs, kycLevel]);

  const latest = (lvl: number) => subs.find((s) => s.level === lvl);

  const stateFor = (lvl: 1 | 2 | 3): CardState => {
    if (lvl <= kycLevel) return "completed";
    if (lvl !== kycLevel + 1) return "locked";
    if (lvl !== 3 && latest(lvl)?.status === "pending") return "review";
    return "pending";
  };

  const s1 = stateFor(1);
  const s2 = stateFor(2);
  const s3 = stateFor(3);

  const rejected = (lvl: UploadLevel, state: CardState) =>
    state === "pending" && latest(lvl)?.status === "rejected";

  const closeDialog = useCallback(() => setDialog(null), []);

  return (
    <section aria-labelledby="kyc-title" className="mb-10">
      <div className="mb-5 flex items-center gap-2">
        <ShieldCheck aria-hidden className="h-4 w-4 text-zinc-500" />
        <h2 id="kyc-title" className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
          {t.title}
        </h2>
        <span className="ml-1 text-[10px] text-zinc-600">{t.subtitle}</span>
      </div>

      <div className="space-y-3">
        {/* ── Уровень 1 · паспорт ── */}
        <KycCard
          level={1}
          state={s1}
          Icon={Shield}
          title={t.l1Title}
          desc={t.l1Desc}
          t={t}
          isAdmin={isAdmin}
          onConfirm={() => onSetLevel(1)}
          onRevoke={() => onSetLevel(0)}
        >
          {s1 === "pending" && (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-zinc-500">
                {t.passportFormats} {t.passportSize}
              </p>
              <GoldButton onClick={() => setDialog(1)} Icon={Upload}>
                {t.uploadPassport}
              </GoldButton>
            </div>
          )}
          {rejected(1, s1) && <Note tone="warn">{t.rejectedNote}</Note>}
          {s1 === "review" && <Note tone="gold">{t.reviewNote}</Note>}
          <PrivacyPlaque t={t} />
        </KycCard>

        {/* ── Уровень 2 · видео ── */}
        <KycCard
          level={2}
          state={s2}
          Icon={Video}
          title={t.l2Title}
          desc={t.l2Desc}
          t={t}
          isAdmin={isAdmin}
          onConfirm={() => onSetLevel(2)}
          onRevoke={() => onSetLevel(1)}
        >
          {s2 !== "completed" && (
            <div className="flex flex-col items-start gap-3 border-t border-white/[0.05] pt-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <Chip>{t.makeup.replace(/\.$/, "")}</Chip>
                <Chip>{t.videoSizeShort}</Chip>
              </div>
              {s2 === "pending" && (
                <GoldButton onClick={() => setDialog(2)} Icon={Upload}>
                  {t.uploadVideo}
                </GoldButton>
              )}
            </div>
          )}
          {rejected(2, s2) && <Note tone="warn">{t.rejectedNote}</Note>}
          {s2 === "review" && <Note tone="gold">{t.reviewNote}</Note>}
          {s2 === "locked" && <Note>{t.opensAfter(1)}</Note>}
        </KycCard>

        {/* ── Уровень 3 · созвон через консьержа ── */}
        <KycCard
          level={3}
          state={s3}
          Icon={Phone}
          title={t.l3Title}
          desc={t.l3Desc}
          t={t}
          isAdmin={isAdmin}
          onConfirm={() => onSetLevel(3)}
          onRevoke={() => onSetLevel(2)}
        >
          {s3 !== "completed" && (
            <div className="flex items-start gap-3 rounded-xl border border-dashed border-zinc-600/45 bg-zinc-950/40 p-3.5 sm:gap-3.5 sm:px-[18px] sm:py-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-600/45 text-zinc-400 sm:h-8 sm:w-8">
                <ConciergeBell aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-zinc-500">{t.brief}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-300 sm:text-[13px]">{t.l3Brief}</p>
                {s3 === "locked" && (
                  <div className="mt-2">
                    <Note>{t.opensAfter(2)}</Note>
                  </div>
                )}
              </div>
            </div>
          )}
        </KycCard>
      </div>

      {dialog !== null && (
        <UploadDialog
          key={dialog}
          level={dialog}
          userId={userId}
          t={t}
          onClose={closeDialog}
          onUploaded={() => void loadSubs()}
        />
      )}
    </section>
  );
}
