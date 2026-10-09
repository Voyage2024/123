"use client";

import { useEffect, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, ArrowLeft } from "lucide-react";
import { useAuth, type Role } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";

// ---------------------------------------------------------------------------
// Переводы
// ---------------------------------------------------------------------------
const translations = {
  EN: {
    checking: "Checking access...",
    title: "Access Denied",
    description: "You don't have permission to view this page. If you believe this is a mistake, contact the club administration.",
    back: "Back to Dashboard",
  },
  RU: {
    checking: "Проверка доступа...",
    title: "Доступ запрещён",
    description: "У вас нет прав для просмотра этой страницы. Если вы считаете, что это ошибка, свяжитесь с администрацией клуба.",
    back: "Вернуться на главную",
  },
  ES: {
    checking: "Verificando acceso...",
    title: "Acceso denegado",
    description: "No tienes permiso para ver esta página. Si crees que es un error, contacta con la administración del club.",
    back: "Volver al panel",
  },
  PT: {
    checking: "Verificando acesso...",
    title: "Acesso negado",
    description: "Você não tem permissão para ver esta página. Se acredita que isso é um erro, entre em contato com a administração do clube.",
    back: "Voltar ao painel",
  },
} as const;

type LangKey = keyof typeof translations;

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------
type RoleGuardProps = {
  allowedRoles: readonly Role[];
  children: React.ReactNode;
  /** "denied" — показать заглушку (по умолчанию), "redirect" — тихо увести на redirectTo */
  mode?: "denied" | "redirect";
  /** Куда уводить при mode="redirect" */
  redirectTo?: string;
  /** Куда уводить неавторизованных */
  loginPath?: string;
};

// ---------------------------------------------------------------------------
// Компонент
// ---------------------------------------------------------------------------
export default function RoleGuard({
  allowedRoles,
  children,
  mode = "denied",
  redirectTo = "/dashboard",
  loginPath = "/login",
}: RoleGuardProps) {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const { lang } = useLanguage();

  const t = translations[(lang as LangKey) in translations ? (lang as LangKey) : "EN"];

  const isAllowed = !!user && !!role && allowedRoles.includes(role);
  const shouldRedirectToLogin = !loading && !user;
  const shouldRedirectAway = !loading && !!user && !isAllowed && mode === "redirect";

  useEffect(() => {
    if (shouldRedirectToLogin) router.replace(loginPath);
    else if (shouldRedirectAway) router.replace(redirectTo);
  }, [shouldRedirectToLogin, shouldRedirectAway, loginPath, redirectTo, router]);

  // Пока грузим или уже уводим — показываем лоадер, а не мелькающий контент
  if (loading || shouldRedirectToLogin || shouldRedirectAway) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-zinc-500">
        <Loader2 size={22} strokeWidth={1.5} className="animate-spin text-amber-200/70" />
        <p className="text-[11px] uppercase tracking-[0.25em]">{t.checking}</p>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-10 text-center backdrop-blur-xl">
          <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/[0.06] blur-[80px]" />

          <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-200/30">
            <ShieldAlert size={22} strokeWidth={1.5} className="text-amber-200/90" />
          </div>

          <h1 className="relative mt-6 font-serif text-2xl font-medium tracking-wide text-zinc-50">
            {t.title}
          </h1>

          <div className="mx-auto mt-4 h-px w-12 bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />

          <p className="relative mt-4 text-sm leading-relaxed text-zinc-400">{t.description}</p>

          <Link
            href={redirectTo}
            className="group relative mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-100 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-950 transition-colors hover:bg-amber-200"
          >
            <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
            {t.back}
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// HOC-вариант: export default withRoleGuard(Page, ["admin", "owner"])
// ---------------------------------------------------------------------------
export function withRoleGuard<P extends object>(
  Component: ComponentType<P>,
  allowedRoles: readonly Role[],
  options?: Omit<RoleGuardProps, "allowedRoles" | "children">
) {
  function Guarded(props: P) {
    return (
      <RoleGuard allowedRoles={allowedRoles} {...options}>
        <Component {...props} />
      </RoleGuard>
    );
  }
  Guarded.displayName = `withRoleGuard(${Component.displayName || Component.name || "Component"})`;
  return Guarded;
}