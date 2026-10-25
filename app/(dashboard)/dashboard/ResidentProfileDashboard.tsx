"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  IdCard,
  LockKeyhole,
  ScanFace,
  Shield,
  ShieldCheck,
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
import { updateResidentLifestylePreference } from "@/app/actions/map-locations";
import {
  attachPortfolioPhotos,
  createPortfolioUploadSlots,
  removePortfolioPhoto,
  type PortfolioError,
  type PortfolioPhoto,
} from "@/app/actions/resident-portfolio";
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
import ProfileIdentityQuickEdit from "@/app/components/profile/ProfileIdentityQuickEdit";

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
 *    и на бакете `user-uploads`. Портфолио (загрузка/удаление) идёт через
 *    Server Actions в app/actions/resident-portfolio.ts: политики бакета
 *    пускают резидента только к файлам avatar-*, а сервер к тому же
 *    атомарно обновляет photo_urls и возвращает актуальный массив из БД.
 *
 * 5. Кардхолдер красится по Circle из v_global_leaderboard (useClubStanding,
 *    realtime) — тот же расчёт, что в «Паспорте» и лидерборде.
 *
 * 6. kyc_level, achievements, status, usdt_wallet и role меняет только
 *    персонал клуба — это гарантирует триггер в БД
 *    (миграция 20261009_profile_kyc_vault.sql), а не только интерфейс.
 *    Документы KYC — в приватном бакете `kyc-vault` (см. KycSection).
 *
 * 7. Перед KycSection стоит KycExplainer — «зачем паспорт и видео»
 *    языком заботы, а не банка (тексты — COPY ниже). Слово «KYC» в
 *    интерфейсе этого файла заменено на «Верификация».
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
  kycShort: "Verification",
  cardAutoNote: "Your card changes colour on its own — with every new circle.",
  cardTapHint: "Touch the card — light will run across it",

  portfolio: "Personal Portfolio",
  verifiedData: "— Verified Data",
  identity: "Identity",
  fullName: "Full Name",
  nameNotSet: "Set your name in settings",
  avatarHint: "Name and photo can be changed in settings",
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
  deleteError: "Could not delete the photo. Refresh the page and try again.",
  photoLimit: "Photo limit reached (max 12). Delete one to add a new one.",
  photoMissing: "File not found",

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

const T: Record<Lang, Dict> = {
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
    kycShort: "Верификация",
    cardAutoNote: "Цвет карты меняется сам — с каждым новым кругом.",
    cardTapHint: "Коснитесь карты — блик пройдёт по ней",

    portfolio: "Личное портфолио",
    verifiedData: "— Проверенные данные",
    identity: "Личность",
    fullName: "Полное имя",
    nameNotSet: "Укажите имя в настройках",
    avatarHint: "Имя и фото можно изменить в настройках",
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
    deleteError: "Не удалось удалить фото. Обнови страницу и попробуй ещё раз.",
    photoLimit: "Достигнут лимит фото (максимум 12). Удали одно, чтобы добавить новое.",
    photoMissing: "Файл не найден",

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
    kycShort: "Verificación",
    cardAutoNote: "El color de la tarjeta cambia solo, con cada nuevo círculo.",
    cardTapHint: "Toque la tarjeta: un destello la recorrerá",

    portfolio: "Portafolio personal",
    verifiedData: "— Datos verificados",
    identity: "Identidad",
    fullName: "Nombre completo",
    nameNotSet: "Indica tu nombre en ajustes",
    avatarHint: "El nombre y la foto se pueden cambiar en ajustes",
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
    deleteError: "No se pudo eliminar la foto. Actualiza la página e inténtalo de nuevo.",
    photoLimit: "Has alcanzado el límite de fotos (máx. 12). Elimina una para añadir otra.",
    photoMissing: "Archivo no encontrado",

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
    kycShort: "Verificação",
    cardAutoNote: "A cor do cartão muda sozinha a cada novo círculo.",
    cardTapHint: "Toque no cartão — um brilho vai percorrê-lo",

    portfolio: "Portfólio pessoal",
    verifiedData: "— Dados verificados",
    identity: "Identidade",
    fullName: "Nome completo",
    nameNotSet: "Defina seu nome nas configurações",
    avatarHint: "O nome e a foto podem ser alterados nas configurações",
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
    deleteError: "Não foi possível excluir a foto. Atualize a página e tente novamente.",
    photoLimit: "Limite de fotos atingido (máx. 12). Exclua uma para adicionar outra.",
    photoMissing: "Arquivo não encontrado",

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

// ─── «Зачем паспорт и видео» — блок перед KycSection ────────────────

type KycPoint = { kicker: string; title: string; text: string };

type KycExplainerCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  /** Плашка у заголовка, когда верификация пройдена полностью */
  trusted: string;
  /** Паспорт · Видео · Конфиденциальность */
  points: readonly [KycPoint, KycPoint, KycPoint];
};

const COPY: Record<Lang, KycExplainerCopy> = {
  EN: {
    eyebrow: "Why we ask",
    title: "Your safety is part of the service",
    lead: "We understand that a request for your passport and a video can feel unsettling. Here is, honestly, why we need them — and how we protect your data.",
    trusted: "Trusted status confirmed",
    points: [
      {
        kicker: "Digital security",
        title: "Why a passport",
        text: "No more scans in messengers, where they linger for years and get forwarded on. Your passport is uploaded once to the club’s encrypted vault and used for one thing only — buying your flights and booking your hotel.",
      },
      {
        kicker: "Trusted status",
        title: "Why a video",
        text: "Top international tours require guarantees. A short video in which you name the club confirms that you are the real woman behind the profile — and that you run it yourself. It protects you from fakes and opens the door to castings.",
      },
      {
        kicker: "Confidentiality",
        title: "Who sees your data",
        text: "Only the club’s founder can open your passport, and only the verification team sees the video. We never pass your documents on to third parties — the sole exception is the airline and the hotel when we arrange your trip.",
      },
    ],
  },
  RU: {
    eyebrow: "Зачем это нужно",
    title: "Ваша безопасность — часть сервиса",
    lead: "Мы понимаем: просьба загрузить паспорт и записать видео может насторожить. Рассказываем честно, зачем это нужно и как мы бережём ваши данные.",
    trusted: "Статус Trusted подтверждён",
    points: [
      {
        kicker: "Цифровая безопасность",
        title: "Зачем паспорт",
        text: "Больше никаких сканов в мессенджерах, где они живут годами и пересылаются дальше. Паспорт загружается один раз в зашифрованное хранилище клуба и нужен только для одного — купить вам авиабилеты и забронировать отель.",
      },
      {
        kicker: "Статус Trusted",
        title: "Зачем видео",
        text: "Топовые международные туры требуют гарантий. Короткое видео, где вы называете клуб, подтверждает: вы — та самая девушка из анкеты, и анкету ведёте вы сами. Это защищает от фейков и открывает доступ к кастингам.",
      },
      {
        kicker: "Конфиденциальность",
        title: "Кто видит данные",
        text: "Паспорт может открыть только основатель клуба, видео смотрит только команда верификации. Мы не передаём документы третьим лицам — исключение лишь авиакомпания и отель, когда оформляем вашу поездку.",
      },
    ],
  },
  ES: {
    eyebrow: "Por qué lo pedimos",
    title: "Tu seguridad es parte del servicio",
    lead: "Entendemos que pedirte el pasaporte y un vídeo puede inquietarte. Te contamos con total sinceridad para qué los necesitamos y cómo protegemos tus datos.",
    trusted: "Estado Trusted confirmado",
    points: [
      {
        kicker: "Seguridad digital",
        title: "¿Por qué el pasaporte?",
        text: "Se acabaron los escaneos por mensajería, donde se quedan años y se reenvían sin control. Subes tu pasaporte una sola vez a la bóveda cifrada del club y solo se usa para una cosa: comprar tus vuelos y reservar tu hotel.",
      },
      {
        kicker: "Estado Trusted",
        title: "¿Por qué el vídeo?",
        text: "Los mejores tours internacionales exigen garantías. Un vídeo corto en el que nombras el club confirma que eres la chica real del perfil y que lo gestionas tú misma. Te protege de las falsificaciones y te abre el acceso a los castings.",
      },
      {
        kicker: "Confidencialidad",
        title: "¿Quién ve tus datos?",
        text: "Solo el fundador del club puede abrir tu pasaporte, y el vídeo lo ve únicamente el equipo de verificación. No compartimos tus documentos con terceros; la única excepción son la aerolínea y el hotel cuando organizamos tu viaje.",
      },
    ],
  },
  PT: {
    eyebrow: "Por que pedimos",
    title: "Sua segurança faz parte do serviço",
    lead: "Sabemos que um pedido de passaporte e de vídeo pode deixar você desconfiada. Contamos com toda a sinceridade por que precisamos deles — e como protegemos seus dados.",
    trusted: "Status Trusted confirmado",
    points: [
      {
        kicker: "Segurança digital",
        title: "Por que o passaporte",
        text: "Chega de digitalizações em mensageiros, onde ficam por anos e são reencaminhadas. Você envia o passaporte uma única vez para o cofre criptografado do clube, e ele serve para uma coisa só: comprar suas passagens e reservar seu hotel.",
      },
      {
        kicker: "Status Trusted",
        title: "Por que o vídeo",
        text: "Os melhores tours internacionais exigem garantias. Um vídeo curto em que você diz o nome do clube confirma que você é a mesma garota do perfil — e que é você quem cuida dele. Isso protege contra perfis falsos e abre o acesso aos castings.",
      },
      {
        kicker: "Confidencialidade",
        title: "Quem vê seus dados",
        text: "Só o fundador do clube pode abrir o seu passaporte, e o vídeo é visto apenas pela equipe de verificação. Não repassamos seus documentos a terceiros — a única exceção são a companhia aérea e o hotel quando organizamos sua viagem.",
      },
    ],
  },
};

const KYC_POINT_ICONS = [IdCard, ScanFace, LockKeyhole] as const;

/** Объясняющий блок перед KycSection: паспорт, видео, конфиденциальность */
function KycExplainer({ lang, kycLevel }: { lang: Lang; kycLevel: number }) {
  const c = COPY[lang] ?? COPY.EN;
  const trusted = kycLevel >= 3;

  return (
    <section aria-labelledby="kyc-why-title" className="mb-6">
      <div className="relative overflow-hidden rounded-2xl border border-[#c9a961]/20 bg-gradient-to-br from-[#c9a961]/[0.07] via-zinc-950 to-zinc-950 p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#c9a961]/10 blur-3xl" />
        <ShieldCheck
          aria-hidden
          strokeWidth={1}
          className="pointer-events-none absolute -bottom-6 -right-4 h-36 w-36 text-[#c9a961]/[0.05] sm:h-44 sm:w-44"
        />

        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#c9a961]/30 bg-[#c9a961]/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#c9a961]">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
              {c.eyebrow}
            </p>
            {trusted && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200/90">
                <BadgeCheck aria-hidden className="h-3.5 w-3.5" />
                {c.trusted}
              </span>
            )}
          </div>

          <h2
            id="kyc-why-title"
            className={`${cormorant.className} mt-4 text-[26px] font-medium leading-tight text-zinc-50 sm:text-[32px]`}
          >
            {c.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{c.lead}</p>

          {/* рядом с сайдбаром три колонки тесные — до xl пункты идут строками */}
          <ul className="mt-6 grid gap-3 xl:grid-cols-3">
            {c.points.map((point, i) => {
              const Icon = KYC_POINT_ICONS[i];
              return (
                <li
                  key={point.kicker}
                  className="flex gap-4 rounded-xl border border-white/[0.06] bg-zinc-950/60 p-4 backdrop-blur-sm sm:p-5 xl:flex-col xl:gap-3"
                >
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#c9a961]/20 bg-[#c9a961]/10 text-[#c9a961]"
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#c9a961]/80">{point.kicker}</p>
                    <h3 className="mt-1 text-[15px] font-medium text-zinc-100">{point.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{point.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

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
  avatar_url?: string | null;
  first_step_earned_at?: string | null;
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
    avatar_url: null,
    first_step_earned_at: null,
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
    // Synchronize the editable draft with the latest prop value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

const HIDDEN_POINTS_COPY: Record<Lang, { title: string; body: string; reveal: string; settings: string }> = {
  RU: {
    title: "Баллы и рейтинг скрыты",
    body: "Другие резидентки видят только ваше место в рейтинге. Клуб продолжает начислять баллы как обычно.",
    reveal: "Показать мне",
    settings: "Изменить в настройках",
  },
  EN: {
    title: "Points and rating hidden",
    body: "Other residents only see your place in the rating. The club keeps awarding points as usual.",
    reveal: "Show me",
    settings: "Change in settings",
  },
  ES: {
    title: "Puntos y ranking ocultos",
    body: "Las demás residentes solo ven tu puesto. El club sigue sumando puntos como siempre.",
    reveal: "Mostrarme",
    settings: "Cambiar en ajustes",
  },
  PT: {
    title: "Pontos e ranking ocultos",
    body: "As outras residentes veem apenas sua posição. O clube continua somando pontos normalmente.",
    reveal: "Mostrar para mim",
    settings: "Alterar nas configurações",
  },
};

/** Свёрнутый блок статуса, когда резидентка скрыла баллы */
function HiddenPointsPanel({ lang, circleTitle, onReveal }: { lang: Lang; circleTitle: string; onReveal: () => void }) {
  const c = HIDDEN_POINTS_COPY[lang] ?? HIDDEN_POINTS_COPY.RU;
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/[0.07] bg-zinc-950/60 p-5 sm:p-6">
      <div>
        <p className="text-[9px] uppercase tracking-[0.35em] text-[#c9a961]/70">{circleTitle}</p>
        <p className={`${cormorant.className} mt-3 flex items-center gap-2 text-2xl text-zinc-100`}>
          <EyeOff size={18} className="text-[#c9a961]/70" />
          {c.title}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{c.body}</p>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onReveal}
          className="inline-flex items-center gap-2 rounded-full border border-[#c9a961]/35 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-[#e6d3a3] transition-colors hover:bg-[#c9a961]/10"
        >
          <Eye size={13} />
          {c.reveal}
        </button>
        <a href="/dashboard/settings" className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline">
          {c.settings}
        </a>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function ResidentProfilePage() {
  const { user, hasRole } = useAuth();
  const { lang } = useLanguage();
  const t: Dict = T[lang] ?? T.EN;

  // UI-проверка; настоящая защита — RLS и триггер в базе
  const isAdmin = hasRole(["owner", "admin"]) || user?.email === LEGACY_ADMIN_EMAIL;
  const [profile, setProfile] = useState<Profile | null>(null);
  // Пары «значение из photo_urls → картинка» в том же порядке, что и в БД.
  // Удаление идёт по entry, а не по индексу на экране.
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null);
  // Синхронный замок: пока идёт загрузка/удаление, новые операции с фото
  // не стартуют (иначе вторая операция могла бы перезаписать первую).
  const photoBusyRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEditOwn = !!user; // владелец редактирует свою базовую анкету

  // Имя и аватар — единый источник правды: AuthContext (меняются в настройках)
  // Prefer the database profile name over an Auth/email-derived fallback.
  const displayName = profile?.full_name?.trim() || user?.fullName || null;
  const avatarUrl = user?.avatarUrl ?? null;

  // Circle резидента из базы — цвет кардхолдера меняется сам при повышении
  const standing = useClubStanding(user?.id, profile?.status);

  // Настройки → «Скрыть мои баллы и рейтинг» (member_preferences.hide_points):
  // блок свёрнут и у самой резидентки, цифры открываются по нажатию.
  const [pointsHidden, setPointsHidden] = useState(false);
  const [pointsRevealed, setPointsRevealed] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    void supabase
      .from("member_preferences")
      .select("hide_points")
      .eq("profile_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setPointsHidden(data?.hide_points === true);
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // ── Генерация signed URL для приватного бакета ──────────────────────
  // Порядок и длина совпадают с photo_urls: «битый» путь остаётся в списке
  // (src = null), чтобы его можно было увидеть и удалить.
  const resolvePhotos = useCallback(async (entries: string[]) => {
    if (!entries || entries.length === 0) {
      setPhotos([]);
      return;
    }
    const paths = entries.filter((e) => !/^https?:\/\//.test(e));
    const signedByPath = new Map<string, string>();
    if (paths.length) {
      const { data, error } = await supabase.storage
        .from("user-uploads")
        .createSignedUrls(paths, 60 * 60); // 1 час
      if (error) console.error("createSignedUrls error:", error.message);
      (data ?? []).forEach((d) => {
        if (d.path && d.signedUrl && !d.error) signedByPath.set(d.path, d.signedUrl);
      });
    }
    setPhotos(
      entries.map((entry) => ({
        entry,
        src: /^https?:\/\//.test(entry) ? entry : signedByPath.get(entry) ?? null,
      }))
    );
  }, []);

  // ── Загрузка профиля при монтировании ───────────────────────────────
  useEffect(() => {
    if (!user) {
      // Resolve the empty-session state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

      const { data: achievementRows, error: achievementError } = await supabase
        .from("resident_achievements")
        .select("achievement_key,earned_at")
        .eq("profile_id", user.id);

      if (!active) return;

      if (error) {
        console.error("Could not load resident profile:", error.message);
      }
      if (achievementError) {
        // The profile page remains usable even if the optional ledger table is
        // unavailable in a partially migrated staging environment.
        console.error("Could not load resident achievements:", achievementError.code ?? "unknown");
      }

      const ledgerKeys = (achievementRows ?? []).map((row) => String(row.achievement_key));
      const welcomeAward = (achievementRows ?? []).find((row) => row.achievement_key === "welcome_to_voyage");
      const base: Profile = data
        ? {
            ...emptyProfile(user.id),
            ...data,
            smoking: !!data.smoking,
            alcohol: !!data.alcohol,
            kyc_level: data.kyc_level ?? 0,
            achievements: Array.from(new Set([...(data.achievements ?? []), ...ledgerKeys])),
            first_step_earned_at: welcomeAward?.earned_at ?? data.first_step_earned_at ?? null,
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

  // Lifestyle toggles use a narrow server action so failed writes can be rolled back
  // and cannot be obscured by a broad profile upsert.
  const updateLifestyle = useCallback(async (patch: { smoking?: boolean; alcohol?: boolean }) => {
    if (!user || !profile) return;
    const before = { smoking: profile.smoking, alcohol: profile.alcohol };
    setProfile((current) => current ? { ...current, ...patch } : current);
    setSaving(true);
    const result = await updateResidentLifestylePreference(patch);
    setSaving(false);
    if (!result.ok) {
      const rollback = {
        ...(patch.smoking !== undefined ? { smoking: before.smoking } : {}),
        ...(patch.alcohol !== undefined ? { alcohol: before.alcohol } : {}),
      };
      setProfile((current) => current ? { ...current, ...rollback } : current);
      console.error("Could not save lifestyle preference:", result.reason);
      return;
    }
    const savedPatch = {
      ...(patch.smoking !== undefined ? { smoking: result.smoking } : {}),
      ...(patch.alcohol !== undefined ? { alcohol: result.alcohol } : {}),
    };
    setProfile((current) => current ? { ...current, ...savedPatch } : current);
  }, [user, profile]);

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

  // Ответ сервера — истина из БД: кладём его и в профиль, и в галерею.
  const applyPortfolio = useCallback((photoUrls: string[], next: PortfolioPhoto[]) => {
    setProfile((prev) => (prev ? { ...prev, photo_urls: photoUrls } : prev));
    setPhotos(next);
  }, []);

  const portfolioErrorText = useCallback(
    (reason: PortfolioError, fallback: string) => (reason === "too_many" ? t.photoLimit : fallback),
    [t]
  );

  // ── Загрузка фото портфолио: signed upload URL → Storage → photo_urls ─
  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      const files = fileList ? Array.from(fileList) : [];
      if (!files.length || !user || !profile || photoBusyRef.current) return;
      photoBusyRef.current = true;
      setUploading(true);

      try {
        const slotsResult = await createPortfolioUploadSlots(
          files.map((f) => ({ size: f.size, type: f.type, name: f.name }))
        );
        if (!slotsResult.ok) {
          console.error("Загрузка не удалась:", slotsResult.reason);
          alert(portfolioErrorText(slotsResult.reason, t.uploadError));
          return;
        }

        const uploaded: string[] = [];
        let failed = false;
        for (let i = 0; i < files.length; i += 1) {
          const slot = slotsResult.slots[i];
          const { error } = await supabase.storage
            .from("user-uploads")
            .uploadToSignedUrl(slot.path, slot.token, files[i], { cacheControl: "3600" });
          if (error) {
            console.error("Загрузка не удалась:", error.message);
            failed = true;
            continue;
          }
          uploaded.push(slot.path);
        }

        if (uploaded.length) {
          const result = await attachPortfolioPhotos(uploaded);
          if (result.ok) {
            applyPortfolio(result.photoUrls, result.photos);
          } else {
            console.error("Не удалось сохранить фото в анкете:", result.reason);
            failed = true;
          }
        }
        if (failed) alert(t.uploadError);
      } catch (err) {
        console.error("Загрузка не удалась:", err);
        alert(t.uploadError);
      } finally {
        photoBusyRef.current = false;
        setUploading(false);
      }
    },
    [user, profile, applyPortfolio, portfolioErrorText, t]
  );

  // ── Удаление фото (владелец): по значению из photo_urls ─────────────
  const removePhoto = useCallback(
    async (entry: string) => {
      if (!profile || !user || photoBusyRef.current) return;
      photoBusyRef.current = true;
      setDeletingEntry(entry);

      // Оптимистично убираем плитку; при ошибке вернём состояние как было.
      const beforePhotos = photos;
      const beforeUrls = profile.photo_urls ?? [];
      setPhotos((cur) => cur.filter((p) => p.entry !== entry));

      try {
        const result = await removePortfolioPhoto(entry);
        if (result.ok) {
          applyPortfolio(result.photoUrls, result.photos);
        } else {
          console.error("Не удалось удалить фото:", result.reason);
          applyPortfolio(beforeUrls, beforePhotos);
          alert(t.deleteError);
        }
      } catch (err) {
        console.error("Не удалось удалить фото:", err);
        applyPortfolio(beforeUrls, beforePhotos);
        alert(t.deleteError);
      } finally {
        photoBusyRef.current = false;
        setDeletingEntry(null);
      }
    },
    [profile, user, photos, applyPortfolio, t]
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
        <div className="fixed right-4 top-[calc(var(--nav-h,0px)+0.75rem)] z-40 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-md">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300/80" />
          <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-400">
            {uploading ? t.uploading : t.saving}
          </span>
        </div>
      )}

      <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-2 sm:px-6 md:pb-16 md:pt-2">
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

          {/* Identity editor stays above achievements and portfolio; it opens a modal. */}
          <div className="mt-4">
            <ProfileIdentityQuickEdit
              currentName={displayName ?? ""}
              onSaved={(fullName, avatarPath) => setProfile((prev) => prev ? {
                ...prev,
                full_name: fullName,
                avatar_url: avatarPath ?? prev.avatar_url ?? null,
              } : prev)}
            />
          </div>

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
            {pointsHidden && !pointsRevealed ? (
              <HiddenPointsPanel lang={lang} circleTitle={standing.circle.title} onReveal={() => setPointsRevealed(true)} />
            ) : (
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
            )}
          </div>

          {/* ── Достижения ───────────────────────────────────────── */}
          <div className="mt-10">
            <AchievementShelf
              lang={lang}
              earned={profile.achievements}
              isAdmin={isAdmin}
              onToggle={toggleAchievement}
              welcomeEarnedAt={profile.first_step_earned_at}
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
                    disabled={!canEditOwn || saving}
                    onChange={(v) => void updateLifestyle({ smoking: v })}
                  />
                  <ToggleSwitch
                    label={t.alcohol}
                    icon={<Wine className="w-4 h-4" />}
                    checked={profile.alcohol}
                    disabled={!canEditOwn || saving}
                    onChange={(v) => void updateLifestyle({ alcohol: v })}
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
            {photos.map(({ entry, src }, i) => (
              <div
                key={entry}
                className="relative aspect-[3/4] rounded-xl bg-zinc-900/50 border border-zinc-800/40 overflow-hidden group"
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={`${t.photo} ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-600">
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-[10px] tracking-[0.12em] uppercase">{t.photoMissing}</span>
                  </div>
                )}
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
                    onClick={() => removePhoto(entry)}
                    disabled={uploading || deletingEntry !== null}
                    aria-label={t.deletePhoto}
                    className="absolute top-1 right-1 w-9 h-9 rounded-full flex items-center justify-center text-zinc-300 opacity-100 transition-all [@media(hover:hover)]:opacity-0 group-hover:opacity-100 hover:text-red-400"
                    title={t.deletePhoto}
                  >
                    <span className="flex w-6 h-6 items-center justify-center rounded-full bg-zinc-950/70 border border-zinc-700/50">
                      {deletingEntry === entry ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
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

            {photos.length === 0 && (
              <div className="relative aspect-[3/4] rounded-xl bg-zinc-900/50 border border-zinc-800/40 overflow-hidden flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-zinc-700" />
              </div>
            )}

            {canEditOwn && (
              <button
                type="button"
                onClick={openFilePicker}
                disabled={uploading || deletingEntry !== null}
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
        <KycExplainer lang={lang} kycLevel={profile.kyc_level} />
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
