import type { Lang } from "@/app/context/LanguageContext";

// ---------------------------------------------------------------------------
// Диалог двух резиденток на странице входа.
// Стейт-машина: idle → login → password → loading, а error перекрывает всё.
// ---------------------------------------------------------------------------

export type LoginScene = "idle" | "login" | "password" | "loading" | "error";

export const LOGIN_SCENES: readonly LoginScene[] = ["idle", "login", "password", "loading", "error"];

export type LoginField = "login" | "password" | null;

export interface LoginSceneInput {
  /** Поле, в котором сейчас фокус */
  focusedField: LoginField;
  /** Поле, с которым работали последним (держит сцену, когда фокус ушёл) */
  lastField: LoginField;
  loginValue: string;
  passwordValue: string;
  isLoading: boolean;
  hasError: boolean;
}

/**
 * Приоритет: ошибка > загрузка > пароль > логин > исходное.
 * Когда фокус уходит с поля (клик мимо формы), сцена не прыгает обратно в idle,
 * а остаётся на последнем поле, пока в форме что-то введено.
 */
export function resolveLoginScene(s: LoginSceneInput): LoginScene {
  if (s.hasError) return "error";
  if (s.isLoading) return "loading";
  if (s.focusedField === "password") return "password";
  if (s.focusedField === "login") return "login";

  const touched = s.loginValue.trim().length > 0 || s.passwordValue.length > 0;
  if (!touched) return "idle";
  if (s.lastField === "password" && s.passwordValue.length > 0) return "password";
  if (s.loginValue.trim().length > 0) return "login";
  return s.passwordValue.length > 0 ? "password" : "idle";
}

/** Выражение лица на сцену — персонажи «реагируют», а не только говорят */
export type RookieMood = "worried" | "curious" | "panic" | "hopeful" | "shocked";
export type VeteranMood = "calm" | "knowing" | "reassure" | "delighted" | "amused";

export const SCENE_MOODS: Record<LoginScene, { rookie: RookieMood; veteran: VeteranMood }> = {
  idle: { rookie: "worried", veteran: "calm" },
  login: { rookie: "curious", veteran: "knowing" },
  password: { rookie: "panic", veteran: "reassure" },
  loading: { rookie: "hopeful", veteran: "delighted" },
  error: { rookie: "shocked", veteran: "amused" },
};

export interface DialogueLine {
  rookie: string;
  veteran: string;
}

export interface LoginDialogueCopy {
  /** Подпись региона для скринридеров */
  regionLabel: string;
  rookieName: string;
  rookieTag: string;
  veteranName: string;
  veteranTag: string;
  typing: string;
  collapse: string;
  expand: string;
  scenes: Record<LoginScene, DialogueLine>;
}

export const LOGIN_DIALOGUE_COPY: Record<Lang, LoginDialogueCopy> = {
  RU: {
    regionLabel: "Разговор двух резиденток клуба",
    rookieName: "Новичок",
    rookieTag: "первый тур",
    veteranName: "Опытная",
    veteranTag: "27 туров",
    typing: "печатает…",
    collapse: "Свернуть диалог",
    expand: "Показать диалог",
    scenes: {
      idle: {
        rookie: "Блин, я так переживаю... А если кредитацию билетов не успеют согласовать?",
        veteran: "Успокойся, милая. Заходи в кабинет, тут админ 24/7 всё держит под контролем.",
      },
      login: {
        rookie: "А работать сразу в первый день начинаем или дадут отдохнуть?",
        veteran:
          "Сначала заселение в апарты, потом фотосессия для анкеты, а дальше сама увидишь, как гости попрут.",
      },
      password: {
        rookie: "Ой, а если у меня прямо во время тура опять «эти дни» начнутся?!",
        veteran: "Да не паникуй ты! В админке сразу отметку ставишь, менеджер всё перенесет без штрафов.",
      },
      loading: {
        rookie: "А допы и чаевые точно 100% нам остаются?",
        veteran: "Точно-точно! Всё, входим в кабинет — твой шорт-лист уже утвержден!",
      },
      error: {
        rookie: "Ой, не заходит... Меня что, из списка тура вычеркнули?! 😱",
        veteran: "Да ты просто раскладку не переключила! Перепроверь пароль и не кошмарь менеджера!",
      },
    },
  },
  EN: {
    regionLabel: "A conversation between two club residents",
    rookieName: "Rookie",
    rookieTag: "first tour",
    veteranName: "Veteran",
    veteranTag: "27 tours",
    typing: "typing…",
    collapse: "Hide the chat",
    expand: "Show the chat",
    scenes: {
      idle: {
        rookie: "Ugh, I'm so nervous... What if they don't get the ticket accreditation approved in time?",
        veteran: "Relax, sweetie. Log in to your cabinet — the admin keeps everything under control 24/7.",
      },
      login: {
        rookie: "Do we start working on day one, or do they let us rest first?",
        veteran:
          "First you check into the apartment, then a photo shoot for your profile — and then you'll see the guests pour in.",
      },
      password: {
        rookie: "Oh no, what if my period starts right in the middle of the tour?!",
        veteran: "Don't panic! Just mark it in your dashboard and the manager reschedules everything, no penalties.",
      },
      loading: {
        rookie: "Are the extras and tips really 100% ours?",
        veteran: "Absolutely! Come on, we're going in — your shortlist is already approved!",
      },
      error: {
        rookie: "Oh, it won't let me in... Did they cross me off the tour list?! 😱",
        veteran: "You just forgot to switch your keyboard layout! Double-check your password and don't stress the manager!",
      },
    },
  },
  ES: {
    regionLabel: "Una conversación entre dos residentes del club",
    rookieName: "Novata",
    rookieTag: "primer tour",
    veteranName: "Veterana",
    veteranTag: "27 tours",
    typing: "escribiendo…",
    collapse: "Ocultar el chat",
    expand: "Mostrar el chat",
    scenes: {
      idle: {
        rookie: "Uf, estoy tan nerviosa... ¿Y si no aprueban a tiempo la acreditación de los billetes?",
        veteran: "Tranquila, cariño. Entra en tu área privada: el admin lo tiene todo bajo control 24/7.",
      },
      login: {
        rookie: "¿Empezamos a trabajar el primer día o nos dejan descansar?",
        veteran:
          "Primero te instalas en el apartamento, luego la sesión de fotos para tu perfil, y después ya verás cómo llegan los invitados.",
      },
      password: {
        rookie: "¡Ay! ¿Y si me viene la regla justo en medio del tour?",
        veteran: "¡No entres en pánico! Lo marcas en tu panel y el mánager lo reprograma todo sin penalizaciones.",
      },
      loading: {
        rookie: "¿Los extras y las propinas son 100% nuestros, seguro?",
        veteran: "¡Segurísimo! Venga, entramos: ¡tu shortlist ya está aprobada!",
      },
      error: {
        rookie: "Ay, no me deja entrar... ¿Me han tachado de la lista del tour? 😱",
        veteran: "¡Solo no cambiaste el idioma del teclado! Revisa la contraseña y no le des la lata al mánager.",
      },
    },
  },
  PT: {
    regionLabel: "Uma conversa entre duas residentes do clube",
    rookieName: "Novata",
    rookieTag: "primeiro tour",
    veteranName: "Veterana",
    veteranTag: "27 tours",
    typing: "digitando…",
    collapse: "Ocultar a conversa",
    expand: "Mostrar a conversa",
    scenes: {
      idle: {
        rookie: "Ai, tô tão nervosa... E se não aprovarem o credenciamento das passagens a tempo?",
        veteran: "Calma, querida. Entra no seu painel: o admin deixa tudo sob controle 24/7.",
      },
      login: {
        rookie: "A gente já começa a trabalhar no primeiro dia ou dá pra descansar?",
        veteran:
          "Primeiro o check-in no apê, depois o ensaio de fotos pro perfil, e aí você vai ver os convidados chegando.",
      },
      password: {
        rookie: "Ai, e se a minha menstruação descer bem no meio do tour?!",
        veteran: "Não entra em pânico! Marca no painel na hora, e o gerente remarca tudo sem multa.",
      },
      loading: {
        rookie: "Os extras e as gorjetas ficam mesmo 100% com a gente?",
        veteran: "Com certeza! Bora, vamos entrar: sua shortlist já está aprovada!",
      },
      error: {
        rookie: "Ai, não entra... Me tiraram da lista do tour?! 😱",
        veteran: "Você só esqueceu de trocar o idioma do teclado! Confere a senha e não enlouquece o gerente!",
      },
    },
  },
};

export function getLoginDialogueCopy(lang: string): LoginDialogueCopy {
  return LOGIN_DIALOGUE_COPY[(lang as Lang) in LOGIN_DIALOGUE_COPY ? (lang as Lang) : "EN"];
}
