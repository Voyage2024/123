"use client";

/* Контроль каталога резиденток (этап 2). Доступ к разделу — только owner
 * (layout tour-control + proxy.ts); изменения дополнительно проверяет база. */

import OwnerCatalogControl from "@/app/components/catalog/OwnerCatalogControl";

export default function OwnerCatalogPage() {
  return <OwnerCatalogControl />;
}
