"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Cookies from "js-cookie";

type UserType = {
  id: string;
  email: string;
  name: string;
} | null;

// Добавили loading в тип контекста
type AuthContextType = {
  user: UserType;
  setUser: (user: UserType) => void;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserType>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrapAuth = async () => {
      setLoading(true);
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      
      if (sbUser) {
        setUser({ 
          id: sbUser.id,
          email: sbUser.email || "",
          name: sbUser.user_metadata?.name || "Резидент" 
        });
        Cookies.set("voyage_token", "true", { expires: 7, secure: true });
      } else {
        setUser(null);
        Cookies.remove("voyage_token");
      }
      setLoading(false);
    };

    bootstrapAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ 
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.name || "Резидент" 
        });
        Cookies.set("voyage_token", "true", { expires: 7, secure: true });
      } else {
        setUser(null);
        Cookies.remove("voyage_token");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    Cookies.remove("voyage_token");
    setUser(null);
  };

  // Важно: убрали возврат Loader2 из провайдера, 
  // чтобы он не блокировал весь сайт, если ты захочешь сделать 
  // другой экран загрузки в другом месте.
  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth должен использоваться внутри AuthProvider");
  }
  return context;
}