"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import { User, LogOut, ChevronDown } from "lucide-react";
import UserAvatar from "@/app/components/UserAvatar";

export default function Header() {
  const { user, role, logout } = useAuth(); // Берём правильный метод logout из контекста
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  // Настройки профиля: у резидента свой маршрут, у персонала — админский
  const settingsHref = role === "resident" ? "/dashboard/settings" : "/admin/settings";

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout(); // supabase.auth.signOut() + очистка куки и стейта
    router.push("/login");
  };

  return (
    <header className="fixed top-0 w-full p-6 flex justify-between items-center z-40 bg-zinc-950/50 backdrop-blur-md">
      <div className="font-serif text-xl tracking-[0.2em] text-amber-200/90">VOYAGE</div>

      {user ? (
        <div className="relative">
          {/* Именной бейдж */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 py-1.5 pl-1.5 pr-4 text-sm text-amber-200 transition-colors hover:border-amber-200/40"
          >
            <UserAvatar user={user} className="h-7 w-7" textClassName="text-[11px]" />
            <span className="max-w-[140px] truncate">{user.fullName}</span>
            <ChevronDown size={14} className={isMenuOpen ? "rotate-180" : ""} />
          </button>

          {/* Выпадающее меню */}
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
              <Link
                href={settingsHref}
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-xs uppercase tracking-widest text-zinc-300 hover:bg-zinc-900"
              >
                <User size={14} /> Личный кабинет
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-3 text-xs uppercase tracking-widest text-red-400 hover:bg-zinc-900"
              >
                <LogOut size={14} /> Выйти
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link href="/login" className="text-xs uppercase tracking-widest text-zinc-500 hover:text-amber-200">
          Войти
        </Link>
      )}
    </header>
  );
}