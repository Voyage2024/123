"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Lock,
  BadgeDollarSign,
  Plane,
  Key,
  Sparkles,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext"; // <-- ДОБАВИЛИ ИМПОРТ ГЛОБАЛЬНОГО ЯЗЫКА
import { supabase } from "@/lib/supabase";

// next/font переименовывает шрифт, поэтому берём его через CSS-переменную
const SERIF = "var(--font-cormorant), Georgia, serif";

/* ─── Форма «Запросить приглашение» → public.guest_applications ───
 * Пишет анонимно (RLS: insert для всех, читать могут только owner/admin).
 * Миграция: supabase/migrations/20261011_guest_applications.sql */

type ApplyFields = { fullName: string; contact: string; instagram: string; portfolio: string; about: string };
type ApplyField = keyof ApplyFields | "consent";
type SubmitState = "idle" | "sending" | "sent" | "error";

const EMPTY_APPLY: ApplyFields = { fullName: "", contact: "", instagram: "", portfolio: "", about: "" };
const ABOUT_MAX = 1000;

/** «@anna.k», «instagram.com/anna.k/», «https://www.instagram.com/anna.k?igsh=…» → «anna.k» */
function instagramHandle(raw: string): string | null {
  const handle = raw
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

/** Telegram (@username, t.me/…) или телефон WhatsApp (не меньше 7 цифр) */
function isContact(raw: string) {
  const v = raw.trim();
  if ((v.match(/\d/g) ?? []).length >= 7) return true;
  return /^(@|(https?:\/\/)?t\.me\/)?[a-z0-9_]{4,32}$/i.test(v);
}

/** Ссылка на портфолио: '' — не указана, null — не похожа на ссылку */
function portfolioUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(url);
    return u.hostname.includes(".") && !/\s/.test(url) && url.length <= 500 ? url : null;
  } catch {
    return null;
  }
}

interface TrailParticle {
  id: number;
  x: number;
  y: number;
  opacity: number;
  scale: number;
}

export default function HomePage() {
  // Подключаем наш новый глобальный язык
  const { lang } = useLanguage();

  // --- Состояния для пасхалки ---
  const [planeClicks, setPlaneClicks] = useState(0);
  const [isFlying, setIsFlying] = useState(false);
  const [trailParticles, setTrailParticles] = useState<TrailParticle[]>([]);
  const particleIdRef = useRef(0);
  const trailIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const planeRef = useRef<HTMLDivElement>(null);

  const handlePlaneClick = () => {
    if (isFlying) return;

    const newCount = planeClicks + 1;
    if (newCount === 5) {
      setIsFlying(true);
      setPlaneClicks(0);
      setTimeout(() => {
        setIsFlying(false);
        setTrailParticles([]);
      }, 4000); // совпадает с длительностью анимации (4s)
    } else {
      setPlaneClicks(newCount);
    }
  };

  useEffect(() => {
    if (!isFlying) {
      if (trailIntervalRef.current) {
        clearInterval(trailIntervalRef.current);
        trailIntervalRef.current = null;
      }
      return;
    }

    setTrailParticles([]);
    particleIdRef.current = 0;

    trailIntervalRef.current = setInterval(() => {
      if (planeRef.current) {
        const rect = planeRef.current.getBoundingClientRect();
        const parentRect = planeRef.current.offsetParent?.getBoundingClientRect();
        if (parentRect) {
          const x = rect.left - parentRect.left + rect.width / 2;
          const y = rect.top - parentRect.top + rect.height / 2;
          const id = particleIdRef.current++;

          setTrailParticles(prev => {
            const newParticle: TrailParticle = { id, x, y, opacity: 1, scale: 1 };
            const updated = [...prev, newParticle];
            if (updated.length > 40) updated.shift();
            return updated;
          });
        }
      }
    }, 50);

    return () => {
      if (trailIntervalRef.current) {
        clearInterval(trailIntervalRef.current);
      }
    };
  }, [isFlying]);

  const hasParticles = trailParticles.length > 0;

  // --- Форма заявки ---
  const [apply, setApply] = useState<ApplyFields>(EMPTY_APPLY);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState(""); // скрытое поле: его заполняют только боты
  const [applyErrors, setApplyErrors] = useState<Partial<Record<ApplyField, string>>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [alreadyReceived, setAlreadyReceived] = useState(false);
  const applySectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!hasParticles) return;

    const fadeInterval = setInterval(() => {
      setTrailParticles(prev => {
        const updated = prev
          .map(p => ({
            ...p,
            opacity: p.opacity - 0.04,
            scale: p.scale - 0.015,
          }))
          .filter(p => p.opacity > 0);
        return updated;
      });
    }, 50);

    return () => clearInterval(fadeInterval);
  }, [hasParticles]);

  // --- Словарь переводов на 4 языка ---
  const translations = {
    EN: {
      logo: "VOYAGE",
      navEyebrow: "Private Membership",
      heroEyebrow: "Private Membership",
      heroLine1: "VOYAGE",
      heroLine2: "PRIVATE",
      heroLine3: "CLUB",
      heroSubtitle: "Exclusive community. Premium image events and residencies worldwide.",
      ctaExplore: "Explore Destinations",
      ctaApply: "Resident Access",
      sectionResidencies: "Residencies",
      sectionDestinations: "Current Destinations",
      macroRegion: "Macro Region",
      regionMiddleEast: "Middle East",
      regionEuropeUK: "Europe & UK",
      regionAsiaPacific: "APAC & Australia",
      regionAmericas: "The Americas",
      exploreRegion: "Explore Region",
      sectionWhy: "Why Voyage",
      sectionTrust: "Built on Trust",
      value1Title: "Verified Network",
      value1Desc: "Only verified VIP clients. Each participant undergoes strict verification before joining the club.",
      value2Title: "Flawless Security",
      value2Desc: "24/7 protection protocols. Confidentiality and security of every participant is our top priority.",
      value3Title: "100% Tips Retention",
      value3Desc: "100% retention of tips. Everything you earn above the rate stays with you only.",
      footerRights: "Private Members Only — All Rights Reserved",
      footerAccess: "Member Access →",
      missionEyebrow: "Mission & Positioning",
      manifesto: "We do not just organize travel. Voyage is a private, invitation-only club. A place where the world's elite, the right connections, and impeccable aesthetics converge.",
      pillar1Title: "The Inner Circle",
      pillar1Desc: "Access is everything. Become part of an exclusive network. From closed after-parties in Hollywood to private yacht charters in Monaco, we put you in the right room with the right people.",
      pillar2Title: "Impeccable Image",
      pillar2Desc: "Aesthetic is our currency. We host high-end image parties and elite gatherings where absolute beauty meets undeniable status.",
      pillar3Title: "Ultimate Discretion",
      pillar3Desc: "Your privacy is our highest priority. Flawless security, non-disclosure protocols, and a seamless VIP experience across 4 continents.",
      formEyebrow: "Join The Club",
      formTitle: "Request an Invitation",
      formDesc: "Membership in VOYAGE PRIVATE CLUB is strictly limited. We review each application individually. Please fill out the form below to initiate the verification process.",
      formName: "Full Name",
      formNamePl: "Your name",
      formContact: "Telegram / WhatsApp",
      formContactPl: "+1...",
      formInsta: "Instagram Profile",
      formInstaPl: "@username",
      formPortfolio: "Portfolio / Snaps Link",
      formPortfolioPl: "Google Drive / Dropbox",
      formStatement: "Statement",
      formStatementPl: "Briefly about your experience and why you want to join Voyage...",
      formConsent1: "I confirm that I am over 18 years old and agree to the ",
      formPrivacy: "Privacy Policy",
      formConsent2: " and processing of my personal data.",
      formSubmit: "Submit Application",
      formSending: "Sending…",
      formRequiredHint: "Required",
      errName: "Please enter your full name.",
      errContact: "Leave your Telegram (@username) or WhatsApp number.",
      errInsta: "Enter your Instagram — @username or a profile link.",
      errPortfolio: "Paste a full link, e.g. https://drive.google.com/…",
      errConsent: "Please confirm you are over 18 and accept the Privacy Policy.",
      formError: "We couldn't send your application. Please check your connection and try again.",
      successEyebrow: "Application Received",
      successTitle: "Thank You",
      successBody: "Your application has been received and passed to the club committee. We will contact you via the details you provided.",
      successAlready: "Your application is already with the club committee. We will contact you via the details you provided.",
      successContact: "We will reach you at"
    },
    RU: {
      logo: "VOYAGE",
      navEyebrow: "Приватное членство",
      heroEyebrow: "Приватное членство",
      heroLine1: "VOYAGE",
      heroLine2: "PRIVATE",
      heroLine3: "CLUB",
      heroSubtitle: "Эксклюзивное комьюнити. Премиальные имиджевые мероприятия и резиденции по всему миру.",
      ctaExplore: "Смотреть направления",
      ctaApply: "Вход для резидентов",
      sectionResidencies: "Резиденции",
      sectionDestinations: "Актуальные направления",
      macroRegion: "Макрорегион",
      regionMiddleEast: "Middle East",
      regionEuropeUK: "Europe & UK",
      regionAsiaPacific: "APAC и Австралия",
      regionAmericas: "The Americas",
      exploreRegion: "Исследовать регион",
      sectionWhy: "Почему Voyage",
      sectionTrust: "Основано на доверии",
      value1Title: "Закрытая сеть",
      value1Desc: "Только проверенные VIP-клиенты. Каждый участник проходит строгую верификацию перед вступлением в клуб.",
      value2Title: "Безупречная защита",
      value2Desc: "24/7 протоколы защиты. Конфиденциальность и безопасность каждого участника — наш главный приоритет.",
      value3Title: "100% сохранение чаевых",
      value3Desc: "Полное сохранение чаевых. Всё, что вы зарабатываете сверх тарифа, остаётся только у вас.",
      footerRights: "Только для членов клуба — Все права защищены",
      footerAccess: "Вход для резидентов →",
      missionEyebrow: "Миссия и позиционирование",
      manifesto: "Мы не просто организуем поездки. Voyage — это закрытый клуб по приглашениям. Место, где пересекаются мировая элита, правильные связи и безупречная эстетика.",
      pillar1Title: "Закрытое комьюнити",
      pillar1Desc: "Доступ решает всё. Станьте частью эксклюзивного нетворка. От закрытых after-party в Голливуде до чартеров в Монако — мы открываем двери в правильные комнаты к нужным людям.",
      pillar2Title: "Безупречный имидж",
      pillar2Desc: "Эстетика — наша валюта. Мы организуем премиальные имидж-вечеринки и элитные собрания, где абсолютная красота встречается с непререкаемым статусом.",
      pillar3Title: "Абсолютная приватность",
      pillar3Desc: "Ваша приватность — наш абсолютный приоритет. Безупречная безопасность, протоколы конфиденциальности и бесшовный VIP-сервис на 4 континентах.",
      formEyebrow: "Вступить в клуб",
      formTitle: "Запросить приглашение",
      formDesc: "Членство в VOYAGE PRIVATE CLUB строго лимитировано. Мы рассматриваем каждую заявку индивидуально. Пожалуйста, заполните форму ниже для инициации процесса верификации.",
      formName: "Имя и Фамилия",
      formNamePl: "Ваше имя",
      formContact: "Telegram / WhatsApp",
      formContactPl: "+7...",
      formInsta: "Профиль Instagram",
      formInstaPl: "@username",
      formPortfolio: "Ссылка на портфолио / Снепы",
      formPortfolioPl: "Google Drive / Dropbox",
      formStatement: "О себе",
      formStatementPl: "Коротко о вашем опыте и почему вы хотите присоединиться к Voyage...",
      formConsent1: "Я подтверждаю, что мне больше 18 лет, и согласен(на) с ",
      formPrivacy: "Политикой конфиденциальности",
      formConsent2: " и обработкой моих персональных данных.",
      formSubmit: "Отправить заявку",
      formSending: "Отправляем…",
      formRequiredHint: "Обязательное поле",
      errName: "Укажите имя и фамилию.",
      errContact: "Оставьте Telegram (@username) или номер WhatsApp.",
      errInsta: "Укажите Instagram — @username или ссылку на профиль.",
      errPortfolio: "Вставьте полную ссылку, например https://drive.google.com/…",
      errConsent: "Подтвердите, что вам больше 18 лет и вы согласны с Политикой конфиденциальности.",
      formError: "Не удалось отправить заявку. Проверьте подключение и попробуйте ещё раз.",
      successEyebrow: "Заявка получена",
      successTitle: "Благодарим вас",
      successBody: "Ваша заявка принята и передана в комитет клуба. Мы свяжемся с вами по указанным контактам.",
      successAlready: "Ваша заявка уже у комитета клуба. Мы свяжемся с вами по указанным контактам.",
      successContact: "Мы напишем вам в"
    },
    ES: {
      logo: "VOYAGE",
      navEyebrow: "Membresía Privada",
      heroEyebrow: "Membresía Privada",
      heroLine1: "VOYAGE",
      heroLine2: "PRIVATE",
      heroLine3: "CLUB",
      heroSubtitle: "Comunidad exclusiva. Eventos de imagen premium y residencias en todo el mundo.",
      ctaExplore: "Explorar Destinos",
      ctaApply: "Acceso de Residentes",
      sectionResidencies: "Residencias",
      sectionDestinations: "Destinos Actuales",
      macroRegion: "Macro Región",
      regionMiddleEast: "Medio Oriente",
      regionEuropeUK: "Europa y Reino Unido",
      regionAsiaPacific: "APAC y Australia",
      regionAmericas: "Las Américas",
      exploreRegion: "Explorar Región",
      sectionWhy: "Por qué Voyage",
      sectionTrust: "Basado en la Confianza",
      value1Title: "Red Verificada",
      value1Desc: "Solo clientes VIP verificados. Cada participante pasa por una estricta verificación antes de unirse al club.",
      value2Title: "Seguridad Impecable",
      value2Desc: "Protocolos de protección 24/7. La confidencialidad y seguridad de cada participante es nuestra máxima prioridad.",
      value3Title: "100% Retención de Propinas",
      value3Desc: "Conservas el 100% de tus propinas. Todo lo que ganes por encima de la tarifa es solo tuyo.",
      footerRights: "Solo para Miembros Privados — Todos los Derechos Reservados",
      footerAccess: "Acceso de Miembros →",
      missionEyebrow: "Misión y Posicionamiento",
      manifesto: "No solo organizamos viajes. Voyage es un club privado por invitación. Un lugar donde convergen la élite mundial, las conexiones correctas y una estética impecable.",
      pillar1Title: "El Círculo Interno",
      pillar1Desc: "El acceso lo es todo. Conviértete en parte de una red exclusiva. Desde after-parties cerrados en Hollywood hasta yates privados en Mónaco.",
      pillar2Title: "Imagen Impecable",
      pillar2Desc: "La estética es nuestra moneda. Organizamos fiestas de imagen de alto nivel y reuniones de élite.",
      pillar3Title: "Discreción Absoluta",
      pillar3Desc: "Tu privacidad es nuestra máxima prioridad. Seguridad impecable, protocolos de confidencialidad y una experiencia VIP.",
      formEyebrow: "Únete al Club",
      formTitle: "Solicitar una Invitación",
      formDesc: "La membresía en VOYAGE PRIVATE CLUB es estrictamente limitada. Revisamos cada solicitud individualmente.",
      formName: "Nombre Completo",
      formNamePl: "Tu nombre",
      formContact: "Telegram / WhatsApp",
      formContactPl: "+1...",
      formInsta: "Perfil de Instagram",
      formInstaPl: "@usuario",
      formPortfolio: "Enlace al Portafolio / Snaps",
      formPortfolioPl: "Google Drive / Dropbox",
      formStatement: "Sobre ti",
      formStatementPl: "Brevemente sobre tu experiencia...",
      formConsent1: "Confirmo que soy mayor de 18 años y acepto la ",
      formPrivacy: "Política de Privacidad",
      formConsent2: " y el procesamiento de mis datos personales.",
      formSubmit: "Enviar Solicitud",
      formSending: "Enviando…",
      formRequiredHint: "Campo obligatorio",
      errName: "Indica tu nombre completo.",
      errContact: "Deja tu Telegram (@usuario) o tu número de WhatsApp.",
      errInsta: "Indica tu Instagram: @usuario o el enlace a tu perfil.",
      errPortfolio: "Pega un enlace completo, por ejemplo https://drive.google.com/…",
      errConsent: "Confirma que eres mayor de 18 años y aceptas la Política de Privacidad.",
      formError: "No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo de nuevo.",
      successEyebrow: "Solicitud Recibida",
      successTitle: "Gracias",
      successBody: "Tu solicitud ha sido aceptada y enviada al comité del club. Te contactaremos a través de los datos indicados.",
      successAlready: "Tu solicitud ya está con el comité del club. Te contactaremos a través de los datos indicados.",
      successContact: "Te escribiremos a"
    },
    PT: {
      logo: "VOYAGE",
      navEyebrow: "Assinatura Privada",
      heroEyebrow: "Assinatura Privada",
      heroLine1: "VOYAGE",
      heroLine2: "PRIVATE",
      heroLine3: "CLUB",
      heroSubtitle: "Comunidade exclusiva. Eventos de imagem premium e residências em todo o mundo.",
      ctaExplore: "Explorar Destinos",
      ctaApply: "Acesso de Residentes",
      sectionResidencies: "Residências",
      sectionDestinations: "Destinos Atuais",
      macroRegion: "Macro Região",
      regionMiddleEast: "Oriente Médio",
      regionEuropeUK: "Europa e Reino Unido",
      regionAsiaPacific: "APAC e Austrália",
      regionAmericas: "As Américas",
      exploreRegion: "Explorar Região",
      sectionWhy: "Por que a Voyage",
      sectionTrust: "Construído com Confiança",
      value1Title: "Rede Verificada",
      value1Desc: "Apenas clientes VIP verificados. Cada participante passa por uma rigorosa verificação antes de ingressar no clube.",
      value2Title: "Segurança Impecável",
      value2Desc: "Protocolos de proteção 24/7. A confidencialidade e segurança de cada participante é a nossa prioridade.",
      value3Title: "100% Retenção de Gorjetas",
      value3Desc: "Você mantém 100% de suas gorjetas. Tudo o que você ganha acima da tarifa permanece apenas com você.",
      footerRights: "Apenas para Membros Privados — Todos os Direitos Reservados",
      footerAccess: "Acesso de Membros →",
      missionEyebrow: "Missão e Posicionamento",
      manifesto: "Não organizamos apenas viagens. Voyage é um clube privado apenas para convidados. Um lugar onde a elite mundial, as conexões certas e a estética impecável convergem.",
      pillar1Title: "O Círculo Interno",
      pillar1Desc: "O acesso é tudo. Torne-se parte de uma rede exclusiva. Desde after-parties fechados em Hollywood a iates privados em Mônaco.",
      pillar2Title: "Imagem Impecável",
      pillar2Desc: "A estética é a nossa moeda. Organizamos festas de imagem de alto nível e encontros de elite.",
      pillar3Title: "Discrição Absoluta",
      pillar3Desc: "A sua privacidade é a nossa prioridade. Segurança impecável, protocolos de confidencialidade e uma experiência VIP.",
      formEyebrow: "Junte-se ao Clube",
      formTitle: "Solicitar um Convite",
      formDesc: "A adesão ao VOYAGE PRIVATE CLUB é estritamente limitada. Analisamos cada candidatura individualmente.",
      formName: "Nome Completo",
      formNamePl: "Seu nome",
      formContact: "Telegram / WhatsApp",
      formContactPl: "+1...",
      formInsta: "Perfil do Instagram",
      formInstaPl: "@usuario",
      formPortfolio: "Link para Portfólio / Snaps",
      formPortfolioPl: "Google Drive / Dropbox",
      formStatement: "Sobre você",
      formStatementPl: "Brevemente sobre a sua experiência...",
      formConsent1: "Confirmo que sou maior de 18 anos e concordo com a ",
      formPrivacy: "Política de Privacidade",
      formConsent2: " e com o processamento dos meus dados pessoais.",
      formSubmit: "Enviar Inscrição",
      formSending: "Enviando…",
      formRequiredHint: "Campo obrigatório",
      errName: "Informe seu nome completo.",
      errContact: "Deixe seu Telegram (@usuario) ou número de WhatsApp.",
      errInsta: "Informe seu Instagram — @usuario ou o link do perfil.",
      errPortfolio: "Cole um link completo, por exemplo https://drive.google.com/…",
      errConsent: "Confirme que você tem mais de 18 anos e aceita a Política de Privacidade.",
      formError: "Não foi possível enviar sua inscrição. Verifique sua conexão e tente novamente.",
      successEyebrow: "Inscrição Recebida",
      successTitle: "Obrigado",
      successBody: "Sua inscrição foi aceita e encaminhada ao comitê do clube. Entraremos em contato pelos contatos informados.",
      successAlready: "Sua inscrição já está com o comitê do clube. Entraremos em contato pelos contatos informados.",
      successContact: "Vamos falar com você em"
    }
  };
  // неизвестный язык (или в нижнем регистре) → английский, а не падение страницы
  const t = translations[String(lang).toUpperCase() as keyof typeof translations] ?? translations.EN;

  const scrollToDestinations = () => {
    document.getElementById("destinations")?.scrollIntoView({ behavior: "smooth" });
  };

  // --- Форма заявки: поля, проверка, отправка ---
  const setField = (key: keyof ApplyFields, value: string) => {
    setApply((prev) => ({ ...prev, [key]: value }));
    if (applyErrors[key]) setApplyErrors((prev) => ({ ...prev, [key]: undefined }));
    if (submitState === "error") setSubmitState("idle");
  };

  const validateApply = () => {
    const errors: Partial<Record<ApplyField, string>> = {};
    if (apply.fullName.trim().replace(/\s+/g, " ").length < 2) errors.fullName = t.errName;
    if (!isContact(apply.contact)) errors.contact = t.errContact;
    if (!instagramHandle(apply.instagram)) errors.instagram = t.errInsta;
    if (portfolioUrl(apply.portfolio) === null) errors.portfolio = t.errPortfolio;
    if (!consent) errors.consent = t.errConsent;
    return errors;
  };

  const handleApply = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitState === "sending") return;

    const errors = validateApply();
    setApplyErrors(errors);
    const firstInvalid = (["fullName", "contact", "instagram", "portfolio", "consent"] as ApplyField[]).find((k) => errors[k]);
    if (firstInvalid) {
      document.getElementById(`apply-${firstInvalid}`)?.focus();
      return;
    }

    const showSuccess = (already: boolean) => {
      setAlreadyReceived(already);
      setSubmitState("sent");
      requestAnimationFrame(() => applySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };

    // бот заполнил скрытое поле — вежливо «принимаем», ничего не сохраняя
    if (honeypot) {
      showSuccess(false);
      return;
    }

    setSubmitState("sending");
    try {
      const { error } = await supabase.from("guest_applications").insert({
        full_name: apply.fullName.trim().replace(/\s+/g, " "),
        contact: apply.contact.trim(),
        instagram: `@${instagramHandle(apply.instagram)}`,
        portfolio_url: portfolioUrl(apply.portfolio) || null,
        about: apply.about.trim() || null,
        consent: true,
        lang: String(lang).toLowerCase(),
      });
      // 23505 — анкета с этим Instagram уже ждёт решения комитета
      if (error && error.code !== "23505") {
        console.error("[Apply] Insert error:", error);
        setSubmitState("error");
        return;
      }
      showSuccess(error?.code === "23505");
    } catch (err) {
      console.error("[Apply] Insert exception:", err);
      setSubmitState("error");
    }
  };

  const fieldClass = (key: ApplyField) =>
    `w-full bg-transparent border-b pb-3 text-zinc-100 focus:outline-none transition-colors placeholder:text-zinc-800 font-light disabled:opacity-60 ${
      applyErrors[key] ? "border-red-400/60 focus:border-red-300/80" : "border-zinc-800 focus:border-amber-200/50"
    }`;

  const fieldError = (key: ApplyField) =>
    applyErrors[key] ? (
      <p id={`apply-${key}-error`} role="alert" className="flex items-center gap-1.5 text-[11px] text-red-300/80">
        <AlertCircle size={12} strokeWidth={1.5} className="shrink-0" />
        {applyErrors[key]}
      </p>
    ) : null;

  const requiredMark = (
    <span className="ml-1 text-amber-200/60" aria-hidden title={t.formRequiredHint}>
      *
    </span>
  );

  const sending = submitState === "sending";

  // --- Три столпа (Manifesto pillars) ---
  const pillars = [
    { icon: <Key size={18} strokeWidth={1.5} />, title: t.pillar1Title, desc: t.pillar1Desc },
    { icon: <Sparkles size={18} strokeWidth={1.5} />, title: t.pillar2Title, desc: t.pillar2Desc },
    { icon: <ShieldCheck size={18} strokeWidth={1.5} />, title: t.pillar3Title, desc: t.pillar3Desc },
  ];

  return (
    <div className="text-zinc-100 font-sans antialiased">
      
      {/* ─── Hero Section ─── */}
      <section className="relative min-h-[calc(100vh-6rem)] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-amber-400/5 blur-[120px]" />
        </div>

        <p className="mb-6 text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium">
          {t.heroEyebrow}
        </p>

        <h1
          className="text-6xl md:text-8xl lg:text-9xl font-light text-zinc-50 leading-none tracking-tight mb-6"
          style={{ fontFamily: SERIF }}
        >
          {t.heroLine1}
          <br />
          <span className="text-amber-200">{t.heroLine2}</span>
          <br />
          {t.heroLine3}
        </h1>

        <div className="w-16 h-px bg-amber-200/40 mx-auto my-8" />

        <p className="max-w-xl text-zinc-400 text-base md:text-lg leading-relaxed mb-12 font-light">
          {t.heroSubtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center z-10">
          <button
            onClick={scrollToDestinations}
            className="px-8 py-3.5 rounded-full bg-amber-200 text-zinc-950 text-sm tracking-widest uppercase font-semibold hover:bg-amber-100 transition-colors duration-300 min-w-[220px]"
          >
            {t.ctaExplore}
          </button>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-full border border-zinc-700 text-zinc-300 text-sm tracking-widest uppercase font-medium hover:border-amber-200/40 hover:text-amber-200 transition-all duration-300 min-w-[220px]"
          >
            {t.ctaApply}
          </Link>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-amber-200/60 animate-pulse" />
        </div>
      </section>

      {/* ─── Mission & Positioning (Манифест и Три столпа) ─── */}
      <section className="relative px-6 py-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[420px] rounded-full bg-amber-400/[0.04] blur-[130px]" />
        </div>

        <div className="relative max-w-5xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium mb-10"
          >
            {t.missionEyebrow}
          </motion.p>

          <motion.blockquote
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.85, ease: "easeOut" }}
            className="mx-auto max-w-4xl text-center text-2xl md:text-4xl lg:text-[2.6rem] font-light leading-snug text-zinc-100"
            style={{ fontFamily: SERIF }}
          >
            {t.manifesto}
          </motion.blockquote>

          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            whileInView={{ opacity: 1, scaleX: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="w-16 h-px bg-amber-200/40 mx-auto my-16 origin-center"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pillars.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.15, ease: "easeOut" }}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-sm p-8 hover:border-amber-200/20 transition-all duration-500"
              >
                <div className="w-12 h-12 rounded-full border border-amber-200/20 flex items-center justify-center mb-6 text-amber-200/70 group-hover:border-amber-200/40 group-hover:text-amber-200 transition-colors duration-500">
                  {p.icon}
                </div>
                <h3
                  className="text-2xl font-light text-zinc-100 mb-4"
                  style={{ fontFamily: SERIF }}
                >
                  {p.title}
                </h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-light">
                  {p.desc}
                </p>

                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Destinations ─── */}
      <section id="destinations" className="px-6 py-28 max-w-6xl mx-auto">
        <div className="mb-14 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium mb-3">
              {t.sectionResidencies}
            </p>
            <h2
              className="text-4xl md:text-5xl font-light text-zinc-100 leading-tight"
              style={{ fontFamily: SERIF }}
            >
              {t.sectionDestinations}
            </h2>
          </div>
          <div className="w-24 h-px bg-zinc-800 self-center hidden md:block" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* ── Middle East ── */}
          <Link
            href="/destinations/middle-east"
            className="group relative block rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:border-amber-200/30 transition-all duration-500"
          >
            <div className="p-8 flex flex-col min-h-[360px]">
              <p className="text-xs tracking-[0.4em] uppercase text-amber-200/50 font-medium mb-2">
                {t.macroRegion}
              </p>
              <h3
                className="text-3xl md:text-4xl font-light text-zinc-100 mb-auto pb-6"
                style={{ fontFamily: SERIF }}
              >
                {t.regionMiddleEast}
              </h3>
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-amber-200/30 text-amber-200/80">
                  10 Destinations
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  Elite Outcall
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  High-End Hubs
                </span>
              </div>
              <div className="flex items-center gap-2 text-amber-200/60 text-sm tracking-widest uppercase font-medium group-hover:text-amber-200 transition-colors duration-300">
                {t.exploreRegion}
                <ArrowRight size={14} strokeWidth={2} className="group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-400/5 to-transparent rounded-2xl" />
          </Link>

          {/* ── Europe & UK ── */}
          <Link
            href="/destinations/europe"
            className="group relative block rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:border-amber-200/30 transition-all duration-500"
          >
            <div className="p-8 flex flex-col min-h-[360px]">
              <p className="text-xs tracking-[0.4em] uppercase text-amber-200/50 font-medium mb-2">
                {t.macroRegion}
              </p>
              <h3
                className="text-3xl md:text-4xl font-light text-zinc-100 mb-auto pb-6"
                style={{ fontFamily: SERIF }}
              >
                {t.regionEuropeUK}
              </h3>
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-amber-200/30 text-amber-200/80">
                  20 Destinations
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  Euro Tours
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  Fashion Capitals
                </span>
              </div>
              <div className="flex items-center gap-2 text-amber-200/60 text-sm tracking-widest uppercase font-medium group-hover:text-amber-200 transition-colors duration-300">
                {t.exploreRegion}
                <ArrowRight size={14} strokeWidth={2} className="group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-400/5 to-transparent rounded-2xl" />
          </Link>

          {/* ── Asia-Pacific ── */}
          <Link
            href="/destinations/asia-pacific"
            className="group relative block rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:border-amber-200/30 transition-all duration-500"
          >
            <div className="p-8 flex flex-col min-h-[360px]">
              <p className="text-xs tracking-[0.4em] uppercase text-amber-200/50 font-medium mb-2">
                {t.macroRegion}
              </p>
              <h3
                className="text-3xl md:text-4xl font-light text-zinc-100 mb-auto pb-6"
                style={{ fontFamily: SERIF }}
              >
                {t.regionAsiaPacific}
              </h3>
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-amber-200/30 text-amber-200/80">
                  10 Destinations
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  High Traffic
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  Visa Support
                </span>
              </div>
              <div className="flex items-center gap-2 text-amber-200/60 text-sm tracking-widest uppercase font-medium group-hover:text-amber-200 transition-colors duration-300">
                {t.exploreRegion}
                <ArrowRight size={14} strokeWidth={2} className="group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-400/5 to-transparent rounded-2xl" />
          </Link>

          {/* ── The Americas ── */}
          <Link
            href="/destinations/americas"
            className="group relative block rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm hover:border-amber-200/30 transition-all duration-500"
          >
            <div className="p-8 flex flex-col min-h-[360px]">
              <p className="text-xs tracking-[0.4em] uppercase text-amber-200/50 font-medium mb-2">
                {t.macroRegion}
              </p>
              <h3
                className="text-3xl md:text-4xl font-light text-zinc-100 mb-auto pb-6"
                style={{ fontFamily: SERIF }}
              >
                {t.regionAmericas}
              </h3>
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-amber-200/30 text-amber-200/80">
                  10 Destinations
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  Coast-to-Coast
                </span>
                <span className="px-3 py-1 text-[11px] tracking-wider uppercase rounded-full border border-zinc-700 text-zinc-500">
                  5★ Hotels
                </span>
              </div>
              <div className="flex items-center gap-2 text-amber-200/60 text-sm tracking-widest uppercase font-medium group-hover:text-amber-200 transition-colors duration-300">
                {t.exploreRegion}
                <ArrowRight size={14} strokeWidth={2} className="group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-400/5 to-transparent rounded-2xl" />
          </Link>
        </div>
      </section>

      {/* ─── Why Voyage / Values ─── */}
      <section className="px-6 py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium mb-3">
              {t.sectionWhy}
            </p>
            <h2
              className="text-4xl md:text-5xl font-light text-zinc-100"
              style={{ fontFamily: SERIF }}
            >
              {t.sectionTrust}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Verified Network */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-8 group hover:border-zinc-700 transition-all duration-300">
              <div className="w-10 h-10 rounded-full border border-amber-200/20 flex items-center justify-center mb-6 group-hover:border-amber-200/40 transition-colors duration-300">
                <Shield size={16} strokeWidth={1.5} className="text-amber-200/70" />
              </div>
              <h3
                className="text-xl font-light text-zinc-100 mb-3"
                style={{ fontFamily: SERIF }}
              >
                {t.value1Title}
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                {t.value1Desc}
              </p>
            </div>

            {/* Flawless Security */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-8 group hover:border-zinc-700 transition-all duration-300">
              <div className="w-10 h-10 rounded-full border border-amber-200/20 flex items-center justify-center mb-6 group-hover:border-amber-200/40 transition-colors duration-300">
                <Lock size={16} strokeWidth={1.5} className="text-amber-200/70" />
              </div>
              <h3
                className="text-xl font-light text-zinc-100 mb-3"
                style={{ fontFamily: SERIF }}
              >
                {t.value2Title}
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                {t.value2Desc}
              </p>
            </div>

            {/* 100% Tips Retention */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-8 group hover:border-zinc-700 transition-all duration-300">
              <div className="w-10 h-10 rounded-full border border-amber-200/20 flex items-center justify-center mb-6 group-hover:border-amber-200/40 transition-colors duration-300">
                <BadgeDollarSign size={16} strokeWidth={1.5} className="text-amber-200/70" />
              </div>
              <h3
                className="text-xl font-light text-zinc-100 mb-3"
                style={{ fontFamily: SERIF }}
              >
                {t.value3Title}
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                {t.value3Desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Membership Application Form ─── */}
      <section
        id="apply"
        ref={applySectionRef}
        className="px-6 py-24 border-t border-white/5 bg-zinc-950 relative overflow-hidden scroll-mt-8"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />

        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs tracking-[0.5em] uppercase text-amber-200/60 font-medium mb-3">
              {t.formEyebrow}
            </p>
            <h2
              className="text-4xl md:text-5xl font-light text-zinc-100 mb-6"
              style={{ fontFamily: SERIF }}
            >
              {t.formTitle}
            </h2>
            {submitState !== "sent" && (
              <p className="text-zinc-400 text-sm md:text-base leading-relaxed font-light max-w-xl mx-auto">
                {t.formDesc}
              </p>
            )}
          </div>

          {submitState === "sent" ? (
            <motion.div
              key="apply-success"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              role="status"
              aria-live="polite"
              className="relative mx-auto max-w-xl overflow-hidden rounded-3xl border border-amber-200/15 bg-zinc-900/40 px-8 py-14 text-center backdrop-blur-sm md:px-14"
            >
              <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />
              <div className="pointer-events-none absolute inset-3 rounded-[1.25rem] border border-amber-200/[0.07]" />

              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.15, ease: [0.3, 1.4, 0.5, 1] }}
                className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-amber-200/40 bg-amber-200/[0.06] text-amber-200 shadow-[0_0_40px_rgba(251,191,36,0.12)]"
              >
                <span className="absolute inset-1.5 rounded-full border border-amber-200/15" />
                <ShieldCheck size={30} strokeWidth={1.25} />
              </motion.div>

              <p className="mb-3 text-xs font-medium uppercase tracking-[0.5em] text-amber-200/60">{t.successEyebrow}</p>
              <h3 className="mb-6 text-4xl font-light text-zinc-50 md:text-5xl" style={{ fontFamily: SERIF }}>
                {t.successTitle}
              </h3>
              <div className="mx-auto mb-6 h-px w-16 bg-amber-200/40" />
              <p className="mx-auto max-w-md text-sm font-light leading-relaxed text-zinc-300 md:text-base">
                {alreadyReceived ? t.successAlready : t.successBody}
              </p>
              {apply.contact.trim() && (
                <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-zinc-600">
                  {t.successContact} <span className="normal-case tracking-normal text-amber-200/80">{apply.contact.trim()}</span>
                </p>
              )}
            </motion.div>
          ) : (
          <form className="space-y-10" onSubmit={handleApply} noValidate>
            {/* ловушка для ботов: людям не видна и не доступна с клавиатуры */}
            <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="apply-website">Website</label>
              <input
                id="apply-website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3 relative group">
                <label htmlFor="apply-fullName" className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 transition-colors group-focus-within:text-amber-200/70">
                  {t.formName}
                  {requiredMark}
                </label>
                <input
                  id="apply-fullName"
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  value={apply.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  disabled={sending}
                  aria-invalid={!!applyErrors.fullName}
                  aria-describedby={applyErrors.fullName ? "apply-fullName-error" : undefined}
                  className={fieldClass("fullName")}
                  placeholder={t.formNamePl}
                />
                {fieldError("fullName")}
              </div>
              <div className="space-y-3 relative group">
                <label htmlFor="apply-contact" className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 transition-colors group-focus-within:text-amber-200/70">
                  {t.formContact}
                  {requiredMark}
                </label>
                <input
                  id="apply-contact"
                  type="text"
                  autoComplete="tel"
                  maxLength={120}
                  value={apply.contact}
                  onChange={(e) => setField("contact", e.target.value)}
                  disabled={sending}
                  aria-invalid={!!applyErrors.contact}
                  aria-describedby={applyErrors.contact ? "apply-contact-error" : undefined}
                  className={fieldClass("contact")}
                  placeholder={t.formContactPl}
                />
                {fieldError("contact")}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3 relative group">
                <label htmlFor="apply-instagram" className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 transition-colors group-focus-within:text-amber-200/70">
                  {t.formInsta}
                  {requiredMark}
                </label>
                <input
                  id="apply-instagram"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={120}
                  value={apply.instagram}
                  onChange={(e) => setField("instagram", e.target.value)}
                  disabled={sending}
                  aria-invalid={!!applyErrors.instagram}
                  aria-describedby={applyErrors.instagram ? "apply-instagram-error" : undefined}
                  className={fieldClass("instagram")}
                  placeholder={t.formInstaPl}
                />
                {fieldError("instagram")}
              </div>
              <div className="space-y-3 relative group">
                <label htmlFor="apply-portfolio" className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 transition-colors group-focus-within:text-amber-200/70">
                  {t.formPortfolio}
                </label>
                <input
                  id="apply-portfolio"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={500}
                  value={apply.portfolio}
                  onChange={(e) => setField("portfolio", e.target.value)}
                  disabled={sending}
                  aria-invalid={!!applyErrors.portfolio}
                  aria-describedby={applyErrors.portfolio ? "apply-portfolio-error" : undefined}
                  className={fieldClass("portfolio")}
                  placeholder={t.formPortfolioPl}
                />
                {fieldError("portfolio")}
              </div>
            </div>

            <div className="space-y-3 relative group">
              <label htmlFor="apply-about" className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 transition-colors group-focus-within:text-amber-200/70">
                {t.formStatement}
              </label>
              <textarea
                id="apply-about"
                rows={2}
                maxLength={ABOUT_MAX}
                value={apply.about}
                onChange={(e) => setField("about", e.target.value)}
                disabled={sending}
                className={`${fieldClass("about")} resize-none`}
                placeholder={t.formStatementPl}
              />
            </div>

            {/* ─── Legal Consent ─── */}
            <div className="space-y-2 pt-2">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="apply-consent"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    if (applyErrors.consent) setApplyErrors((prev) => ({ ...prev, consent: undefined }));
                  }}
                  disabled={sending}
                  aria-invalid={!!applyErrors.consent}
                  aria-describedby={applyErrors.consent ? "apply-consent-error" : undefined}
                  className={`mt-0.5 appearance-none min-w-[16px] w-4 h-4 rounded-sm border bg-transparent checked:bg-amber-200 checked:border-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40 transition-colors cursor-pointer relative after:content-['✓'] after:absolute after:text-zinc-900 after:text-[10px] after:font-bold after:left-1/2 after:-translate-x-1/2 after:top-1/2 after:-translate-y-1/2 after:opacity-0 checked:after:opacity-100 ${
                    applyErrors.consent ? "border-red-400/70" : "border-zinc-700"
                  }`}
                />
                <label htmlFor="apply-consent" className="text-[10px] tracking-wider text-zinc-500 leading-relaxed font-light cursor-pointer select-none">
                  {t.formConsent1}
                  <Link href="/privacy" className="text-amber-200/70 hover:text-amber-200 transition-colors">
                    {t.formPrivacy}
                  </Link>
                  {t.formConsent2}
                </label>
              </div>
              {fieldError("consent")}
            </div>

            {/* Кнопка отправки с пасхалкой */}
            <div className="pt-8 flex justify-center">
              <style>{`
                @keyframes fly-around-btn {
                  0%   { transform: translate(0px, 0px) rotate(0deg); }
                  8%   { transform: translate(-60px, -45px) rotate(-30deg); }
                  16%  { transform: translate(-130px, -55px) rotate(-60deg); }
                  24%  { transform: translate(-180px, -35px) rotate(-90deg); }
                  32%  { transform: translate(-200px, 0px) rotate(-120deg); }
                  40%  { transform: translate(-180px, 35px) rotate(-150deg); }
                  48%  { transform: translate(-130px, 55px) rotate(-180deg); }
                  56%  { transform: translate(-60px, 45px) rotate(-210deg); }
                  64%  { transform: translate(0px, 0px) rotate(-240deg); }
                  72%  { transform: translate(60px, -45px) rotate(-270deg); }
                  80%  { transform: translate(130px, -55px) rotate(-300deg); }
                  88%  { transform: translate(180px, -35px) rotate(-330deg); }
                  96%  { transform: translate(200px, 0px) rotate(-360deg); }
                  100% { transform: translate(0px, 0px) rotate(-360deg); }
                }

                .animate-fly-around {
                  animation: fly-around-btn 4s linear forwards;
                }
              `}</style>

              <div className="relative group/btn inline-flex items-center justify-center">
                <button
                  type="submit"
                  disabled={sending}
                  aria-busy={sending}
                  className="inline-flex min-w-[15rem] items-center justify-center gap-2.5 px-12 py-4 rounded-full bg-zinc-100 text-zinc-950 text-[11px] tracking-[0.2em] uppercase font-bold hover:bg-amber-200 transition-all duration-300 shadow-[0_0_20px_rgba(251,191,36,0.1)] hover:shadow-[0_0_30px_rgba(251,191,36,0.2)] disabled:cursor-wait disabled:bg-amber-200/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  {sending && <Loader2 size={15} strokeWidth={2} className="animate-spin" />}
                  {sending ? t.formSending : t.formSubmit}
                </button>

                <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ width: '500px', height: '200px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                  {trailParticles.map((p) => (
                    <div
                      key={p.id}
                      className="absolute rounded-full"
                      style={{
                        left: `${p.x}px`,
                        top: `${p.y}px`,
                        width: '6px',
                        height: '6px',
                        transform: `translate(-50%, -50%) scale(${p.scale})`,
                        opacity: p.opacity,
                        background: 'radial-gradient(circle, rgba(251,191,36,0.9) 0%, rgba(255,255,255,0.6) 40%, rgba(251,191,36,0.2) 70%, transparent 100%)',
                        boxShadow: '0 0 8px rgba(251,191,36,0.5), 0 0 16px rgba(251,191,36,0.2)',
                        transition: 'opacity 0.1s ease-out, transform 0.1s ease-out',
                      }}
                    />
                  ))}
                </div>

                <div
                  ref={planeRef}
                  onClick={handlePlaneClick}
                  className={`absolute p-2 cursor-pointer text-zinc-700 hover:text-amber-200 transition-colors duration-300 z-10 ${isFlying ? 'animate-fly-around text-amber-400' : ''}`}
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: isFlying ? undefined : 'translate(-50%, -50%)',
                    marginLeft: isFlying ? undefined : '140px',
                    marginTop: isFlying ? undefined : '-2px',
                  }}
                  title="Secret Voyage"
                >
                  <Plane size={20} strokeWidth={1.5} />
                </div>
              </div>
            </div>

            {submitState === "error" && (
              <p role="alert" className="mx-auto flex max-w-md items-start justify-center gap-2 text-center text-xs leading-relaxed text-red-300/80">
                <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                {t.formError}
              </p>
            )}
          </form>
          )}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="px-8 py-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <span
          className="text-amber-200/40 font-serif tracking-[0.35em] text-sm font-light"
          style={{ fontFamily: SERIF }}
        >
          {t.logo}
        </span>
        <p className="text-zinc-700 text-xs tracking-widest uppercase">
          {t.footerRights}
        </p>
        <Link
          href="/login"
          className="text-zinc-600 text-xs tracking-widest uppercase hover:text-amber-200/60 transition-colors duration-300"
        >
          {t.footerAccess}
        </Link>
      </footer>
    </div>
  );
}