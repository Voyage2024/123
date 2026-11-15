/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Уровни KYC — единый источник текстов
 * lib/kyc-levels.ts
 *
 * Используется в форме кастинга (менеджер выбирает минимальный уровень
 * отклика), в ленте резидентки (бейдж на карточке и подсказки), на доске
 * кастинга и в «Моих моделях». Хранение — profiles.kyc_level (0–3),
 * требование кастинга — partner_castings.min_kyc_level
 * (миграция 20261114100000_casting_min_kyc_level.sql).
 *
 * Тексты двух видов:
 *   manager  — что менеджер получает, выбирая этот уровень;
 *   resident — что резидентке нужно сделать, чтобы его получить.
 * ──────────────────────────────────────────────────────────────────── */

import type { Lang } from "@/app/context/LanguageContext";

export const KYC_LEVELS = [0, 1, 2, 3] as const;
export type KycLevel = (typeof KYC_LEVELS)[number];

export const toKycLevel = (v: unknown, fallback: KycLevel = 0): KycLevel => {
  const n = Math.round(Number(v));
  return n === 0 || n === 1 || n === 2 || n === 3 ? n : fallback;
};

export type KycLevelCopy = {
  /** Короткое имя: «Базовый профиль» */
  name: string;
  /** Для менеджера: что гарантирует уровень */
  manager: string;
  /** Для резидентки: как его получить */
  resident: string;
};

type Dict = {
  label: (n: number) => string;
  levels: Record<KycLevel, KycLevelCopy>;
  pickerTitle: string;
  pickerHint: string;
  recommended: string;
  /** Подсказка при повышении уровня у кастинга, на который уже откликались */
  raiseWarning: string;
  needed: (n: number) => string;
  youHave: (n: number) => string;
  belowRequired: (n: number) => string;
  levelsTitle: string;
};

export const KYC_COPY: Record<Lang, Dict> = {
  RU: {
    label: (n) => `KYC ${n}`,
    levels: {
      0: {
        name: "Базовый профиль",
        manager: "Модель только зарегистрировалась и загрузила фото. Анкета может быть заполнена не до конца — минимальный уровень доверия. Подходит для быстрого сбора откликов, если вы готовы сами проверить анкету.",
        resident: "Достаточно зарегистрироваться и загрузить хотя бы одно фото.",
      },
      1: {
        name: "Документы",
        manager: "Модель загрузила паспорт или ID — базовое подтверждение личности по документам.",
        resident: "Загрузите паспорт или ID в разделе верификации.",
      },
      2: {
        name: "Видео-подтверждение",
        manager: "Модель записала видео-кружок: называет текущую дату и подтверждает, что фото и документы принадлежат ей.",
        resident: "Запишите короткое видео: назовите сегодняшнюю дату и подтвердите, что фото и документы ваши.",
      },
      3: {
        name: "Живой контакт",
        manager: "Проведён видеосозвон или личная встреча с представителем или консьержем клуба. Высший уровень доверия — для VIP-туров.",
        resident: "Пройдите видеосозвон или встречу с консьержем клуба.",
      },
    },
    pickerTitle: "Минимальный KYC для отклика",
    pickerHint: "Резидентки ниже этого уровня видят кастинг, но кнопка отклика у них закрыта с подсказкой, что пройти.",
    recommended: "по умолчанию",
    raiseWarning: "Уже поданные отклики сохранятся, но опцион и рукопожатие проверяют текущий уровень. Такие отклики на доске помечены «ниже KYC».",
    needed: (n) => `Нужен KYC ${n}`,
    youHave: (n) => `У вас KYC ${n}`,
    belowRequired: (n) => `Ниже требуемого KYC ${n}`,
    levelsTitle: "Что означают уровни KYC",
  },
  EN: {
    label: (n) => `KYC ${n}`,
    levels: {
      0: {
        name: "Basic profile",
        manager: "The model has only signed up and uploaded photos. The profile may be incomplete — the lowest level of trust. Good for collecting replies fast if you are ready to check the profile yourself.",
        resident: "Sign up and upload at least one photo.",
      },
      1: {
        name: "Documents",
        manager: "The model has uploaded a passport or ID — basic identity confirmation by documents.",
        resident: "Upload your passport or ID in the verification section.",
      },
      2: {
        name: "Video confirmation",
        manager: "The model recorded a short video stating today’s date and confirming the photos and documents are hers.",
        resident: "Record a short video: say today’s date and confirm the photos and documents are yours.",
      },
      3: {
        name: "Live contact",
        manager: "A video call or an in-person meeting with a club representative or concierge took place. The highest level of trust — for VIP tours.",
        resident: "Have a video call or a meeting with the club concierge.",
      },
    },
    pickerTitle: "Minimum KYC to reply",
    pickerHint: "Residents below this level still see the casting, but their reply button is locked with a hint on what to complete.",
    recommended: "default",
    raiseWarning: "Replies already sent stay, but options and the handshake check the current level. Such replies are marked “below KYC” on the board.",
    needed: (n) => `KYC ${n} required`,
    youHave: (n) => `You have KYC ${n}`,
    belowRequired: (n) => `Below required KYC ${n}`,
    levelsTitle: "What the KYC levels mean",
  },
  ES: {
    label: (n) => `KYC ${n}`,
    levels: {
      0: {
        name: "Perfil básico",
        manager: "La modelo solo se registró y subió fotos. El perfil puede estar incompleto: nivel mínimo de confianza. Útil para reunir respuestas rápido si usted revisará el perfil.",
        resident: "Regístrate y sube al menos una foto.",
      },
      1: {
        name: "Documentos",
        manager: "La modelo subió pasaporte o ID: confirmación básica de identidad por documentos.",
        resident: "Sube tu pasaporte o ID en la sección de verificación.",
      },
      2: {
        name: "Confirmación en vídeo",
        manager: "La modelo grabó un vídeo diciendo la fecha actual y confirmando que las fotos y documentos son suyos.",
        resident: "Graba un vídeo corto: di la fecha de hoy y confirma que las fotos y documentos son tuyos.",
      },
      3: {
        name: "Contacto en vivo",
        manager: "Hubo videollamada o reunión en persona con un representante o conserje del club. Máximo nivel de confianza, para tours VIP.",
        resident: "Haz una videollamada o reunión con el conserje del club.",
      },
    },
    pickerTitle: "KYC mínimo para responder",
    pickerHint: "Las residentes por debajo de este nivel ven el casting, pero su botón está bloqueado con una pista de qué completar.",
    recommended: "por defecto",
    raiseWarning: "Las respuestas ya enviadas se mantienen, pero la opción y el apretón de manos comprueban el nivel actual. Se marcan «bajo KYC» en el tablero.",
    needed: (n) => `Se requiere KYC ${n}`,
    youHave: (n) => `Tienes KYC ${n}`,
    belowRequired: (n) => `Por debajo de KYC ${n}`,
    levelsTitle: "Qué significan los niveles KYC",
  },
  PT: {
    label: (n) => `KYC ${n}`,
    levels: {
      0: {
        name: "Perfil básico",
        manager: "A modelo apenas se registrou e enviou fotos. O perfil pode estar incompleto — nível mínimo de confiança. Bom para reunir respostas rápido se você vai conferir o perfil.",
        resident: "Cadastre-se e envie pelo menos uma foto.",
      },
      1: {
        name: "Documentos",
        manager: "A modelo enviou passaporte ou ID — confirmação básica de identidade por documentos.",
        resident: "Envie seu passaporte ou ID na seção de verificação.",
      },
      2: {
        name: "Confirmação em vídeo",
        manager: "A modelo gravou um vídeo dizendo a data atual e confirmando que as fotos e documentos são dela.",
        resident: "Grave um vídeo curto: diga a data de hoje e confirme que as fotos e documentos são seus.",
      },
      3: {
        name: "Contato ao vivo",
        manager: "Houve videochamada ou encontro presencial com um representante ou concierge do clube. Nível máximo de confiança, para tours VIP.",
        resident: "Faça uma videochamada ou encontro com o concierge do clube.",
      },
    },
    pickerTitle: "KYC mínimo para responder",
    pickerHint: "Residentes abaixo deste nível veem o casting, mas o botão fica bloqueado com uma dica do que completar.",
    recommended: "padrão",
    raiseWarning: "Respostas já enviadas permanecem, mas a opção e o aperto de mão verificam o nível atual. Elas aparecem como «abaixo do KYC» no quadro.",
    needed: (n) => `Requer KYC ${n}`,
    youHave: (n) => `Você tem KYC ${n}`,
    belowRequired: (n) => `Abaixo do KYC ${n}`,
    levelsTitle: "O que significam os níveis KYC",
  },
};

export const kycCopy = (lang: Lang): Dict => KYC_COPY[lang] ?? KYC_COPY.EN;
