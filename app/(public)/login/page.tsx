"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { useAuth } from "@/app/context/AuthContext";
import { Cormorant_Garamond } from "next/font/google";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase"; // <-- Подключили нашу базу!

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
});

type Lang = "EN" | "RU";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [lang, setLang] = useState<Lang>("EN");
  const [loading, setLoading] = useState(false); // Добавили стейт загрузки
  
  const router = useRouter();
  const { setUser } = useAuth();

  // --- РЕАЛЬНАЯ Функция входа через Supabase ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Достаем данные из полей ввода
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Стучимся в Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Ошибка входа:", error.message);
      alert("Ошибка входа: Неверный логин или пароль");
      setLoading(false);
      return;
    }

    // 1. Достаем имя из базы (из "кармана" user_metadata). 
    // Если имени пока нет, ставим красивую заглушку "Резидент"
    const userName = data.user?.user_metadata?.name || "Резидент";

    // 2. Создаем "билет" для middleware
    Cookies.set("voyage_token", "true", { expires: 7, secure: true });
    
    // 3. Обновляем контекст ПОЛНЫМИ данными (с id и email)
    setUser({ 
      id: data.user.id,
      email: data.user.email || "",
      name: userName 
    });
    
    // 4. Перекидываем в закрытую часть
    router.push("/dashboard");
  };

  // --- Словарь переводов ---
  const t = {
    EN: {
      privateClub: "Private Club",
      privateAccess: "Private Access",
      enterDetails: "Enter your account details",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "••••••••",
      forgotPassword: "Forgot password?",
      enterClub: "Enter the Club",
      invitationOnly: "Access is strictly by invitation only.",
      langEN: "EN",
      langRU: "RU",
    },
    RU: {
      privateClub: "Закрытый клуб",
      privateAccess: "Приватный доступ",
      enterDetails: "Введите данные вашего аккаунта",
      emailLabel: "Email",
      emailPlaceholder: "вы@example.com",
      passwordLabel: "Пароль",
      passwordPlaceholder: "••••••••",
      forgotPassword: "Забыли пароль?",
      enterClub: "Войти в клуб",
      invitationOnly: "Доступ строго по приглашениям.",
      langEN: "EN",
      langRU: "RU",
    },
  }[lang];

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/[0.04] blur-[120px]" />

      <div className="absolute top-6 right-6 md:top-8 md:right-8 z-50">
        <div className="relative flex items-center rounded-full border border-white/5 bg-zinc-900/50 p-1 backdrop-blur-md">
          <div
            className="absolute left-1 top-1 h-6 w-8 rounded-full bg-amber-200/20 transition-all duration-300"
            style={{ transform: lang === "EN" ? "translateX(0px)" : "translateX(32px)" }}
          />
          <button onClick={() => setLang("EN")} className={`relative z-10 flex h-6 w-8 items-center justify-center text-[10px] font-medium tracking-widest transition-colors ${lang === "EN" ? "text-amber-200" : "text-zinc-500"}`}>
            {t.langEN}
          </button>
          <button onClick={() => setLang("RU")} className={`relative z-10 flex h-6 w-8 items-center justify-center text-[10px] font-medium tracking-widest transition-colors ${lang === "RU" ? "text-amber-200" : "text-zinc-500"}`}>
            {t.langRU}
          </button>
        </div>
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-10 backdrop-blur-xl z-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/30">
            <span className={`${cormorant.className} text-2xl font-medium text-amber-200/90`}>V</span>
          </div>
          <p className={`${cormorant.className} mt-4 text-2xl font-medium tracking-[0.25em] text-zinc-50`}>VOYAGE</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.35em] text-zinc-500">{t.privateClub}</p>
        </div>

        <div className="mx-auto mt-8 h-px w-12 bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />

        <h1 className={`${cormorant.className} mt-8 text-center text-2xl font-medium text-zinc-50`}>{t.privateAccess}</h1>
        <p className="mt-2 text-center text-xs text-zinc-500">{t.enterDetails}</p>

        <form className="mt-8 space-y-4" onSubmit={handleLogin}>
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t.emailLabel}</label>
            <div className="relative">
              <Mail size={16} strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input name="email" type="email" placeholder={t.emailPlaceholder} className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-3 pl-11 pr-4 text-sm font-light text-white focus:border-amber-200/40 focus:outline-none" required />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t.passwordLabel}</label>
            <div className="relative">
              <Lock size={16} strokeWidth={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input name="password" type={showPassword ? "text" : "password"} placeholder={t.passwordPlaceholder} className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-3 pl-11 pr-11 text-sm font-light text-white focus:border-amber-200/40 focus:outline-none" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <a href="#" className="text-xs text-zinc-500 hover:text-amber-200/80">{t.forgotPassword}</a>
          </div>

          <button disabled={loading} type="submit" className="group mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-950 hover:bg-amber-200 disabled:opacity-50">
            {loading ? "Загрузка..." : t.enterClub}
            {!loading && <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />}
          </button>
        </form>

        <p className="mt-8 text-center text-[11px] tracking-wide text-zinc-600">{t.invitationOnly}</p>
      </div>
    </main>
    
  );
}