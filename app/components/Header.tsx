"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { logoutUser } from "@/lib/auth"; // Сделаем этот метод в lib/auth.ts
import { useRouter } from "next/navigation";
import { User, LogOut, ChevronDown } from "lucide-react";

export default function Header() {
  const { user, setUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    logoutUser(); // Удаляет куку
    setUser(null); // Очищает "Мозг"
    setIsMenuOpen(false);
    router.push("/login"); // Выкидывает на логин
  };

  return (
    <header className="fixed top-0 w-full p-6 flex justify-between items-center z-40 bg-zinc-950/50 backdrop-blur-md">
      <div className="font-serif text-xl tracking-[0.2em] text-amber-200/90">VOYAGE</div>
      
      {user ? (
        <div className="relative">
          {/* Именной бейдж */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-sm text-amber-200 transition-hover hover:border-amber-200/40"
          >
            {user.name}
            <ChevronDown size={14} className={isMenuOpen ? "rotate-180" : ""} />
          </button>

          {/* Выпадающее меню */}
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
              <Link href="/profile" className="flex items-center gap-3 px-4 py-3 text-xs uppercase tracking-widest text-zinc-300 hover:bg-zinc-900">
                <User size={14} /> Личный кабинет
              </Link>
              <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-3 text-xs uppercase tracking-widest text-red-400 hover:bg-zinc-900">
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