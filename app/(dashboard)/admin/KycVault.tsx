"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · KYC VAULT — просмотр паспортов и видео резидентов
 * app/(dashboard)/admin/KycVault.tsx
 *
 * Источник данных:
 *   kyc_submissions (миграция 20261009_profile_kyc_vault) — заявки + статусы,
 *     realtime: новая загрузка резидента появляется в справочнике сама;
 *   storage kyc-vault — <uid>/passport/… и <uid>/video/…; в просмотрщике
 *     дополнительно читаем папку, чтобы не потерять файл без заявки.
 *
 * Доступ решает база, а не этот файл:
 *   паспорта — только основатель (role = owner): администратору ни строки
 *   заявок, ни сами файлы просто не отдаются;
 *   видео — owner и admin.
 * Файлы открываются по подписанной ссылке на несколько минут и
 * показываются прямо в дашборде, поверх — водяной знак со смотрящим.
 *
 * Решения (подтвердить / отклонить) пишет page.tsx через RPC
 * club_admin_set_kyc_level и club_admin_reject_kyc (миграция
 * 20261009c_kyc_downgrade): отклонение файла уже пройденного уровня
 * понижает kyc_level профиля до level − 1, вплоть до 0.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FileText,
  Hourglass,
  Loader2,
  Lock,
  PlaySquare,
  RefreshCw,
  ShieldCheck,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Lang } from "@/lib/gamification";

export const KYC_BUCKET = "kyc-vault";
const DOC_LINK_TTL = 5 * 60; // паспорт: 5 минут
const VIDEO_LINK_TTL = 15 * 60; // видео дольше — плеер дочитывает его частями
const RELOAD_DEBOUNCE_MS = 350;

/* ══════════════════════════════════════════════════════════════════
 * ДАННЫЕ
 * ══════════════════════════════════════════════════════════════════ */

export type KycLevelWithFile = 1 | 2;
export type KycSubmissionStatus = "pending" | "approved" | "rejected";

export type KycSubmission = {
  id: string;
  profileId: string;
  level: KycLevelWithFile;
  status: KycSubmissionStatus;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

type SubmissionRow = {
  id: string;
  profile_id: string;
  level: number;
  status: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

const isMissing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e &&
  (["42P01", "PGRST202", "PGRST205", "42883"].includes(e.code ?? "") ||
    /does not exist|schema cache|Could not find/i.test(e.message ?? ""));

const toSubmission = (r: SubmissionRow): KycSubmission | null => {
  if (r.level !== 1 && r.level !== 2) return null;
  const status: KycSubmissionStatus =
    r.status === "approved" || r.status === "rejected" ? r.status : "pending";
  return {
    id: r.id,
    profileId: r.profile_id,
    level: r.level,
    status,
    filePath: r.file_path,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
  };
};

export type KycIndex = {
  /** заявки по резиденту, новые сверху */
  byProfile: Record<string, KycSubmission[]>;
  /** таблица kyc_submissions есть в базе */
  available: boolean;
  loaded: boolean;
  reload: () => void;
};

/** Все заявки, которые база разрешает видеть текущему сотруднику + realtime */
export function useKycSubmissions(enabled = true): KycIndex {
  const [rows, setRows] = useState<KycSubmission[]>([]);
  const [available, setAvailable] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("id, profile_id, level, status, file_path, mime_type, size_bytes, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (cancelled) return;
      if (error) {
        if (isMissing(error)) setAvailable(false);
        else console.error("[KYC vault] submissions:", error.message);
        setLoaded(true);
        return;
      }
      setAvailable(true);
      setRows(
        ((data ?? []) as SubmissionRow[])
          .map(toSubmission)
          .filter((s): s is KycSubmission => s !== null),
      );
      setLoaded(true);
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), RELOAD_DEBOUNCE_MS);
    };

    void load();

    const channel = supabase
      .channel("admin-kyc-submissions")
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_submissions" }, schedule)
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [enabled, tick]);

  const byProfile = useMemo(() => {
    const out: Record<string, KycSubmission[]> = {};
    for (const s of rows) (out[s.profileId] ??= []).push(s);
    return out;
  }, [rows]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  return { byProfile, available, loaded, reload };
}

/** Есть ли у резидента файлы уровня */
export const hasFile = (subs: readonly KycSubmission[] | undefined, level: KycLevelWithFile) =>
  !!subs?.some((s) => s.level === level);

/** Уровень, по которому лежит свежий файл на проверке (только следующий шаг) */
export function pendingLevelFor(subs: readonly KycSubmission[] | undefined, kycLevel: number) {
  const next = kycLevel + 1;
  if (next !== 1 && next !== 2) return null;
  const latest = subs?.find((s) => s.level === next);
  return latest?.status === "pending" ? next : null;
}

/* ══════════════════════════════════════════════════════════════════
 * ТЕКСТЫ
 * ══════════════════════════════════════════════════════════════════ */

type VaultText = {
  eyebrow: string;
  passport: string;
  video: string;
  level: (n: number) => string;
  uploads: string;
  noFiles: string;
  foundersOnly: string;
  foundersOnlyNote: string;
  opening: string;
  linkError: string;
  retry: string;
  openTab: string;
  pdfHint: string;
  playbackError: string;
  status: Record<KycSubmissionStatus | "orphan", string>;
  approve: (n: number) => string;
  levelDone: (n: number) => string;
  needPrev: (n: number) => string;
  reject: string;
  rejected: string;
  revoke: string;
  confirmRevoke: (n: number) => string;
  downgradeHint: (n: number) => string;
  downgraded: (n: number) => string;
  approvedNotice: (n: number) => string;
  actionError: string;
  linkTtl: (min: number) => string;
  close: string;
  zoomIn: string;
  zoomOut: string;
  confidential: string;
};

const VAULT_TEXT: Record<Lang, VaultText> = {
  ru: {
    eyebrow: "KYC · хранилище",
    passport: "Паспорт",
    video: "Видео",
    level: (n) => `Уровень ${n}`,
    uploads: "Загрузки",
    noFiles: "Резидент ещё ничего не загрузила",
    foundersOnly: "Паспорта видит только основатель",
    foundersOnlyNote: "Доступ ограничен базой — файл даже не попадает в этот браузер.",
    opening: "Открываем файл…",
    linkError: "Не удалось открыть файл. Возможно, ссылка истекла.",
    retry: "Обновить ссылку",
    openTab: "Открыть в новой вкладке",
    pdfHint: "Если документ не отобразился — откройте его в новой вкладке.",
    playbackError: "Браузер не может воспроизвести этот формат — откройте видео в новой вкладке.",
    status: { pending: "На проверке", approved: "Принято", rejected: "Отклонено", orphan: "Без заявки" },
    approve: (n) => `Подтвердить уровень ${n}`,
    levelDone: (n) => `Уровень ${n} подтверждён`,
    needPrev: (n) => `Сначала уровень ${n}`,
    reject: "Отклонить",
    rejected: "Файл отклонён — резидент загрузит новый",
    revoke: "Отклонить и понизить",
    confirmRevoke: (n) => `Точно? KYC станет ${n}`,
    downgradeHint: (n) => `KYC опустится до уровня ${n}`,
    downgraded: (n) => `Файл отклонён · KYC понижен до уровня ${n}`,
    approvedNotice: (n) => `KYC: уровень ${n} подтверждён`,
    actionError: "Не удалось сохранить",
    linkTtl: (min) => `Защищённая ссылка · ${min} мин`,
    close: "Закрыть",
    zoomIn: "Увеличить",
    zoomOut: "Вписать в экран",
    confidential: "Voyage · конфиденциально",
  },
  en: {
    eyebrow: "KYC · vault",
    passport: "Passport",
    video: "Video",
    level: (n) => `Level ${n}`,
    uploads: "Uploads",
    noFiles: "Nothing uploaded yet",
    foundersOnly: "Passports are visible to the founder only",
    foundersOnlyNote: "Access is enforced by the database — the file never reaches this browser.",
    opening: "Opening the file…",
    linkError: "Couldn't open the file. The link may have expired.",
    retry: "Refresh link",
    openTab: "Open in a new tab",
    pdfHint: "If the document doesn't show, open it in a new tab.",
    playbackError: "This browser can't play the format — open the video in a new tab.",
    status: { pending: "In review", approved: "Accepted", rejected: "Rejected", orphan: "No request" },
    approve: (n) => `Approve level ${n}`,
    levelDone: (n) => `Level ${n} confirmed`,
    needPrev: (n) => `Approve level ${n} first`,
    reject: "Reject",
    rejected: "File rejected — the resident will upload a new one",
    revoke: "Reject & downgrade",
    confirmRevoke: (n) => `Sure? KYC becomes ${n}`,
    downgradeHint: (n) => `KYC will drop to level ${n}`,
    downgraded: (n) => `File rejected · KYC lowered to level ${n}`,
    approvedNotice: (n) => `KYC: level ${n} confirmed`,
    actionError: "Couldn't save",
    linkTtl: (min) => `Secure link · ${min} min`,
    close: "Close",
    zoomIn: "Zoom in",
    zoomOut: "Fit to screen",
    confidential: "Voyage · confidential",
  },
  es: {
    eyebrow: "KYC · bóveda",
    passport: "Pasaporte",
    video: "Vídeo",
    level: (n) => `Nivel ${n}`,
    uploads: "Archivos",
    noFiles: "Aún no ha subido nada",
    foundersOnly: "Los pasaportes solo los ve el fundador del proyecto",
    foundersOnlyNote: "El acceso lo limita la base de datos: el archivo ni siquiera llega a este navegador.",
    opening: "Abriendo el archivo…",
    linkError: "No se pudo abrir el archivo. Puede que el enlace haya caducado.",
    retry: "Renovar enlace",
    openTab: "Abrir en otra pestaña",
    pdfHint: "Si el documento no se muestra, ábralo en otra pestaña.",
    playbackError: "El navegador no reproduce este formato: abra el vídeo en otra pestaña.",
    status: { pending: "En revisión", approved: "Aceptado", rejected: "Rechazado", orphan: "Sin solicitud" },
    approve: (n) => `Confirmar nivel ${n}`,
    levelDone: (n) => `Nivel ${n} confirmado`,
    needPrev: (n) => `Primero el nivel ${n}`,
    reject: "Rechazar",
    rejected: "Archivo rechazado: la residente subirá uno nuevo",
    revoke: "Rechazar y bajar",
    confirmRevoke: (n) => `¿Seguro? El KYC pasa a ${n}`,
    downgradeHint: (n) => `El KYC bajará al nivel ${n}`,
    downgraded: (n) => `Archivo rechazado · KYC bajado al nivel ${n}`,
    approvedNotice: (n) => `KYC: nivel ${n} confirmado`,
    actionError: "No se pudo guardar",
    linkTtl: (min) => `Enlace seguro · ${min} min`,
    close: "Cerrar",
    zoomIn: "Ampliar",
    zoomOut: "Ajustar a la pantalla",
    confidential: "Voyage · confidencial",
  },
  pt: {
    eyebrow: "KYC · cofre",
    passport: "Passaporte",
    video: "Vídeo",
    level: (n) => `Nível ${n}`,
    uploads: "Envios",
    noFiles: "Ainda não enviou nada",
    foundersOnly: "Os passaportes só são visíveis para o fundador",
    foundersOnlyNote: "O acesso é limitado pelo banco de dados — o arquivo nem chega a este navegador.",
    opening: "Abrindo o arquivo…",
    linkError: "Não foi possível abrir o arquivo. O link pode ter expirado.",
    retry: "Renovar link",
    openTab: "Abrir em nova aba",
    pdfHint: "Se o documento não aparecer, abra-o em nova aba.",
    playbackError: "O navegador não reproduz este formato — abra o vídeo em nova aba.",
    status: { pending: "Em análise", approved: "Aceito", rejected: "Recusado", orphan: "Sem pedido" },
    approve: (n) => `Confirmar nível ${n}`,
    levelDone: (n) => `Nível ${n} confirmado`,
    needPrev: (n) => `Primeiro o nível ${n}`,
    reject: "Recusar",
    rejected: "Arquivo recusado — a residente enviará um novo",
    revoke: "Recusar e rebaixar",
    confirmRevoke: (n) => `Certeza? O KYC passa a ${n}`,
    downgradeHint: (n) => `O KYC cairá para o nível ${n}`,
    downgraded: (n) => `Arquivo recusado · KYC rebaixado ao nível ${n}`,
    approvedNotice: (n) => `KYC: nível ${n} confirmado`,
    actionError: "Não foi possível salvar",
    linkTtl: (min) => `Link seguro · ${min} min`,
    close: "Fechar",
    zoomIn: "Ampliar",
    zoomOut: "Ajustar à tela",
    confidential: "Voyage · confidencial",
  },
};

const LOCALE: Record<Lang, string> = { ru: "ru-RU", en: "en-GB", es: "es-ES", pt: "pt-BR" };

/* ══════════════════════════════════════════════════════════════════
 * ФАЙЛЫ
 * ══════════════════════════════════════════════════════════════════ */

type VaultFile = {
  path: string;
  mime: string;
  size: number | null;
  createdAt: string | null;
  status: KycSubmissionStatus | "orphan";
  submissionId: string | null;
};

type MediaKind = "image" | "pdf" | "video" | "other";

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/mp4",
};

const mimeFromPath = (path: string) => EXT_MIME[path.split(".").pop()?.toLowerCase() ?? ""] ?? "";

function kindOf(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("video/")) return "video";
  return "other";
}

const fmtSize = (bytes: number | null, lang: Lang) =>
  bytes === null
    ? ""
    : `${(bytes / 1024 / 1024).toLocaleString(LOCALE[lang], { maximumFractionDigits: 1 })} ${lang === "ru" ? "МБ" : "MB"}`;

const fmtDate = (iso: string | null, lang: Lang) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(LOCALE[lang], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const STATUS_CHIP: Record<VaultFile["status"], string> = {
  pending: "border-amber-300/30 bg-amber-300/[0.08] text-amber-200",
  approved: "border-emerald-700/40 bg-emerald-950/40 text-emerald-300",
  rejected: "border-rose-700/40 bg-rose-950/30 text-rose-300",
  orphan: "border-zinc-700/60 bg-zinc-900/60 text-zinc-400",
};

/* ══════════════════════════════════════════════════════════════════
 * СЦЕНА: картинка / PDF / видео
 * ══════════════════════════════════════════════════════════════════ */

function Watermark({ text }: { text: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-wrap content-around justify-around gap-x-16 gap-y-20 opacity-[0.08]">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.3em] text-white">
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stage({
  file,
  url,
  error,
  onRetry,
  watermark,
  t,
}: {
  file: VaultFile;
  url: string | null;
  error: string | null;
  onRetry: () => void;
  watermark: string;
  t: VaultText;
}) {
  const kind = kindOf(file.mime || mimeFromPath(file.path));
  const [zoom, setZoom] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertTriangle aria-hidden className="h-5 w-5 text-rose-300" strokeWidth={1.5} />
        <p className="max-w-xs text-sm text-zinc-300">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-zinc-700 px-4 text-[11px] uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:border-amber-200/40 hover:text-amber-100"
        >
          <RefreshCw aria-hidden className="h-3.5 w-3.5" />
          {t.retry}
        </button>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center gap-2.5 text-sm text-zinc-500">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin text-amber-200/70" />
        {t.opening}
      </div>
    );
  }

  const blockMenu = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="relative h-full w-full" onContextMenu={blockMenu}>
      {kind === "image" && (
        <div className={`h-full w-full ${zoom ? "overflow-auto" : "flex items-center justify-center overflow-hidden p-3"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={t.passport}
            draggable={false}
            onClick={() => setZoom((z) => !z)}
            className={
              zoom
                ? "max-w-none cursor-zoom-out select-none"
                : "max-h-full max-w-full cursor-zoom-in select-none object-contain"
            }
            style={zoom ? { width: "180%" } : undefined}
          />
        </div>
      )}

      {kind === "pdf" && (
        <iframe title={t.passport} src={url} className="h-full w-full rounded-[inherit] bg-white" />
      )}

      {kind === "video" &&
        (playbackFailed ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <PlaySquare aria-hidden className="h-6 w-6 text-zinc-500" strokeWidth={1.3} />
            <p className="max-w-xs text-sm text-zinc-400">{t.playbackError}</p>
          </div>
        ) : (
          <video
            key={url}
            src={url}
            controls
            playsInline
            preload="metadata"
            controlsList="nodownload"
            disablePictureInPicture
            onError={() => setPlaybackFailed(true)}
            className="h-full w-full bg-black object-contain"
          />
        ))}

      {kind === "other" && (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-400">{t.pdfHint}</div>
      )}

      <Watermark text={watermark} />

      {kind === "image" && (
        <button
          type="button"
          onClick={() => setZoom((z) => !z)}
          aria-label={zoom ? t.zoomOut : t.zoomIn}
          className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-zinc-200 backdrop-blur transition-colors hover:text-amber-100"
        >
          {zoom ? <ZoomOut aria-hidden className="h-4 w-4" /> : <ZoomIn aria-hidden className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * МОДАЛКА ПРОСМОТРА
 * мобильная — на весь экран, sm+ — окно по центру
 * ══════════════════════════════════════════════════════════════════ */

export function KycViewer({
  lang,
  resident,
  submissions,
  initialLevel,
  canViewPassport,
  viewer,
  serif,
  onClose,
  onApprove,
  onReject,
  onChanged,
}: {
  lang: Lang;
  resident: { id: string; fullName: string | null; kycLevel: number };
  submissions: readonly KycSubmission[];
  initialLevel: KycLevelWithFile;
  /** только основатель (role = owner) */
  canViewPassport: boolean;
  viewer: { id: string | null; email: string | null };
  /** className шрифта-серифа справочника */
  serif: string;
  onClose: () => void;
  /** null — успех, строка — ошибка */
  onApprove: (level: number) => Promise<string | null>;
  /** отклонить заявку; если уровень уже пройден — база понизит KYC до level − 1 */
  onReject: (submissionId: string, level: KycLevelWithFile) => Promise<string | null>;
  onChanged: () => void;
}) {
  const t = VAULT_TEXT[lang] ?? VAULT_TEXT.en;
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  const [level, setLevel] = useState<KycLevelWithFile>(initialLevel);
  const [orphans, setOrphans] = useState<Partial<Record<KycLevelWithFile, VaultFile[]>>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [link, setLink] = useState<{ path: string; url: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const request = useRef(0);

  const locked = level === 1 && !canViewPassport;
  const folder = level === 1 ? "passport" : "video";
  const ttl = level === 1 ? DOC_LINK_TTL : VIDEO_LINK_TTL;

  /* Esc, блокировка прокрутки, фокус */
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = busy !== null;
  }, [busy]);
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

  /* файлы в папке без строки в kyc_submissions (загрузка прошла, заявка — нет) */
  useEffect(() => {
    if (locked) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage
        .from(KYC_BUCKET)
        .list(`${resident.id}/${folder}`, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (cancelled) return;
      if (error) {
        console.error("[KYC vault] list:", error.message);
        return;
      }
      const list = ((data ?? []) as Array<{
        name: string;
        created_at?: string | null;
        metadata?: { size?: number; mimetype?: string } | null;
      }>)
        .filter((o) => o.name && !o.name.startsWith("."))
        .map<VaultFile>((o) => {
          const path = `${resident.id}/${folder}/${o.name}`;
          return {
            path,
            mime: o.metadata?.mimetype ?? mimeFromPath(path),
            size: typeof o.metadata?.size === "number" ? o.metadata.size : null,
            createdAt: o.created_at ?? null,
            status: "orphan",
            submissionId: null,
          };
        });
      setOrphans((prev) => ({ ...prev, [level]: list }));
    })();
    return () => {
      cancelled = true;
    };
  }, [folder, level, locked, resident.id]);

  const files = useMemo<VaultFile[]>(() => {
    const fromRows = submissions
      .filter((s) => s.level === level)
      .map<VaultFile>((s) => ({
        path: s.filePath,
        mime: s.mimeType ?? mimeFromPath(s.filePath),
        size: s.sizeBytes,
        createdAt: s.createdAt,
        status: s.status,
        submissionId: s.id,
      }));
    const known = new Set(fromRows.map((f) => f.path));
    const extra = (orphans[level] ?? []).filter((f) => !known.has(f.path));
    return [...fromRows, ...extra].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [submissions, level, orphans]);

  const current = locked ? null : (files.find((f) => f.path === picked) ?? files[0] ?? null);

  /* подписанная ссылка на выбранный файл */
  const openLink = useCallback(
    async (path: string, seconds: number) => {
      const req = ++request.current;
      setLink(null);
      setLinkError(null);
      const { data, error } = await supabase.storage.from(KYC_BUCKET).createSignedUrl(path, seconds);
      if (req !== request.current) return;
      if (error || !data?.signedUrl) {
        console.error("[KYC vault] signed url:", error?.message ?? "empty");
        setLinkError(t.linkError);
        return;
      }
      setLink({ path, url: data.signedUrl });
    },
    [t.linkError],
  );

  const currentPath = current?.path ?? null;
  useEffect(() => {
    if (!currentPath) return;
    void openLink(currentPath, ttl);
  }, [currentPath, ttl, openLink]);

  // «точно понизить?» живёт 5 секунд и сбрасывается при смене файла
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  if (confirmRevoke && confirmFor !== currentPath) {
    setConfirmRevoke(false);
  }
  useEffect(() => {
    if (!confirmRevoke) return;
    const timer = setTimeout(() => setConfirmRevoke(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmRevoke]);

  /* решения */
  const next = resident.kycLevel + 1;
  const levelDone = resident.kycLevel >= level;
  const canApprove = !levelDone && level === next;
  // отклонить можно заявку на проверке или уже принятую; принятая — с понижением KYC
  const canReject =
    !!current?.submissionId && (current.status === "pending" || current.status === "approved");
  const downgrades = canReject && levelDone;

  const approve = async () => {
    setBusy("approve");
    setNotice(null);
    const err = await onApprove(level);
    setBusy(null);
    setNotice(err ? { ok: false, text: `${t.actionError}: ${err}` } : { ok: true, text: t.approvedNotice(level) });
    if (!err) onChanged();
  };

  const reject = async () => {
    if (!current?.submissionId) return;
    // понижение уровня — только со второго нажатия
    if (downgrades && !confirmRevoke) {
      setConfirmFor(current.path);
      setConfirmRevoke(true);
      return;
    }
    setConfirmRevoke(false);
    setBusy("reject");
    setNotice(null);
    const err = await onReject(current.submissionId, level);
    setBusy(null);
    if (err) {
      setNotice({ ok: false, text: `${t.actionError}: ${err}` });
      return;
    }
    setNotice({ ok: true, text: downgrades ? t.downgraded(level - 1) : t.rejected });
    onChanged();
  };

  const watermark = `${t.confidential} · ${viewer.email ?? "staff"} · ${new Date().toLocaleDateString(LOCALE[lang])}`;

  const tabs: Array<{ level: KycLevelWithFile; label: string; Icon: typeof FileText; count: number }> = [
    { level: 1, label: t.passport, Icon: FileText, count: submissions.filter((s) => s.level === 1).length },
    { level: 2, label: t.video, Icon: PlaySquare, count: submissions.filter((s) => s.level === 2).length },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center sm:items-center sm:p-5">
      <div aria-hidden className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !busy && onClose()} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-zinc-950 text-zinc-100 sm:h-auto sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-2xl sm:border sm:border-amber-200/15 sm:shadow-2xl sm:shadow-black/60"
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />

        {/* шапка */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800/70 px-4 pb-3.5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-amber-200/70" strokeWidth={1.5} />
              {t.eyebrow}
            </p>
            <h3 id={titleId} className={`${serif} mt-1 truncate text-2xl font-medium text-zinc-50 sm:text-[28px]`}>
              {resident.fullName ?? "—"}
            </h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => !busy && onClose()}
            aria-label={t.close}
            className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/40"
          >
            <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
        </div>

        {/* уровни */}
        <div className="px-4 pt-3.5 sm:px-6">
          <div role="tablist" aria-label="KYC" className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1 sm:inline-grid sm:w-auto">
            {tabs.map(({ level: lvl, label, Icon, count }) => {
              const active = level === lvl;
              const lockedTab = lvl === 1 && !canViewPassport;
              return (
                <button
                  key={lvl}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setLevel(lvl);
                    setPicked(null);
                    setNotice(null);
                  }}
                  className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 text-xs transition-colors ${
                    active ? "bg-amber-200/[0.12] text-amber-100" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {lockedTab ? <Lock aria-hidden className="h-3.5 w-3.5" /> : <Icon aria-hidden className="h-3.5 w-3.5" />}
                  <span>{label}</span>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{t.level(lvl)}</span>
                  {!lockedTab && count > 0 && (
                    <span className="rounded-full bg-zinc-800 px-1.5 text-[10px] tabular-nums text-zinc-300">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* тело */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3.5 md:grid md:grid-cols-[minmax(0,1fr)_15rem] md:gap-5 md:px-6 md:py-5">
          <div className="relative h-[58dvh] min-h-[16rem] shrink-0 overflow-hidden rounded-xl border border-zinc-800/80 bg-[radial-gradient(120%_100%_at_50%_0%,#18181b_0%,#09090b_70%)] md:h-[62vh]">
            {locked ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/25 text-amber-200/80">
                  <Lock aria-hidden className="h-5 w-5" strokeWidth={1.4} />
                </span>
                <p className={`${serif} text-xl text-zinc-100`}>{t.foundersOnly}</p>
                <p className="max-w-xs text-xs leading-relaxed text-zinc-500">{t.foundersOnlyNote}</p>
              </div>
            ) : current ? (
              <Stage
                key={current.path}
                file={current}
                url={link?.path === current.path ? link.url : null}
                error={linkError}
                onRetry={() => void openLink(current.path, ttl)}
                watermark={watermark}
                t={t}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                {level === 1 ? (
                  <FileText aria-hidden className="h-6 w-6 text-zinc-600" strokeWidth={1.3} />
                ) : (
                  <PlaySquare aria-hidden className="h-6 w-6 text-zinc-600" strokeWidth={1.3} />
                )}
                <p className="text-sm text-zinc-500">{t.noFiles}</p>
              </div>
            )}
          </div>

          {/* список загрузок */}
          {!locked && files.length > 0 && (
            <div className="min-w-0">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{t.uploads}</p>
              <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-col md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
                {files.map((f) => {
                  const active = f.path === current?.path;
                  return (
                    <li key={f.path} className="w-[13.5rem] shrink-0 snap-start md:w-auto">
                      <button
                        type="button"
                        onClick={() => setPicked(f.path)}
                        aria-current={active ? "true" : undefined}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          active
                            ? "border-amber-200/35 bg-amber-200/[0.06]"
                            : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-zinc-200">{fmtDate(f.createdAt, lang)}</span>
                          <span className={`shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.12em] ${STATUS_CHIP[f.status]}`}>
                            {t.status[f.status]}
                          </span>
                        </span>
                        <span className="mt-1 block truncate font-mono text-[10px] text-zinc-500">
                          {(f.mime || mimeFromPath(f.path) || "file").replace(/^.*\//, "").toUpperCase()}
                          {f.size !== null && ` · ${fmtSize(f.size, lang)}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {current && link?.path === current.path && (
                <div className="mt-3 hidden flex-col gap-2 md:flex">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">{t.linkTtl(Math.round(ttl / 60))}</p>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 transition-colors hover:text-amber-100"
                  >
                    <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                    {t.openTab}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* решение */}
        <div className="flex flex-col gap-3 border-t border-zinc-800/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pb-4">
          <div className="min-w-0 text-xs">
            {notice ? (
              <p role="status" className={`flex items-center gap-2 ${notice.ok ? "text-amber-100" : "text-rose-300"}`}>
                {notice.ok ? <Check aria-hidden className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{notice.text}</span>
              </p>
            ) : confirmRevoke ? (
              <p role="status" className="flex items-center gap-2 text-rose-300">
                <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.downgradeHint(level - 1)}</span>
              </p>
            ) : levelDone ? (
              <p className="flex items-center gap-2 text-emerald-300/90">
                <Check aria-hidden className="h-3.5 w-3.5" />
                {t.levelDone(level)}
              </p>
            ) : level > next ? (
              <p className="flex items-center gap-2 text-zinc-500">
                <Hourglass aria-hidden className="h-3.5 w-3.5" />
                {t.needPrev(next)}
              </p>
            ) : current && link?.path === current.path ? (
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-zinc-400 transition-colors hover:text-amber-100 md:hidden"
              >
                <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                {t.openTab}
              </a>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            {canReject && !locked && (
              <button
                type="button"
                onClick={() => void reject()}
                disabled={busy !== null}
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-4 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:opacity-50 [&:only-child]:col-span-2 ${
                  confirmRevoke
                    ? "border-rose-500/60 bg-rose-950/60 text-rose-100 hover:bg-rose-900/60"
                    : "border-rose-800/40 text-rose-200 hover:bg-rose-950/40"
                }`}
              >
                {busy === "reject" ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <X aria-hidden className="h-3.5 w-3.5" />}
                {confirmRevoke ? t.confirmRevoke(level - 1) : downgrades ? t.revoke : t.reject}
              </button>
            )}
            {canApprove && !locked && (
              <button
                type="button"
                onClick={() => void approve()}
                disabled={busy !== null}
                className="col-span-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-emerald-700/50 bg-emerald-950/50 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200 transition-colors hover:bg-emerald-900/50 disabled:opacity-50 [&:only-child]:col-span-2"
              >
                {busy === "approve" ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Check aria-hidden className="h-3.5 w-3.5" />}
                {t.approve(level)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
