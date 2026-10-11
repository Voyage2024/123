"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Clock3, Fingerprint, LoaderCircle } from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { supabase } from "@/lib/supabase";

type Dict = Record<string, string>;
type BanProfile = { banned_until: string | null; ban_reason: string | null; ban_permanent: boolean | null };
const LOCALE: Record<Lang, string> = { EN: "en-US", RU: "ru-RU", ES: "es-ES", PT: "pt-BR" };
const T: Record<Lang, Dict> = {
  EN: {
    loading: "Checking account status…", titleError: "Voyage · Access Review", loadError: "We could not verify your access status. Please contact club administration.", restricted: "Access temporarily restricted", intro: "Your account has been temporarily frozen. Access will be restored when the restriction expires or when club administration removes it.", reason: "Reason", noReason: "No reason was provided. Please contact club administration.", opens: "Access available", forever: "Indefinitely · pending an administrative decision", afterExpiry: "After the restriction expires", timezone: "Time shown in the Asia/Ho_Chi_Minh time zone.", appeal: "If you believe this restriction was made in error, contact Voyage Private Club administration.",
  },
  RU: {
    loading: "Проверка статуса аккаунта…", titleError: "Voyage · Проверка доступа", loadError: "Не удалось проверить состояние доступа. Пожалуйста, свяжитесь с администрацией клуба.", restricted: "Доступ временно ограничен", intro: "Ваш аккаунт временно заморожен. Доступ к платформе будет восстановлен после окончания блокировки либо после её снятия администрацией.", reason: "Причина", noReason: "Причина не указана. Обратитесь к администрации клуба.", opens: "Доступ откроется", forever: "Навсегда - до решения администрации", afterExpiry: "После завершения срока блокировки", timezone: "Время указано по часовому поясу Asia/Ho_Chi_Minh.", appeal: "Если вы считаете блокировку ошибочной, обратитесь к администрации Voyage Private Club.",
  },
  ES: {
    loading: "Comprobando el estado de la cuenta…", titleError: "Voyage · Revisión de acceso", loadError: "No pudimos verificar tu estado de acceso. Ponte en contacto con la administración del club.", restricted: "Acceso temporalmente restringido", intro: "Tu cuenta se ha suspendido temporalmente. El acceso se restablecerá cuando termine la restricción o cuando la administración del club la retire.", reason: "Motivo", noReason: "No se indicó ningún motivo. Ponte en contacto con la administración del club.", opens: "Acceso disponible", forever: "Indefinidamente · pendiente de una decisión administrativa", afterExpiry: "Cuando termine el periodo de restricción", timezone: "La hora se muestra en la zona horaria Asia/Ho_Chi_Minh.", appeal: "Si crees que la restricción es un error, ponte en contacto con Voyage Private Club.",
  },
  PT: {
    loading: "Verificando o status da conta…", titleError: "Voyage · Revisão de acesso", loadError: "Não foi possível verificar seu acesso. Entre em contato com a administração do clube.", restricted: "Acesso temporariamente restrito", intro: "Sua conta foi temporariamente suspensa. O acesso será restaurado quando a restrição terminar ou quando a administração do clube removê-la.", reason: "Motivo", noReason: "Nenhum motivo foi informado. Entre em contato com a administração do clube.", opens: "Acesso disponível", forever: "Por tempo indeterminado · aguardando decisão administrativa", afterExpiry: "Após o término da restrição", timezone: "O horário é exibido no fuso horário Asia/Ho_Chi_Minh.", appeal: "Se você acredita que a restrição foi aplicada por engano, entre em contato com o Voyage Private Club.",
  },
};

export default function BannedPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const [profile, setProfile] = useState<BanProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) { router.replace("/login"); return; }
      const { data, error } = await supabase.from("profiles").select("banned_until, ban_reason, ban_permanent").eq("id", authData.user.id).maybeSingle();
      if (!alive) return;
      if (error || !data) { setFailed(true); setLoading(false); return; }
      const p = data as BanProfile;
      const permanent = p.ban_permanent === true || p.banned_until === "infinity";
      const timestamp = typeof p.banned_until === "string" ? Date.parse(p.banned_until) : NaN;
      const active = permanent || (Number.isFinite(timestamp) && timestamp > Date.now());
      if (!active) { router.replace("/dashboard"); return; }
      setProfile(p);
      setLoading(false);
    };
    void load();
    return () => { alive = false; };
  }, [router]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-zinc-500"><LoaderCircle size={18} className="animate-spin text-amber-200/70" />{t.loading}</div>;

  if (failed || !profile) return <div className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center px-4 py-16"><div className="w-full rounded-2xl border border-zinc-800/70 bg-zinc-900/50 p-8 text-center backdrop-blur-xl"><ShieldAlert className="mx-auto h-8 w-8 text-amber-200" /><h1 className="mt-5 font-serif text-3xl text-zinc-100">{t.titleError}</h1><p className="mt-3 text-sm leading-6 text-zinc-400">{t.loadError}</p></div></div>;

  const permanent = profile.ban_permanent === true || profile.banned_until === "infinity";
  const until = typeof profile.banned_until === "string" ? Date.parse(profile.banned_until) : NaN;
  const formattedUntil = !permanent && Number.isFinite(until) ? new Date(until).toLocaleString(LOCALE[lang], { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "long", timeStyle: "short" }) : null;

  return <div className="relative mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4 py-12 sm:px-6"><div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/[0.035] blur-[100px]" /><section className="relative w-full overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/45 p-7 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-12"><div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/50 to-transparent" /><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] text-amber-100"><ShieldAlert size={24} strokeWidth={1.4} /></div><p className="mt-6 text-center text-[10px] font-semibold uppercase tracking-[0.35em] text-amber-100/60">Voyage Private Club</p><h1 className="mt-3 text-center font-serif text-3xl font-medium tracking-wide text-zinc-50 sm:text-4xl">{t.restricted}</h1><p className="mx-auto mt-4 max-w-xl text-center text-sm leading-7 text-zinc-400">{t.intro}</p>
    <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-zinc-800/80 bg-black/20 p-5"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500"><Fingerprint size={14} className="text-amber-200/70" /> {t.reason}</div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{profile.ban_reason?.trim() || t.noReason}</p></div><div className="rounded-2xl border border-zinc-800/80 bg-black/20 p-5"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500"><Clock3 size={14} className="text-amber-200/70" /> {t.opens}</div><p className="mt-3 text-sm leading-6 text-zinc-100">{permanent ? t.forever : formattedUntil ?? t.afterExpiry}</p>{!permanent && <p className="mt-2 text-xs text-zinc-600">{t.timezone}</p>}</div></div><div className="mt-8 border-t border-zinc-800/70 pt-5 text-center"><p className="text-xs leading-5 text-zinc-600">{t.appeal}</p></div>
  </section></div>;
}
