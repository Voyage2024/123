"use client";

/* «Мой часовой пояс» — мелкое время на таймлайне. Пусто = пояс браузера. */

import { useState } from "react";
import { BTN_GOLD } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { setMyTimezone } from "@/app/actions/tour-ops";
import { opsError } from "@/lib/tour-ops/i18n";
import { COMMON_TIMEZONES, browserTimezone, isValidTimezone } from "@/lib/tour-ops/time";
import { Field, INPUT, Notice, useOps } from "@/app/components/tour-ops/ops-ui";

export default function TimezoneSettings({ initial, onSaved }: { initial: string | null; onSaved?: (tz: string | null) => void }) {
  const { t } = useOps();
  const [tz, setTz] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "rose" | "emerald"; text: string } | null>(null);

  const submit = async () => {
    const value = tz.trim();
    if (value && !isValidTimezone(value)) {
      setMsg({ tone: "rose", text: t.errors.invalid_timezone });
      return;
    }
    setBusy(true);
    const r = await setMyTimezone(value);
    setBusy(false);
    if (!r.ok) setMsg({ tone: "rose", text: opsError(t, r.code) });
    else {
      setMsg({ tone: "emerald", text: t.settings.saved });
      onSaved?.(value || null);
    }
  };

  return (
    <div className="space-y-3">
      <Field label={t.team.myTimezone} hint={t.team.myTimezoneHint}>
        <input className={INPUT} list="voyage-my-tz" value={tz} onChange={(e) => setTz(e.target.value)} placeholder={browserTimezone()} />
        <datalist id="voyage-my-tz">{COMMON_TIMEZONES.map((z) => <option key={z} value={z} />)}</datalist>
      </Field>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <button type="button" className={BTN_GOLD} disabled={busy} onClick={submit}>{busy ? t.common.saving : t.common.save}</button>
    </div>
  );
}
