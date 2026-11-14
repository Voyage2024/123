"use client";

/* «Диспетчерский пульт» — домашняя оператора (редирект после входа). */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ScanSearch, UserCog } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, PageHeader, PageShell } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { errorCode, obj, parseTourList, str, type TourListItem } from "@/lib/tour-ops/types";
import { opsError } from "@/lib/tour-ops/i18n";
import { Notice, useOps } from "@/app/components/tour-ops/ops-ui";
import TourOpsList from "@/app/components/tour-ops/TourOpsList";

export default function OperatorHomePage() {
  const { t, lang } = useOps();
  const [tours, setTours] = useState<TourListItem[] | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.rpc("voyage_operator_home").then(({ data, error: rpcError }) => {
      if (rpcError) {
        setError(opsError(t, errorCode(rpcError.message)));
        setTours([]);
        return;
      }
      const d = obj(data);
      setProfile(obj(d.profile));
      setTours(parseTourList(d.tours));
    });
  }, [t]);

  const suspended = str(profile.status) === "suspended";
  return (
    <PageShell>
      <PageHeader
        eyebrow={t.operator.eyebrow}
        title={t.operator.title}
        subtitle={t.operator.subtitle}
        actions={
          <>
            <Link href="/operator/guests" className={BTN_GHOST}><ScanSearch className="size-3.5" /> {t.guests.title}</Link>
            <Link href="/operator/profile" className={BTN_GHOST}><UserCog className="size-3.5" /> {t.operator.profileTitle}</Link>
          </>
        }
        aside={str(profile.manager_name) ? <p className="text-[13px] text-zinc-400">{t.operator.manager}: <span className="text-zinc-100">{str(profile.manager_name)}</span></p> : undefined}
      />
      {suspended && <div className="mt-6"><Notice tone="rose">{t.operator.suspendedNote}</Notice></div>}
      {error && <div className="mt-6"><Notice tone="rose">{error}</Notice></div>}
      <p className="mb-3 mt-8 text-[10px] uppercase tracking-[0.3em] text-amber-200/60">{t.operator.pickTour}</p>
      {tours === null ? (
        <p className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" /> {t.common.loading}</p>
      ) : (
        <TourOpsList tours={tours} t={t} lang={lang} hrefFor={(id) => `/operator/${id}`} emptyText={t.list.emptyOperator} />
      )}
    </PageShell>
  );
}
