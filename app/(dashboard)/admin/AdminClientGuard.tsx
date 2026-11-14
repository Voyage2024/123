"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import RoleGuard from "@/app/components/RoleGuard"; // ← поправь путь, если RoleGuard лежит в другом месте
import { STAFF_ROLES, getAdminAllowedRoles } from "@/lib/rbac";

/* ──────────────────────────────────────────────────────────────────────
 * Клиентский слой защиты /admin/* (бывший admin/layout.tsx).
 *
 * Сервер уже проверил вход, роль, бан и код MFA в admin/layout.tsx.
 * Этот гард ловит переходы без перезагрузки и правила разделов
 * (менеджеру — только /admin/settings) из lib/rbac.ts.
 * ──────────────────────────────────────────────────────────────────── */

export default function AdminClientGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sectionRoles = useMemo(() => getAdminAllowedRoles(pathname), [pathname]);

  return (
    <RoleGuard allowedRoles={STAFF_ROLES} mode="redirect" redirectTo="/dashboard">
      <RoleGuard allowedRoles={sectionRoles} mode="denied" redirectTo="/admin">
        {children}
      </RoleGuard>
    </RoleGuard>
  );
}
