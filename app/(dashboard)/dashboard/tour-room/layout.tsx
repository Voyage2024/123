"use client";

/* Комната тура резидентки: только сама модель тура (права — в RPC).
 * Сервер уже проверил роль в proxy.ts; этот гард — второй слой на клиенте. */

import RoleGuard from "@/app/components/RoleGuard";

const ALLOWED = ["resident"] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={ALLOWED} mode="redirect" redirectTo="/dashboard">
      {children}
    </RoleGuard>
  );
}
