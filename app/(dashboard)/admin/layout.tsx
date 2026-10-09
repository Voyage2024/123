"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import RoleGuard from "@/app/components/RoleGuard"; // ← поправь путь, если RoleGuard лежит в другом месте
import { STAFF_ROLES, getAdminAllowedRoles } from "@/lib/rbac";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN LAYOUT — защищённая зона /admin/*
 *
 * Основную проверку уже делает middleware на сервере. Этот гард —
 * второй слой на клиенте: ловит переходы без перезагрузки страницы
 * и смену роли посреди сессии.
 *
 * Правила доступа к разделам лежат в lib/rbac.ts и общие с middleware.
 * ──────────────────────────────────────────────────────────────────── */

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
