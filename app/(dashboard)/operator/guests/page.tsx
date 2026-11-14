"use client";

/* Пробивщик для оператора: поиск, карточка, заметки. Статус меняет менеджер. */

import { PageHeader, PageShell } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { useOps } from "@/app/components/tour-ops/ops-ui";
import GuestDesk from "@/app/components/tour-ops/GuestDesk";

export default function OperatorGuestsPage() {
  const { t } = useOps();
  return (
    <PageShell>
      <PageHeader eyebrow={t.guests.eyebrow} title={t.guests.title} subtitle={t.guests.subtitle} />
      <div className="mt-8 max-w-3xl">
        <GuestDesk canModerate={false} />
      </div>
    </PageShell>
  );
}
