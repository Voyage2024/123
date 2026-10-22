import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import BunkerShell from "@/app/bunker/_components/BunkerShell";
import { getBunkerViewer } from "@/lib/bunker/access";
import "@/app/bunker/bunker.css";

/* ──────────────────────────────────────────────────────────────────────
 * /bunker — личная закрытая зона владельца.
 *
 * Доступ: только BUNKER_OWNER_IDS или роль owner (lib/bunker/access.ts).
 * Остальным notFound() — снаружи раздел выглядит как несуществующий.
 * Та же проверка стоит в middleware (lib/bunker/middleware.ts), а данные
 * дополнительно закрыты RLS.
 *
 * PWA: свой manifest (scope /bunker) и метатеги iOS — «На экран Домой»
 * в Safari открывает бункер как отдельное приложение без панелей браузера.
 * Шапка Voyage (Navbar) на /bunker скрыта.
 * ──────────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Bunker", template: "%s · Bunker" },
  description: "Private planner, finance tracker and vault.",
  manifest: "/manifest.json",
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: { capable: true, title: "Bunker", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/bunker/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/bunker/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/bunker/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false, email: false, address: false },
  // Явно, на случай если версия Next выводит только mobile-web-app-capable.
  other: { "apple-mobile-web-app-capable": "yes", "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default async function BunkerLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getBunkerViewer();
  if (!viewer) notFound();

  // Корневой layout даёт <main className="pt-24"> под шапку Voyage — здесь шапки нет.
  return (
    <div className="-mt-24">
      <BunkerShell>{children}</BunkerShell>
    </div>
  );
}
