"use client";
import MyApplications from "@/app/components/MyApplications";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  CheckCircle2,
  Shield,
  Eye,
  EyeOff,
  Wallet,
  User,
  MapPin,
  Flag,
  Calendar,
  Ruler,
  Weight,
  Activity,
  Cigarette,
  Wine,
  AlignLeft,
  Crown,
  Camera,
  Image as ImageIcon,
  Plus,
  Loader2,
  X,
} from "lucide-react";

import { useAuth } from "@/app/context/AuthContext";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import { fmtPoints, type CircleConfig, type CircleKey } from "@/lib/gamification";

import { cormorant } from "@/app/components/profile/fonts";
import { useClubStanding } from "@/app/components/profile/useClubStanding";
import {
  CIRCLE_ORDER,
  ClubCardholder,
  formatMemberNo,
  sinceRoman,
  skinFor,
  toRoman,
} from "@/app/components/profile/ClubCardholder";
import { AchievementShelf, type AchievementKey } from "@/app/components/profile/AchievementShelf";
import { KycSection } from "@/app/components/profile/KycSection";

/* ──────────────────────────────────────────────────────────────────────
 * ПРИМЕЧАНИЯ ПО АРХИТЕКТУРЕ
 *
 * 1. Бакет `user-uploads` приватный, поэтому в колонке `photo_urls` мы
 *    храним ПУТИ к файлам (`${user.id}/${file.name}`), а для показа
 *    генерируем временные signed URL через createSignedUrls(). Если в
 *    массиве уже лежат полные http-ссылки — они используются как есть.
 *
 * 2. Имя и аватар берутся ТОЛЬКО из AuthContext (user.fullName / user.avatarUrl)
 *    и редактируются на странице настроек. Здесь они read-only.
 *    `photo_urls` — отдельный массив портфолио, к аватару отношения не имеет.
 *
 * 3. `height` / `weight` сохраняются как «сырые» значения из инпута.
 *    Единицы (cm / kg) показываются отдельно и НЕ пишутся в БД.
 *
 * 4. Для записи нужны корректные RLS-политики на таблице `profiles`
 *    и на бакете `user-uploads`.
 *
 * 5. Кардхолдер красится по Circle из v_global_leaderboard (useClubStanding,
 *    realtime) — тот же расчёт, что в «Паспорте» и лидерборде.
 *
 * 6. kyc_level, achievements, status, usdt_wallet и role меняет только
 *    персонал клуба — это гарантирует триггер в БД
 *    (миграция 20261009_profile_kyc_vault.sql), а не только интерфейс.
 *    Документы KYC — в приватном бакете `kyc-vault` (см. KycSection).
 * ──────────────────────────────────────────────────────────────────── */

/** Временный запасной доступ — пока у этого аккаунта нет роли owner/admin в profiles */
const LEGACY_ADMIN_EMAIL = "fridelltubaugh129@gmail.com";

// ─── i18n ────────────────────────────────────────────────────────────
// Lang ("EN" | "RU" | "ES" | "PT") импортируется из LanguageContext.
// Тексты ачивок и KYC живут в своих компонентах.

const en = {
  club: "Voyage Private Club",
  admin: "Admin",
  pageTitle: "Resident Profile",
  completion: "Profile Completion",

  circleNow: "Current circle",
  next: "Next",
  topCircle: "The club's highest circle",
  influence: "Influence Index",
  kycShort: "KYC verification",
  cardAutoNote: "Your card changes colour on its own — with every new circle.",
  cardTapHint: "Touch the card — light will run across it",

  portfolio: "Personal Portfolio",
  verifiedData: "— Verified Data",
  identity: "Identity",
  fullName: "Full Name",
  nameNotSet: "Set your name in settings",
  avatarHint: "Avatar can be changed in settings",
  currentLocation: "Current Location",
  locationPlaceholder: "City",
  citizenship: "Citizenship",
  nationality: "Nationality",
  nationalityPlaceholder: "Citizenship",
  dob: "Date of Birth",
  dobPlaceholder: "dd.mm.yyyy",
  physical: "Physical Parameters",
  height: "Height",
  weight: "Weight",
  measurements: "Measurements",
  cm: "cm",
  kg: "kg",
  lifestyle: "Lifestyle Habits",
  smoking: "Smoking Status",
  alcohol: "Alcohol Consumption",
  about: "About & Preferences",
  aboutPlaceholder: "Tell us about yourself and your travel preferences…",
  clickToEdit: "Click to edit",

  visualPortfolio: "Visual Portfolio",
  polaroids: "— Polaroids & Digitals",
  photo: "Photo",
  addPhoto: "Add Photo",
  uploadingShort: "Uploading…",
  deletePhoto: "Delete photo",
  uploadError: "Photo upload failed. Check the console (F12).",

  vault: "Personal Vault",
  encrypted: "— Encrypted",
  vaultPitch:
    "We can open a protected wallet for you and arrange secure withdrawals anywhere on our planet",
  vaultMars: "(or even on Mars)",
  usdtWallet: "USDT Wallet",
  walletNotOpened: "Not opened yet",
  showAddress: "Show address",
  hideAddress: "Hide address",

  footerTitle: "Voyage Private Club — Confidential",
  footerNote: "All data is encrypted and stored under strict NDA",
  loginRequired: "Please sign in to open your dashboard.",
  saving: "Saving",
  uploading: "Uploading",
};

type TKey = keyof typeof en;
type Dict = Record<TKey, string>;

const translations: Record<Lang, Dict> = {
  EN: en,
  RU: {
    club: "Voyage Private Club",
    admin: "Админ",
    pageTitle: "Профиль резидента",
    completion: "Заполненность профиля",

    circleNow: "Текущий круг",
    next: "Следующий",
    topCircle: "Высший круг клуба",
    influence: "Индекс влияния",
    kycShort: "KYC-верификация",
    cardAutoNote: "Цвет карты меняется сам — с каждым новым кругом.",
    cardTapHint: "Коснитесь карты — блик пройдёт по ней",

    portfolio: "Личное портфолио",
    verifiedData: "— Проверенные данные",
    identity: "Личность",
    fullName: "Полное имя",
    nameNotSet: "Укажите имя в настройках",
    avatarHint: "Аватар меняется в настройках",
    currentLocation: "Текущее местоположение",
    locationPlaceholder: "Город",
    citizenship: "Гражданство",
    nationality: "Гражданство",
    nationalityPlaceholder: "Гражданство",
    dob: "Дата рождения",
    dobPlaceholder: "дд.мм.гггг",
    physical: "Параметры",
    height: "Рост",
    weight: "Вес",
    measurements: "Объёмы",
    cm: "см",
    kg: "кг",
    lifestyle: "Образ жизни",
    smoking: "Курение",
    alcohol: "Алкоголь",
    about: "О себе и предпочтения",
    aboutPlaceholder: "Расскажите о себе, своих предпочтениях в путешествиях…",
    clickToEdit: "Нажмите, чтобы изменить",

    visualPortfolio: "Фотопортфолио",
    polaroids: "— Полароиды и снепы",
    photo: "Фото",
    addPhoto: "Добавить фото",
    uploadingShort: "Загрузка…",
    deletePhoto: "Удалить фото",
    uploadError: "Ошибка при загрузке фото. Проверь консоль (F12).",

    vault: "Личный сейф",
    encrypted: "— Зашифровано",
    vaultPitch:
      "Мы можем завести для вас защищённый кошелёк и организовать безопасный вывод средств в любой точке нашей планеты",
    vaultMars: "(или даже на Марсе)",
    usdtWallet: "USDT-кошелёк",
    walletNotOpened: "Ещё не открыт",
    showAddress: "Показать адрес",
    hideAddress: "Скрыть адрес",

    footerTitle: "Voyage Private Club — Конфиденциально",
    footerNote: "Все данные зашифрованы и хранятся под строгим NDA",
    loginRequired: "Пожалуйста, войдите, чтобы открыть личный кабинет.",
    saving: "Сохранение",
    uploading: "Загрузка",
  },
  ES: {
    club: "Voyage Private Club",
    admin: "Admin",
    pageTitle: "Perfil de residente",
    completion: "Perfil completado",

    circleNow: "Círculo actual",
    next: "Siguiente",
    topCircle: "El círculo más alto del club",
    influence: "Índice de influencia",
    kycShort: "Verificación KYC",
    cardAutoNote: "El color de la tarjeta cambia solo, con cada nuevo círculo.",
    cardTapHint: "Toque la tarjeta: un destello la recorrerá",

    portfolio: "Portafolio personal",
    verifiedData: "— Datos verificados",
    identity: "Identidad",
    fullName: "Nombre completo",
    nameNotSet: "Indica tu nombre en ajustes",
    avatarHint: "El avatar se cambia en ajustes",
    currentLocation: "Ubicación actual",
    locationPlaceholder: "Ciudad",
    citizenship: "Ciudadanía",
    nationality: "Nacionalidad",
    nationalityPlaceholder: "Ciudadanía",
    dob: "Fecha de nacimiento",
    dobPlaceholder: "dd.mm.aaaa",
    physical: "Medidas físicas",
    height: "Altura",
    weight: "Peso",
    measurements: "Medidas",
    cm: "cm",
    kg: "kg",
    lifestyle: "Estilo de vida",
    smoking: "Fumadora",
    alcohol: "Consumo de alcohol",
    about: "Sobre mí y preferencias",
    aboutPlaceholder: "Cuéntanos sobre ti y tus preferencias de viaje…",
    clickToEdit: "Haz clic para editar",

    visualPortfolio: "Portafolio visual",
    polaroids: "— Polaroids y digitales",
    photo: "Foto",
    addPhoto: "Añadir foto",
    uploadingShort: "Subiendo…",
    deletePhoto: "Eliminar foto",
    uploadError: "Error al subir la foto. Revisa la consola (F12).",

    vault: "Bóveda personal",
    encrypted: "— Cifrado",
    vaultPitch:
      "Podemos abrirle una billetera protegida y organizar retiros seguros en cualquier lugar de nuestro planeta",
    vaultMars: "(o incluso en Marte)",
    usdtWallet: "Billetera USDT",
    walletNotOpened: "Aún no abierta",
    showAddress: "Mostrar dirección",
    hideAddress: "Ocultar dirección",

    footerTitle: "Voyage Private Club — Confidencial",
    footerNote: "Todos los datos están cifrados y protegidos por un estricto NDA",
    loginRequired: "Inicia sesión para abrir tu panel.",
    saving: "Guardando",
    uploading: "Subiendo",
  },
  PT: {
    club: "Voyage Private Club",
    admin: "Admin",
    pageTitle: "Perfil de residente",
    completion: "Perfil preenchido",

    circleNow: "Círculo atual",
    next: "Próximo",
    topCircle: "O círculo mais alto do clube",
    influence: "Índice de influência",
    kycShort: "Verificação KYC",
    cardAutoNote: "A cor do cartão muda sozinha a cada novo círculo.",
    cardTapHint: "Toque no cartão — um brilho vai percorrê-lo",

    portfolio: "Portfólio pessoal",
    verifiedData: "— Dados verificados",
    identity: "Identidade",
    fullName: "Nome completo",
    nameNotSet: "Defina seu nome nas configurações",
    avatarHint: "O avatar é alterado nas configurações",
    currentLocation: "Localização atual",
    locationPlaceholder: "Cidade",
    citizenship: "Cidadania",
    nationality: "Nacionalidade",
    nationalityPlaceholder: "Cidadania",
    dob: "Data de nascimento",
    dobPlaceholder: "dd.mm.aaaa",
    physical: "Medidas físicas",
    height: "Altura",
    weight: "Peso",
    measurements: "Medidas",
    cm: "cm",
    kg: "kg",
    lifestyle: "Estilo de vida",
    smoking: "Fumante",
    alcohol: "Consumo de álcool",
    about: "Sobre mim e preferências",
    aboutPlaceholder: "Conte sobre você e suas preferências de viagem…",
    clickToEdit: "Clique para editar",

    visualPortfolio: "Portfólio visual",
    polaroids: "— Polaroids e digitais",
    photo: "Foto",
    addPhoto: "Adicionar foto",
    uploadingShort: "Enviando…",
    deletePhoto: "Excluir foto",
    uploadError: "Falha ao enviar a foto. Verifique o console (F12).",

    vault: "Cofre pessoal",
    encrypted: "— Criptografado",
    vaultPitch:
      "Podemos abrir uma carteira protegida para você e organizar saques seguros em qualquer lugar do nosso planeta",
    vaultMars: "(ou até em Marte)",
    usdtWallet: "Carteira USDT",
    walletNotOpened: "Ainda não aberta",
    showAddress: "Mostrar endereço",
    hideAddress: "Ocultar endereço",

    footerTitle: "Voyage Private Club — Confidencial",
    footerNote: "Todos os dados são criptografados e protegidos por NDA rigoroso",
    loginRequired: "Faça login para abrir seu painel.",
    saving: "Salvando",
    uploading: "Enviando",
  },
};

// ─── Types ──────────────────────────────────────────────────────────
interface Profile {
  id: string;
  full_name: string | null;
  location: string | null;
  citizenship: string | null;
  birth_date: string | null;
  height: string | number | null;
  weight: string | number | null;
  measurements: string | null;
  smoking: boolean;
  alcohol: boolean;
  about: string | null;
  status: string | null;
  kyc_level: number;
  achievements: string[] | null;
  photo_urls: string[] | null;
  /** адрес кошелька — заводит персонал клуба */
  usdt_wallet?: string | null;
  member_no?: string | number | null;
  created_at?: string | null;
}

function emptyProfile(id: string): Profile {
  return {
    id,
    full_name: null,
    location: null,
    citizenship: null,
    birth_date: null,
    height: null,
    weight: null,
    measurements: null,
    smoking: false,
    alcohol: false,
    about: null,
    status: null,
    // паспорт ещё не загружен — уровень 1 не пройден
    kyc_level: 0,
    achievements: [],
    photo_urls: [],
    usdt_wallet: null,
  };
}

const isFilled = (v: unknown) =>
  v !== null && v !== undefined && String(v).trim() !== "";

// helper: ISO date (1998-03-15) → 15.03.1998 for display only
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

// ─── Small UI primitives ─────────────────────────────────────────────

function ProfileCompletionBar({
  percentage,
  label,
}: {
  percentage: number;
  label: string;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-medium">
          {label}
        </span>
        <span className="text-xs tracking-[0.15em] text-amber-200/80 font-medium">
          {percentage}%
        </span>
      </div>
      <div className="relative h-[3px] w-full bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percentage}%`,
            background:
              "linear-gradient(90deg, #d4a853 0%, #f0d78c 50%, #d4a853 100%)",
            boxShadow: "0 0 12px rgba(212,168,83,0.3)",
          }}
        />
      </div>
    </div>
  );
}

/** Панель рядом с кардхолдером: круг, путь к следующему, заполненность, KYC */
function CircleStatusPanel({
  t,
  circle,
  next,
  index,
  progress,
  completion,
  kycLevel,
  loading,
}: {
  t: Dict;
  circle: CircleConfig;
  next: CircleConfig | null;
  index: number;
  progress: number;
  completion: number;
  kycLevel: number;
  loading: boolean;
}) {
  const skin = skinFor(circle.key);
  const rank = CIRCLE_ORDER.indexOf(circle.key as CircleKey);

  return (
    <div className="flex min-w-0 flex-col justify-between gap-5 rounded-[18px] border border-zinc-800/50 bg-zinc-900/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md sm:rounded-[22px] sm:p-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
          {t.circleNow}
        </p>
        <div className="mt-2 flex items-baseline gap-2.5">
          <span className={`${cormorant.className} text-[15px] text-zinc-500`}>
            {toRoman(circle.level)}
          </span>
          <span
            className={`${cormorant.className} text-[30px] italic leading-none transition-colors duration-700 sm:text-4xl ${
              loading ? "opacity-60" : ""
            }`}
            style={{ color: skin.accent, textShadow: `0 0 24px ${skin.glow}` }}
          >
            {circle.title}
          </span>
        </div>

        {/* шесть кругов: пройденные — золото, текущий — цвет круга, следующий — прогресс */}
        <div aria-hidden className="mt-4 flex gap-1 sm:mt-[18px]">
          {CIRCLE_ORDER.map((k, i) => (
            <span key={k} className="relative h-[3px] flex-1 overflow-hidden rounded-sm bg-white/[0.07]">
              {i < rank && <span className="absolute inset-0 bg-[#d4a853]/50" />}
              {i === rank && (
                <span
                  className="absolute inset-0"
                  style={{ background: skin.accent, boxShadow: `0 0 12px ${skin.glow}` }}
                />
              )}
              {i === rank + 1 && next && (
                <span
                  className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-700"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              )}
            </span>
          ))}
        </div>

        <div className="mt-2.5 flex items-baseline justify-between gap-3">
          <span className="truncate text-[10px] uppercase tracking-[0.18em] text-zinc-500 sm:tracking-[0.2em]">
            {next ? `${t.next} · ${next.title}` : t.topCircle}
          </span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-400" title={t.influence}>
            {fmtPoints(index)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-white/[0.06] pt-4">
        <ProfileCompletionBar percentage={completion} label={t.completion} />

        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t.kycShort}</span>
            <span className="font-mono text-[11px] text-zinc-400">
              {Math.max(0, Math.min(3, kycLevel))} / 3
            </span>
          </div>
          <div aria-hidden className="mt-2 flex gap-1">
            {[1, 2, 3].map((lvl) => (
              <span
                key={lvl}
                className={`h-[3px] flex-1 rounded-sm ${
                  lvl <= kycLevel
                    ? "bg-emerald-400/70"
                    : lvl === kycLevel + 1
                      ? "bg-amber-300/35"
                      : "bg-white/[0.07]"
                }`}
              />
            ))}
          </div>
        </div>

        <p className={`${cormorant.className} text-[15px] italic leading-snug text-zinc-500`}>
          {t.cardAutoNote}
        </p>
      </div>
    </div>
  );
}

function VaultRow({ t, address }: { t: Dict; address: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const short =
    address && address.length > 12 ? `${address.slice(0, 3)}···${address.slice(-4)}` : address;

  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700/30 bg-zinc-800/40 text-zinc-500">
          <Wallet className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-zinc-500">
            {t.usdtWallet}
          </p>
          {address ? (
            <p className="mt-0.5 break-all font-mono text-sm tracking-wide text-zinc-300">
              {revealed ? address : short}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-zinc-400">{t.walletNotOpened}</p>
          )}
        </div>
      </div>
      {address && (
        <button
          type="button"
          aria-label={revealed ? t.hideAddress : t.showAddress}
          aria-pressed={revealed}
          onClick={() => setRevealed((v) => !v)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-all hover:bg-zinc-800/50 hover:text-zinc-300"
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function ToggleSwitch({
  label,
  icon,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500">
          {icon}
        </div>
        <span className="text-sm text-zinc-300">{label}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-all duration-300 border ${
          checked
            ? "bg-amber-500/20 border-amber-500/40"
            : "bg-zinc-800/60 border-zinc-700/40"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div
          className={`absolute top-[2px] w-4 h-4 rounded-full transition-all duration-300 ${
            checked
              ? "left-[22px] bg-amber-400 shadow-[0_0_8px_rgba(212,168,83,0.4)]"
              : "left-[2px] bg-zinc-500"
          }`}
        />
      </button>
    </div>
  );
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative bg-zinc-900/40 backdrop-blur-md rounded-xl border border-zinc-800/40 overflow-hidden ${className}`}
    >
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-zinc-700/20" />
      {children}
    </div>
  );
}

/**
 * Инлайн-редактируемое текстовое поле.
 * Клик → инпут → сохранение по blur / Enter (Esc отменяет).
 */
function EditableText({
  value,
  onSave,
  editable = false,
  placeholder = "—",
  type = "text",
  multiline = false,
  mono = false,
  format,
  editHint,
}: {
  value: string | number | null | undefined;
  onSave: (v: string) => void;
  editable?: boolean;
  placeholder?: string;
  type?: "text" | "date" | "number";
  multiline?: boolean;
  mono?: boolean;
  format?: (v: string) => string;
  editHint?: string;
}) {
  const raw = value === null || value === undefined ? "" : String(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(raw);

  useEffect(() => {
    setDraft(raw);
  }, [raw]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== raw) onSave(trimmed);
  };

  if (editable && editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          rows={6}
          className="w-full bg-zinc-950/60 border border-amber-500/30 rounded-lg p-3 text-xs text-zinc-200 leading-[1.8] outline-none focus:border-amber-500/50 resize-none"
        />
      );
    }
    return (
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(raw);
            setEditing(false);
          }
        }}
        className={`w-full max-w-[180px] bg-zinc-950/60 border border-amber-500/30 rounded-md px-2 py-1 text-sm text-zinc-100 outline-none focus:border-amber-500/50 ${
          mono ? "font-mono" : ""
        }`}
      />
    );
  }

  const hasValue = isFilled(raw);
  const display = hasValue ? (format ? format(raw) : raw) : placeholder;

  return (
    <span
      onClick={() => editable && setEditing(true)}
      title={editable ? editHint : undefined}
      className={`text-sm tracking-wide ${
        hasValue ? "text-zinc-200" : "text-zinc-600"
      } ${mono ? "font-mono" : ""} ${
        editable
          ? "cursor-text border-b border-dashed border-transparent hover:border-amber-500/30 hover:text-amber-200/90 transition-colors"
          : ""
      }`}
    >
      {multiline ? (
        <span className="whitespace-pre-line leading-[1.8]">{display}</span>
      ) : (
        display
      )}
    </span>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function ResidentProfilePage() {
  const { user, hasRole } = useAuth();
  const { lang } = useLanguage();
  const t: Dict = translations[lang] ?? translations.EN;

  // UI-проверка; настоящая защита — RLS и триггер в базе
  const isAdmin = hasRole(["owner", "admin"]) || user?.email === LEGACY_ADMIN_EMAIL;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photoSrcs, setPhotoSrcs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEditOwn = !!user; // владелец редактирует свою базовую анкету

  // Имя и аватар — единый источник правды: AuthContext (меняются в настройках)
  const displayName = user?.fullName ?? null;
  const avatarUrl = user?.avatarUrl ?? null;

  // Circle резидента из базы — цвет кардхолдера меняется сам при повышении
  const standing = useClubStanding(user?.id, profile?.status);

  // ── Генерация signed URL для приватного бакета ──────────────────────
  const resolvePhotos = useCallback(async (entries: string[]) => {
    if (!entries || entries.length === 0) {
      setPhotoSrcs([]);
      return;
    }
    const direct: string[] = [];
    const paths: string[] = [];
    entries.forEach((e) =>
      /^https?:\/\//.test(e) ? direct.push(e) : paths.push(e)
    );

    let signed: string[] = [];
    if (paths.length) {
      const { data, error } = await supabase.storage
        .from("user-uploads")
        .createSignedUrls(paths, 60 * 60); // 1 час
      if (error) console.error("createSignedUrls error:", error.message);
      signed = (data ?? [])
        .map((d) => d.signedUrl)
        .filter(Boolean) as string[];
    }
    setPhotoSrcs([...direct, ...signed]);
  }, []);

  // ── Загрузка профиля при монтировании ───────────────────────────────
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id) // profiles.id = auth user id (user_id в таблице пустой)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Не удалось загрузить профиль:", error.message);
      }

      const base: Profile = data
        ? {
            ...emptyProfile(user.id),
            ...data,
            smoking: !!data.smoking,
            alcohol: !!data.alcohol,
            kyc_level: data.kyc_level ?? 0,
            achievements: data.achievements ?? [],
            photo_urls: data.photo_urls ?? [],
          }
        : emptyProfile(user.id);

      setProfile(base);
      await resolvePhotos(base.photo_urls ?? []);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user, resolvePhotos]);

  // ── Универсальное сохранение (optimistic + upsert) ──────────────────
  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!user) return;

      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));

      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...patch }, { onConflict: "id" });
      setSaving(false);

      if (error) console.error("Ошибка сохранения:", error.message);
    },
    [user]
  );

  // ── Загрузка фото портфолио в Storage (с защитой от кэша) ───────────
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || !user || !profile) return;
      setUploading(true);

      const existing = profile.photo_urls ?? [];
      const added: string[] = [];

      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const uniqueFileName = `${Date.now()}_${safeName}`;
        const path = `${user.id}/${uniqueFileName}`;

        const { error } = await supabase.storage
          .from("user-uploads")
          .upload(path, file, { upsert: true, cacheControl: "3600" });

        if (error) {
          console.error("Загрузка не удалась:", error.message);
          alert(t.uploadError);
          continue;
        }

        if (!existing.includes(path) && !added.includes(path)) {
          added.push(path);
        }
      }

      if (added.length) {
        const next = [...existing, ...added];
        await updateProfile({ photo_urls: next });
        await resolvePhotos(next);
      }
      setUploading(false);
    },
    [user, profile, updateProfile, resolvePhotos, t]
  );

  // ── Удаление фото (владелец) ────────────────────────────────────────
  const removePhoto = useCallback(
    async (index: number) => {
      if (!profile || !user) return;
      const entries = profile.photo_urls ?? [];
      const target = entries[index];
      const next = entries.filter((_, i) => i !== index);

      if (target && !/^https?:\/\//.test(target)) {
        await supabase.storage.from("user-uploads").remove([target]);
      }
      await updateProfile({ photo_urls: next });
      await resolvePhotos(next);
    },
    [profile, user, updateProfile, resolvePhotos]
  );

  const openFilePicker = () => fileInputRef.current?.click();

  // ── Ачивки (только персонал) ────────────────────────────────────────
  const toggleAchievement = (key: AchievementKey) => {
    if (!profile || !isAdmin) return;
    const cur = profile.achievements ?? [];
    const next = cur.includes(key)
      ? cur.filter((k) => k !== key)
      : [...cur, key];
    updateProfile({ achievements: next });
  };

  // ── KYC (только персонал) ───────────────────────────────────────────
  const setKyc = (n: number) => {
    if (!isAdmin) return;
    updateProfile({ kyc_level: Math.max(0, Math.min(3, n)) });
  };

  // ── Прогресс заполнения ─────────────────────────────────────────────
  // 100% только если: все поля заполнены, ≥3 фото портфолио и kyc_level === 3
  const completion = useMemo(() => {
    if (!profile) return 0;
    const textFields = [
      displayName,
      profile.location,
      profile.citizenship,
      profile.birth_date,
      profile.height,
      profile.weight,
      profile.measurements,
      profile.about,
    ];
    let done = textFields.filter(isFilled).length; // до 8
    done += Math.min((profile.photo_urls ?? []).length, 3); // до 3
    done += profile.kyc_level >= 3 ? 1 : 0; // до 1
    return Math.round((done / 12) * 100);
  }, [profile, displayName]);

  // ── Состояния загрузки / отсутствия пользователя ────────────────────
  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        <p className="text-sm tracking-wide">{t.loginRequired}</p>
      </div>
    );
  }

  if (loading || !profile || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-300/70" />
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen overflow-x-clip bg-zinc-950 text-zinc-100">
      {/* hidden file input — только для портфолио */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Subtle ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-[0.03]"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.4) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full opacity-[0.02]"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.3) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* индикатор сохранения */}
      {(saving || uploading) && (
        <div className="fixed top-4 right-4 z-50 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-md">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300/80" />
          <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-400">
            {uploading ? t.uploading : t.saving}
          </span>
        </div>
      )}

      <div className="relative mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-16">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <Crown className="w-5 h-5 text-amber-200/60" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-500 font-semibold">
              {t.club}
            </span>
            {isAdmin && (
              <span className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-300/80 font-semibold">
                {t.admin}
              </span>
            )}
          </div>
          <h1
            className={`${cormorant.className} text-[38px] font-medium leading-[1.05] text-zinc-100 sm:text-5xl md:text-[52px]`}
          >
            {t.pageTitle}
          </h1>

          {/* ── Кардхолдер + статус ──────────────────────────────── */}
          <div className="mt-7 grid gap-4 md:mt-9 md:grid-cols-[1.25fr_1fr] md:gap-6">
            <div className="min-w-0">
              <ClubCardholder
                circleKey={standing.circle.key}
                circleTitle={standing.circle.title}
                circleLevel={standing.circle.level}
                holderName={isFilled(displayName) ? (displayName as string) : "Voyage Resident"}
                memberNo={formatMemberNo(profile.member_no, user.id)}
                since={sinceRoman(profile.created_at)}
              />
              <p className="mt-3 text-center text-[9px] uppercase tracking-[0.3em] text-zinc-600 [@media(hover:hover)]:hidden">
                {t.cardTapHint}
              </p>
            </div>
            <CircleStatusPanel
              t={t}
              circle={standing.circle}
              next={standing.next}
              index={standing.index}
              progress={standing.progress}
              completion={completion}
              kycLevel={profile.kyc_level}
              loading={standing.loading}
            />
          </div>

          {/* ── Достижения ───────────────────────────────────────── */}
          <div className="mt-10">
            <AchievementShelf
              lang={lang}
              earned={profile.achievements}
              isAdmin={isAdmin}
              onToggle={toggleAchievement}
            />
          </div>
        </header>

        {/* ── Personal Portfolio ─────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
              {t.portfolio}
            </h2>
            <span className="text-[10px] text-zinc-600 ml-1">
              {t.verifiedData}
            </span>
          </div>

          <div className="space-y-3">
            {/* Identity */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    {t.identity}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {/* Avatar — только из настроек (user.avatarUrl), без загрузки */}
                  <div className="relative flex-shrink-0" title={t.avatarHint}>
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-800/50 border border-amber-500/30 flex items-center justify-center overflow-hidden">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt={displayName ?? "avatar"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-9 h-9 text-zinc-500" />
                      )}
                    </div>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                    <div className="min-w-0">
                      <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                        {t.fullName}
                      </p>
                      <span
                        className={`block truncate text-sm tracking-wide ${
                          isFilled(displayName)
                            ? "text-zinc-200"
                            : "text-zinc-600"
                        }`}
                      >
                        {isFilled(displayName) ? displayName : t.nameNotSet}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                        {t.currentLocation}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                        <EditableText
                          value={profile.location}
                          editable={canEditOwn}
                          editHint={t.clickToEdit}
                          placeholder={t.locationPlaceholder}
                          onSave={(v) =>
                            updateProfile({ location: v || null })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Citizenship */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Flag className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    {t.citizenship}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                      {t.nationality}
                    </p>
                    <EditableText
                      value={profile.citizenship}
                      editable={canEditOwn}
                      editHint={t.clickToEdit}
                      placeholder={t.nationalityPlaceholder}
                      onSave={(v) =>
                        updateProfile({ citizenship: v || null })
                      }
                    />
                  </div>
                  <div>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                      {t.dob}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                      <EditableText
                        value={profile.birth_date}
                        editable={canEditOwn}
                        editHint={t.clickToEdit}
                        type="date"
                        mono
                        placeholder={t.dobPlaceholder}
                        format={formatDate}
                        onSave={(v) =>
                          updateProfile({ birth_date: v || null })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Physical Parameters */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    {t.physical}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 mb-2">
                      <Ruler className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-[0.15em] uppercase text-zinc-500 font-medium mb-0.5">
                      {t.height}
                    </p>
                    <p className="text-sm text-zinc-200 font-mono tracking-wide flex items-center justify-center gap-1">
                      <EditableText
                        value={profile.height}
                        editable={canEditOwn}
                        editHint={t.clickToEdit}
                        type="number"
                        mono
                        placeholder="—"
                        onSave={(v) => updateProfile({ height: v || null })}
                      />
                      {isFilled(profile.height) && (
                        <span className="text-zinc-500 text-xs">{t.cm}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 mb-2">
                      <Weight className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-[0.15em] uppercase text-zinc-500 font-medium mb-0.5">
                      {t.weight}
                    </p>
                    <p className="text-sm text-zinc-200 font-mono tracking-wide flex items-center justify-center gap-1">
                      <EditableText
                        value={profile.weight}
                        editable={canEditOwn}
                        editHint={t.clickToEdit}
                        type="number"
                        mono
                        placeholder="—"
                        onSave={(v) => updateProfile({ weight: v || null })}
                      />
                      {isFilled(profile.weight) && (
                        <span className="text-zinc-500 text-xs">{t.kg}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 mb-2">
                      <Activity className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-[0.15em] uppercase text-zinc-500 font-medium mb-0.5">
                      {t.measurements}
                    </p>
                    <p className="text-sm text-zinc-200 font-mono tracking-wide">
                      <EditableText
                        value={profile.measurements}
                        editable={canEditOwn}
                        editHint={t.clickToEdit}
                        mono
                        placeholder="90 / 60 / 90"
                        onSave={(v) =>
                          updateProfile({ measurements: v || null })
                        }
                      />
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Lifestyle Habits */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Cigarette className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    {t.lifestyle}
                  </span>
                </div>
                <div className="divide-y divide-zinc-800/30">
                  <ToggleSwitch
                    label={t.smoking}
                    icon={<Cigarette className="w-4 h-4" />}
                    checked={profile.smoking}
                    disabled={!canEditOwn}
                    onChange={(v) => updateProfile({ smoking: v })}
                  />
                  <ToggleSwitch
                    label={t.alcohol}
                    icon={<Wine className="w-4 h-4" />}
                    checked={profile.alcohol}
                    disabled={!canEditOwn}
                    onChange={(v) => updateProfile({ alcohol: v })}
                  />
                </div>
              </div>
            </GlassCard>

            {/* About & Preferences */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <AlignLeft className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    {t.about}
                  </span>
                </div>
                <div className="bg-zinc-950/40 rounded-lg border border-zinc-800/30 p-4 text-xs text-zinc-400">
                  <EditableText
                    value={profile.about}
                    editable={canEditOwn}
                    editHint={t.clickToEdit}
                    multiline
                    placeholder={t.aboutPlaceholder}
                    onSave={(v) => updateProfile({ about: v || null })}
                  />
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* ── Visual Portfolio ───────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Camera className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
              {t.visualPortfolio}
            </h2>
            <span className="text-[10px] text-zinc-600 ml-1">
              {t.polaroids}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photoSrcs.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="relative aspect-[3/4] rounded-xl bg-zinc-900/50 border border-zinc-800/40 overflow-hidden group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${t.photo} ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0 opacity-30 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(212,168,83,0.06) 0%, transparent 50%, rgba(20,20,20,0.4) 100%)",
                  }}
                />
                <div className="absolute top-2 left-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400/80" />
                  </div>
                </div>
                {canEditOwn && (
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={t.deletePhoto}
                    className="absolute top-1 right-1 w-9 h-9 rounded-full flex items-center justify-center text-zinc-300 opacity-100 transition-all [@media(hover:hover)]:opacity-0 group-hover:opacity-100 hover:text-red-400"
                    title={t.deletePhoto}
                  >
                    <span className="flex w-6 h-6 items-center justify-center rounded-full bg-zinc-950/70 border border-zinc-700/50">
                      <X className="w-3.5 h-3.5" />
                    </span>
                  </button>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-zinc-950/80 to-transparent">
                  <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-300 font-medium">
                    {t.photo} {String(i + 1).padStart(2, "0")}
                  </p>
                </div>
              </div>
            ))}

            {photoSrcs.length === 0 && (
              <div className="relative aspect-[3/4] rounded-xl bg-zinc-900/50 border border-zinc-800/40 overflow-hidden flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-zinc-700" />
              </div>
            )}

            {canEditOwn && (
              <button
                type="button"
                onClick={openFilePicker}
                disabled={uploading}
                className="relative aspect-[3/4] rounded-xl bg-transparent border border-dashed border-zinc-700 hover:border-amber-500/50 transition-all duration-300 flex flex-col items-center justify-center gap-2 group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-zinc-900/60 border border-zinc-700/40 group-hover:border-amber-500/30 group-hover:bg-amber-950/20 flex items-center justify-center transition-all duration-300">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                  )}
                </div>
                <span className="text-[11px] tracking-[0.12em] uppercase text-zinc-500 group-hover:text-amber-300/80 transition-colors font-medium">
                  {uploading ? t.uploadingShort : t.addPhoto}
                </span>
              </button>
            )}
          </div>
        </section>

        {/* ── KYC Verification ───────────────────────────────────── */}
        <KycSection
          userId={user.id}
          lang={lang}
          kycLevel={profile.kyc_level}
          isAdmin={isAdmin}
          onSetLevel={setKyc}
        />

        {/* ── Personal Vault ─────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
              {t.vault}
            </h2>
            <span className="text-[10px] text-zinc-600 ml-1">
              {t.encrypted}
            </span>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/40 px-4 pt-5 pb-1 backdrop-blur-md sm:px-6 sm:pt-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-16 h-40 w-60 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(212,168,83,0.1) 0%, rgba(212,168,83,0) 70%)",
              }}
            />
            <p
              className={`${cormorant.className} relative max-w-[48ch] text-[19px] leading-[1.4] text-zinc-200 sm:text-[21px]`}
            >
              {t.vaultPitch} <span className="italic text-[#ecd08c]">{t.vaultMars}</span>.
            </p>
            <div className="relative mt-4 border-t border-white/[0.06] sm:mt-5">
              <VaultRow t={t} address={profile.usdt_wallet ?? null} />
            </div>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="text-center pt-6 border-t border-zinc-900">
          <p className="text-[10px] tracking-[0.2em] text-zinc-600 uppercase">
            {t.footerTitle}
          </p>
          <p className="text-[10px] text-zinc-700 mt-1">{t.footerNote}</p>
        </footer>
      </div>
    </div>
  );
}
