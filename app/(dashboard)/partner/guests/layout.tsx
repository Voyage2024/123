"use client";

/* ОС туров (/partner/guests): только менеджер и owner — admin к модулю доступа не имеет.
 * Сервер уже проверил роль в proxy.ts; этот гард — второй слой на клиенте. */

import RoleGuard from "@/app/components/RoleGuard";

const ALLOWED = ["manager", "owner"] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={ALLOWED} mode="redirect" redirectTo="/partner">
      {children}
    </RoleGuard>
  );
}
