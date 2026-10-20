/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — тексты гидов по разделам (RU · EN · ES · PT)
 * app/(dashboard)/partner/_components/guides.ts
 *
 * Вёрстка — PartnerGuide.tsx. Здесь только слова и иконки:
 *   flow      механика по шагам (иконка на шаг — GUIDE_ICONS[page].flow)
 *   sections  словарь статусов и кнопок (иконка на раздел — .sections)
 *   tip       короткая подсказка внизу
 *
 * Правила, которые описывают тексты, живут в БД — поменяли порог там,
 * поправьте и здесь:
 *   Trusted       partner_resident_trust: 3+ долетевших тура, 3+ отзыва
 *                 со средней ≥ 4,5 и ни одного срыва за 12 месяцев
 *   Имя открыто   partner_can_reveal: участница была в туре менеджера
 *   Live Snap     свежий ≤ 24 ч, недавний ≤ 7 дн (TrustSignals.snapState)
 *   Отзыв         без комментария публикуется сразу, с комментарием —
 *                 после модерации (partner_review_before_insert)
 * ──────────────────────────────────────────────────────────────────── */

import {
  BadgeCheck,
  Bell,
  Camera,
  ClipboardCheck,
  FileCheck,
  FileText,
  Flag,
  Gauge,
  Handshake,
  History,
  KeyRound,
  Lock,
  MessageSquareQuote,
  PenLine,
  Plane,
  PlaneLanding,
  Radar,
  Repeat,
  ScrollText,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";

export type GuidePage = "command" | "castings" | "manifest" | "room" | "pulse" | "blacklist";

export type GuideItem = { term?: string; text: string };
export type GuideCopy = {
  title: string;
  lead: string;
  flow?: { title: string; steps: { title: string; text: string }[] };
  sections: { title: string; items: GuideItem[] }[];
  tip?: string;
};

export const GUIDE_UI: Record<Lang, { eyebrow: string; show: string; hide: string }> = {
  RU: { eyebrow: "Гид раздела", show: "Как это работает", hide: "Свернуть" },
  EN: { eyebrow: "Section guide", show: "How it works", hide: "Collapse" },
  ES: { eyebrow: "Guía de la sección", show: "Cómo funciona", hide: "Contraer" },
  PT: { eyebrow: "Guia da seção", show: "Como funciona", hide: "Recolher" },
};

export const GUIDE_ICONS: Record<GuidePage, { flow: LucideIcon[]; sections: LucideIcon[] }> = {
  command: { flow: [Sparkles, Handshake, FileText, Flag], sections: [Bell, Plane, Radar, Gauge] },
  castings: { flow: [Send, Sparkles, KeyRound, Handshake], sections: [Lock, Camera, BadgeCheck, ClipboardCheck] },
  manifest: { flow: [ClipboardCheck, Plane, PlaneLanding, Flag], sections: [PenLine, FileCheck, Repeat, ScrollText] },
  room: { flow: [PenLine, Users, Bell, Flag], sections: [FileText, History, Flag, Star] },
  pulse: { flow: [PlaneLanding, Star, BadgeCheck, KeyRound], sections: [Gauge, MessageSquareQuote, Users, KeyRound] },
  blacklist: { flow: [Send, ClipboardCheck, ShieldCheck], sections: [Lock, ShieldCheck, ShieldAlert, Users] },
};

/* ══════════════════════════════════════════════════════════════════
 * РУССКИЙ
 * ══════════════════════════════════════════════════════════════════ */

const RU: Record<GuidePage, GuideCopy> = {
  command: {
    title: "Как устроен Штаб",
    lead: "Штаб — ваш пульт на каждый день. Он собирает всё, что требует решения сегодня, и ведёт в нужный раздел одним касанием. Ничего не нужно искать: срочное поднимается наверх само.",
    flow: {
      title: "Работа партнёра · 4 шага",
      steps: [
        { title: "Кастинг · слепой отбор", text: "Публикуете бриф. Подходящие резидентки отвечают «Готова», вы видите их по коду, Live Snap и Trusted — без имён и контактов." },
        { title: "Рукопожатие и состав", text: "Выдаёте опцион, участница подтверждает. После рукопожатия открываются имя и профиль, состав тура собран." },
        { title: "Комната тура", text: "Условия контракта, подписи всех сторон, паспорта и билеты, напоминания в Telegram и лог тура — в одном месте." },
        { title: "Закрытие и рейтинг", text: "Отмечаете итог по каждой участнице и закрываете тур. Долетевшие получают баллы, вы и участницы оцениваете друг друга." },
      ],
    },
    sections: [
      {
        title: "Требует внимания",
        items: [
          { text: "Лента событий, которые ждут вашего действия: истекающий опцион, неподписанный контракт, недостающие документы, срыв с заменой, новые «Готова»." },
          { term: "Кнопка в строке", text: "Сразу делает нужное: подтвердить, открыть контракт, напомнить в Telegram, открыть кастинг. Закрыли вопрос — строка уходит." },
        ],
      },
      {
        title: "Быстрый доступ и вылеты",
        items: [
          { term: "Быстрый доступ", text: "Плитки ведут в Кастинги, Манифест, Пульс, Чёрный список, Ключи и настройки Telegram-оповещений." },
          { term: "Вылеты · 72 ч", text: "Туры, которые улетают в ближайшие трое суток: рейс, состав, документы и печать контракта. Строка открывает тур." },
        ],
      },
      {
        title: "Радар",
        items: [
          { term: "Новые проверенные", text: "Резидентки, которые недавно прошли верификацию: город, рост, свежесть Live Snap. Старшие Ключи видят новые анкеты раньше — пока доступ ранний, вместо имени замок и таймер." },
          { term: "Чёрный список", text: "Свежие записи клуба. Зелёная плашка значит, что в ваших текущих составах нарушителей нет." },
          { term: "Отзывы", text: "Последние оценки резиденток от менеджеров клуба — помогают выбрать надёжный состав." },
        ],
      },
      {
        title: "Цифры наверху",
        items: [
          { term: "Активные кастинги", text: "Открытые брифы и шорт-листы." },
          { term: "Ответы «Готова»", text: "Сколько резиденток откликнулось на ваши активные кастинги." },
          { term: "Оценка резиденток", text: "Средняя оценка вас от участниц ваших туров — основа Ключа." },
        ],
      },
    ],
    tip: "Начните день со Штаба: если лента «Требует внимания» пуста, а вылеты зелёные — туры идут по плану.",
  },

  castings: {
    title: "Как работает кастинг",
    lead: "Кастинг — закрытый рынок клуба. Вы описываете проект, резидентки сами решают, откликнуться ли. До взаимного рукопожатия никто не видит лишнего: вы выбираете по фактам, а не по фото в соцсетях, и девушки чувствуют себя защищёнными.",
    flow: {
      title: "Путь отклика · 4 шага",
      steps: [
        { title: "Публикация брифа", text: "Город, даты, число мест, гонорар, кто платит перелёт и отель, рост и языки. Бриф видят резидентки, которые подходят по условиям." },
        { title: "Ответы «Готова»", text: "Подходящие участницы отвечают одним касанием. Новые ответы подсвечиваются, пока вы их не открыли." },
        { title: "Опцион и шорт-лист", text: "Опцион мягко держит место за участницей до указанного срока. Отобранные переходят в шорт-лист." },
        { title: "Рукопожатие", text: "Участница подтверждает опцион — открываются имя и профиль, она входит в состав, и для тура создаётся Комната." },
      ],
    },
    sections: [
      {
        title: "Слепой отбор",
        items: [
          { term: "#A-417", text: "Слепой код кандидатки в этом кастинге. До рукопожатия нет ни имени, ни контактов, ни личных сообщений — только факты. Это защищает резиденток от давления и вас — от выбора «по знакомству»." },
          { term: "Замок", text: "Профиль ещё закрыт. После рукопожатия вместо замка появляются инициалы и ссылка на профиль." },
        ],
      },
      {
        title: "Live Snap",
        items: [
          { term: "Кольцо свежести", text: "Live Snap — снимок, сделанный в приложении без фильтров и ретуши. Кольцо показывает, насколько он свежий." },
          { term: "Свежий", text: "Снимку не больше 24 часов — так участница выглядит сейчас." },
          { term: "Недавний", text: "До 7 дней. Старше — серое кольцо: попросите обновить снап перед отбором." },
        ],
      },
      {
        title: "Trusted",
        items: [
          { term: "Бейдж Trusted", text: "Проверенная участница: 3 и больше долетевших тура, 3 и больше отзывов менеджеров со средней от 4,5 и ни одного срыва за 12 месяцев." },
          { text: "Бейдж ставит система по фактам из Voyage, вручную его не выдают и не покупают." },
        ],
      },
      {
        title: "Этапы кастинга",
        items: [
          { term: "Открыт", text: "Принимает ответы «Готова» до срока закрытия." },
          { term: "Шорт-лист", text: "Вы отобрали кандидаток и выдаёте опционы." },
          { term: "Закрыт", text: "Состав собран, кастинг превратился в тур — ссылка «Комната тура» на карточке." },
          { term: "Отменён", text: "Проект не состоялся; участницы получают уведомление." },
        ],
      },
    ],
    tip: "Чем полнее бриф (гонорар, кто платит перелёт и отель, окно отмены), тем больше сильных ответов «Готова».",
  },

  manifest: {
    title: "Как читать Манифест",
    lead: "Манифест — табло всех ваших туров, как в аэропорту: от подтверждения до закрытия. По цвету статуса видно, где всё готово, а где нужна ваша рука. Клик по строке открывает рабочую Комнату тура.",
    flow: {
      title: "Жизненный цикл тура",
      steps: [
        { title: "Подтверждён", text: "Состав собран. Идёт сбор подписей под контрактом, паспортов и билетов." },
        { title: "В туре", text: "Команда на выезде. Табло показывает, когда возвращение." },
        { title: "Закрыт", text: "Тур завершён, итоги отмечены, баллы участницам начислены. В строке — сколько долетели из состава." },
        { title: "Отменён", text: "Тур не состоялся. Строка остаётся в истории, баллы не начисляются." },
      ],
    },
    sections: [
      {
        title: "Печать контракта · Contract Seal",
        items: [
          { term: "Подписан всеми", text: "Последнюю версию условий подписали вы и каждая участница. Печать закрыта — тур защищён." },
          { term: "Подписание", text: "Часть подписей ещё нет: рядом счётчик, сколько стоит и сколько нужно." },
          { term: "Нет контракта", text: "Условия ещё не отправлены — сделайте это в Комнате тура." },
          { term: "v2, v3…", text: "Номер версии. Условия меняются только новой версией, и её снова подписывают все." },
        ],
      },
      {
        title: "Документы · Docs",
        items: [
          { term: "Документы 2/4", text: "Сколько участниц загрузили и прошли проверку паспорта и билетов." },
          { term: "Ждём документы", text: "Кому-то не хватает документов — напомните из Комнаты тура в Telegram." },
          { term: "Проверены", text: "Документы всех участниц подтверждены ассистентом клуба." },
        ],
      },
      {
        title: "Срочная замена · Replacement",
        items: [
          { term: "Срыв → Замена", text: "Участница сорвалась, её место заняла другая. Имя замены видно в строке; новой участнице нужно подписать контракт." },
          { text: "Закрытые замены засчитываются в вашу репутацию на Пульсе." },
        ],
      },
      {
        title: "Фильтры и поиск",
        items: [
          { term: "Требуют действий", text: "Подтверждённые туры, где не хватает подписи, документов или есть замена." },
          { term: "Поиск", text: "По городу, коду аэропорта, номеру рейса или имени участницы." },
        ],
      },
    ],
    tip: "Ближайший вылет всегда в шапке с обратным отсчётом — достаточно взглянуть, чтобы понять, всё ли готово.",
  },

  room: {
    title: "Гид по Комнате тура",
    lead: "Комната — рабочее место одного тура: условия, подписи, документы, связь с участницами и закрытие. Всё, что здесь происходит, записывается в лог, который нельзя изменить.",
    flow: {
      title: "Порядок работы",
      steps: [
        { title: "Условия", text: "Гонорар и его доля, кто платит перелёт и отель, окно бесплатной отмены. «Подписать и отправить» — ваша подпись и запрос подписи участницам." },
        { title: "Подписи и документы", text: "Участницы подписывают в Telegram и загружают паспорт и билеты. Карточка каждой показывает, чего не хватает." },
        { title: "Напоминания", text: "Кнопки «Напомнить о документах» и «Напомнить о подписи» шлют сообщение в Telegram — не чаще раза в 6 часов на участницу." },
        { title: "Закрытие тура", text: "После вылета появляется панель «Закрыть тур · начислить баллы»: отметьте итог по каждой участнице." },
      ],
    },
    sections: [
      {
        title: "Контракт",
        items: [
          { term: "Новая версия", text: "Условия нельзя переписать тихо: каждое изменение — новая версия, старые подписи сбрасываются, подписывают все заново." },
          { term: "Печать", text: "Закрывается, когда подписали вы и каждая участница последней версии." },
          { term: "Нет Telegram", text: "Если у участницы не подключён бот, сообщение не уйдёт — это видно в её карточке." },
        ],
      },
      {
        title: "Лог тура",
        items: [
          { text: "Кто и когда отправил условия, подписал, загрузил документы, был заменён, получил напоминание. Лог пишет сервер, редактировать его нельзя — это общая правда для вас, участниц и клуба." },
        ],
      },
      {
        title: "Закрыть тур · начислить баллы",
        items: [
          { term: "Долетела", text: "Участница отработала тур. Ей автоматически начисляются баллы клуба и штамп страны в паспорт Voyage." },
          { term: "Поздний срыв", text: "Отказалась слишком поздно, когда замену найти уже трудно. Снижает её процент надёжности." },
          { term: "Неявка", text: "Не явилась без предупреждения. Сильнее всего снижает надёжность; возможна заявка в чёрный список." },
          { term: "Снята", text: "Вы сами сняли участницу с тура (по договорённости). Надёжность не меняется, баллов нет." },
        ],
      },
      {
        title: "Почему важна честность",
        items: [
          { text: "Ваши отметки — единственный источник фактов о туре. От них зависят баллы девушек, их статус Trusted и то, кого клуб предложит вам и другим менеджерам в следующий раз. Закрытие окончательное: после него комната только для чтения." },
        ],
      },
    ],
    tip: "Не нашли страну тура в данных — укажите ISO-код (например, AE) в панели закрытия, иначе штамп в паспорт не появится.",
  },

  pulse: {
    title: "Как складывается ваша репутация",
    lead: "Пульс показывает, каким партнёром вас видит клуб. Репутация строится на трёх фактах: участницы долетают, срывы закрываются заменой, резидентки честно оценивают работу с вами.",
    flow: {
      title: "Круг доверия",
      steps: [
        { title: "Тур закрыт", text: "Вы отмечаете итог по каждой участнице — это попадает в график явки." },
        { title: "Взаимные оценки", text: "Вы оцениваете участниц, участницы — вас. Обе стороны видят только честные факты." },
        { title: "Trusted у девушек", text: "Ваши оценки вместе с оценками других менеджеров формируют статус Trusted у резиденток." },
        { title: "Ваш Ключ", text: "Закрытые туры и средняя оценка от резиденток поднимают вас до Gold и Platinum Key." },
      ],
    },
    sections: [
      {
        title: "Явка и замены",
        items: [
          { term: "Show Rate", text: "Доля подтверждённых участниц, которые долетели, за 12 месяцев." },
          { term: "График по месяцам", text: "Золото — долетели, красный — сорвались. Ровный золотой ряд — признак сильного партнёра." },
          { term: "Замены", text: "Сколько срывов вы закрыли заменой из всех срывов за год." },
        ],
      },
      {
        title: "Отзывы резиденток о вас",
        items: [
          { term: "Анонимно", text: "Вы видите только город, тип проекта, оценку и теги — никогда имя автора. Иначе девушки боялись бы оценивать честно." },
          { term: "5 критериев", text: "Оплата вовремя, тур как в брифе, организация, уважение и безопасность, на связи." },
          { term: "Модерация", text: "Отзыв без текста публикуется сразу, с комментарием — после проверки клуба." },
        ],
      },
      {
        title: "Ваши оценки участниц",
        items: [
          { term: "Ждут вашей оценки", text: "Участницы вернувшихся туров. Звёзды и профессиональные теги: пунктуальна, профессиональна, как на снапах, на связи, командная." },
          { text: "Внешность здесь не оценивается — её подтверждают Live Snaps. Оценка уходит в профиль участницы и формирует её Trusted." },
        ],
      },
      {
        title: "Связь с Ключом",
        items: [
          { text: "Ключ считается по закрытым турам и средней оценке резиденток о вас (от 4,5 для Gold и Platinum). Честно оценивая участниц, вы растите пул надёжных девушек — и чаще закрываете туры без срывов." },
        ],
      },
    ],
  },

  blacklist: {
    title: "Правила безопасности и приватности",
    lead: "Чёрный список — общая защита клуба от неявок, поддельных фото и мошенничества. Записи вносит только клуб после проверки доказательств; менеджер сообщает о случае, а приватность участниц соблюдается на каждом шаге.",
    flow: {
      title: "Заявка в список · 3 шага",
      steps: [
        { title: "Сообщить клубу", text: "Нажмите «Сообщить клубу», выберите участницу своего тура, причину и опишите, что произошло: даты, договорённости, переписка." },
        { title: "На проверке", text: "Заявка получает статус «На проверке». Её видите только вы и администрация; участница и другие менеджеры — нет." },
        { title: "Решение клуба", text: "Ассистент проверяет доказательства и переводит запись в «Подтверждено», «На апелляции» или снимает её." },
      ],
    },
    sections: [
      {
        title: "Почему имена закрыты",
        items: [
          { term: "#R-204 и замок", text: "Код записи вместо имени. Имя и профиль открыты, только если участница была в ваших турах, — чужие истории клуба остаются приватными." },
          { term: "Была в вашем туре", text: "Такие записи открыты: вы работали с участницей и можете посмотреть её профиль." },
        ],
      },
      {
        title: "Текущие составы чисты",
        items: [
          { text: "Зелёная плашка в шапке: никого из ваших активных составов и опционов нет в списке. Если плашка красная — участница вашего тура попала в список, проверьте Манифест." },
        ],
      },
      {
        title: "Статусы записи",
        items: [
          { term: "На проверке", text: "Ваша заявка ждёт решения клуба." },
          { term: "Подтверждено", text: "Нарушение доказано. Неявка хранится 12 месяцев, мошенничество — бессрочно." },
          { term: "На апелляции", text: "Участница оспаривает запись, клуб пересматривает доказательства." },
          { term: "Снято", text: "Запись отозвана — участница снова чиста." },
        ],
      },
      {
        title: "Что видит менеджер",
        items: [
          { text: "Причину, даты, срок хранения и сколько доказательств проверено — но не сами файлы. Доказательства хранятся у клуба." },
        ],
      },
    ],
    tip: "Одна активная заявка на участницу: пока клуб проверяет первую, вторую отправить нельзя.",
  },
};

/* ══════════════════════════════════════════════════════════════════
 * ENGLISH
 * ══════════════════════════════════════════════════════════════════ */

const EN: Record<GuidePage, GuideCopy> = {
  command: {
    title: "How Command works",
    lead: "Command is your everyday desk. It gathers everything that needs a decision today and takes you to the right section in one tap. Nothing to look for: urgent items rise to the top on their own.",
    flow: {
      title: "The partner’s work · 4 steps",
      steps: [
        { title: "Casting · blind selection", text: "Publish a brief. Matching residents reply “Ready”; you see them by code, Live Snap and Trusted — no names, no contacts." },
        { title: "Handshake & crew", text: "Give an option, the participant confirms. After the handshake her name and profile open and the crew is set." },
        { title: "Deal room", text: "Contract terms, everyone’s signatures, passports and tickets, Telegram reminders and the tour log — in one place." },
        { title: "Closing & ratings", text: "Mark each participant’s outcome and close the tour. Those who flew get points; you and the participants rate each other." },
      ],
    },
    sections: [
      {
        title: "Needs attention",
        items: [
          { text: "A feed of events waiting for you: an expiring option, an unsigned contract, missing documents, a drop with a replacement, new “Ready” replies." },
          { term: "Row button", text: "Does the job right away: confirm, open the contract, remind in Telegram, open the casting. Once handled, the row disappears." },
        ],
      },
      {
        title: "Quick access & departures",
        items: [
          { term: "Quick access", text: "Tiles lead to Castings, Manifest, Pulse, Blacklist, Keys and Telegram notification settings." },
          { term: "Departures · 72h", text: "Tours leaving within three days: flight, crew, documents and contract seal. The row opens the tour." },
        ],
      },
      {
        title: "Radar",
        items: [
          { term: "Newly verified", text: "Residents who recently passed verification: city, height, Live Snap freshness. Higher Keys see new profiles first — during early access you see a lock and a timer instead of a name." },
          { term: "Blacklist", text: "Fresh club entries. The green badge means none of your current crews are on the list." },
          { term: "Reviews", text: "Latest ratings of residents by club managers — help you choose a reliable crew." },
        ],
      },
      {
        title: "Numbers at the top",
        items: [
          { term: "Active castings", text: "Open briefs and shortlists." },
          { term: "“Ready” replies", text: "How many residents replied to your active castings." },
          { term: "Resident rating", text: "Your average rating from participants of your tours — the basis of your Key." },
        ],
      },
    ],
    tip: "Start the day at Command: if “Needs attention” is empty and departures are green, your tours are on track.",
  },

  castings: {
    title: "How castings work",
    lead: "Castings are the club’s closed market. You describe the project and residents decide for themselves whether to reply. Until the mutual handshake nobody sees more than needed: you choose on facts, not social-media photos, and residents feel protected.",
    flow: {
      title: "The path of a reply · 4 steps",
      steps: [
        { title: "Publish the brief", text: "City, dates, slots, fee, who covers flight and hotel, height and languages. Residents who match the terms see it." },
        { title: "“Ready” replies", text: "Matching participants reply in one tap. New replies stay highlighted until you open them." },
        { title: "Option & shortlist", text: "An option softly holds a spot for a participant until a set date. Chosen candidates move to the shortlist." },
        { title: "Handshake", text: "The participant confirms the option — her name and profile open, she joins the crew and a deal room is created for the tour." },
      ],
    },
    sections: [
      {
        title: "Blind selection",
        items: [
          { term: "#A-417", text: "The candidate’s blind code in this casting. Before the handshake there is no name, no contacts, no private messages — only facts. It protects residents from pressure and you from picking “by acquaintance”." },
          { term: "Lock", text: "The profile is still closed. After the handshake the lock turns into initials and a profile link." },
        ],
      },
      {
        title: "Live Snap",
        items: [
          { term: "Freshness ring", text: "A Live Snap is a photo taken in the app with no filters or retouching. The ring shows how fresh it is." },
          { term: "Fresh", text: "Taken within 24 hours — this is how she looks now." },
          { term: "Recent", text: "Up to 7 days. Older means a grey ring: ask for a new snap before selecting." },
        ],
      },
      {
        title: "Trusted",
        items: [
          { term: "Trusted badge", text: "A proven participant: 3+ tours flown, 3+ manager reviews averaging 4.5 or more, and no drops in 12 months." },
          { text: "The system awards the badge from facts inside Voyage; it can’t be granted by hand or bought." },
        ],
      },
      {
        title: "Casting stages",
        items: [
          { term: "Open", text: "Accepts “Ready” replies until the closing time." },
          { term: "Shortlist", text: "You have picked candidates and are giving options." },
          { term: "Closed", text: "The crew is set and the casting became a tour — see “Deal room” on the card." },
          { term: "Cancelled", text: "The project didn’t happen; participants are notified." },
        ],
      },
    ],
    tip: "The fuller the brief (fee, who covers flight and hotel, cancellation window), the more strong “Ready” replies you get.",
  },

  manifest: {
    title: "How to read the Manifest",
    lead: "The Manifest is a board of all your tours, like at an airport: from confirmation to closing. Status colours show where everything is ready and where your hand is needed. Clicking a row opens the tour’s deal room.",
    flow: {
      title: "A tour’s life cycle",
      steps: [
        { title: "Confirmed", text: "The crew is set. Contract signatures, passports and tickets are being collected." },
        { title: "On tour", text: "The team is away. The board shows when they return." },
        { title: "Closed", text: "The tour is over, outcomes are marked, points awarded. The row shows how many of the crew flew." },
        { title: "Cancelled", text: "The tour didn’t happen. The row stays in history; no points are awarded." },
      ],
    },
    sections: [
      {
        title: "Contract Seal",
        items: [
          { term: "Signed by all", text: "You and every participant signed the latest terms. The seal is closed — the tour is protected." },
          { term: "Signing", text: "Some signatures are missing: the counter shows how many are in and how many are needed." },
          { term: "No contract", text: "Terms haven’t been sent yet — do it in the deal room." },
          { term: "v2, v3…", text: "Version number. Terms change only through a new version, which everyone signs again." },
        ],
      },
      {
        title: "Docs",
        items: [
          { term: "Docs 2/4", text: "How many participants uploaded passports and tickets and passed the check." },
          { term: "Waiting for docs", text: "Someone is missing documents — send a Telegram reminder from the deal room." },
          { term: "Verified", text: "All participants’ documents are confirmed by the club assistant." },
        ],
      },
      {
        title: "Replacement",
        items: [
          { term: "Drop → Replacement", text: "A participant dropped and another took her place. The replacement’s name is in the row; she needs to sign the contract." },
          { text: "Closed replacements count toward your reputation on Pulse." },
        ],
      },
      {
        title: "Filters & search",
        items: [
          { term: "Needs action", text: "Confirmed tours missing a signature or documents, or with a replacement." },
          { term: "Search", text: "By city, airport code, flight number or participant’s name." },
        ],
      },
    ],
    tip: "The next departure is always in the header with a countdown — one glance tells you whether everything is ready.",
  },

  room: {
    title: "Deal room guide",
    lead: "The room is the workspace of one tour: terms, signatures, documents, contact with participants and closing. Everything that happens here is written to a log that can’t be edited.",
    flow: {
      title: "Order of work",
      steps: [
        { title: "Terms", text: "Fee and its split, who covers flight and hotel, the free-cancellation window. “Sign and send” adds your signature and requests the participants’." },
        { title: "Signatures & docs", text: "Participants sign in Telegram and upload passports and tickets. Each card shows what is missing." },
        { title: "Reminders", text: "“Remind about documents” and “Remind to sign” send a Telegram message — at most once every 6 hours per participant." },
        { title: "Closing the tour", text: "After departure the “Close tour · award points” panel appears: mark each participant’s outcome." },
      ],
    },
    sections: [
      {
        title: "Contract",
        items: [
          { term: "New version", text: "Terms can’t be rewritten quietly: every change is a new version, old signatures reset and everyone signs again." },
          { term: "Seal", text: "Closes once you and every participant have signed the latest version." },
          { term: "No Telegram", text: "If a participant hasn’t connected the bot, the message won’t go out — you’ll see it on her card." },
        ],
      },
      {
        title: "Tour log",
        items: [
          { text: "Who sent terms, signed, uploaded documents, was replaced or reminded, and when. The server writes the log and nobody can edit it — it is the shared truth for you, participants and the club." },
        ],
      },
      {
        title: "Close tour · award points",
        items: [
          { term: "Flew", text: "The participant worked the tour. Club points and the country stamp in her Voyage passport are awarded automatically." },
          { term: "Late drop", text: "Pulled out too late to find a replacement easily. Lowers her reliability." },
          { term: "No-show", text: "Didn’t turn up without warning. Lowers reliability the most; a blacklist report is possible." },
          { term: "Released", text: "You released her from the tour by agreement. Reliability doesn’t change; no points." },
        ],
      },
      {
        title: "Why honesty matters",
        items: [
          { text: "Your marks are the only source of facts about the tour. Residents’ points, their Trusted status and whom the club suggests to you and other managers next time all depend on them. Closing is final: afterwards the room is read-only." },
        ],
      },
    ],
    tip: "If the tour’s country isn’t set, enter its ISO code (e.g. AE) in the closing panel — otherwise no passport stamp appears.",
  },

  pulse: {
    title: "How your reputation is built",
    lead: "Pulse shows how the club sees you as a partner. Reputation rests on three facts: participants fly, drops are covered with replacements, and residents rate working with you honestly.",
    flow: {
      title: "The circle of trust",
      steps: [
        { title: "Tour closed", text: "You mark each participant’s outcome — it goes into the show-rate chart." },
        { title: "Mutual ratings", text: "You rate the participants, they rate you. Both sides see only honest facts." },
        { title: "Residents’ Trusted", text: "Your ratings, together with other managers’, shape residents’ Trusted status." },
        { title: "Your Key", text: "Closed tours and your average rating from residents raise you to Gold and Platinum Key." },
      ],
    },
    sections: [
      {
        title: "Show rate & replacements",
        items: [
          { term: "Show Rate", text: "Share of confirmed participants who flew over 12 months." },
          { term: "Monthly chart", text: "Gold — flew, red — dropped. An even gold row is the mark of a strong partner." },
          { term: "Replacements", text: "How many drops you covered with a replacement out of all drops this year." },
        ],
      },
      {
        title: "Residents’ reviews of you",
        items: [
          { term: "Anonymous", text: "You see only city, project type, rating and tags — never the author’s name. Otherwise residents would be afraid to rate honestly." },
          { term: "5 criteria", text: "Paid on time, tour as in the brief, organisation, respect & safety, responsiveness." },
          { term: "Moderation", text: "A review without text is published at once; one with a comment goes live after the club checks it." },
        ],
      },
      {
        title: "Your ratings of participants",
        items: [
          { term: "Waiting for your rating", text: "Participants of returned tours. Stars and professional tags: punctual, professional, as in the snaps, responsive, team player." },
          { text: "Looks aren’t rated here — Live Snaps confirm them. The rating goes into her profile and shapes her Trusted status." },
        ],
      },
      {
        title: "Link to your Key",
        items: [
          { text: "Your Key counts closed tours and residents’ average rating of you (4.5+ for Gold and Platinum). Rating participants honestly grows a pool of reliable residents — and you close more tours without drops." },
        ],
      },
    ],
  },

  blacklist: {
    title: "Safety & privacy rules",
    lead: "The blacklist is the club’s shared protection against no-shows, fake photos and fraud. Only the club adds entries, after checking evidence; a manager reports a case, and participants’ privacy is kept at every step.",
    flow: {
      title: "Reporting · 3 steps",
      steps: [
        { title: "Report to the club", text: "Tap “Report to the club”, choose a participant of your tour and a reason, and describe what happened: dates, agreements, messages." },
        { title: "Under review", text: "The report gets “Under review”. Only you and the administration see it — not the participant or other managers." },
        { title: "Club decision", text: "The assistant checks the evidence and moves the entry to “Confirmed”, “Under appeal”, or revokes it." },
      ],
    },
    sections: [
      {
        title: "Why names are hidden",
        items: [
          { term: "#R-204 and a lock", text: "An entry code instead of a name. Name and profile are open only if the participant was on your tours — other club stories stay private." },
          { term: "Was in your tour", text: "These entries are open: you worked with her and can view her profile." },
        ],
      },
      {
        title: "Current crews are clean",
        items: [
          { text: "The green badge in the header: nobody from your active crews and options is on the list. If it turns red, a participant of your tour is on the list — check the Manifest." },
        ],
      },
      {
        title: "Entry statuses",
        items: [
          { term: "Under review", text: "Your report is waiting for the club’s decision." },
          { term: "Confirmed", text: "The violation is proven. A no-show is kept 12 months, fraud — permanently." },
          { term: "Under appeal", text: "The participant disputes the entry; the club re-examines the evidence." },
          { term: "Revoked", text: "The entry is withdrawn — the participant is clean again." },
        ],
      },
      {
        title: "What a manager sees",
        items: [
          { text: "The reason, dates, retention period and how many pieces of evidence were checked — but not the files. Evidence stays with the club." },
        ],
      },
    ],
    tip: "One open report per participant: while the club reviews the first, a second can’t be sent.",
  },
};

/* ══════════════════════════════════════════════════════════════════
 * ESPAÑOL
 * ══════════════════════════════════════════════════════════════════ */

const ES: Record<GuidePage, GuideCopy> = {
  command: {
    title: "Cómo funciona el Cuartel",
    lead: "El Cuartel es tu mesa de trabajo diaria. Reúne todo lo que requiere una decisión hoy y te lleva a la sección correcta con un toque. No hay que buscar nada: lo urgente sube solo.",
    flow: {
      title: "El trabajo del socio · 4 pasos",
      steps: [
        { title: "Casting · selección a ciegas", text: "Publicas un brief. Las residentes que encajan responden «Lista»; las ves por código, Live Snap y Trusted, sin nombres ni contactos." },
        { title: "Apretón de manos y equipo", text: "Das una opción y la participante la confirma. Tras el apretón de manos se abren su nombre y perfil, y el equipo queda formado." },
        { title: "Sala del tour", text: "Condiciones del contrato, firmas de todas las partes, pasaportes y billetes, recordatorios en Telegram y el registro del tour, en un solo lugar." },
        { title: "Cierre y valoraciones", text: "Marcas el resultado de cada participante y cierras el tour. Las que volaron reciben puntos; tú y ellas os valoráis mutuamente." },
      ],
    },
    sections: [
      {
        title: "Requiere atención",
        items: [
          { text: "Eventos que esperan tu acción: una opción que vence, un contrato sin firmar, documentos pendientes, una baja con reemplazo, nuevas respuestas «Lista»." },
          { term: "Botón de la fila", text: "Hace lo necesario al instante: confirmar, abrir el contrato, recordar en Telegram, abrir el casting. Resuelto, la fila desaparece." },
        ],
      },
      {
        title: "Acceso rápido y salidas",
        items: [
          { term: "Acceso rápido", text: "Las tarjetas llevan a Castings, Manifiesto, Pulso, Lista negra, Llaves y los avisos de Telegram." },
          { term: "Salidas · 72 h", text: "Tours que salen en los próximos tres días: vuelo, equipo, documentos y sello del contrato. La fila abre el tour." },
        ],
      },
      {
        title: "Radar",
        items: [
          { term: "Nuevas verificadas", text: "Residentes que pasaron la verificación hace poco: ciudad, altura, frescura del Live Snap. Las Llaves superiores ven los perfiles antes; durante el acceso anticipado verás un candado y un temporizador en lugar del nombre." },
          { term: "Lista negra", text: "Entradas recientes del club. La insignia verde indica que tus equipos actuales están limpios." },
          { term: "Reseñas", text: "Últimas valoraciones de residentes por gerentes del club: ayudan a elegir un equipo fiable." },
        ],
      },
      {
        title: "Cifras de arriba",
        items: [
          { term: "Castings activos", text: "Briefs abiertos y listas cortas." },
          { term: "Respuestas «Lista»", text: "Cuántas residentes respondieron a tus castings activos." },
          { term: "Valoración", text: "Tu valoración media por las participantes de tus tours: la base de tu Llave." },
        ],
      },
    ],
    tip: "Empieza el día en el Cuartel: si «Requiere atención» está vacío y las salidas están en verde, tus tours van según lo previsto.",
  },

  castings: {
    title: "Cómo funciona el casting",
    lead: "El casting es el mercado cerrado del club. Describes el proyecto y las residentes deciden si responder. Hasta el apretón de manos mutuo nadie ve más de lo necesario: eliges por hechos, no por fotos de redes, y ellas se sienten protegidas.",
    flow: {
      title: "El camino de una respuesta · 4 pasos",
      steps: [
        { title: "Publicar el brief", text: "Ciudad, fechas, plazas, honorario, quién paga vuelo y hotel, altura e idiomas. Lo ven las residentes que cumplen las condiciones." },
        { title: "Respuestas «Lista»", text: "Las participantes que encajan responden con un toque. Las nuevas quedan resaltadas hasta que las abras." },
        { title: "Opción y lista corta", text: "La opción reserva suavemente una plaza hasta una fecha. Las elegidas pasan a la lista corta." },
        { title: "Apretón de manos", text: "La participante confirma la opción: se abren su nombre y perfil, entra en el equipo y se crea la sala del tour." },
      ],
    },
    sections: [
      {
        title: "Selección a ciegas",
        items: [
          { term: "#A-417", text: "Código ciego de la candidata en este casting. Antes del apretón de manos no hay nombre, ni contactos, ni mensajes privados: solo hechos. Protege a las residentes de la presión y a ti de elegir «por amistad»." },
          { term: "Candado", text: "El perfil sigue cerrado. Tras el apretón de manos aparecen las iniciales y el enlace al perfil." },
        ],
      },
      {
        title: "Live Snap",
        items: [
          { term: "Anillo de frescura", text: "Un Live Snap es una foto hecha en la app sin filtros ni retoques. El anillo muestra lo reciente que es." },
          { term: "Fresco", text: "Hecho en las últimas 24 horas: así luce ahora." },
          { term: "Reciente", text: "Hasta 7 días. Si es más antiguo, el anillo es gris: pide un snap nuevo antes de elegir." },
        ],
      },
      {
        title: "Trusted",
        items: [
          { term: "Insignia Trusted", text: "Participante comprobada: 3 o más tours volados, 3 o más reseñas de gerentes con media de 4,5 o más y ninguna baja en 12 meses." },
          { text: "El sistema la otorga con hechos de Voyage; no se concede a mano ni se compra." },
        ],
      },
      {
        title: "Etapas del casting",
        items: [
          { term: "Abierto", text: "Acepta respuestas «Lista» hasta la hora de cierre." },
          { term: "Lista corta", text: "Has elegido candidatas y das opciones." },
          { term: "Cerrado", text: "El equipo está formado y el casting se convirtió en tour: ver «Sala del tour» en la tarjeta." },
          { term: "Cancelado", text: "El proyecto no se realizó; las participantes reciben aviso." },
        ],
      },
    ],
    tip: "Cuanto más completo el brief (honorario, quién paga vuelo y hotel, ventana de cancelación), más respuestas «Lista» de calidad.",
  },

  manifest: {
    title: "Cómo leer el Manifiesto",
    lead: "El Manifiesto es un tablero de todos tus tours, como en un aeropuerto: de la confirmación al cierre. Los colores muestran dónde todo está listo y dónde hace falta tu mano. Un clic en la fila abre la sala del tour.",
    flow: {
      title: "Ciclo de vida del tour",
      steps: [
        { title: "Confirmado", text: "El equipo está formado. Se recogen firmas del contrato, pasaportes y billetes." },
        { title: "En tour", text: "El equipo está de viaje. El tablero muestra cuándo vuelve." },
        { title: "Cerrado", text: "Tour terminado, resultados marcados y puntos otorgados. La fila muestra cuántas del equipo volaron." },
        { title: "Cancelado", text: "El tour no se realizó. Queda en el historial; no hay puntos." },
      ],
    },
    sections: [
      {
        title: "Sello del contrato · Contract Seal",
        items: [
          { term: "Firmado por todas", text: "Tú y cada participante firmasteis las últimas condiciones. El sello está cerrado: el tour está protegido." },
          { term: "Firmando", text: "Faltan firmas: el contador muestra cuántas hay y cuántas se necesitan." },
          { term: "Sin contrato", text: "Aún no se enviaron las condiciones: hazlo en la sala del tour." },
          { term: "v2, v3…", text: "Número de versión. Las condiciones solo cambian con una nueva versión, que todas firman de nuevo." },
        ],
      },
      {
        title: "Documentos · Docs",
        items: [
          { term: "Documentos 2/4", text: "Cuántas participantes subieron pasaporte y billetes y pasaron la revisión." },
          { term: "Faltan documentos", text: "A alguien le faltan documentos: envía un recordatorio por Telegram desde la sala." },
          { term: "Verificados", text: "Los documentos de todas están confirmados por la asistente del club." },
        ],
      },
      {
        title: "Reemplazo urgente · Replacement",
        items: [
          { term: "Baja → Reemplazo", text: "Una participante se dio de baja y otra ocupó su lugar. Su nombre aparece en la fila; debe firmar el contrato." },
          { text: "Los reemplazos cerrados suman a tu reputación en Pulso." },
        ],
      },
      {
        title: "Filtros y búsqueda",
        items: [
          { term: "Requieren acción", text: "Tours confirmados a los que les falta una firma o documentos, o con reemplazo." },
          { term: "Búsqueda", text: "Por ciudad, código de aeropuerto, número de vuelo o nombre de la participante." },
        ],
      },
    ],
    tip: "La próxima salida siempre está en la cabecera con cuenta atrás: un vistazo basta para saber si todo está listo.",
  },

  room: {
    title: "Guía de la sala del tour",
    lead: "La sala es el espacio de trabajo de un tour: condiciones, firmas, documentos, contacto con las participantes y cierre. Todo lo que ocurre aquí queda en un registro que no se puede editar.",
    flow: {
      title: "Orden de trabajo",
      steps: [
        { title: "Condiciones", text: "Honorario y reparto, quién paga vuelo y hotel, ventana de cancelación gratuita. «Firmar y enviar» añade tu firma y pide la de las participantes." },
        { title: "Firmas y documentos", text: "Las participantes firman en Telegram y suben pasaporte y billetes. Cada tarjeta muestra lo que falta." },
        { title: "Recordatorios", text: "«Recordar documentos» y «Recordar firma» envían un mensaje por Telegram, como máximo cada 6 horas por participante." },
        { title: "Cierre del tour", text: "Tras la salida aparece el panel «Cerrar tour · otorgar puntos»: marca el resultado de cada participante." },
      ],
    },
    sections: [
      {
        title: "Contrato",
        items: [
          { term: "Nueva versión", text: "Las condiciones no se reescriben en silencio: cada cambio es una nueva versión, las firmas se reinician y todas firman otra vez." },
          { term: "Sello", text: "Se cierra cuando tú y cada participante habéis firmado la última versión." },
          { term: "Sin Telegram", text: "Si la participante no conectó el bot, el mensaje no sale; lo verás en su tarjeta." },
        ],
      },
      {
        title: "Registro del tour",
        items: [
          { text: "Quién y cuándo envió condiciones, firmó, subió documentos, fue reemplazada o recibió un recordatorio. Lo escribe el servidor y nadie puede editarlo: es la verdad común para ti, las participantes y el club." },
        ],
      },
      {
        title: "Cerrar tour · otorgar puntos",
        items: [
          { term: "Voló", text: "La participante cumplió el tour. Recibe automáticamente puntos del club y el sello del país en su pasaporte Voyage." },
          { term: "Baja tardía", text: "Se retiró demasiado tarde para encontrar reemplazo con facilidad. Baja su fiabilidad." },
          { term: "Ausencia", text: "No se presentó sin avisar. Es lo que más baja la fiabilidad; cabe un reporte a la lista negra." },
          { term: "Liberada", text: "La retiraste del tour de mutuo acuerdo. La fiabilidad no cambia; sin puntos." },
        ],
      },
      {
        title: "Por qué importa la honestidad",
        items: [
          { text: "Tus marcas son la única fuente de hechos sobre el tour. De ellas dependen los puntos de las residentes, su estado Trusted y a quién propondrá el club a ti y a otros gerentes. El cierre es definitivo: después la sala es de solo lectura." },
        ],
      },
    ],
    tip: "Si el país del tour no está definido, introduce su código ISO (p. ej. AE) en el panel de cierre; si no, no aparecerá el sello.",
  },

  pulse: {
    title: "Cómo se construye tu reputación",
    lead: "Pulso muestra cómo te ve el club como socio. La reputación se apoya en tres hechos: las participantes vuelan, las bajas se cubren con reemplazos y las residentes valoran con honestidad el trabajo contigo.",
    flow: {
      title: "El círculo de confianza",
      steps: [
        { title: "Tour cerrado", text: "Marcas el resultado de cada participante: entra en el gráfico de asistencia." },
        { title: "Valoraciones mutuas", text: "Tú valoras a las participantes y ellas a ti. Ambas partes ven solo hechos honestos." },
        { title: "Trusted de las residentes", text: "Tus valoraciones, junto con las de otros gerentes, forman el estado Trusted de las residentes." },
        { title: "Tu Llave", text: "Los tours cerrados y tu valoración media de las residentes te suben a Gold y Platinum Key." },
      ],
    },
    sections: [
      {
        title: "Asistencia y reemplazos",
        items: [
          { term: "Show Rate", text: "Proporción de participantes confirmadas que volaron en 12 meses." },
          { term: "Gráfico mensual", text: "Dorado: volaron; rojo: bajas. Una fila dorada pareja es señal de un socio fuerte." },
          { term: "Reemplazos", text: "Cuántas bajas cubriste con reemplazo del total del año." },
        ],
      },
      {
        title: "Reseñas de las residentes",
        items: [
          { term: "Anónimas", text: "Ves solo ciudad, tipo de proyecto, valoración y etiquetas, nunca el nombre de la autora. Si no, temerían valorar con honestidad." },
          { term: "5 criterios", text: "Pago puntual, tour como en el brief, organización, respeto y seguridad, disponibilidad." },
          { term: "Moderación", text: "Una reseña sin texto se publica al instante; con comentario, tras la revisión del club." },
        ],
      },
      {
        title: "Tus valoraciones de participantes",
        items: [
          { term: "Pendientes", text: "Participantes de tours ya de vuelta. Estrellas y etiquetas profesionales: puntual, profesional, como en los snaps, disponible, buena compañera." },
          { text: "Aquí no se valora el físico: lo confirman los Live Snaps. La valoración va a su perfil y forma su Trusted." },
        ],
      },
      {
        title: "Relación con tu Llave",
        items: [
          { text: "Tu Llave cuenta los tours cerrados y la valoración media que te dan las residentes (4,5+ para Gold y Platinum). Valorar con honestidad hace crecer un grupo de residentes fiables, y cierras más tours sin bajas." },
        ],
      },
    ],
  },

  blacklist: {
    title: "Reglas de seguridad y privacidad",
    lead: "La lista negra es la protección común del club frente a ausencias, fotos falsas y fraude. Solo el club añade entradas, tras revisar las pruebas; el gerente informa del caso y la privacidad de las participantes se respeta en cada paso.",
    flow: {
      title: "Reporte · 3 pasos",
      steps: [
        { title: "Informar al club", text: "Pulsa «Informar al club», elige a una participante de tu tour y el motivo, y describe lo ocurrido: fechas, acuerdos, mensajes." },
        { title: "En revisión", text: "El reporte pasa a «En revisión». Solo lo veis tú y la administración, no la participante ni otros gerentes." },
        { title: "Decisión del club", text: "La asistente revisa las pruebas y pasa la entrada a «Confirmada», «En apelación» o la retira." },
      ],
    },
    sections: [
      {
        title: "Por qué hay nombres ocultos",
        items: [
          { term: "#R-204 y candado", text: "Un código en lugar del nombre. El nombre y el perfil solo se abren si la participante estuvo en tus tours: las demás historias del club son privadas." },
          { term: "Estuvo en tu tour", text: "Estas entradas están abiertas: trabajaste con ella y puedes ver su perfil." },
        ],
      },
      {
        title: "Equipos actuales limpios",
        items: [
          { text: "La insignia verde de la cabecera: nadie de tus equipos y opciones activos está en la lista. Si se vuelve roja, una participante de tu tour está en la lista: revisa el Manifiesto." },
        ],
      },
      {
        title: "Estados de la entrada",
        items: [
          { term: "En revisión", text: "Tu reporte espera la decisión del club." },
          { term: "Confirmada", text: "La infracción está probada. Una ausencia se guarda 12 meses; el fraude, para siempre." },
          { term: "En apelación", text: "La participante impugna la entrada; el club vuelve a revisar las pruebas." },
          { term: "Retirada", text: "La entrada se anuló: la participante vuelve a estar limpia." },
        ],
      },
      {
        title: "Qué ve el gerente",
        items: [
          { text: "El motivo, las fechas, el plazo y cuántas pruebas se revisaron, pero no los archivos. Las pruebas quedan en el club." },
        ],
      },
    ],
    tip: "Un reporte abierto por participante: mientras el club revisa el primero, no se puede enviar otro.",
  },
};

/* ══════════════════════════════════════════════════════════════════
 * PORTUGUÊS
 * ══════════════════════════════════════════════════════════════════ */

const PT: Record<GuidePage, GuideCopy> = {
  command: {
    title: "Como funciona o Quartel",
    lead: "O Quartel é a sua mesa de trabalho diária. Reúne tudo o que exige decisão hoje e leva à seção certa com um toque. Não é preciso procurar: o urgente sobe sozinho.",
    flow: {
      title: "O trabalho do parceiro · 4 passos",
      steps: [
        { title: "Casting · seleção às cegas", text: "Você publica um brief. As residentes compatíveis respondem «Pronta»; você as vê por código, Live Snap e Trusted, sem nomes nem contatos." },
        { title: "Aperto de mão e equipe", text: "Você dá uma opção e a participante confirma. Depois do aperto de mão, nome e perfil se abrem e a equipe está formada." },
        { title: "Sala do tour", text: "Condições do contrato, assinaturas de todas as partes, passaportes e passagens, lembretes no Telegram e o registro do tour, num só lugar." },
        { title: "Fechamento e avaliações", text: "Você marca o resultado de cada participante e fecha o tour. Quem voou recebe pontos; você e elas se avaliam mutuamente." },
      ],
    },
    sections: [
      {
        title: "Requer atenção",
        items: [
          { text: "Eventos que aguardam sua ação: opção vencendo, contrato sem assinatura, documentos faltando, desistência com substituição, novas respostas «Pronta»." },
          { term: "Botão da linha", text: "Faz o necessário na hora: confirmar, abrir o contrato, lembrar no Telegram, abrir o casting. Resolvido, a linha some." },
        ],
      },
      {
        title: "Acesso rápido e partidas",
        items: [
          { term: "Acesso rápido", text: "Os blocos levam a Castings, Manifesto, Pulso, Lista negra, Chaves e aos avisos do Telegram." },
          { term: "Partidas · 72 h", text: "Tours que partem nos próximos três dias: voo, equipe, documentos e selo do contrato. A linha abre o tour." },
        ],
      },
      {
        title: "Radar",
        items: [
          { term: "Novas verificadas", text: "Residentes que passaram pela verificação há pouco: cidade, altura, frescor do Live Snap. Chaves mais altas veem os perfis antes; no acesso antecipado, você vê um cadeado e um cronômetro no lugar do nome." },
          { term: "Lista negra", text: "Registros recentes do clube. O selo verde indica que suas equipes atuais estão limpas." },
          { term: "Avaliações", text: "Últimas avaliações de residentes feitas por gerentes do clube: ajudam a escolher uma equipe confiável." },
        ],
      },
      {
        title: "Números no topo",
        items: [
          { term: "Castings ativos", text: "Briefs abertos e listas curtas." },
          { term: "Respostas «Pronta»", text: "Quantas residentes responderam aos seus castings ativos." },
          { term: "Avaliação", text: "Sua média dada pelas participantes dos seus tours: a base da sua Chave." },
        ],
      },
    ],
    tip: "Comece o dia no Quartel: se «Requer atenção» estiver vazio e as partidas estiverem verdes, seus tours seguem o plano.",
  },

  castings: {
    title: "Como funciona o casting",
    lead: "O casting é o mercado fechado do clube. Você descreve o projeto e as residentes decidem se respondem. Até o aperto de mão mútuo ninguém vê além do necessário: você escolhe por fatos, não por fotos de redes sociais, e elas se sentem protegidas.",
    flow: {
      title: "O caminho de uma resposta · 4 passos",
      steps: [
        { title: "Publicar o brief", text: "Cidade, datas, vagas, cachê, quem paga voo e hotel, altura e idiomas. As residentes que atendem às condições o veem." },
        { title: "Respostas «Pronta»", text: "As participantes compatíveis respondem com um toque. As novas ficam destacadas até você abri-las." },
        { title: "Opção e lista curta", text: "A opção segura uma vaga até uma data. As escolhidas vão para a lista curta." },
        { title: "Aperto de mão", text: "A participante confirma a opção: nome e perfil se abrem, ela entra na equipe e a sala do tour é criada." },
      ],
    },
    sections: [
      {
        title: "Seleção às cegas",
        items: [
          { term: "#A-417", text: "Código cego da candidata neste casting. Antes do aperto de mão não há nome, contatos nem mensagens privadas, só fatos. Isso protege as residentes de pressão e você de escolher «por amizade»." },
          { term: "Cadeado", text: "O perfil ainda está fechado. Depois do aperto de mão surgem as iniciais e o link do perfil." },
        ],
      },
      {
        title: "Live Snap",
        items: [
          { term: "Anel de frescor", text: "O Live Snap é uma foto feita no app, sem filtros nem retoques. O anel mostra o quão recente ela é." },
          { term: "Fresco", text: "Feito nas últimas 24 horas: é assim que ela está agora." },
          { term: "Recente", text: "Até 7 dias. Mais antigo, o anel fica cinza: peça um snap novo antes de escolher." },
        ],
      },
      {
        title: "Trusted",
        items: [
          { term: "Selo Trusted", text: "Participante comprovada: 3+ tours voados, 3+ avaliações de gerentes com média de 4,5 ou mais e nenhuma desistência em 12 meses." },
          { text: "O sistema concede o selo com fatos do Voyage; ele não é dado à mão nem comprado." },
        ],
      },
      {
        title: "Etapas do casting",
        items: [
          { term: "Aberto", text: "Aceita respostas «Pronta» até o horário de fechamento." },
          { term: "Lista curta", text: "Você escolheu candidatas e está dando opções." },
          { term: "Fechado", text: "A equipe está formada e o casting virou tour: veja «Sala do tour» no cartão." },
          { term: "Cancelado", text: "O projeto não aconteceu; as participantes são avisadas." },
        ],
      },
    ],
    tip: "Quanto mais completo o brief (cachê, quem paga voo e hotel, janela de cancelamento), mais respostas «Pronta» fortes.",
  },

  manifest: {
    title: "Como ler o Manifesto",
    lead: "O Manifesto é um painel de todos os seus tours, como num aeroporto: da confirmação ao fechamento. As cores mostram onde tudo está pronto e onde sua ação é necessária. Um clique na linha abre a sala do tour.",
    flow: {
      title: "Ciclo de vida do tour",
      steps: [
        { title: "Confirmado", text: "A equipe está formada. Coletam-se assinaturas do contrato, passaportes e passagens." },
        { title: "Em tour", text: "A equipe está em viagem. O painel mostra quando volta." },
        { title: "Fechado", text: "Tour concluído, resultados marcados e pontos creditados. A linha mostra quantas da equipe voaram." },
        { title: "Cancelado", text: "O tour não aconteceu. Fica no histórico; não há pontos." },
      ],
    },
    sections: [
      {
        title: "Selo do contrato · Contract Seal",
        items: [
          { term: "Assinado por todas", text: "Você e cada participante assinaram as condições mais recentes. O selo está fechado: o tour está protegido." },
          { term: "Assinando", text: "Faltam assinaturas: o contador mostra quantas há e quantas são necessárias." },
          { term: "Sem contrato", text: "As condições ainda não foram enviadas: faça isso na sala do tour." },
          { term: "v2, v3…", text: "Número da versão. As condições só mudam com uma nova versão, que todas assinam de novo." },
        ],
      },
      {
        title: "Documentos · Docs",
        items: [
          { term: "Documentos 2/4", text: "Quantas participantes enviaram passaporte e passagens e passaram pela verificação." },
          { term: "Faltam documentos", text: "Alguém está sem documentos: envie um lembrete no Telegram pela sala." },
          { term: "Verificados", text: "Os documentos de todas foram confirmados pela assistente do clube." },
        ],
      },
      {
        title: "Substituição urgente · Replacement",
        items: [
          { term: "Desistência → Substituição", text: "Uma participante desistiu e outra assumiu a vaga. O nome aparece na linha; ela precisa assinar o contrato." },
          { text: "Substituições fechadas contam para sua reputação no Pulso." },
        ],
      },
      {
        title: "Filtros e busca",
        items: [
          { term: "Requerem ação", text: "Tours confirmados sem uma assinatura, sem documentos ou com substituição." },
          { term: "Busca", text: "Por cidade, código do aeroporto, número do voo ou nome da participante." },
        ],
      },
    ],
    tip: "A próxima partida fica sempre no cabeçalho com contagem regressiva: um olhar basta para saber se tudo está pronto.",
  },

  room: {
    title: "Guia da sala do tour",
    lead: "A sala é o espaço de trabalho de um tour: condições, assinaturas, documentos, contato com as participantes e fechamento. Tudo o que acontece aqui vai para um registro que não pode ser editado.",
    flow: {
      title: "Ordem de trabalho",
      steps: [
        { title: "Condições", text: "Cachê e divisão, quem paga voo e hotel, janela de cancelamento gratuito. «Assinar e enviar» adiciona sua assinatura e pede a das participantes." },
        { title: "Assinaturas e documentos", text: "As participantes assinam no Telegram e enviam passaporte e passagens. Cada cartão mostra o que falta." },
        { title: "Lembretes", text: "«Lembrar dos documentos» e «Lembrar de assinar» mandam mensagem no Telegram, no máximo a cada 6 horas por participante." },
        { title: "Fechamento do tour", text: "Após a partida surge o painel «Fechar tour · creditar pontos»: marque o resultado de cada participante." },
      ],
    },
    sections: [
      {
        title: "Contrato",
        items: [
          { term: "Nova versão", text: "As condições não são reescritas em silêncio: cada mudança é uma nova versão, as assinaturas zeram e todas assinam de novo." },
          { term: "Selo", text: "Fecha quando você e cada participante assinaram a versão mais recente." },
          { term: "Sem Telegram", text: "Se a participante não conectou o bot, a mensagem não sai; isso aparece no cartão dela." },
        ],
      },
      {
        title: "Registro do tour",
        items: [
          { text: "Quem e quando enviou condições, assinou, enviou documentos, foi substituída ou recebeu lembrete. O servidor escreve o registro e ninguém pode editá-lo: é a verdade comum para você, as participantes e o clube." },
        ],
      },
      {
        title: "Fechar tour · creditar pontos",
        items: [
          { term: "Voou", text: "A participante cumpriu o tour. Recebe automaticamente pontos do clube e o carimbo do país no passaporte Voyage." },
          { term: "Desistência tardia", text: "Saiu tarde demais para achar substituta com facilidade. Reduz a confiabilidade dela." },
          { term: "Ausência", text: "Não apareceu sem avisar. É o que mais reduz a confiabilidade; cabe denúncia à lista negra." },
          { term: "Liberada", text: "Você a liberou do tour em comum acordo. A confiabilidade não muda; sem pontos." },
        ],
      },
      {
        title: "Por que a honestidade importa",
        items: [
          { text: "Suas marcações são a única fonte de fatos sobre o tour. Delas dependem os pontos das residentes, o status Trusted e quem o clube vai sugerir a você e a outros gerentes. O fechamento é definitivo: depois a sala fica só leitura." },
        ],
      },
    ],
    tip: "Se o país do tour não estiver definido, informe o código ISO (ex. AE) no painel de fechamento; senão o carimbo não aparece.",
  },

  pulse: {
    title: "Como sua reputação é construída",
    lead: "O Pulso mostra como o clube vê você como parceiro. A reputação se apoia em três fatos: as participantes voam, as desistências são cobertas com substituições e as residentes avaliam com honestidade o trabalho com você.",
    flow: {
      title: "O círculo de confiança",
      steps: [
        { title: "Tour fechado", text: "Você marca o resultado de cada participante: isso entra no gráfico de comparecimento." },
        { title: "Avaliações mútuas", text: "Você avalia as participantes e elas avaliam você. Os dois lados veem só fatos honestos." },
        { title: "Trusted das residentes", text: "Suas avaliações, junto com as de outros gerentes, formam o status Trusted das residentes." },
        { title: "Sua Chave", text: "Tours fechados e sua média dada pelas residentes levam você a Gold e Platinum Key." },
      ],
    },
    sections: [
      {
        title: "Comparecimento e substituições",
        items: [
          { term: "Show Rate", text: "Parcela das participantes confirmadas que voaram em 12 meses." },
          { term: "Gráfico mensal", text: "Dourado: voaram; vermelho: desistiram. Uma fileira dourada uniforme é sinal de parceiro forte." },
          { term: "Substituições", text: "Quantas desistências você cobriu com substituição no total do ano." },
        ],
      },
      {
        title: "Avaliações das residentes",
        items: [
          { term: "Anônimas", text: "Você vê só cidade, tipo de projeto, nota e tags, nunca o nome da autora. Do contrário, teriam medo de avaliar com honestidade." },
          { term: "5 critérios", text: "Pagamento em dia, tour como no brief, organização, respeito e segurança, disponibilidade." },
          { term: "Moderação", text: "Avaliação sem texto é publicada na hora; com comentário, após a análise do clube." },
        ],
      },
      {
        title: "Suas avaliações das participantes",
        items: [
          { term: "Aguardando", text: "Participantes de tours que voltaram. Estrelas e tags profissionais: pontual, profissional, como nos snaps, disponível, boa colega." },
          { text: "A aparência não é avaliada aqui: os Live Snaps a confirmam. A nota vai para o perfil dela e forma o Trusted." },
        ],
      },
      {
        title: "Ligação com sua Chave",
        items: [
          { text: "Sua Chave conta os tours fechados e a média que as residentes dão a você (4,5+ para Gold e Platinum). Avaliar com honestidade faz crescer um grupo de residentes confiáveis, e você fecha mais tours sem desistências." },
        ],
      },
    ],
  },

  blacklist: {
    title: "Regras de segurança e privacidade",
    lead: "A lista negra é a proteção comum do clube contra ausências, fotos falsas e fraude. Só o clube adiciona registros, após verificar as provas; o gerente informa o caso e a privacidade das participantes é respeitada em cada passo.",
    flow: {
      title: "Denúncia · 3 passos",
      steps: [
        { title: "Informar o clube", text: "Toque em «Informar o clube», escolha uma participante do seu tour e o motivo, e descreva o que houve: datas, combinados, mensagens." },
        { title: "Em análise", text: "A denúncia fica «Em análise». Só você e a administração a veem, nem a participante nem outros gerentes." },
        { title: "Decisão do clube", text: "A assistente verifica as provas e muda o registro para «Confirmada», «Em recurso» ou o retira." },
      ],
    },
    sections: [
      {
        title: "Por que há nomes ocultos",
        items: [
          { term: "#R-204 e cadeado", text: "Um código no lugar do nome. Nome e perfil só se abrem se a participante esteve nos seus tours: as outras histórias do clube são privadas." },
          { term: "Esteve no seu tour", text: "Esses registros ficam abertos: você trabalhou com ela e pode ver o perfil." },
        ],
      },
      {
        title: "Equipes atuais limpas",
        items: [
          { text: "O selo verde no cabeçalho: ninguém das suas equipes e opções ativas está na lista. Se ficar vermelho, uma participante do seu tour está na lista: confira o Manifesto." },
        ],
      },
      {
        title: "Status do registro",
        items: [
          { term: "Em análise", text: "Sua denúncia aguarda a decisão do clube." },
          { term: "Confirmada", text: "A infração foi comprovada. Ausência fica 12 meses; fraude, para sempre." },
          { term: "Em recurso", text: "A participante contesta o registro; o clube reexamina as provas." },
          { term: "Retirada", text: "O registro foi anulado: a participante está limpa de novo." },
        ],
      },
      {
        title: "O que o gerente vê",
        items: [
          { text: "O motivo, as datas, o prazo e quantas provas foram verificadas, mas não os arquivos. As provas ficam com o clube." },
        ],
      },
    ],
    tip: "Uma denúncia aberta por participante: enquanto o clube analisa a primeira, não é possível enviar outra.",
  },
};

/* ══════════════════════════════════════════════════════════════════ */

const BY_LANG: Record<Lang, Record<GuidePage, GuideCopy>> = { RU, EN, ES, PT };

export const GUIDES = Object.fromEntries(
  (Object.keys(RU) as GuidePage[]).map((page) => [
    page,
    Object.fromEntries((Object.keys(BY_LANG) as Lang[]).map((lang) => [lang, BY_LANG[lang][page]])),
  ]),
) as Record<GuidePage, Record<Lang, GuideCopy>>;
