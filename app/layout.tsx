import type { Metadata } from "next";
import { AuthProvider } from "@/app/context/AuthContext"; // "Мозг" авторизации
import { LanguageProvider } from "@/app/context/LanguageContext"; // Глобальный язык
import Navbar from "@/app/components/Navbar";
import PresenceHeartbeat from "@/app/components/PresenceHeartbeat";
import { cormorant } from "@/app/components/profile/fonts";
import "@/app/globals.css";
import "@/app/mobile.css";
import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export const metadata: Metadata = {
  title: "Voyage — Private Club",
  description: "Exclusive access. Curated experiences.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // lang по умолчанию "en" (как и язык в контексте),
    // LanguageProvider сам обновит его при переключении языка.
    <html lang="en" className={cormorant.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {/* Порядок: сначала авторизация, внутри — язык */}
        <AuthProvider>
          <PresenceHeartbeat />
          <LanguageProvider>
            <Navbar />
            <main className="pt-24">{children}</main>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}