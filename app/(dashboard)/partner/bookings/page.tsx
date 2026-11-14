"use client";

/* «Туры и букинги» — список туров менеджера (owner видит все). */

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader, PageShell } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { ROUTES } from "@/app/(dashboard)/partner/_lib/routes";
import { errorCode, parseTourList, type TourListItem } from "@/lib/tour-ops/types";
import { opsError } from "@/lib/tour-ops/i18n";
import { Notice, useOps } from "@/app/components/tour-ops/ops-ui";
import TourOpsList from "@/app/components/tour-ops/TourOpsList";

export default function PartnerBookingsPage() {
  const { t, lang } = useOps();
  const [tours, setTours] = useState<TourListItem[] | null>(null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc("voyage_tour_ops_list", { p_include_closed: closed });
    if (rpcError) setError(opsError(t, errorCode(rpcError.message)));
    else setTours(parseTourList(data));
  }, [closed, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const owner = tours?.some((x) => x.access === "owner") ?? false;
  return (
    <PageShell>
      <PageHeader eyebrow={t.list.managerEyebrow} title={t.list.managerTitle} subtitle={t.list.managerSubtitle} />
      <label className="mt-6 inline-flex min-h-11 items-center gap-2 text-[13px] text-zinc-400">
        <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} className="size-4 accent-amber-200" /> {t.list.showClosed}
      </label>
      {error && <div className="mt-4"><Notice tone="rose">{error}</Notice></div>}
      <div className="mt-4">
        {tours === null ? (
          <p className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" /> {t.common.loading}</p>
        ) : (
          <TourOpsList tours={tours} t={t} lang={lang} hrefFor={ROUTES.bookingsTour} emptyText={t.list.empty} showManager={owner} />
        )}
      </div>
    </PageShell>
  );
}
