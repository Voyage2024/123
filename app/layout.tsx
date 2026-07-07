import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import { AuthProvider } from "./context/AuthContext"; // Импортируем провайдер
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  variable: "--font-cormorant",
});

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
    <html lang="ru" className={cormorant.variable}>
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        {/* Оборачиваем всё приложение в наш "Мозг" (AuthProvider) */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}