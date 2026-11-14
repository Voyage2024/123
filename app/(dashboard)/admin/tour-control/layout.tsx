"use client";

/* Контроль туров и букингов: только owner (admin исключён).
 * Сервер уже проверил роль в proxy.ts; этот гард — второй слой на клиенте. */

import RoleGuard from "@/app/components/RoleGuard";

const ALLOWED = ["owner"] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={ALLOWED} mode="redirect" redirectTo="/admin">
      {children}
    </RoleGuard>
  );
}
