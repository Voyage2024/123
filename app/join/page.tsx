/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · /join — страница открытия ключа-приглашения
 * app/join/page.tsx
 *
 * Публичная страница вне дашборда: гостья приходит сюда по ссылке
 * /join?key=VYG-XXXX-XXXX из сообщения поручительницы.
 * Если middleware закрывает все страницы для гостей — добавьте /join
 * в список публичных путей.
 * ──────────────────────────────────────────────────────────────────── */

import { Suspense } from "react";
import type { Metadata } from "next";
import JoinClient, { JoinFallback } from "./JoinClient";

export const metadata: Metadata = {
  title: "Voyage · Sur invitation",
  description: "A personal invitation to the private club Voyage.",
  // личные ссылки-приглашения не должны попадать в поиск
  robots: { index: false, follow: false },
};

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinFallback />}>
      <JoinClient />
    </Suspense>
  );
}