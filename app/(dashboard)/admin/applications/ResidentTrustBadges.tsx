'use client';

import { Crown, ShieldCheck } from 'lucide-react';

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
