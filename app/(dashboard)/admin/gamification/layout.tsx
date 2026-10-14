"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import RoleGuard from "@/app/components/RoleGuard"; // ← поправь путь, если RoleGuard лежит в другом месте
import { STAFF_ROLES, getAdminAllowedRoles } from "@/lib/rbac";
import { useAuth } from "@/app/context/AuthContext";

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
  const { role } = useAuth();
  const sectionRoles = useMemo(() => getAdminAllowedRoles(pathname), [pathname]);
  const deniedRedirect = role === "manager" ? "/partner" : role === "resident" ? "/dashboard" : "/admin";

  return (
    <RoleGuard allowedRoles={STAFF_ROLES} mode="redirect" redirectTo="/dashboard">
      <RoleGuard allowedRoles={sectionRoles} mode="redirect" redirectTo={deniedRedirect}>
        {children}
      </RoleGuard>
    </RoleGuard>
  );
}
