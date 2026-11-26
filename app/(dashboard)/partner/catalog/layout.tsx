"use client";

/* Каталог резиденток (/partner/catalog, этап 2): менеджер, owner и admin.
 * Это только первый слой: кто реально видит анкеты — решает база
 * (voyage_rcat_mode: одобрен, активный доступ от owner, каталог включён). */

import RoleGuard from "@/app/components/RoleGuard";

const ALLOWED = ["manager", "owner", "admin"] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={ALLOWED} mode="redirect" redirectTo="/partner">
      {children}
    </RoleGuard>
  );
}
