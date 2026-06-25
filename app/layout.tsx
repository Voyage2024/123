import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
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

// ─────────────────────────────────────────────────────────────
// ROOT LAYOUT — максимально «тонкий».
// Никакого сайдбара и обёрток здесь быть НЕ должно: и публичная
// витрина, и приватный кабинет наследуют только <html>/<body>.
// Конкретный каркас (sidebar / fullscreen) задают вложенные
// layout-файлы внутри route groups (public) и (dashboard).
// ─────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={cormorant.variable}>
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
