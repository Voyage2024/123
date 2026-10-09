"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { Cormorant_Garamond } from "next/font/google";
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import { supabase } from "@/lib/supabase";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500", "600"],
});

// ---------------------------------------------------------------------------
// Вход по никнейму: "admin1" -> "admin1@voyage-models.com"
// ---------------------------------------------------------------------------
const STAFF_DOMAIN = "voyage-models.com";

function normalizeLogin(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!value) return value;
  return value.includes("@") ? value : `${value}@${STAFF_DOMAIN}`;
}

// ---------------------------------------------------------------------------
// Словарь переводов
// ---------------------------------------------------------------------------
const translations = {
  EN: {
    privateClub: "Private Club",
    privateAccess: "Private Access",
    enterDetails: "Enter your account details",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    loginLabel: "Email or username",
    loginPlaceholder: "you@example.com or admin1",
    signingInAs: "Signing in as",
    passwordLabel: "Password",
    passwordPlaceholder: "••••••••",
    showPassword: "Show password",
    hidePassword: "Hide password",
    forgotPassword: "Forgot password?",
    enterClub: "Enter the Club",
    signingIn: "Signing in...",
    invitationOnly: "Access is strictly by invitation only.",
    defaultName: "Resident",
    errors: {
      invalidCredentials: "Incorrect username or password. Please try again.",
      emailNotConfirmed: "Your email is not confirmed yet. Please check your inbox.",
      tooManyRequests: "Too many attempts. Please wait a moment and try again.",
      network: "Connection error. Please check your internet and try again.",
      generic: "Something went wrong. Please try again.",
    },
  },
  RU: {
    privateClub: "Закрытый клуб",
    privateAccess: "Приватный доступ",
    enterDetails: "Введите данные вашего аккаунта",
    emailLabel: "Email",
    emailPlaceholder: "vy@example.com",
    loginLabel: "Email или никнейм",
    loginPlaceholder: "vy@example.com или admin1",
    signingInAs: "Вход как",
    passwordLabel: "Пароль",
    passwordPlaceholder: "••••••••",
    showPassword: "Показать пароль",
    hidePassword: "Скрыть пароль",
    forgotPassword: "Забыли пароль?",
    enterClub: "Войти в клуб",
    signingIn: "Вход...",
    invitationOnly: "Доступ строго по приглашениям.",
    defaultName: "Резидент",
    errors: {
      invalidCredentials: "Неверный логин или пароль. Попробуйте ещё раз.",
      emailNotConfirmed: "Email ещё не подтверждён. Проверьте почту.",
      tooManyRequests: "Слишком много попыток. Подождите немного и повторите.",
      network: "Ошибка соединения. Проверьте интернет и попробуйте снова.",
      generic: "Что-то пошло не так. Попробуйте ещё раз.",
    },
  },
  ES: {
    privateClub: "Club Privado",
    privateAccess: "Acceso Privado",
    enterDetails: "Introduce los datos de tu cuenta",
    emailLabel: "Correo electrónico",
    emailPlaceholder: "tu@ejemplo.com",
    loginLabel: "Correo o usuario",
    loginPlaceholder: "tu@ejemplo.com o admin1",
    signingInAs: "Entrando como",
    passwordLabel: "Contraseña",
    passwordPlaceholder: "••••••••",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
    forgotPassword: "¿Olvidaste tu contraseña?",
    enterClub: "Entrar al Club",
    signingIn: "Entrando...",
    invitationOnly: "El acceso es estrictamente por invitación.",
    defaultName: "Residente",
    errors: {
      invalidCredentials: "Usuario o contraseña incorrectos. Inténtalo de nuevo.",
      emailNotConfirmed: "Tu correo aún no está confirmado. Revisa tu bandeja de entrada.",
      tooManyRequests: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
      network: "Error de conexión. Revisa tu internet e inténtalo de nuevo.",
      generic: "Algo salió mal. Inténtalo de nuevo.",
    },
  },
  PT: {
    privateClub: "Clube Privado",
    privateAccess: "Acesso Privado",
    enterDetails: "Insira os dados da sua conta",
    emailLabel: "E-mail",
    emailPlaceholder: "voce@exemplo.com",
    loginLabel: "E-mail ou usuário",
    loginPlaceholder: "voce@exemplo.com ou admin1",
    signingInAs: "Entrando como",
    passwordLabel: "Senha",
    passwordPlaceholder: "••••••••",
    showPassword: "Mostrar senha",
    hidePassword: "Ocultar senha",
    forgotPassword: "Esqueceu a senha?",
    enterClub: "Entrar no Clube",
    signingIn: "Entrando...",
    invitationOnly: "O acesso é estritamente por convite.",
    defaultName: "Residente",
    errors: {
      invalidCredentials: "Usuário ou senha incorretos. Tente novamente.",
      emailNotConfirmed: "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.",
      tooManyRequests: "Muitas tentativas. Aguarde um momento e tente novamente.",
      network: "Erro de conexão. Verifique sua internet e tente novamente.",
      generic: "Algo deu errado. Tente novamente.",
    },
  },
} as const;

type TranslationKey = keyof typeof translations;
type ErrorKey = keyof (typeof translations)["EN"]["errors"];

// Сопоставляем ответ Supabase с ключом перевода
function mapAuthError(message: string, status?: number): ErrorKey {
  const msg = message.toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
    return "invalidCredentials";
  }
  if (msg.includes("email not confirmed")) return "emailNotConfirmed";
  if (status === 429 || msg.includes("rate limit") || msg.includes("too many")) {
    return "tooManyRequests";
  }
  if (msg.includes("fetch") || msg.includes("network")) return "network";
  return "generic";
}

// ---------------------------------------------------------------------------
// Страница входа
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const { lang } = useLanguage();

  const t = translations[(lang as TranslationKey) in translations ? (lang as TranslationKey) : "EN"];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);

  const hasError = errorKey !== null;
  const isNickname = email.trim().length > 0 && !email.includes("@");

  // Сбрасываем ошибку, как только пользователь начинает исправлять ввод
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errorKey) setErrorKey(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errorKey) setErrorKey(null);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setErrorKey(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizeLogin(email),
        password,
      });

      if (error || !data.user) {
        setErrorKey(error ? mapAuthError(error.message, error.status) : "generic");
        setPassword("");
        setIsLoading(false);
        return;
      }

      const userName = (data.user.user_metadata?.name as string | undefined) || t.defaultName;

      // "Билет" для middleware. secure только на https, иначе на localhost кука не ставится
      Cookies.set("voyage_token", "true", {
        expires: 7,
        sameSite: "lax",
        secure: typeof window !== "undefined" && window.location.protocol === "https:",
      });

      setUser({
        id: data.user.id,
        email: data.user.email || "",
        fullName: userName,
      });

      // isLoading не сбрасываем — кнопка остаётся заблокированной до перехода
      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setErrorKey("network");
      setIsLoading(false);
    }
  };

  const inputBase =
    "w-full rounded-lg border bg-zinc-900/50 py-3 pl-11 text-sm font-light text-white placeholder:text-zinc-600 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
  const inputState = hasError
    ? "border-red-500/50 focus:border-red-400/70"
    : "border-zinc-800 focus:border-amber-200/40";

  return (
    // pt-24 уже задан в layout.tsx — здесь вычитаем высоту шапки (6rem),
    // чтобы форма центрировалась в видимой области и не уходила под Navbar
    <main className="relative flex min-h-[calc(100dvh-6rem)] items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10 sm:py-16">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/[0.04] blur-[120px]" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-8 backdrop-blur-xl sm:p-10">
        {/* Логотип */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/30">
            <span className={`${cormorant.className} text-2xl font-medium text-amber-200/90`}>V</span>
          </div>
          <p className={`${cormorant.className} mt-4 text-2xl font-medium tracking-[0.25em] text-zinc-50`}>
            VOYAGE
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.35em] text-zinc-500">{t.privateClub}</p>
        </div>

        <div className="mx-auto mt-8 h-px w-12 bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />

        <h1 className={`${cormorant.className} mt-8 text-center text-2xl font-medium text-zinc-50`}>
          {t.privateAccess}
        </h1>
        <p className="mt-2 text-center text-xs text-zinc-500">{t.enterDetails}</p>

        {/* Форма */}
        <form className="mt-8 space-y-4" onSubmit={handleLogin} noValidate={false}>
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-zinc-500"
            >
              {t.loginLabel}
            </label>
            <div className="relative">
              <Mail
                size={16}
                strokeWidth={1.5}
                className={`absolute left-4 top-1/2 -translate-y-1/2 ${hasError ? "text-red-400/70" : "text-zinc-500"}`}
              />
              {/* type="text", а не "email" — иначе браузер не пропустит никнейм без @ */}
              <input
                id="email"
                name="email"
                type="text"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={t.loginPlaceholder}
                value={email}
                onChange={handleEmailChange}
                disabled={isLoading}
                aria-invalid={hasError}
                aria-describedby={hasError ? "login-error" : undefined}
                className={`${inputBase} ${inputState} pr-4`}
                required
              />
            </div>
            {isNickname && (
              <p className="mt-1.5 text-[11px] text-zinc-500">
                {t.signingInAs}{" "}
                <span className="text-amber-200/80">{normalizeLogin(email)}</span>
              </p>
            )}
          </div>

          {/* Пароль */}
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-zinc-500"
            >
              {t.passwordLabel}
            </label>
            <div className="relative">
              <Lock
                size={16}
                strokeWidth={1.5}
                className={`absolute left-4 top-1/2 -translate-y-1/2 ${hasError ? "text-red-400/70" : "text-zinc-500"}`}
              />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder={t.passwordPlaceholder}
                value={password}
                onChange={handlePasswordChange}
                disabled={isLoading}
                aria-invalid={hasError}
                aria-describedby={hasError ? "login-error" : undefined}
                className={`${inputBase} ${inputState} pr-11`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Ошибка */}
          <div aria-live="polite" className="min-h-0">
            {hasError && (
              <div
                id="login-error"
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3.5 py-3 text-xs leading-relaxed text-red-300 animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <AlertCircle size={15} strokeWidth={1.75} className="mt-px shrink-0 text-red-400" />
                <span>{t.errors[errorKey]}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <a href="#" className="text-xs text-zinc-500 transition-colors hover:text-amber-200/80">
              {t.forgotPassword}
            </a>
          </div>

          {/* Кнопка входа */}
          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            className="group mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-950 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-zinc-100"
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {t.signingIn}
              </>
            ) : (
              <>
                {t.enterClub}
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-[11px] tracking-wide text-zinc-600">{t.invitationOnly}</p>
      </div>
    </main>
  );
}