"use client";

/* «Пробивщик гостей» для менеджера и owner: + статус, скрытие заметок; owner — удаление. */

import { PageHeader, PageShell } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { useAuth } from "@/app/context/AuthContext";
import { useOps } from "@/app/components/tour-ops/ops-ui";
import GuestDesk from "@/app/components/tour-ops/GuestDesk";

export default function PartnerGuestsPage() {
  const { t } = useOps();
  const { role } = useAuth();
  return (
    <PageShell>
      <PageHeader eyebrow={t.guests.eyebrow} title={t.guests.title} subtitle={t.guests.subtitle} />
      <div className="mt-8 max-w-3xl">
        <GuestDesk canModerate canDelete={role === "owner"} />
      </div>
    </PageShell>
  );
}
