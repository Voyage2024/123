"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · RESIDENT DIRECTORY — интерфейс
 * app/(dashboard)/admin/DirectoryClient.tsx
 *
 * Справочник профилей и подтверждение KYC (страница — ./page.tsx).
 * KYC — три ступени доверия; зелёная галочка = уровень реально подтверждён:
 *   0 — ничего не пройдено · 1 Identity (паспорт) · 2 Club Loyalty (видео)
 *   · 3 Trust (видеозвонок). Янтарная ступень — файл ждёт проверки.
 *
 * Файлы KYC (паспорт/видео) — ./KycVault.tsx: заявки с realtime и
 * просмотрщик с подписанными ссылками. Паспорта база отдаёт только
 * основателю (role = owner), видео — owner и admin.
 *
 * Раскладка — container queries: таблица на широкой колонке, компактные
 * карточки на узкой (страница живёт рядом с сайдбаром). Действия строки —
 * в меню «⋯» (на телефоне — шторка снизу) + быстрые кнопки файлов.
 * Клик по строке открывает анкету со сводкой.
 *
 * Уровень KYC двигается в обе стороны: подтверждение поднимает его на
 * один шаг, отклонение файла пройденного уровня и ручной выбор в анкете
 * опускают — вплоть до 0. Записывает page.tsx (RPC из миграции
 * 20261009c_kyc_downgrade), здесь — только интерфейс.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Cormorant_Garamond } from "next/font/google";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  ChevronDown,
  Crown,
  FileText,
  Flag,
  Hourglass,
  Loader2,
  Lock,
  MapPin,
  MoreHorizontal,
  Pencil,
  PlaySquare,
  Plus,
  RefreshCw,
  Search,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/app/context/LanguageContext";
import { normalizeLang, type CircleKey, type Lang } from "@/lib/gamification";
import { isStaff } from "@/lib/access";
import { CIRCLE_ORDER, skinFor } from "@/app/components/profile/ClubCardholder";
import {
  KycViewer,
  hasFile,
  pendingLevelFor,
  useKycSubmissions,
  type KycLevelWithFile,
  type KycSubmission,
} from "./KycVault";

export const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600"],
});

/* ── Данные ───────────────────────────────────────────────────────── */

export type DirectoryResident = {
  id: string;
  fullName: string | null;
  role: string | null;
  status: string | null;
  /** 0…3; 0 — ничего не пройдено */
  kycLevel: number;
  location: string | null;
  citizenship: string | null;
  email: string | null;
  createdAt: string | null;
  avatar: string | null;
  circleKey: CircleKey | null;
  circleTitle: string | null;
};

export type ResidentDraft = {
  id: string | null; // null → новый пользователь (через серверный роут)
  fullName: string;
  location: string;
  citizenship: string;
  status: string;
  kycLevel: number;
  email: string;
  password: string;
};

export type KycFilter = "all" | "pending" | "verified";

export type DirectoryViewer = {
  id: string | null;
  email: string | null;
  role: string | null;
};

/** Строго 0…3: всё нечисловое и пустое — 0 (ничего не пройдено) */
export const clampKyc = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.floor(n))) : 0;
};

/** Ждёт подтверждения: не персонал и (KYC ниже 3 или статус pending) */
export const needsReview = (r: Pick<DirectoryResident, "role" | "kycLevel" | "status">) =>
  !isStaff(r.role) && (r.kycLevel < 3 || (r.status ?? "").toLowerCase() === "pending");

/** Заполненность анкеты — та же формула, что на странице профиля резидента */
export function profileCompletion(p: Record<string, unknown>) {
  const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";
  const text = ["full_name", "location", "citizenship", "birth_date", "height", "weight", "measurements", "about"].filter(
    (k) => filled(p[k]),
  ).length; // до 8
  const photos = Array.isArray(p.photo_urls) ? Math.min(p.photo_urls.length, 3) : 0; // до 3
  const kyc = clampKyc(p.kyc_level) >= 3 ? 1 : 0; // до 1
  return Math.round(((text + photos + kyc) / 12) * 100);
}

/* ── Тексты ───────────────────────────────────────────────────────── */

const TEXT = {
  en: {
    eyebrow: "Voyage Private Club",
    badge: "Admin",
    title: "Resident Directory",
    subtitle: "Profiles, statuses and KYC verification",
    total: "Profiles",
    verifiedCount: "Verified",
    reviewCount: "Awaiting review",
    filesCount: "Files to review",
    search: "Search by name, email or city…",
    allStatuses: "All statuses",
    noStatus: "— No status —",
    kycAll: "All",
    kycPending: "Awaiting KYC",
    kycVerified: "Verified",
    add: "Add resident",
    refresh: "Refresh",
    colResident: "Resident",
    colLocation: "Location",
    colCitizenship: "Citizenship",
    colStatus: "Status",
    colKyc: "KYC",
    colFiles: "Files",
    colActions: "Actions",
    unnamed: "No name",
    statusNone: "not assigned",
    verified: "Verified",
    approve: "Approve KYC",
    approveShort: "Approve",
    approveLevel: (n: number) => `Approve KYC level ${n}`,
    reviewFirst: "opens the file first",
    approvedLevel: (n: number) => `KYC level ${n} confirmed`,
    edit: "Edit",
    openProfile: "Open profile",
    viewPassport: "Passport",
    viewVideo: "Video",
    founderOnly: "founder only",
    moreActions: "Actions",
    inReview: "file in review",
    kycSteps: ["Identity", "Club Loyalty", "Trust"],
    emptyTitle: "No residents found",
    emptyHint: "Try another search or filter",
    loading: "Opening the directory…",
    modalNew: "New guest",
    modalEditing: "Editing",
    modalAddTitle: "Add resident",
    modalEditTitle: "Edit resident",
    summary: "At a glance",
    memberSince: "Member since",
    days: (n: number) => `${n} d in the club`,
    circle: "Circle",
    noCircle: "Not set",
    completion: "Profile",
    completionUnknown: "No access",
    email: "Email",
    password: "Password",
    passwordPh: "Password for sign-in",
    fullName: "Full name",
    fullNamePh: "Resident's name",
    location: "Current location",
    locationPh: "City",
    citizenship: "Citizenship",
    citizenshipPh: "Citizenship",
    status: "Status",
    statusCustom: "+ New status…",
    statusCustomPh: "Type a new status",
    kyc: "KYC level",
    kyc0: "Level 0 — not started",
    kyc1: "Level 1 — Identity (passport)",
    kyc2: "Level 2 — Club Loyalty (video)",
    kyc3: "Level 3 — Trust (video call)",
    kycDowngrade: (from: number, to: number) => `KYC downgrade ${from} → ${to}: uploads above level ${to} will be marked rejected`,
    cancel: "Cancel",
    save: "Save",
    create: "Create",
    needEmail: "Enter the new member's email.",
    needPassword: "Set a password (at least 8 characters).",
    saved: "Changes saved",
    created: "Resident created",
    approved: "KYC confirmed — level 3",
    migration: "Migration 20261016 isn't applied yet: the list is read straight from profiles, edits may be blocked by RLS.",
    vaultMissing: "The KYC vault isn't connected yet — apply migration 20261009_profile_kyc_vault so uploads appear here.",
    failed: "Couldn't load the directory",
    retry: "Retry",
    roles: { owner: "Owner", admin: "Admin", manager: "Manager", resident: "Resident", guest: "Guest" } as Record<string, string>,
    footer: "Voyage Private Club — Admin Console · data is stored under strict NDA",
  },
  ru: {
    eyebrow: "Voyage Private Club",
    badge: "Admin",
    title: "Справочник резидентов",
    subtitle: "Анкеты, статусы и подтверждение KYC",
    total: "Профилей",
    verifiedCount: "Подтверждены",
    reviewCount: "Ждут проверки",
    filesCount: "Файлы на проверке",
    search: "Поиск по имени, почте или городу…",
    allStatuses: "Все статусы",
    noStatus: "— Без статуса —",
    kycAll: "Все",
    kycPending: "Ждут KYC",
    kycVerified: "Подтверждены",
    add: "Добавить резидента",
    refresh: "Обновить",
    colResident: "Резидент",
    colLocation: "Локация",
    colCitizenship: "Гражданство",
    colStatus: "Статус",
    colKyc: "KYC",
    colFiles: "Файлы",
    colActions: "Действия",
    unnamed: "Без имени",
    statusNone: "не назначен",
    verified: "Verified",
    approve: "Подтвердить KYC",
    approveShort: "Подтвердить",
    approveLevel: (n: number) => `Подтвердить KYC · уровень ${n}`,
    reviewFirst: "сначала откроется файл",
    approvedLevel: (n: number) => `KYC: уровень ${n} подтверждён`,
    edit: "Редактировать",
    openProfile: "Открыть анкету",
    viewPassport: "Паспорт",
    viewVideo: "Видео",
    founderOnly: "только основатель",
    moreActions: "Действия",
    inReview: "файл на проверке",
    kycSteps: ["Личность", "Лояльность", "Доверие"],
    emptyTitle: "Резиденты не найдены",
    emptyHint: "Попробуйте изменить поиск или фильтр",
    loading: "Открываем справочник…",
    modalNew: "Новая гостья",
    modalEditing: "Редактирование",
    modalAddTitle: "Добавить резидента",
    modalEditTitle: "Анкета резидента",
    summary: "Коротко",
    memberSince: "В клубе с",
    days: (n: number) => `${n} дн. в клубе`,
    circle: "Круг",
    noCircle: "Не назначен",
    completion: "Анкета",
    completionUnknown: "Нет доступа",
    email: "Почта",
    password: "Пароль",
    passwordPh: "Пароль для входа",
    fullName: "Имя",
    fullNamePh: "Имя резидента",
    location: "Текущая локация",
    locationPh: "Город",
    citizenship: "Гражданство",
    citizenshipPh: "Гражданство",
    status: "Статус",
    statusCustom: "+ Новый статус…",
    statusCustomPh: "Введите новый статус",
    kyc: "Уровень KYC",
    kyc0: "Уровень 0 — не пройден",
    kyc1: "Уровень 1 — Identity (паспорт)",
    kyc2: "Уровень 2 — Club Loyalty (видео)",
    kyc3: "Уровень 3 — Trust (видеозвонок)",
    kycDowngrade: (from: number, to: number) => `Понижение KYC ${from} → ${to}: файлы уровней выше ${to} станут «отклонёнными»`,
    cancel: "Отмена",
    save: "Сохранить",
    create: "Создать",
    needEmail: "Укажите почту нового пользователя.",
    needPassword: "Задайте пароль (не короче 8 символов).",
    saved: "Изменения сохранены",
    created: "Резидент создан",
    approved: "KYC подтверждён — уровень 3",
    migration: "Миграция 20261016 ещё не применена: список читается напрямую из profiles, правки может заблокировать RLS.",
    vaultMissing: "Хранилище KYC ещё не подключено — примените миграцию 20261009_profile_kyc_vault, и загрузки появятся здесь.",
    failed: "Не удалось загрузить справочник",
    retry: "Повторить",
    roles: { owner: "Владелец", admin: "Админ", manager: "Менеджер", resident: "Резидент", guest: "Гостья" } as Record<string, string>,
    footer: "Voyage Private Club — консоль администратора · данные хранятся под строгим NDA",
  },
  es: {
    eyebrow: "Voyage Private Club",
    badge: "Admin",
    title: "Directorio de residentes",
    subtitle: "Perfiles, estados y verificación KYC",
    total: "Perfiles",
    verifiedCount: "Verificadas",
    reviewCount: "Por revisar",
    filesCount: "Archivos por revisar",
    search: "Buscar por nombre, correo o ciudad…",
    allStatuses: "Todos los estados",
    noStatus: "— Sin estado —",
    kycAll: "Todos",
    kycPending: "KYC pendiente",
    kycVerified: "Verificadas",
    add: "Añadir residente",
    refresh: "Actualizar",
    colResident: "Residente",
    colLocation: "Ubicación",
    colCitizenship: "Ciudadanía",
    colStatus: "Estado",
    colKyc: "KYC",
    colFiles: "Archivos",
    colActions: "Acciones",
    unnamed: "Sin nombre",
    statusNone: "sin asignar",
    verified: "Verified",
    approve: "Confirmar KYC",
    approveShort: "Aprobar",
    approveLevel: (n: number) => `Confirmar KYC · nivel ${n}`,
    reviewFirst: "primero se abre el archivo",
    approvedLevel: (n: number) => `KYC: nivel ${n} confirmado`,
    edit: "Editar",
    openProfile: "Abrir perfil",
    viewPassport: "Pasaporte",
    viewVideo: "Vídeo",
    founderOnly: "solo el fundador",
    moreActions: "Acciones",
    inReview: "archivo en revisión",
    kycSteps: ["Identidad", "Lealtad", "Confianza"],
    emptyTitle: "No se encontraron residentes",
    emptyHint: "Prueba otra búsqueda o filtro",
    loading: "Abriendo el directorio…",
    modalNew: "Nueva invitada",
    modalEditing: "Edición",
    modalAddTitle: "Añadir residente",
    modalEditTitle: "Perfil de residente",
    summary: "Resumen",
    memberSince: "En el club desde",
    days: (n: number) => `${n} días en el club`,
    circle: "Círculo",
    noCircle: "Sin asignar",
    completion: "Perfil",
    completionUnknown: "Sin acceso",
    email: "Correo",
    password: "Contraseña",
    passwordPh: "Contraseña de acceso",
    fullName: "Nombre",
    fullNamePh: "Nombre de la residente",
    location: "Ubicación actual",
    locationPh: "Ciudad",
    citizenship: "Ciudadanía",
    citizenshipPh: "Ciudadanía",
    status: "Estado",
    statusCustom: "+ Nuevo estado…",
    statusCustomPh: "Escribe un nuevo estado",
    kyc: "Nivel KYC",
    kyc0: "Nivel 0 — sin iniciar",
    kyc1: "Nivel 1 — Identity (pasaporte)",
    kyc2: "Nivel 2 — Club Loyalty (vídeo)",
    kyc3: "Nivel 3 — Trust (videollamada)",
    kycDowngrade: (from: number, to: number) => `Bajada de KYC ${from} → ${to}: los archivos por encima del nivel ${to} quedarán rechazados`,
    cancel: "Cancelar",
    save: "Guardar",
    create: "Crear",
    needEmail: "Indica el correo del nuevo miembro.",
    needPassword: "Define una contraseña (mínimo 8 caracteres).",
    saved: "Cambios guardados",
    created: "Residente creada",
    approved: "KYC confirmado — nivel 3",
    migration: "La migración 20261016 aún no está aplicada: la lista se lee de profiles y RLS puede bloquear los cambios.",
    vaultMissing: "La bóveda KYC aún no está conectada: aplique la migración 20261009_profile_kyc_vault para ver los archivos aquí.",
    failed: "No se pudo cargar el directorio",
    retry: "Reintentar",
    roles: { owner: "Propietario", admin: "Admin", manager: "Gerente", resident: "Residente", guest: "Invitada" } as Record<string, string>,
    footer: "Voyage Private Club — consola de administración · datos bajo estricto NDA",
  },
  pt: {
    eyebrow: "Voyage Private Club",
    badge: "Admin",
    title: "Diretório de residentes",
    subtitle: "Perfis, status e verificação KYC",
    total: "Perfis",
    verifiedCount: "Verificadas",
    reviewCount: "Aguardando revisão",
    filesCount: "Arquivos para revisar",
    search: "Buscar por nome, e-mail ou cidade…",
    allStatuses: "Todos os status",
    noStatus: "— Sem status —",
    kycAll: "Todos",
    kycPending: "KYC pendente",
    kycVerified: "Verificadas",
    add: "Adicionar residente",
    refresh: "Atualizar",
    colResident: "Residente",
    colLocation: "Localização",
    colCitizenship: "Cidadania",
    colStatus: "Status",
    colKyc: "KYC",
    colFiles: "Arquivos",
    colActions: "Ações",
    unnamed: "Sem nome",
    statusNone: "não definido",
    verified: "Verified",
    approve: "Confirmar KYC",
    approveShort: "Aprovar",
    approveLevel: (n: number) => `Confirmar KYC · nível ${n}`,
    reviewFirst: "primeiro abre o arquivo",
    approvedLevel: (n: number) => `KYC: nível ${n} confirmado`,
    edit: "Editar",
    openProfile: "Abrir perfil",
    viewPassport: "Passaporte",
    viewVideo: "Vídeo",
    founderOnly: "só o fundador",
    moreActions: "Ações",
    inReview: "arquivo em análise",
    kycSteps: ["Identidade", "Lealdade", "Confiança"],
    emptyTitle: "Nenhuma residente encontrada",
    emptyHint: "Tente outra busca ou filtro",
    loading: "Abrindo o diretório…",
    modalNew: "Nova convidada",
    modalEditing: "Edição",
    modalAddTitle: "Adicionar residente",
    modalEditTitle: "Perfil da residente",
    summary: "Resumo",
    memberSince: "No clube desde",
    days: (n: number) => `${n} dias no clube`,
    circle: "Círculo",
    noCircle: "Não definido",
    completion: "Perfil",
    completionUnknown: "Sem acesso",
    email: "E-mail",
    password: "Senha",
    passwordPh: "Senha de acesso",
    fullName: "Nome",
    fullNamePh: "Nome da residente",
    location: "Localização atual",
    locationPh: "Cidade",
    citizenship: "Cidadania",
    citizenshipPh: "Cidadania",
    status: "Status",
    statusCustom: "+ Novo status…",
    statusCustomPh: "Digite um novo status",
    kyc: "Nível KYC",
    kyc0: "Nível 0 — não iniciado",
    kyc1: "Nível 1 — Identity (passaporte)",
    kyc2: "Nível 2 — Club Loyalty (vídeo)",
    kyc3: "Nível 3 — Trust (videochamada)",
    kycDowngrade: (from: number, to: number) => `Rebaixamento de KYC ${from} → ${to}: envios acima do nível ${to} serão recusados`,
    cancel: "Cancelar",
    save: "Salvar",
    create: "Criar",
    needEmail: "Informe o e-mail do novo membro.",
    needPassword: "Defina uma senha (mínimo 8 caracteres).",
    saved: "Alterações salvas",
    created: "Residente criada",
    approved: "KYC confirmado — nível 3",
    migration: "A migração 20261016 ainda não foi aplicada: a lista vem direto de profiles e o RLS pode bloquear edições.",
    vaultMissing: "O cofre KYC ainda não está conectado — aplique a migração 20261009_profile_kyc_vault para ver os envios aqui.",
    failed: "Não foi possível carregar o diretório",
    retry: "Tentar de novo",
    roles: { owner: "Proprietário", admin: "Admin", manager: "Gerente", resident: "Residente", guest: "Convidada" } as Record<string, string>,
    footer: "Voyage Private Club — console do administrador · dados sob NDA estrito",
  },
} satisfies Record<Lang, Record<string, unknown>>;

export type DirectoryText = (typeof TEXT)["en"];

export function useDirectoryI18n() {
  const ctx: unknown = useLanguage();
  const lang = normalizeLang(ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>).lang : ctx);
  return { lang, t: TEXT[lang] as DirectoryText };
}

const LOCALE: Record<Lang, string> = { ru: "ru-RU", en: "en-GB", es: "es-ES", pt: "pt-BR" };
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

/* ── Оформление ───────────────────────────────────────────────────── */

const ROLE_BADGE: Record<string, string> = {
  owner: "border-amber-300/40 bg-amber-200/[0.08] text-amber-200",
  admin: "border-amber-200/25 bg-amber-200/[0.05] text-amber-200/80",
  manager: "border-sky-300/20 bg-sky-400/[0.05] text-sky-200/80",
  resident: "border-zinc-700/70 bg-zinc-800/40 text-zinc-400",
  guest: "border-zinc-700/50 bg-transparent text-zinc-500",
};

const INPUT =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-amber-200/40 focus-visible:ring-1 focus-visible:ring-amber-200/20";

const STYLES = `
.dir-root { container-type: inline-size; }
.dir-toolbar { display: grid; gap: .75rem; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 760px) { .dir-toolbar { grid-template-columns: minmax(0, 1fr) 12rem auto auto; align-items: center; } }
.dir-stats { display: grid; gap: .625rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
@container (min-width: 640px) { .dir-stats { gap: .75rem; grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.dir-head { display: none; }
/* узко — карточка: имя и «⋯», локация, статус + KYC, ряд файлов */
.dir-row {
  display: grid; gap: .7rem .75rem; padding: 1rem;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: "who menu" "meta meta" "status kyc" "files files";
  align-items: center;
}
.dir-who { grid-area: who; min-width: 0; }
.dir-menu { grid-area: menu; justify-self: end; align-self: start; }
.dir-meta { grid-area: meta; display: flex; flex-wrap: wrap; gap: .35rem 1rem; min-width: 0; }
.dir-status { grid-area: status; min-width: 0; }
.dir-kyc { grid-area: kyc; justify-self: end; }
.dir-files { grid-area: files; display: flex; flex-wrap: wrap; gap: .5rem; }
.dir-files:empty { display: none; }
.dir-loc, .dir-cit { min-width: 0; }
@container (min-width: 920px) {
  .dir-head, .dir-row {
    display: grid; gap: 1rem; padding: .85rem 1.25rem;
    grid-template-columns: minmax(0, 2.2fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.1fr) 6.25rem 5.25rem 2.75rem;
    grid-template-areas: "who loc cit status kyc files menu";
  }
  .dir-meta { display: contents; }
  .dir-loc { grid-area: loc; } .dir-cit { grid-area: cit; }
  .dir-kyc { justify-self: start; }
  .dir-menu { align-self: center; }
  .dir-files { flex-wrap: nowrap; gap: .375rem; }
  .dir-files .dir-lbl { display: none; }
}
`;

/* ── Хуки ─────────────────────────────────────────────────────────── */

const NARROW = "(max-width: 639px)";
const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
function useNarrow() {
  return useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
}

/** Заполненность анкеты по запросу (undefined — грузится, null — нет доступа) */
function useCompletion(id: string) {
  const [state, setState] = useState<{ id: string; value: number | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, location, citizenship, birth_date, height, weight, measurements, about, photo_urls, kyc_level")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error("[Directory] completion:", error.message);
      setState({ id, value: data ? profileCompletion(data as Record<string, unknown>) : null });
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);
  return state && state.id === id ? state.value : undefined;
}

/* ── Мелкие элементы ──────────────────────────────────────────────── */

function initials(name: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function Avatar({ src, name, size = "md" }: { src: string | null; name: string | null; size?: "md" | "lg" }) {
  const [broken, setBroken] = useState(false);
  const box = size === "lg" ? "h-12 w-12" : "h-10 w-10";
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700/60 bg-zinc-900`}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : initials(name) ? (
        <span className="text-xs font-medium tracking-wide text-zinc-400">{initials(name)}</span>
      ) : (
        <User size={16} strokeWidth={1.5} className="text-zinc-500" aria-hidden />
      )}
    </span>
  );
}

/**
 * KYC — три ступени. Зелёная галочка только у реально подтверждённого
 * уровня (0 → ни одной). Янтарная — следующий уровень, файл ждёт проверки.
 */
function KycBadge({ level, pending = null, t }: { level: number; pending?: number | null; t: DirectoryText }) {
  const lvl = clampKyc(level);
  const label = `KYC ${lvl} / 3${pending ? ` · ${t.inReview}` : ""}`;
  return (
    <span className="inline-flex items-center gap-1" title={label} aria-label={label}>
      {[1, 2, 3].map((n) => {
        const reached = lvl >= n;
        const review = !reached && pending === n;
        return (
          <span
            key={n}
            title={`${n} · ${t.kycSteps[n - 1]}`}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-[11px] font-semibold transition-colors ${
              reached
                ? "border-emerald-700/40 bg-emerald-950/40 text-emerald-300/90 shadow-[0_0_8px_rgba(16,185,129,0.12)]"
                : review
                  ? "border-amber-300/40 bg-amber-300/[0.08] text-amber-200 shadow-[0_0_8px_rgba(212,168,83,0.18)]"
                  : "border-zinc-800/60 bg-zinc-900/50 text-zinc-600"
            }`}
          >
            {reached ? <Check size={13} strokeWidth={2} aria-hidden /> : review ? <Hourglass size={12} strokeWidth={1.8} aria-hidden /> : n}
          </span>
        );
      })}
    </span>
  );
}

function FileButton({
  Icon,
  label,
  ariaLabel,
  pending,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  ariaLabel: string;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={ariaLabel}
      aria-label={ariaLabel}
      className={`relative inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/40 ${
        pending
          ? "border-amber-300/40 bg-amber-300/[0.07] text-amber-100 hover:bg-amber-300/[0.12]"
          : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
      }`}
    >
      <Icon size={15} strokeWidth={1.5} aria-hidden />
      <span className="dir-lbl">{label}</span>
      {pending && (
        <span aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-zinc-950 bg-amber-300" />
      )}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

/* ── Меню «⋯» ─────────────────────────────────────────────────────── */

type MenuItem = {
  key: string;
  label: string;
  Icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  hint?: string;
  tone?: "default" | "positive";
};

/** Десктоп — поповер у кнопки; телефон — шторка снизу. Через портал: таблица с overflow не обрежет. */
function RowMenu({ label, title, items }: { label: string; title: string; items: MenuItem[] }) {
  const narrow = useNarrow();
  const menuId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 16 });

  const close = useCallback((focusBack = true) => {
    setOpen(false);
    if (focusBack) btn.current?.focus();
  }, []);

  const toggle = () => {
    if (open) return close();
    const r = btn.current?.getBoundingClientRect();
    if (r) {
      const estimate = items.length * 48 + 16;
      const below = window.innerHeight - r.bottom;
      const right = Math.max(8, window.innerWidth - r.right);
      setPos(below < estimate + 12 && r.top > below ? { bottom: window.innerHeight - r.top + 6, right } : { top: r.bottom + 6, right });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const nodes = [...(list.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
        if (!nodes.length) return;
        const i = nodes.indexOf(document.activeElement as HTMLButtonElement);
        nodes[(i + (e.key === "ArrowDown" ? 1 : -1) + nodes.length) % nodes.length]?.focus();
      }
      if (e.key === "Tab") close(false);
    };
    const onMove = () => close(false);

    document.addEventListener("keydown", onKey);
    if (!narrow) {
      window.addEventListener("scroll", onMove, true);
      window.addEventListener("resize", onMove);
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, narrow, close]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${label}: ${title}`}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-zinc-400 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/40 ${
          open ? "border-amber-200/40 bg-amber-200/[0.08] text-amber-100" : "border-zinc-800 hover:border-zinc-700 hover:text-zinc-100"
        }`}
      >
        <MoreHorizontal size={16} strokeWidth={1.6} aria-hidden />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[65]"
            onPointerDown={(e) => {
              if (!list.current?.contains(e.target as Node)) close(false);
            }}
          >
            {narrow && <div aria-hidden className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />}
            <div
              ref={list}
              id={menuId}
              role="menu"
              aria-label={`${label}: ${title}`}
              style={narrow ? undefined : pos}
              className={
                narrow
                  ? "absolute inset-x-0 bottom-0 rounded-t-[22px] border-t border-amber-200/20 bg-zinc-950 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-24px_60px_-10px_rgba(0,0,0,0.8)]"
                  : "absolute min-w-[16rem] max-w-[20rem] rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-md"
              }
            >
              {narrow && (
                <>
                  <div aria-hidden className="mx-auto mb-3 h-1 w-[38px] rounded-full bg-white/15" />
                  <p className={`${cormorant.className} mb-2 truncate px-2 text-xl text-zinc-100`}>{title}</p>
                </>
              )}
              {items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  role="menuitem"
                  disabled={it.disabled}
                  onClick={() => {
                    close(false);
                    it.onSelect();
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 text-left transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
                    narrow ? "min-h-12" : "min-h-10"
                  } ${
                    it.tone === "positive"
                      ? "text-emerald-200 hover:bg-emerald-950/40 focus-visible:bg-emerald-950/40"
                      : "text-zinc-200 hover:bg-zinc-900 focus-visible:bg-zinc-900"
                  }`}
                >
                  <it.Icon size={15} strokeWidth={1.5} aria-hidden className="shrink-0 opacity-80" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{it.label}</span>
                    {it.hint && <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-zinc-500">{it.hint}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ── Сводка в анкете ──────────────────────────────────────────────── */

function ResidentSummary({
  r,
  t,
  lang,
  submissions,
  canViewPassport,
  onViewKyc,
}: {
  r: DirectoryResident;
  t: DirectoryText;
  lang: Lang;
  submissions: readonly KycSubmission[] | undefined;
  canViewPassport: boolean;
  onViewKyc: (level: KycLevelWithFile) => void;
}) {
  const completion = useCompletion(r.id);
  const skin = r.circleKey ? skinFor(r.circleKey) : null;
  const rank = r.circleKey ? CIRCLE_ORDER.indexOf(r.circleKey) : -1;
  const pending = pendingLevelFor(submissions, r.kycLevel);

  const since = r.createdAt ? new Date(r.createdAt) : null;
  const sinceOk = since && !Number.isNaN(since.getTime());
  const days = sinceOk ? Math.max(0, Math.floor((Date.now() - since.getTime()) / 86_400_000)) : null;
  const role = r.role ?? "resident";

  const tile = "min-w-0 rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-2.5 py-2 sm:px-3 sm:py-2.5";
  const dt = "truncate text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-500";

  return (
    <section
      aria-label={t.summary}
      className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 sm:p-4"
    >
      {skin && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-32 w-40 rounded-full blur-2xl"
          style={{ background: skin.glow, opacity: 0.35 }}
        />
      )}

      <div className="relative flex items-center gap-3">
        <Avatar src={r.avatar} name={r.fullName} size="lg" />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2">
            <span className={`${cormorant.className} truncate text-xl font-medium text-zinc-50`}>{r.fullName ?? t.unnamed}</span>
            {role !== "resident" && (
              <span className={`shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.14em] ${ROLE_BADGE[role] ?? ROLE_BADGE.guest}`}>
                {t.roles[role] ?? role}
              </span>
            )}
          </p>
          <p className="truncate font-mono text-[10px] text-zinc-500">{r.email ?? r.id}</p>
        </div>
      </div>

      <dl className="relative mt-3.5 grid grid-cols-3 gap-2">
        <div className={tile}>
          <dt className={dt}>{t.memberSince}</dt>
          <dd className={`${cormorant.className} mt-0.5 truncate text-base text-zinc-100 sm:text-[17px]`}>
            {sinceOk ? since.toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short", year: "numeric" }) : "—"}
          </dd>
          {days !== null && <dd className="truncate text-[10px] text-zinc-500">{t.days(days)}</dd>}
        </div>

        <div className={tile}>
          <dt className={dt}>{t.circle}</dt>
          <dd
            className={`${cormorant.className} mt-0.5 truncate text-base italic sm:text-[17px]`}
            style={{ color: skin?.accent ?? "#a1a1aa" }}
          >
            {r.circleTitle ?? t.noCircle}
          </dd>
          {rank >= 0 && <dd className="text-[10px] tracking-[0.2em] text-zinc-500">{ROMAN[rank]} / VI</dd>}
        </div>

        <div className={tile}>
          <dt className={dt}>{t.completion}</dt>
          {completion === undefined ? (
            <dd className="mt-1.5">
              <Loader2 size={14} className="animate-spin text-zinc-600" aria-hidden />
            </dd>
          ) : completion === null ? (
            <dd className="mt-0.5 truncate text-xs text-zinc-500">{t.completionUnknown}</dd>
          ) : (
            <>
              <dd className={`${cormorant.className} mt-0.5 text-base tabular-nums text-amber-100 sm:text-[17px]`}>{completion}%</dd>
              <dd aria-hidden className="mt-1 h-[3px] overflow-hidden rounded-full bg-zinc-800">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-[#d4a853] via-[#f0d78c] to-[#d4a853]"
                  style={{ width: `${completion}%` }}
                />
              </dd>
            </>
          )}
        </div>
      </dl>

      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2.5 border-t border-zinc-800/60 pt-3">
        <KycBadge level={r.kycLevel} pending={pending} t={t} />
        <div className="flex gap-2">
          {canViewPassport && hasFile(submissions, 1) && (
            <FileButton Icon={FileText} label={t.viewPassport} ariaLabel={t.viewPassport} pending={pending === 1} onClick={() => onViewKyc(1)} />
          )}
          {hasFile(submissions, 2) && (
            <FileButton Icon={PlaySquare} label={t.viewVideo} ariaLabel={t.viewVideo} pending={pending === 2} onClick={() => onViewKyc(2)} />
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Модалка анкеты ───────────────────────────────────────────────── */

function ResidentModal({
  t,
  lang,
  initial,
  statusOptions,
  saving,
  submissions,
  canViewPassport,
  suspended,
  onViewKyc,
  onClose,
  onSubmit,
}: {
  t: DirectoryText;
  lang: Lang;
  initial: DirectoryResident | null;
  statusOptions: string[];
  saving: boolean;
  submissions: readonly KycSubmission[] | undefined;
  canViewPassport: boolean;
  /** поверх открыт просмотрщик KYC — Esc принадлежит ему */
  suspended: boolean;
  onViewKyc: (level: KycLevelWithFile) => void;
  onClose: () => void;
  onSubmit: (draft: ResidentDraft) => Promise<boolean>;
}) {
  const isNew = !initial;
  const CUSTOM = "__custom__";
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [citizenship, setCitizenship] = useState(initial?.citizenship ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [statusChoice, setStatusChoice] = useState(initial?.status ?? "");
  const [customStatus, setCustomStatus] = useState("");
  const [kycLevel, setKycLevel] = useState(clampKyc(initial?.kycLevel ?? 0));
  const [formError, setFormError] = useState<string | null>(null);

  // уровень подтвердили в просмотрщике — селект следует за ним
  const liveKyc = initial ? clampKyc(initial.kycLevel) : null;
  const [seenKyc, setSeenKyc] = useState(liveKyc);
  if (liveKyc !== seenKyc) {
    setSeenKyc(liveKyc);
    if (liveKyc !== null) setKycLevel(liveKyc);
  }

  const known = useMemo(() => {
    const set = new Set(statusOptions);
    if (initial?.status) set.add(initial.status);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [statusOptions, initial?.status]);

  useEffect(() => {
    if (suspended) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving, suspended]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNew && !/^\S+@\S+\.\S+$/.test(email.trim())) return setFormError(t.needEmail);
    if (isNew && password.length < 8) return setFormError(t.needPassword);
    setFormError(null);
    const ok = await onSubmit({
      id: initial?.id ?? null,
      fullName,
      location,
      citizenship,
      status: statusChoice === CUSTOM ? customStatus : statusChoice,
      kycLevel,
      email: email.trim(),
      password,
    });
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dir-modal-title"
        className="relative flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-amber-200/15 bg-zinc-950 shadow-2xl shadow-black/60 sm:max-h-[92dvh] sm:rounded-2xl"
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-[38px] rounded-full bg-white/15 sm:hidden" />
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800/70 px-5 pb-4 pt-4 sm:px-6 sm:pt-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-600">{isNew ? t.modalNew : t.modalEditing}</p>
            <h3 id="dir-modal-title" className={`${cormorant.className} mt-1 text-2xl font-medium text-zinc-50`}>
              {isNew ? t.modalAddTitle : t.modalEditTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            aria-label={t.cancel}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-200"
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {initial && (
            <ResidentSummary
              r={initial}
              t={t}
              lang={lang}
              submissions={submissions}
              canViewPassport={canViewPassport}
              onViewKyc={onViewKyc}
            />
          )}
          {isNew && (
            <>
              <Field label={t.email}>
                <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="resident@example.com" className={INPUT} />
              </Field>
              <Field label={t.password}>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.passwordPh} autoComplete="new-password" className={INPUT} />
              </Field>
              <div className="h-px bg-zinc-800/60" />
            </>
          )}
          <Field label={t.fullName}>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.fullNamePh} className={INPUT} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.location}>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t.locationPh} className={INPUT} />
            </Field>
            <Field label={t.citizenship}>
              <input value={citizenship} onChange={(e) => setCitizenship(e.target.value)} placeholder={t.citizenshipPh} className={INPUT} />
            </Field>
          </div>
          <Field label={t.status}>
            <span className="relative block">
              <select value={statusChoice} onChange={(e) => setStatusChoice(e.target.value)} className={`${INPUT} cursor-pointer appearance-none pr-9`}>
                <option value="">{t.noStatus}</option>
                {known.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value={CUSTOM}>{t.statusCustom}</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600" aria-hidden />
            </span>
            {statusChoice === CUSTOM && (
              <input autoFocus value={customStatus} onChange={(e) => setCustomStatus(e.target.value)} placeholder={t.statusCustomPh} className={`${INPUT} mt-2`} />
            )}
          </Field>
          <Field label={t.kyc}>
            <span className="relative block">
              <select value={String(kycLevel)} onChange={(e) => setKycLevel(clampKyc(e.target.value))} className={`${INPUT} cursor-pointer appearance-none pr-9`}>
                <option value="0">{t.kyc0}</option>
                <option value="1">{t.kyc1}</option>
                <option value="2">{t.kyc2}</option>
                <option value="3">{t.kyc3}</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600" aria-hidden />
            </span>
            {liveKyc !== null && kycLevel < liveKyc && (
              <span role="status" className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-rose-300/90">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
                {t.kycDowngrade(liveKyc, kycLevel)}
              </span>
            )}
          </Field>
          {formError && (
            <p role="alert" className="flex items-start gap-2 text-xs text-red-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
              {formError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-800/70 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-4">
          <button type="button" onClick={() => !saving && onClose()} className="min-h-11 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-100">
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-amber-200/40 bg-amber-200/[0.1] px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100 transition-colors hover:bg-amber-200/[0.16] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} aria-hidden />}
            {isNew ? t.create : t.save}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Страница ─────────────────────────────────────────────────────── */

export default function DirectoryClient({
  residents,
  initialKyc = "all",
  refreshing = false,
  migrationMissing = false,
  viewer = { id: null, email: null, role: null },
  onRefresh,
  onSave,
  onApprove,
  onReject,
}: {
  residents: DirectoryResident[];
  initialKyc?: KycFilter;
  refreshing?: boolean;
  migrationMissing?: boolean;
  /** кто смотрит: паспорта — только role = owner; email — в водяной знак */
  viewer?: DirectoryViewer;
  onRefresh: () => void;
  /** null — успех, строка — текст ошибки */
  onSave: (draft: ResidentDraft) => Promise<string | null>;
  /** выставить уровень KYC (подтверждение следующего шага); null — успех */
  onApprove: (id: string, level: number) => Promise<string | null>;
  /** отклонить файл; если уровень уже пройден — KYC опускается до level − 1 */
  onReject: (id: string, submissionId: string, level: number) => Promise<string | null>;
}) {
  const { t, lang } = useDirectoryI18n();
  const kyc = useKycSubmissions();
  const canViewPassport = viewer.role === "owner";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kycFilter, setKycFilter] = useState<KycFilter>(initialKyc);
  const [modal, setModal] = useState<{ open: boolean; editingId: string | null }>({ open: false, editingId: null });
  const [vault, setVault] = useState<{ id: string; level: KycLevelWithFile } | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  // initialKyc меняется из адресной строки — подхватываем без эффекта
  const [seenInitial, setSeenInitial] = useState(initialKyc);
  if (seenInitial !== initialKyc) {
    setSeenInitial(initialKyc);
    setKycFilter(initialKyc);
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

  // всегда свежая запись резидента (после подтверждения уровня и т.п.)
  const byId = useMemo(() => new Map(residents.map((r) => [r.id, r])), [residents]);
  const editing = modal.editingId ? (byId.get(modal.editingId) ?? null) : null;
  const vaultResident = vault ? (byId.get(vault.id) ?? null) : null;

  const statusOptions = useMemo(
    () => [...new Set(residents.map((r) => r.status).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b)),
    [residents],
  );

  const pendingOf = useCallback(
    (r: DirectoryResident) => pendingLevelFor(kyc.byProfile[r.id], r.kycLevel),
    [kyc.byProfile],
  );

  const counts = useMemo(
    () => ({
      total: residents.length,
      verified: residents.filter((r) => !isStaff(r.role) && r.kycLevel >= 3).length,
      review: residents.filter(needsReview).length,
      files: residents.filter((r) => !isStaff(r.role) && pendingOf(r) !== null).length,
    }),
    [residents, pendingOf],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = residents.filter((r) => {
      if (q && ![r.fullName, r.email, r.location, r.citizenship].some((v) => (v ?? "").toLowerCase().includes(q))) return false;
      if (statusFilter === "__none__" && r.status) return false;
      if (statusFilter !== "all" && statusFilter !== "__none__" && r.status !== statusFilter) return false;
      if (kycFilter === "pending" && !needsReview(r)) return false;
      if (kycFilter === "verified" && !(r.kycLevel >= 3 && !isStaff(r.role))) return false;
      return true;
    });
    // «Ждут KYC»: сверху те, у кого лежит файл на проверке
    if (kycFilter === "pending") {
      return list
        .map((r, i) => ({ r, i, p: pendingOf(r) !== null ? 0 : 1 }))
        .sort((a, b) => a.p - b.p || a.i - b.i)
        .map((x) => x.r);
    }
    return list;
  }, [residents, search, statusFilter, kycFilter, pendingOf]);

  const save = async (draft: ResidentDraft) => {
    setSaving(true);
    const err = await onSave(draft);
    setSaving(false);
    setToast(err ? { ok: false, text: err } : { ok: true, text: draft.id ? t.saved : t.created });
    if (!err) kyc.reload(); // понижение уровня меняет статусы заявок
    return !err;
  };

  const approve = useCallback(
    async (id: string, level: number) => {
      const err = await onApprove(id, level);
      setToast(err ? { ok: false, text: err } : { ok: true, text: t.approvedLevel(level) });
      if (!err) kyc.reload();
      return err;
    },
    [onApprove, t, kyc],
  );

  const reject = useCallback(
    async (id: string, submissionId: string, level: number) => {
      const err = await onReject(id, submissionId, level);
      if (err) setToast({ ok: false, text: err });
      else kyc.reload();
      return err;
    },
    [onReject, kyc],
  );

  const openModal = useCallback((r: DirectoryResident | null) => setModal({ open: true, editingId: r?.id ?? null }), []);
  const closeModal = useCallback(() => setModal({ open: false, editingId: null }), []);
  const openVault = useCallback((r: DirectoryResident, level: KycLevelWithFile) => setVault({ id: r.id, level }), []);
  const closeVault = useCallback(() => setVault(null), []);

  const menuFor = (r: DirectoryResident): MenuItem[] => {
    const subs = kyc.byProfile[r.id];
    const next = r.kycLevel + 1;
    const visible = (lvl: KycLevelWithFile) => (lvl === 1 ? canViewPassport : true) && hasFile(subs, lvl);
    const items: MenuItem[] = [
      { key: "open", label: t.openProfile, Icon: Pencil, onSelect: () => openModal(r) },
      {
        key: "passport",
        label: t.viewPassport,
        Icon: canViewPassport ? FileText : Lock,
        onSelect: () => openVault(r, 1),
        disabled: !visible(1),
        hint: canViewPassport ? undefined : t.founderOnly,
      },
      { key: "video", label: t.viewVideo, Icon: PlaySquare, onSelect: () => openVault(r, 2), disabled: !visible(2) },
    ];
    if (r.kycLevel < 3) {
      // для уровней с файлом — подтверждение только после просмотра
      const viaFile = (next === 1 || next === 2) && visible(next);
      items.push({
        key: "approve",
        label: t.approveLevel(next),
        Icon: Check,
        tone: "positive",
        hint: viaFile ? t.reviewFirst : undefined,
        onSelect: () => (viaFile ? openVault(r, next as KycLevelWithFile) : void approve(r.id, next)),
      });
    }
    return items;
  };

  const kycTabs: Array<{ key: KycFilter; label: string }> = [
    { key: "all", label: t.kycAll },
    { key: "pending", label: t.kycPending },
    { key: "verified", label: t.kycVerified },
  ];

  return (
    <div className="min-h-screen overflow-x-clip bg-zinc-950 text-zinc-100">
      <style>{STYLES}</style>
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-[10%] -top-[20%] h-[50%] w-[50%] rounded-full bg-[radial-gradient(circle,rgba(212,168,83,0.08)_0%,transparent_70%)]" />
      </div>

      <div className="dir-root relative mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-8 sm:pt-14">
        {/* ── Заголовок ── */}
        <header className="mb-7 sm:mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Crown size={18} strokeWidth={1.4} className="text-amber-200/70" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">{t.eyebrow}</span>
            <span className="rounded-full border border-amber-200/30 bg-amber-200/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
              {t.badge}
            </span>
          </div>
          <h1 className={`${cormorant.className} text-[34px] font-medium leading-[1.05] tracking-wide text-zinc-50 sm:text-5xl`}>{t.title}</h1>
          <p className="mt-2 text-sm text-zinc-500">{t.subtitle}</p>
        </header>

        {migrationMissing && (
          <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200/20 bg-amber-200/[0.04] px-4 py-3 text-xs text-amber-100/80">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            {t.migration}
          </p>
        )}
        {kyc.loaded && !kyc.available && (
          <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200/20 bg-amber-200/[0.04] px-4 py-3 text-xs text-amber-100/80">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            {t.vaultMissing}
          </p>
        )}

        {/* ── Счётчики ── */}
        <div className="dir-stats mb-6">
          {[
            { label: t.total, value: counts.total, tone: "text-zinc-50", on: () => setKycFilter("all") },
            { label: t.verifiedCount, value: counts.verified, tone: "text-emerald-300/90", on: () => setKycFilter("verified") },
            { label: t.reviewCount, value: counts.review, tone: "text-amber-200", on: () => setKycFilter("pending") },
            { label: t.filesCount, value: counts.files, tone: "text-amber-100", on: () => setKycFilter("pending"), dot: counts.files > 0 },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.on}
              className="relative rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-3.5 py-3 text-left backdrop-blur-md transition-colors hover:border-amber-200/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30 sm:px-4"
            >
              {"dot" in s && s.dot && (
                <span aria-hidden className="absolute right-3 top-3 h-2 w-2 animate-pulse rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.6)]" />
              )}
              <span className={`${cormorant.className} block text-[28px] font-medium leading-none lining-nums tabular-nums sm:text-3xl ${s.tone}`}>{s.value}</span>
              <span className="mt-1.5 block truncate text-[10px] uppercase tracking-[0.16em] text-zinc-500">{s.label}</span>
            </button>
          ))}
        </div>

        {/* ── Панель ── */}
        <div className="dir-toolbar mb-5 rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-3 backdrop-blur-md">
          <label className="relative block">
            <span className="sr-only">{t.search}</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" aria-hidden />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} className={`${INPUT} pl-9`} />
          </label>
          <span className="relative block">
            <select aria-label={t.colStatus} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${INPUT} cursor-pointer appearance-none pr-9`}>
              <option value="all">{t.allStatuses}</option>
              <option value="__none__">{t.noStatus}</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600" aria-hidden />
          </span>
          <div role="tablist" aria-label="KYC" className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1">
            {kycTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={kycFilter === tab.key}
                onClick={() => setKycFilter(tab.key)}
                className={`min-h-9 flex-1 whitespace-nowrap rounded-md px-3 text-xs transition-colors ${
                  kycFilter === tab.key ? "bg-amber-200/[0.12] text-amber-100" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onRefresh();
                kyc.reload();
              }}
              aria-label={t.refresh}
              title={t.refresh}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
            >
              <RefreshCw size={15} strokeWidth={1.5} className={refreshing ? "animate-spin" : ""} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => openModal(null)}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-200/30 bg-amber-200/[0.08] px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100 transition-colors hover:bg-amber-200/[0.14]"
            >
              <Plus size={14} aria-hidden />
              {t.add}
            </button>
          </div>
        </div>

        <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-zinc-600">
          {filtered.length} / {residents.length}
        </p>

        {/* ── Список ── */}
        <div className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/30 backdrop-blur-md">
          <div className="dir-head border-b border-zinc-800/70 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
            <span style={{ gridArea: "who" }}>{t.colResident}</span>
            <span style={{ gridArea: "loc" }}>{t.colLocation}</span>
            <span style={{ gridArea: "cit" }}>{t.colCitizenship}</span>
            <span style={{ gridArea: "status" }}>{t.colStatus}</span>
            <span style={{ gridArea: "kyc" }}>{t.colKyc}</span>
            <span style={{ gridArea: "files" }}>{t.colFiles}</span>
            <span style={{ gridArea: "menu" }} className="sr-only">
              {t.colActions}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-600">
                <Search size={18} aria-hidden />
              </span>
              <p className="text-sm text-zinc-400">{t.emptyTitle}</p>
              <p className="mt-1 text-[11px] text-zinc-600">{t.emptyHint}</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800/50">
              {filtered.map((r) => {
                const role = r.role ?? "resident";
                const name = r.fullName ?? t.unnamed;
                const subs = kyc.byProfile[r.id];
                const pending = pendingOf(r);
                const showPassport = canViewPassport && hasFile(subs, 1);
                const showVideo = hasFile(subs, 2);
                return (
                  <li key={r.id} className="dir-row relative transition-colors hover:bg-zinc-900/40">
                    {/* вся строка кликабельна: растянутая кнопка имени */}
                    <div className="dir-who flex items-center gap-3">
                      <Avatar src={r.avatar} name={r.fullName} />
                      <div className="min-w-0">
                        <p className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openModal(r)}
                            className={`truncate text-left text-sm tracking-wide after:absolute after:inset-0 after:rounded-[inherit] focus:outline-none focus-visible:after:ring-1 focus-visible:after:ring-inset focus-visible:after:ring-amber-200/40 ${
                              r.fullName ? "text-zinc-100" : "text-zinc-600"
                            }`}
                          >
                            {name}
                          </button>
                          {role !== "resident" && (
                            <span className={`shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.14em] ${ROLE_BADGE[role] ?? ROLE_BADGE.guest}`}>
                              {t.roles[role] ?? role}
                            </span>
                          )}
                        </p>
                        <p className="truncate font-mono text-[10px] text-zinc-600">{r.email ?? r.id.slice(0, 8)}</p>
                      </div>
                    </div>

                    <div className="dir-meta text-sm text-zinc-300">
                      <span className="dir-loc inline-flex min-w-0 items-center gap-1.5">
                        {r.location ? (
                          <>
                            <MapPin size={12} className="shrink-0 text-zinc-500" aria-hidden />
                            <span className="truncate">{r.location}</span>
                          </>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </span>
                      <span className="dir-cit inline-flex min-w-0 items-center gap-1.5">
                        {r.citizenship ? (
                          <>
                            <Flag size={12} className="shrink-0 text-zinc-500" aria-hidden />
                            <span className="truncate">{r.citizenship}</span>
                          </>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </span>
                    </div>

                    <div className="dir-status">
                      {r.status ? (
                        <span className={`${cormorant.className} block truncate text-base tracking-wide text-amber-200/90`}>{r.status}</span>
                      ) : (
                        <span className="text-[11px] tracking-wide text-zinc-600">{t.statusNone}</span>
                      )}
                    </div>

                    <div className="dir-kyc">
                      <KycBadge level={r.kycLevel} pending={pending} t={t} />
                    </div>

                    <div className="dir-files relative z-[1]">
                      {showPassport && (
                        <FileButton
                          Icon={FileText}
                          label={t.viewPassport}
                          ariaLabel={`${t.viewPassport}: ${name}`}
                          pending={pending === 1}
                          onClick={() => openVault(r, 1)}
                        />
                      )}
                      {showVideo && (
                        <FileButton
                          Icon={PlaySquare}
                          label={t.viewVideo}
                          ariaLabel={`${t.viewVideo}: ${name}`}
                          pending={pending === 2}
                          onClick={() => openVault(r, 2)}
                        />
                      )}
                    </div>

                    <div className="dir-menu relative z-[1]">
                      <RowMenu label={t.moreActions} title={name} items={menuFor(r)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="mt-10 border-t border-zinc-900 pt-6 text-center text-[10px] uppercase tracking-[0.2em] text-zinc-700">{t.footer}</footer>
      </div>

      {modal.open && (
        <ResidentModal
          key={modal.editingId ?? "new"}
          t={t}
          lang={lang}
          initial={editing}
          statusOptions={statusOptions}
          saving={saving}
          submissions={editing ? kyc.byProfile[editing.id] : undefined}
          canViewPassport={canViewPassport}
          suspended={vault !== null}
          onViewKyc={(level) => editing && openVault(editing, level)}
          onClose={closeModal}
          onSubmit={save}
        />
      )}

      {vault && vaultResident && (
        <KycViewer
          key={`${vault.id}-${vault.level}`}
          lang={lang}
          resident={{ id: vaultResident.id, fullName: vaultResident.fullName, kycLevel: clampKyc(vaultResident.kycLevel) }}
          submissions={kyc.byProfile[vault.id] ?? []}
          initialLevel={!canViewPassport && vault.level === 1 ? 2 : vault.level}
          canViewPassport={canViewPassport}
          viewer={{ id: viewer.id, email: viewer.email }}
          serif={cormorant.className}
          onClose={closeVault}
          onApprove={(level) => approve(vaultResident.id, level)}
          onReject={(submissionId, level) => reject(vaultResident.id, submissionId, level)}
          onChanged={kyc.reload}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 z-[80] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 md:bottom-6 md:left-[calc(50%+9rem)]">
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
              toast.ok ? "border-amber-200/30 bg-zinc-900/95 text-amber-50" : "border-red-500/30 bg-zinc-900/95 text-red-200"
            }`}
          >
            {toast.ok ? <BadgeCheck size={16} className="shrink-0 text-amber-200" aria-hidden /> : <AlertTriangle size={16} className="shrink-0 text-red-300" aria-hidden />}
            <span className="min-w-0">{toast.text}</span>
            <button type="button" onClick={() => setToast(null)} aria-label={t.cancel} className="ml-1 shrink-0 text-zinc-500 hover:text-zinc-200">
              <X size={13} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
