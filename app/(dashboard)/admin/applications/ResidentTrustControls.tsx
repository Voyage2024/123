'use client';

import { useState } from 'react';
import { ArrowRightLeft, Check, Crown, Loader2, Save, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type Segment = 'working' | 'elite';

const CIRCLE_NAMES: Record<number, string> = {
  1: 'Voyager',
  2: 'Resident',
  3: 'Preferred',
  4: 'Inner Circle',
  5: 'Private Circle',
  6: 'Black Circle',
};

export function getCircleName(levelValue: unknown) {
  const level = Math.max(1, Math.min(6, Math.floor(Number(levelValue) || 1)));
  return { level, title: CIRCLE_NAMES[level] };
}

export function getReliabilityClass(value: number) {
  if (value >= 90) return 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300';
  if (value >= 70) return 'border-amber-200/25 bg-amber-200/[0.07] text-amber-100';
  return 'border-rose-400/25 bg-rose-400/[0.07] text-rose-300';
}

function getKycBadge(levelValue: unknown, statusValue?: string | null, submittedLevel?: number | null) {
  const level = Math.max(0, Math.min(3, Math.floor(Number(levelValue) || 0)));
  const status = String(statusValue ?? '').toLowerCase();
  const step = submittedLevel ? ` · ${submittedLevel}/3` : (level > 0 ? ` · ${level}/3` : '');
  if (level >= 3) return { label: 'KYC VERIFIED', cls: 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300' };
  if (['approved', 'verified', 'passed', 'completed'].includes(status)) return { label: `KYC APPROVED${step}`, cls: 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300' };
  if (status === 'pending') return { label: `KYC PENDING${step}`, cls: 'border-amber-200/25 bg-amber-200/[0.07] text-amber-100' };
  if (status === 'rejected') return { label: `KYC REJECTED${step}`, cls: 'border-rose-400/25 bg-rose-400/[0.07] text-rose-300' };
  if (level > 0) return { label: `KYC LEVEL ${level}/3`, cls: 'border-amber-200/20 bg-amber-200/[0.04] text-amber-100/80' };
  return { label: 'KYC NOT VERIFIED', cls: 'border-white/10 bg-white/[0.035] text-zinc-500' };
}

export function ResidentTrustBadges({
  segment,
  level,
  reliability,
  kycLevel,
  kycStatus = null,
  kycSubmissionLevel = null,
}: {
  segment: Segment | string | null | undefined;
  level: number | null | undefined;
  reliability: number | null | undefined;
  kycLevel: number | string | null | undefined;
  kycStatus?: string | null;
  kycSubmissionLevel?: number | null;
}) {
  const safeSegment: Segment = segment === 'elite' ? 'elite' : 'working';
  const trust = Math.max(0, Math.min(100, reliability == null ? 100 : (Number.isFinite(Number(reliability)) ? Number(reliability) : 100)));
  const circle = getCircleName(level);
  const kyc = getKycBadge(kycLevel, kycStatus, kycSubmissionLevel);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Resident trust status">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] ${safeSegment === 'elite' ? 'border-amber-200/40 bg-amber-200/10 text-amber-100' : 'border-zinc-700/70 bg-zinc-800/50 text-zinc-300'}`}>
        {safeSegment === 'elite' && <Crown size={10} aria-hidden />}
        {safeSegment.toUpperCase()}
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.025] px-2 py-0.5 text-[10px] text-zinc-300">
        Level {circle.level} · {circle.title}
      </span>
      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${getReliabilityClass(trust)}`}>
        Reliability {trust.toLocaleString('en-US', { maximumFractionDigits: 2 })}%
      </span>
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium tracking-wide ${kyc.cls}`}>
        <ShieldCheck size={10} aria-hidden /> {kyc.label}
      </span>
    </div>
  );
}

export function ResidentSocialLiftControls({
  profileId,
  segment,
  reliability,
  enabled,
  onUpdated,
}: {
  profileId: string;
  segment: Segment | string | null | undefined;
  reliability: number | null | undefined;
  enabled: boolean;
  onUpdated: (next: { segment: Segment; reliability: number }) => void;
}) {
  const currentSegment: Segment = segment === 'elite' ? 'elite' : 'working';
  const currentReliability = Math.max(0, Math.min(100, reliability == null ? 100 : (Number.isFinite(Number(reliability)) ? Number(reliability) : 100)));
  const [draft, setDraft] = useState(String(currentReliability));
  const [busy, setBusy] = useState<'segment' | 'reliability' | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  if (!enabled) return null;

  async function save(nextSegment: Segment | null, nextReliability: number | null, kind: 'segment' | 'reliability') {
    if (busy) return;
    setBusy(kind);
    setFeedback(null);
    const { data, error } = await supabase.rpc('admin_set_resident_segment_reliability', {
      p_profile_id: profileId,
      p_segment: nextSegment,
      p_reliability: nextReliability,
    });
    setBusy(null);

    if (error) {
      console.error('[VOYAGE Social Lift]', error);
      setFeedback({ ok: false, text: error.message || 'Не удалось сохранить изменения.' });
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      setFeedback({ ok: false, text: 'База не вернула обновлённый профиль.' });
      return;
    }

    const result = row as { segment?: string; reliability?: number | string };
    const next = {
      segment: result.segment === 'elite' ? 'elite' as const : 'working' as const,
      reliability: Math.max(0, Math.min(100, Number(result.reliability ?? currentReliability))),
    };
    setDraft(String(next.reliability));
    onUpdated(next);
    setFeedback({ ok: true, text: kind === 'segment' ? 'Сегмент обновлён.' : 'Надёжность обновлена.' });
  }

  const parsedDraft = draft.trim() === '' ? NaN : Number(draft);
  const validDraft = Number.isFinite(parsedDraft) && parsedDraft >= 0 && parsedDraft <= 100;

  return (
    <details className="mt-2 text-left" onToggle={(event) => { if (!(event.currentTarget as HTMLDetailsElement).open) setFeedback(null); }}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-amber-200/20 bg-amber-200/[0.035] px-2.5 py-1 text-[10px] font-medium text-amber-100/90 transition hover:border-amber-200/45 hover:bg-amber-200/[0.07]">
        <ArrowRightLeft size={12} aria-hidden /> Social Lift
      </summary>
      <div className="mt-2 w-full max-w-[300px] rounded-xl border border-zinc-700/70 bg-zinc-950/95 p-3 shadow-xl sm:min-w-[260px]">
        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Управление профилем</p>
        <button
          type="button"
          onClick={() => void save(currentSegment === 'elite' ? 'working' : 'elite', null, 'segment')}
          disabled={busy !== null}
          className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg border border-amber-200/20 bg-amber-200/[0.05] px-3 py-2 text-xs text-amber-100 transition hover:border-amber-200/45 hover:bg-amber-200/[0.09] disabled:opacity-50"
        >
          <span>{currentSegment === 'elite' ? 'Перевести в WORKING' : 'Перевести в ELITE'}</span>
          {busy === 'segment' ? <Loader2 size={13} className="animate-spin" /> : <Crown size={13} />}
        </button>
        <label className="mt-3 block text-[11px] text-zinc-400" htmlFor={`reliability-${profileId}`}>Reliability · 0-100%</label>
        <div className="mt-1.5 flex gap-2">
          <input
            id={`reliability-${profileId}`}
            type="number"
            min={0}
            max={100}
            step="0.01"
            inputMode="decimal"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-200/35"
          />
          <button
            type="button"
            onClick={() => void save(null, parsedDraft, 'reliability')}
            disabled={busy !== null || !validDraft || parsedDraft === currentReliability}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 transition hover:border-amber-200/35 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === 'reliability' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Сохранить
          </button>
        </div>
        {feedback && (
          <p role="status" className={`mt-2 flex items-start gap-1.5 text-[11px] ${feedback.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
            {feedback.ok && <Check size={12} className="mt-0.5 shrink-0" />}
            <span>{feedback.text}</span>
          </p>
        )}
      </div>
    </details>
  );
}
