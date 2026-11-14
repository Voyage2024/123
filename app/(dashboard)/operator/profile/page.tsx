"use client";

/* Профиль оператора: контакты (меняет менеджер) и свой часовой пояс. */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader, PageShell, Panel } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { obj, str } from "@/lib/tour-ops/types";
import { useOps } from "@/app/components/tour-ops/ops-ui";
import TimezoneSettings from "@/app/components/tour-ops/TimezoneSettings";

export default function OperatorProfilePage() {
  const { t } = useOps();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void supabase.rpc("voyage_operator_home").then(({ data }) => setProfile(obj(obj(data).profile)));
  }, []);

  const rows: [string, string][] = profile
    ? [
        [t.operator.displayName, str(profile.display_name)],
        [t.operator.telegram, str(profile.telegram_username) ? `@${str(profile.telegram_username)}` : "—"],
        [t.operator.phone, str(profile.phone) || "—"],
        [t.operator.manager, str(profile.manager_name) || "—"],
      ]
    : [];

  return (
    <PageShell>
      <PageHeader eyebrow={t.operator.eyebrow} title={t.operator.profileTitle} subtitle={t.operator.profileSubtitle} />
      <div className="mt-8 grid max-w-3xl gap-4 md:grid-cols-2">
        <Panel className="p-5">
          <dl className="space-y-2 text-[13px]">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{k}</dt>
                <dd className="text-zinc-100">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel className="p-5">
          {profile && <TimezoneSettings initial={str(profile.timezone) || null} />}
        </Panel>
      </div>
    </PageShell>
  );
}
