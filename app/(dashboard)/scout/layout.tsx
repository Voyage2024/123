"use client";

/* Кабинет скаута (/scout/*): только роль scout.
 * Сервер уже проверил роль в proxy.ts; этот гард — второй слой на клиенте,
 * данные дополнительно режут RLS и SECURITY DEFINER RPC. */

import RoleGuard from "@/app/components/RoleGuard";

const ALLOWED = ["scout"] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={ALLOWED} mode="redirect" redirectTo="/login">
      {children}
    </RoleGuard>
  );
}
