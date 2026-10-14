/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · КАРТОЧКА ТУРА — app/(dashboard)/partner/manifest/[id]/page.tsx
 *
 * Отдельной карточки тура пока нет: её работу делает Комната тура.
 * Штаб и алерты ссылаются на /partner/manifest/[id] — отправляем туда,
 * а не на 404. Когда появится своя карточка, замените этот файл.
 * ──────────────────────────────────────────────────────────────────── */

import { redirect } from "next/navigation";
import { ROUTES } from "../../_lib/routes";

// Next 15 передаёт params промисом; в Next 14 await обычного объекта тоже работает
export default async function PartnerTourPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(ROUTES.dealRoom(id));
}
