"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · КАСТИНГ — подробности для резидентки
 * app/(dashboard)/dashboard/castings/[id]/page.tsx
 *
 * Открывается из ленты /dashboard/castings (карточка целиком или кнопка
 * «Подробнее»), по прямой ссылке, после F5 и в новой вкладке. Вся логика —
 * в _components/CastingDetail.tsx; данные — RPC partner_resident_feed().
 * Менеджер / admin / owner отсюда уходят на /partner/castings/[id].
 * ──────────────────────────────────────────────────────────────────── */

import { useParams } from "next/navigation";
import { ResidentPageShell } from "@/app/(dashboard)/dashboard/_components/PageExplainerHeader";
import CastingDetail from "@/app/(dashboard)/dashboard/_components/CastingDetail";

export default function ResidentCastingPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? decodeURIComponent(params.id) : "";
  return (
    <ResidentPageShell className="pt-2">
      <CastingDetail castingId={id} />
    </ResidentPageShell>
  );
}
