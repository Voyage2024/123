/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Video Identity — общие константы и тексты (клиент + сервер)
 * lib/resident-media.ts
 *
 * Лимиты совпадают с CHECK-ограничениями миграции
 * 20261130090000_resident_video_identity.sql (Визитка 50 МБ, Moment 15 МБ).
 * ──────────────────────────────────────────────────────────────────── */

export type MediaLang = "EN" | "RU" | "ES" | "PT";

export const MEDIA_BUCKET = "resident-media";

/**
 * Визитка: до 90 с, до 50 МБ — общий лимит Storage проекта (проверен 26.11).
 * Один лимит везде: бакет resident-media (file_size_limit), CHECK
 * resident_media_size_check в базе, проверка слота и файла на сервере,
 * проверка в браузере и текст ошибки.
 */
export const INTRO_MAX_BYTES = 50 * 1024 * 1024;
export const INTRO_MAX_SECONDS = 90;
/** Moments: до 6 штук, 3–30 с, только с камеры сайта. */
export const MOMENT_MAX_COUNT = 6;
export const MOMENT_MIN_SECONDS = 3;
export const MOMENT_MAX_SECONDS = 30;
export const MOMENT_MAX_BYTES = 15 * 1024 * 1024;
export const POSTER_MAX_BYTES = 600 * 1024;
/** Signed URL на просмотр — 10 минут. */
export const MEDIA_SIGNED_TTL = 10 * 60;

export const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export type VideoMime = (typeof VIDEO_MIMES)[number];
export const EXT_BY_MIME: Record<VideoMime, "mp4" | "mov" | "webm"> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type MediaKind = "intro" | "moment";
export type MediaSource = "in_app_camera" | "upload";
export type VideoScope = "engaged" | "hidden" | "catalog";
export type MediaContext = "casting" | "tour" | "admin" | "catalog";

export const MOMENT_TOPICS = ["hello", "language", "travel", "style", "talent", "today"] as const;
export type MomentTopic = (typeof MOMENT_TOPICS)[number];

export type MediaFailure =
  | "unauthenticated"
  | "forbidden"
  | "consent_required"
  | "limit"
  | "invalid"
  | "too_large"
  | "not_found"
  | "schema"
  | "failed";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  source: MediaSource;
  topic: string | null;
  mime: string;
  durationMs: number;
  width: number | null;
  height: number | null;
  status: "active" | "hidden_by_staff";
  hiddenReason: string | null;
  recordedAt: string;
  src: string | null;
  poster: string | null;
};

export type MediaBundle = {
  access: "self" | "staff" | "casting" | "tour" | "catalog";
  scope: VideoScope;
  consent: boolean;
  latestAt: string | null;
  items: MediaItem[];
};

export type ProfileViewItem = {
  viewer: string | null;
  staff: boolean;
  badge: string | null;
  context: "casting" | "tour" | "admin" | "catalog";
  contextLabel: string | null;
  what: "profile" | "video";
  at: string;
};

export type ProfileViews = { week: number; month: number; items: ProfileViewItem[] };

/** Нормализует MIME из MediaRecorder / File: "video/webm;codecs=vp9" → "video/webm". */
export function baseMime(mime: string | null | undefined): VideoMime | null {
  const m = String(mime ?? "").split(";")[0].trim().toLowerCase();
  return (VIDEO_MIMES as readonly string[]).includes(m) ? (m as VideoMime) : null;
}

/** Первый формат записи, который поддерживает браузер. iPhone Safari — только mp4. */
export function pickRecorderMime(): string | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* старые браузеры бросают на неизвестный тип */
    }
  }
  return null;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function mediaLang(lang: string | null | undefined): MediaLang {
  return lang === "RU" || lang === "ES" || lang === "PT" ? lang : "EN";
}

type TopicCopy = { label: string; prompt: string };

type Copy = {
  title: string;
  kicker: string;
  lead: string;
  intro: string;
  introHint: string;
  introEmpty: string;
  introUpload: string;
  introRecord: string;
  introReplace: string;
  moments: string;
  momentsHint: string;
  momentsEmpty: string;
  momentAdd: string;
  momentLimit: string;
  record: string;
  stop: string;
  retake: string;
  save: string;
  cancel: string;
  delete: string;
  deleteConfirm: string;
  preview: string;
  recording: string;
  maxLen: (s: number) => string;
  tooShort: (s: number) => string;
  tooLong: (s: number) => string;
  tooLarge: (mb: number) => string;
  badFormat: string;
  cameraDenied: string;
  cameraMissing: string;
  cameraFallback: string;
  uploading: string;
  saved: string;
  failed: string;
  consentTitle: string;
  consentText: string;
  consentAccept: string;
  consentRevoke: string;
  consentRevokeHint: string;
  scopeTitle: string;
  scopeEngaged: string;
  scopeEngagedHint: string;
  scopeHidden: string;
  scopeHiddenHint: string;
  scopeCatalog: string;
  scopeCatalogHint: string;
  hiddenByStaff: string;
  hiddenReason: string;
  freshness: (d: string) => string;
  viewsTitle: string;
  viewsWeek: (n: number) => string;
  viewsEmpty: string;
  viewsStaff: string;
  viewsWhatVideo: string;
  viewsWhatProfile: string;
  viewsContextCasting: string;
  viewsContextTour: string;
  viewsContextAdmin: string;
  viewsContextCatalog: string;
  value: [string, string][];
  privacy: string;
  topic: string;
  topics: Record<MomentTopic, TopicCopy>;
  pickTopic: string;
  pause: string;
  play: string;
  mute: string;
  unmute: string;
  fullscreen: string;
  close: string;
  next: string;
  prev: string;
  watermark: string;
  noVideo: string;
  videoTab: string;
  loading: string;
  conflict: string;
};

export const MEDIA_COPY: Record<MediaLang, Copy> = {
  RU: {
    title: "Video Identity",
    kicker: "Живая анкета",
    lead: "Фото показывают, как вы выглядите. Видео показывает, какая вы: голос, улыбка, манера говорить. Менеджеры выбирают быстрее, когда видят человека, а не только кадры.",
    intro: "Визитка",
    introHint: "До 90 секунд. Представьтесь, расскажите, откуда вы, какие языки знаете и что любите в поездках.",
    introEmpty: "Визитки пока нет",
    introUpload: "Загрузить видео",
    introRecord: "Записать на камеру",
    introReplace: "Заменить",
    moments: "Моменты",
    momentsHint: "Короткие кружки до 30 секунд, только с камеры сайта. Так менеджер видит вас сегодняшнюю, без монтажа и фильтров.",
    momentsEmpty: "Запишите первый момент: просто поздоровайтесь.",
    momentAdd: "Новый момент",
    momentLimit: "Уже 6 моментов. Удалите один, чтобы записать новый.",
    record: "Запись",
    stop: "Стоп",
    retake: "Переснять",
    save: "Сохранить",
    cancel: "Отмена",
    delete: "Удалить",
    deleteConfirm: "Удалить это видео? Отменить нельзя.",
    preview: "Предпросмотр",
    recording: "Идёт запись",
    maxLen: (s) => `до ${s} с`,
    tooShort: (s) => `Слишком коротко: нужно хотя бы ${s} с.`,
    tooLong: (s) => `Слишком длинно: максимум ${s} с.`,
    tooLarge: (mb) => `Файл больше ${mb} МБ. Сожмите видео или запишите короче.`,
    badFormat: "Нужен формат MP4, MOV или WebM.",
    cameraDenied: "Нет доступа к камере. Разрешите камеру и микрофон для этого сайта в настройках браузера.",
    cameraMissing: "Этот браузер не умеет записывать видео на странице.",
    cameraFallback: "Открыть камеру телефона",
    uploading: "Загружаем…",
    saved: "Сохранено",
    failed: "Не получилось. Попробуйте ещё раз.",
    consentTitle: "Показывать видео менеджерам",
    consentText: "Видео увидят только менеджеры кастингов, на которые вы откликнулись, и менеджеры ваших туров, а также администрация VOYAGE. Публично видео не показывается, скачать его нельзя. Каждый просмотр записывается, и вы видите, кто смотрел.",
    consentAccept: "Согласна, включить видео",
    consentRevoke: "Отозвать согласие",
    consentRevokeHint: "Менеджеры перестанут видеть видео сразу. Ваши записи останутся у вас.",
    scopeTitle: "Кто видит видео",
    scopeEngaged: "Менеджеры, с которыми я работаю",
    scopeEngagedHint: "Кастинги с моим откликом и мои туры",
    scopeHidden: "Только я",
    scopeHiddenHint: "Видео скрыто от менеджеров",
    scopeCatalog: "Всем менеджерам каталога",
    scopeCatalogHint: "Проверенные менеджеры с доступом к каталогу, когда ваша анкета в каталоге",
    hiddenByStaff: "Скрыто администрацией",
    hiddenReason: "Причина",
    freshness: (d) => `Обновлено ${d}`,
    viewsTitle: "Кто смотрел",
    viewsWeek: (n) => (n === 0 ? "На этой неделе пока никто" : `${n} ${n === 1 ? "менеджер" : n < 5 ? "менеджера" : "менеджеров"} за 7 дней`),
    viewsEmpty: "Пока никто не открывал вашу анкету.",
    viewsStaff: "Администрация VOYAGE",
    viewsWhatVideo: "видео",
    viewsWhatProfile: "анкета",
    viewsContextCasting: "кастинг",
    viewsContextTour: "тур",
    viewsContextAdmin: "проверка",
    viewsContextCatalog: "каталог",
    value: [
      ["Вас выбирают быстрее", "Менеджер слышит голос и языки, не дожидаясь звонка."],
      ["Всегда актуально", "Моменты показывают вас сегодняшнюю."],
      ["Под вашим контролем", "Скрыть, заменить или удалить можно в любой момент."],
    ],
    privacy: "Видео хранится в закрытом хранилище. Ссылка на просмотр живёт 10 минут и выдаётся только тем, у кого есть право.",
    topic: "Тема",
    topics: {
      hello: { label: "Привет", prompt: "Поздоровайтесь и скажите, как вас зовут." },
      language: { label: "Языки", prompt: "Скажите пару фраз на языке, который знаете." },
      travel: { label: "Путешествия", prompt: "Любимое место, где вы были." },
      style: { label: "Образ", prompt: "Покажите сегодняшний образ." },
      talent: { label: "Талант", prompt: "Что вы умеете: танец, песня, спорт." },
      today: { label: "Сегодня", prompt: "Как проходит ваш день." },
    },
    pickTopic: "О чём момент?",
    pause: "Пауза",
    play: "Смотреть",
    mute: "Без звука",
    unmute: "Со звуком",
    fullscreen: "На весь экран",
    close: "Закрыть",
    next: "Дальше",
    prev: "Назад",
    watermark: "VOYAGE · private",
    noVideo: "Резидентка пока не добавила видео.",
    videoTab: "Видео",
    loading: "Загружаем видео…",
    conflict: "Видео изменилось в другой вкладке. Обновили список.",
  },
  EN: {
    title: "Video Identity",
    kicker: "A living profile",
    lead: "Photos show how you look. Video shows who you are: your voice, your smile, the way you speak. Managers decide faster when they see a person, not just pictures.",
    intro: "Intro",
    introHint: "Up to 90 seconds. Introduce yourself, where you are from, which languages you speak and what you love about travelling.",
    introEmpty: "No intro yet",
    introUpload: "Upload video",
    introRecord: "Record with camera",
    introReplace: "Replace",
    moments: "Moments",
    momentsHint: "Short round clips up to 30 seconds, recorded only with the site camera. Managers see you as you are today, no edits or filters.",
    momentsEmpty: "Record your first moment: just say hello.",
    momentAdd: "New moment",
    momentLimit: "You already have 6 moments. Delete one to record a new one.",
    record: "Record",
    stop: "Stop",
    retake: "Retake",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    deleteConfirm: "Delete this video? This cannot be undone.",
    preview: "Preview",
    recording: "Recording",
    maxLen: (s) => `up to ${s}s`,
    tooShort: (s) => `Too short: at least ${s}s.`,
    tooLong: (s) => `Too long: ${s}s max.`,
    tooLarge: (mb) => `The file is larger than ${mb} MB. Compress it or record a shorter one.`,
    badFormat: "Use MP4, MOV or WebM.",
    cameraDenied: "No camera access. Allow camera and microphone for this site in your browser settings.",
    cameraMissing: "This browser cannot record video on a page.",
    cameraFallback: "Open phone camera",
    uploading: "Uploading…",
    saved: "Saved",
    failed: "Something went wrong. Please try again.",
    consentTitle: "Show video to managers",
    consentText: "Only managers of castings you applied to, managers of your tours and the VOYAGE team can see your video. It is never public and cannot be downloaded. Every view is logged and you can see who watched.",
    consentAccept: "I agree, turn video on",
    consentRevoke: "Withdraw consent",
    consentRevokeHint: "Managers stop seeing your video immediately. Your recordings stay with you.",
    scopeTitle: "Who can see the video",
    scopeEngaged: "Managers I work with",
    scopeEngagedHint: "Castings I applied to and my tours",
    scopeHidden: "Only me",
    scopeHiddenHint: "Video is hidden from managers",
    scopeCatalog: "All catalog managers",
    scopeCatalogHint: "Verified managers with catalog access, while your profile is in the catalog",
    hiddenByStaff: "Hidden by VOYAGE team",
    hiddenReason: "Reason",
    freshness: (d) => `Updated ${d}`,
    viewsTitle: "Who viewed",
    viewsWeek: (n) => (n === 0 ? "No one yet this week" : `${n} manager${n === 1 ? "" : "s"} in 7 days`),
    viewsEmpty: "No one has opened your profile yet.",
    viewsStaff: "VOYAGE team",
    viewsWhatVideo: "video",
    viewsWhatProfile: "profile",
    viewsContextCasting: "casting",
    viewsContextTour: "tour",
    viewsContextAdmin: "review",
    viewsContextCatalog: "catalog",
    value: [
      ["Get picked faster", "Managers hear your voice and languages before any call."],
      ["Always current", "Moments show you as you are today."],
      ["You stay in control", "Hide, replace or delete at any time."],
    ],
    privacy: "Videos are kept in private storage. A viewing link lasts 10 minutes and is issued only to people with access.",
    topic: "Topic",
    topics: {
      hello: { label: "Hello", prompt: "Say hello and tell your name." },
      language: { label: "Languages", prompt: "Say a few words in a language you speak." },
      travel: { label: "Travel", prompt: "Your favourite place so far." },
      style: { label: "Look", prompt: "Show today's look." },
      talent: { label: "Talent", prompt: "What you can do: dance, sing, sport." },
      today: { label: "Today", prompt: "How your day is going." },
    },
    pickTopic: "What is this moment about?",
    pause: "Pause",
    play: "Play",
    mute: "Mute",
    unmute: "Unmute",
    fullscreen: "Full screen",
    close: "Close",
    next: "Next",
    prev: "Back",
    watermark: "VOYAGE · private",
    noVideo: "The resident has not added any video yet.",
    videoTab: "Video",
    loading: "Loading video…",
    conflict: "Your videos changed in another tab. The list is refreshed.",
  },
  ES: {
    title: "Video Identity",
    kicker: "Un perfil vivo",
    lead: "Las fotos muestran cómo eres por fuera. El vídeo muestra quién eres: tu voz, tu sonrisa, tu forma de hablar. Los managers deciden antes cuando ven a una persona y no solo imágenes.",
    intro: "Presentación",
    introHint: "Hasta 90 segundos. Preséntate, cuenta de dónde eres, qué idiomas hablas y qué te gusta de viajar.",
    introEmpty: "Aún no hay presentación",
    introUpload: "Subir vídeo",
    introRecord: "Grabar con la cámara",
    introReplace: "Reemplazar",
    moments: "Momentos",
    momentsHint: "Clips redondos de hasta 30 segundos, solo con la cámara del sitio. El manager te ve tal como eres hoy, sin edición ni filtros.",
    momentsEmpty: "Graba tu primer momento: simplemente saluda.",
    momentAdd: "Nuevo momento",
    momentLimit: "Ya tienes 6 momentos. Borra uno para grabar otro.",
    record: "Grabar",
    stop: "Parar",
    retake: "Repetir",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Borrar",
    deleteConfirm: "¿Borrar este vídeo? No se puede deshacer.",
    preview: "Vista previa",
    recording: "Grabando",
    maxLen: (s) => `hasta ${s} s`,
    tooShort: (s) => `Demasiado corto: mínimo ${s} s.`,
    tooLong: (s) => `Demasiado largo: máximo ${s} s.`,
    tooLarge: (mb) => `El archivo supera ${mb} MB. Comprímelo o graba uno más corto.`,
    badFormat: "Usa MP4, MOV o WebM.",
    cameraDenied: "Sin acceso a la cámara. Permite cámara y micrófono para este sitio en el navegador.",
    cameraMissing: "Este navegador no puede grabar vídeo en la página.",
    cameraFallback: "Abrir la cámara del teléfono",
    uploading: "Subiendo…",
    saved: "Guardado",
    failed: "Algo salió mal. Inténtalo de nuevo.",
    consentTitle: "Mostrar vídeo a los managers",
    consentText: "Solo lo ven los managers de los castings a los que te postulaste, los managers de tus tours y el equipo VOYAGE. Nunca es público y no se puede descargar. Cada visualización queda registrada y ves quién lo miró.",
    consentAccept: "Acepto, activar vídeo",
    consentRevoke: "Retirar consentimiento",
    consentRevokeHint: "Los managers dejan de ver tu vídeo al instante. Tus grabaciones se quedan contigo.",
    scopeTitle: "Quién ve el vídeo",
    scopeEngaged: "Managers con los que trabajo",
    scopeEngagedHint: "Castings con mi postulación y mis tours",
    scopeHidden: "Solo yo",
    scopeHiddenHint: "El vídeo está oculto a los managers",
    scopeCatalog: "Todos los managers del catálogo",
    scopeCatalogHint: "Managers verificados con acceso al catálogo, mientras tu perfil esté en el catálogo",
    hiddenByStaff: "Ocultado por el equipo VOYAGE",
    hiddenReason: "Motivo",
    freshness: (d) => `Actualizado ${d}`,
    viewsTitle: "Quién lo vio",
    viewsWeek: (n) => (n === 0 ? "Nadie todavía esta semana" : `${n} manager${n === 1 ? "" : "s"} en 7 días`),
    viewsEmpty: "Nadie ha abierto tu perfil todavía.",
    viewsStaff: "Equipo VOYAGE",
    viewsWhatVideo: "vídeo",
    viewsWhatProfile: "perfil",
    viewsContextCasting: "casting",
    viewsContextTour: "tour",
    viewsContextAdmin: "revisión",
    viewsContextCatalog: "catálogo",
    value: [
      ["Te eligen antes", "El manager oye tu voz e idiomas antes de cualquier llamada."],
      ["Siempre al día", "Los momentos te muestran como eres hoy."],
      ["Tú decides", "Oculta, reemplaza o borra cuando quieras."],
    ],
    privacy: "Los vídeos se guardan en un almacenamiento privado. El enlace dura 10 minutos y solo lo recibe quien tiene acceso.",
    topic: "Tema",
    topics: {
      hello: { label: "Hola", prompt: "Saluda y di tu nombre." },
      language: { label: "Idiomas", prompt: "Di unas frases en un idioma que hables." },
      travel: { label: "Viajes", prompt: "Tu lugar favorito." },
      style: { label: "Look", prompt: "Muestra tu look de hoy." },
      talent: { label: "Talento", prompt: "Lo que sabes hacer: baile, canto, deporte." },
      today: { label: "Hoy", prompt: "Cómo va tu día." },
    },
    pickTopic: "¿De qué trata este momento?",
    pause: "Pausa",
    play: "Ver",
    mute: "Silenciar",
    unmute: "Con sonido",
    fullscreen: "Pantalla completa",
    close: "Cerrar",
    next: "Siguiente",
    prev: "Atrás",
    watermark: "VOYAGE · private",
    noVideo: "La residente aún no ha añadido vídeo.",
    videoTab: "Vídeo",
    loading: "Cargando vídeo…",
    conflict: "Tus vídeos cambiaron en otra pestaña. Lista actualizada.",
  },
  PT: {
    title: "Video Identity",
    kicker: "Um perfil vivo",
    lead: "As fotos mostram como você é por fora. O vídeo mostra quem você é: a voz, o sorriso, o jeito de falar. Os managers decidem mais rápido quando veem uma pessoa, não só imagens.",
    intro: "Apresentação",
    introHint: "Até 90 segundos. Apresente-se, diga de onde é, quais idiomas fala e o que ama em viajar.",
    introEmpty: "Ainda sem apresentação",
    introUpload: "Enviar vídeo",
    introRecord: "Gravar com a câmera",
    introReplace: "Substituir",
    moments: "Momentos",
    momentsHint: "Clipes redondos de até 30 segundos, só com a câmera do site. O manager vê você como é hoje, sem edição nem filtros.",
    momentsEmpty: "Grave seu primeiro momento: só diga oi.",
    momentAdd: "Novo momento",
    momentLimit: "Você já tem 6 momentos. Apague um para gravar outro.",
    record: "Gravar",
    stop: "Parar",
    retake: "Regravar",
    save: "Salvar",
    cancel: "Cancelar",
    delete: "Apagar",
    deleteConfirm: "Apagar este vídeo? Não dá para desfazer.",
    preview: "Prévia",
    recording: "Gravando",
    maxLen: (s) => `até ${s} s`,
    tooShort: (s) => `Curto demais: mínimo ${s} s.`,
    tooLong: (s) => `Longo demais: máximo ${s} s.`,
    tooLarge: (mb) => `O arquivo passa de ${mb} MB. Comprima ou grave um mais curto.`,
    badFormat: "Use MP4, MOV ou WebM.",
    cameraDenied: "Sem acesso à câmera. Permita câmera e microfone para este site no navegador.",
    cameraMissing: "Este navegador não grava vídeo na página.",
    cameraFallback: "Abrir a câmera do celular",
    uploading: "Enviando…",
    saved: "Salvo",
    failed: "Algo deu errado. Tente de novo.",
    consentTitle: "Mostrar vídeo aos managers",
    consentText: "Só veem os managers dos castings em que você se candidatou, os managers dos seus tours e a equipe VOYAGE. Nunca é público e não pode ser baixado. Cada visualização fica registrada e você vê quem assistiu.",
    consentAccept: "Concordo, ativar vídeo",
    consentRevoke: "Retirar consentimento",
    consentRevokeHint: "Os managers deixam de ver seu vídeo na hora. Suas gravações ficam com você.",
    scopeTitle: "Quem vê o vídeo",
    scopeEngaged: "Managers com quem trabalho",
    scopeEngagedHint: "Castings em que me candidatei e meus tours",
    scopeHidden: "Só eu",
    scopeHiddenHint: "O vídeo está oculto para managers",
    scopeCatalog: "Todos os managers do catálogo",
    scopeCatalogHint: "Managers verificados com acesso ao catálogo, enquanto o seu perfil estiver no catálogo",
    hiddenByStaff: "Ocultado pela equipe VOYAGE",
    hiddenReason: "Motivo",
    freshness: (d) => `Atualizado ${d}`,
    viewsTitle: "Quem viu",
    viewsWeek: (n) => (n === 0 ? "Ninguém ainda nesta semana" : `${n} manager${n === 1 ? "" : "s"} em 7 dias`),
    viewsEmpty: "Ninguém abriu seu perfil ainda.",
    viewsStaff: "Equipe VOYAGE",
    viewsWhatVideo: "vídeo",
    viewsWhatProfile: "perfil",
    viewsContextCasting: "casting",
    viewsContextTour: "tour",
    viewsContextAdmin: "revisão",
    viewsContextCatalog: "catálogo",
    value: [
      ["Escolhida mais rápido", "O manager ouve sua voz e idiomas antes de qualquer ligação."],
      ["Sempre atual", "Os momentos mostram você como é hoje."],
      ["Você no controle", "Oculte, substitua ou apague quando quiser."],
    ],
    privacy: "Os vídeos ficam em armazenamento privado. O link dura 10 minutos e só é entregue a quem tem acesso.",
    topic: "Tema",
    topics: {
      hello: { label: "Oi", prompt: "Diga oi e o seu nome." },
      language: { label: "Idiomas", prompt: "Diga algumas frases em um idioma que fala." },
      travel: { label: "Viagens", prompt: "Seu lugar favorito." },
      style: { label: "Look", prompt: "Mostre o look de hoje." },
      talent: { label: "Talento", prompt: "O que você sabe fazer: dança, canto, esporte." },
      today: { label: "Hoje", prompt: "Como está o seu dia." },
    },
    pickTopic: "Sobre o que é este momento?",
    pause: "Pausar",
    play: "Assistir",
    mute: "Sem som",
    unmute: "Com som",
    fullscreen: "Tela cheia",
    close: "Fechar",
    next: "Próximo",
    prev: "Voltar",
    watermark: "VOYAGE · private",
    noVideo: "A residente ainda não adicionou vídeo.",
    videoTab: "Vídeo",
    loading: "Carregando vídeo…",
    conflict: "Seus vídeos mudaram em outra aba. Lista atualizada.",
  },
};

export function mediaCopy(lang: string | null | undefined): Copy {
  return MEDIA_COPY[mediaLang(lang)];
}
