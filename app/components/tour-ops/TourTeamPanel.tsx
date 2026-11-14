"use client";

/* Операторы тура: привязать оператора команды организатора ко всему туру
 * или к выбранным моделям. Только менеджер тура и owner. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Headset, UserMinus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, BTN_GOLD, Panel } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { assignTourOperator, unassignTourOperator } from "@/app/actions/tour-ops";
import { opsError } from "@/lib/tour-ops/i18n";
import type { TourBoard } from "@/lib/tour-ops/types";
import { Chip, Field, INPUT, Notice, useOps } from "@/app/components/tour-ops/ops-ui";

type TeamOperator = { id: string; name: string; status: string };

export default function TourTeamPanel({ board, reload }: { board: TourBoard; reload: () => Promise<void> }) {
  const { t } = useOps();
  const [team, setTeam] = useState<TeamOperator[]>([]);
  const [operatorId, setOperatorId] = useState("");
  const [allModels, setAllModels] = useState(true);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assigned = board.operators ?? [];
  const names = new Map(board.models.map((m) => [m.id, m.name]));

  useEffect(() => {
    let alive = true;
    void supabase
      .from("operator_profiles")
      .select("profile_id,display_name,status")
      .eq("manager_id", board.tour.managerId)
      .order("display_name")
      .then(({ data }) => {
        if (!alive) return;
        setTeam((data ?? []).map((r) => ({ id: String(r.profile_id), name: String(r.display_name), status: String(r.status) })));
      });
    return () => {
      alive = false;
    };
  }, [board.tour.managerId]);

  const edit = (id: string) => {
    const o = assigned.find((x) => x.id === id);
    setOperatorId(id);
    setAllModels(o ? o.allModels : true);
    setModels(o ? o.modelIds : []);
  };

  const submit = async () => {
    if (!operatorId) return;
    setBusy(true);
    setError(null);
    const r = await assignTourOperator(board.tour.id, operatorId, allModels, models);
    setBusy(false);
    if (!r.ok) setError(opsError(t, r.code));
    else {
      setOperatorId("");
      setModels([]);
      setAllModels(true);
      await reload();
    }
  };

  const unassign = async (linkId: string) => {
    const r = await unassignTourOperator(linkId);
    if (!r.ok) setError(opsError(t, r.code));
    else await reload();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="p-5">
        <p className="mb-3 text-base text-zinc-50">{t.team.assignTitle}</p>
        {assigned.length === 0 && <p className="text-sm text-zinc-500">{t.team.noOperators}</p>}
        <ul className="space-y-2">
          {assigned.map((o) => (
            <li key={o.linkId} className="rounded-xl border border-zinc-800 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="flex items-center gap-2 text-sm text-zinc-100 hover:text-amber-100" onClick={() => edit(o.id)}>
                  <Headset className="size-4 text-amber-200/70" /> {o.name}
                </button>
                <div className="flex items-center gap-2">
                  {o.status === "suspended" && <Chip className="border-rose-400/40 text-rose-200">{t.team.suspended}</Chip>}
                  <button type="button" className={BTN_GHOST} onClick={() => unassign(o.linkId)}><UserMinus className="size-3.5" /> {t.team.unassign}</button>
                </div>
              </div>
              <p className="mt-1 text-[12px] text-zinc-500">{o.allModels ? t.team.allModels : o.modelIds.map((id) => names.get(id) ?? "—").join(", ")}</p>
            </li>
          ))}
        </ul>
        <Link href="/partner/team" className="mt-4 inline-flex text-[12px] text-amber-200/80 hover:underline">{t.team.teamLink} →</Link>
      </Panel>

      <Panel className="space-y-3 p-5">
        <Field label={t.team.pickOperator}>
          <select className={INPUT} value={operatorId} onChange={(e) => edit(e.target.value)}>
            <option value="">—</option>
            {team.filter((o) => o.status === "active").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={allModels} onClick={() => setAllModels(true)} className={`min-h-10 rounded-full border px-3 text-xs ${allModels ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-zinc-800 text-zinc-400"}`}>{t.team.allModels}</button>
          <button type="button" aria-pressed={!allModels} onClick={() => setAllModels(false)} className={`min-h-10 rounded-full border px-3 text-xs ${!allModels ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-zinc-800 text-zinc-400"}`}>{t.team.onlyModels}</button>
        </div>
        {!allModels && (
          <div className="flex flex-wrap gap-1.5">
            {board.models.map((m) => {
              const on = models.includes(m.id);
              return (
                <button key={m.id} type="button" aria-pressed={on} onClick={() => setModels((cur) => (on ? cur.filter((x) => x !== m.id) : [...cur, m.id]))} className={`min-h-9 rounded-full border px-3 text-[12px] ${on ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-zinc-800 text-zinc-400"}`}>
                  {m.name}
                </button>
              );
            })}
          </div>
        )}
        {error && <Notice tone="rose">{error}</Notice>}
        <button type="button" className={BTN_GOLD} disabled={busy || !operatorId} onClick={submit}>{busy ? t.common.saving : t.team.assign}</button>
      </Panel>
    </div>
  );
}
