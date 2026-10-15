"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, Crown, FileText, Loader2, PlaySquare, Save, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { normalizeLang, type Lang } from "@/lib/gamification";
import { supabase } from "@/lib/supabase";
import { updateResidentTrust, type ResidentSegment } from "@/app/actions/admin-profile-trust";
import { KycViewer, useKycSubmissions, type KycLevelWithFile } from "../../KycVault";

type Props = {
  profileId: string;
  fullName: string;
  segment: string | null;
  level: number | null;
  circle: string | null;
  reliability: number | null;
  kycLevel: number | null;
  viewerRole: string;
  viewerId: string | null;
  viewerEmail: string | null;
};

const CIRCLE_NAMES: Record<number, string> = {
  1: "Voyager",
  2: "Resident",
  3: "Preferred",
  4: "Inner Circle",
  5: "Private Circle",
  6: "Black Circle",
};

const COPY: Record<Lang, {
  title: string; segment: string; elite: string; working: string; switchToElite: string; switchToWorking: string;
  level: string; reliability: string; save: string; savedSegment: string; savedReliability: string; error: string;
  invalidReliability: string; pending: string; verified: string; rejected: string; notVerified: string;
  kycFiles: string; passport: string; video: string; noKycVault: string; forbidden: string; failed: string;
}> = {
  en: { title: "Resident status management", segment: "Segment", elite: "ELITE", working: "WORKING", switchToElite: "Promote to ELITE", switchToWorking: "Move to WORKING", level: "Circle status", reliability: "Reliability · 0-100%", save: "Save", savedSegment: "Segment updated", savedReliability: "Reliability updated", error: "Could not save changes", invalidReliability: "Enter a value from 0 to 100", pending: "KYC PENDING", verified: "KYC VERIFIED", rejected: "KYC REJECTED", notVerified: "KYC NOT VERIFIED", kycFiles: "Verification documents", passport: "Passport", video: "Video", noKycVault: "KYC submissions are not available; try refreshing the page.", forbidden: "Only the owner and admin can change these metrics.", failed: "The operation failed. Try again." },
  ru: { title: "Управление статусом резидентки", segment: "Сегмент", elite: "ELITE", working: "WORKING", switchToElite: "Перевести в ELITE", switchToWorking: "Перевести в WORKING", level: "Игровой уровень", reliability: "Надёжность · 0-100%", save: "Сохранить", savedSegment: "Сегмент обновлён", savedReliability: "Надёжность обновлена", error: "Не удалось сохранить изменения", invalidReliability: "Введите значение от 0 до 100", pending: "KYC НА ПРОВЕРКЕ", verified: "KYC ПОДТВЕРЖДЁН", rejected: "KYC ОТКЛОНЁН", notVerified: "KYC НЕ ПРОЙДЕН", kycFiles: "Документы верификации", passport: "Паспорт", video: "Видео", noKycVault: "Заявки KYC недоступны. Обновите страницу.", forbidden: "Изменять метрики могут только owner/admin.", failed: "Не удалось выполнить операцию. Повторите попытку." },
  es: { title: "Gestión del estado de residente", segment: "Segmento", elite: "ELITE", working: "WORKING", switchToElite: "Promover a ELITE", switchToWorking: "Cambiar a WORKING", level: "Nivel del círculo", reliability: "Fiabilidad · 0-100%", save: "Guardar", savedSegment: "Segmento actualizado", savedReliability: "Fiabilidad actualizada", error: "No se pudieron guardar los cambios", invalidReliability: "Introduce un valor entre 0 y 100", pending: "KYC PENDIENTE", verified: "KYC VERIFICADO", rejected: "KYC RECHAZADO", notVerified: "KYC NO VERIFICADO", kycFiles: "Documentos de verificación", passport: "Pasaporte", video: "Vídeo", noKycVault: "Las solicitudes KYC no están disponibles; actualiza la página.", forbidden: "Solo owner/admin pueden cambiar estas métricas.", failed: "No se pudo completar la operación. Inténtalo de nuevo." },
  pt: { title: "Gestão do status da residente", segment: "Segmento", elite: "ELITE", working: "WORKING", switchToElite: "Promover para ELITE", switchToWorking: "Mover para WORKING", level: "Nível do círculo", reliability: "Confiabilidade · 0-100%", save: "Salvar", savedSegment: "Segmento atualizado", savedReliability: "Confiabilidade atualizada", error: "Não foi possível salvar as alterações", invalidReliability: "Informe um valor entre 0 e 100", pending: "KYC PENDENTE", verified: "KYC VERIFICADO", rejected: "KYC REJEITADO", notVerified: "KYC NÃO VERIFICADO", kycFiles: "Documentos de verificação", passport: "Passaporte", video: "Vídeo", noKycVault: "As solicitações KYC não estão disponíveis; atualize a página.", forbidden: "Somente owner/admin podem alterar estas métricas.", failed: "Não foi possível concluir a operação. Tente novamente." },
};

function safeLevel(value: number | null) {
  const parsed = Number(value ?? 1);
  return Number.isFinite(parsed) ? Math.min(6, Math.max(1, Math.floor(parsed))) : 1;
}
function safeKyc(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.min(3, Math.max(0, Math.floor(parsed))) : 0;
}
function safeReliability(value: number | null) {
  const parsed = Number(value ?? 100);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 100;
}
function reliabilityClass(value: number) {
  if (value >= 90) return "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300";
  if (value >= 70) return "border-amber-200/25 bg-amber-200/[0.07] text-amber-100";
  return "border-rose-400/25 bg-rose-400/[0.07] text-rose-300";
}

export default function ResidentProfileManagement(props: Props) {
  const languageContext = useLanguage();
  const lang = normalizeLang(languageContext.lang);
  const t = COPY[lang];
  const router = useRouter();
  const isOwnerOrAdmin = props.viewerRole === "owner" || props.viewerRole === "admin";
  const canViewPassport = isOwnerOrAdmin;
  const [segment, setSegment] = useState<ResidentSegment>(props.segment === "elite" ? "elite" : "working");
  const [reliability, setReliability] = useState(() => safeReliability(props.reliability));
  const [reliabilityDraft, setReliabilityDraft] = useState(() => String(safeReliability(props.reliability)));
  const [busy, setBusy] = useState<"segment" | "reliability" | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [kycLevel, setKycLevel] = useState(() => safeKyc(props.kycLevel));
  const [openedKyc, setOpenedKyc] = useState<KycLevelWithFile | null>(null);
  const kyc = useKycSubmissions(isOwnerOrAdmin);
  const closeKyc = useCallback(() => setOpenedKyc(null), []);

  const level = safeLevel(props.level);
  const circleName = CIRCLE_NAMES[level] ?? (props.circle || "Voyager");
  const latestKyc = kyc.byProfile[props.profileId]?.[0] ?? null;
  const kycBadge = kycLevel >= 3
    ? { label: t.verified, cls: "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300" }
    : latestKyc?.status === "pending"
      ? { label: t.pending, cls: "border-amber-200/25 bg-amber-200/[0.07] text-amber-100" }
      : latestKyc?.status === "rejected"
        ? { label: t.rejected, cls: "border-rose-400/25 bg-rose-400/[0.07] text-rose-300" }
        : { label: t.notVerified, cls: "border-zinc-700 bg-zinc-800/40 text-zinc-400" };

  const persist = async (patch: { segment?: ResidentSegment; reliability?: number }, kind: "segment" | "reliability") => {
    if (busy || !isOwnerOrAdmin) return;
    setBusy(kind);
    setFeedback(null);
    let result: Awaited<ReturnType<typeof updateResidentTrust>>;
    try {
      result = await updateResidentTrust(props.profileId, patch);
    } catch (cause) {
      console.error("[VOYAGE profile trust] action failed", cause);
      setBusy(null);
      setFeedback({ ok: false, text: t.error });
      return;
    }
    setBusy(null);
    if (!result.ok) {
      const message = result.reason === "forbidden" ? t.forbidden : result.reason === "invalid" ? t.invalidReliability : t.error;
      setFeedback({ ok: false, text: message });
      return;
    }
    setSegment(result.segment);
    setReliability(result.reliability);
    setReliabilityDraft(String(result.reliability));
    setFeedback({ ok: true, text: kind === "segment" ? t.savedSegment : t.savedReliability });
    router.refresh();
  };

  const parsedDraft = reliabilityDraft.trim() === "" ? Number.NaN : Number(reliabilityDraft);
  const validDraft = Number.isFinite(parsedDraft) && parsedDraft >= 0 && parsedDraft <= 100;
  const displayReliability = useMemo(() => reliability.toLocaleString(lang === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: 2 }), [reliability, lang]);

  const approveKyc = async (nextLevel: number): Promise<string | null> => {
    const { data, error } = await supabase.rpc("club_admin_set_kyc_level", { p_profile: props.profileId, p_level: nextLevel });
    if (error) return error.message;
    setKycLevel(safeKyc(data ?? nextLevel));
    return null;
  };

  const rejectKyc = async (submissionId: string, docLevel: KycLevelWithFile): Promise<string | null> => {
    const { data, error } = await supabase.rpc("club_admin_reject_kyc", { p_submission: submissionId });
    if (error) return error.message;
    const next = safeKyc(data ?? (kycLevel >= docLevel ? docLevel - 1 : kycLevel));
    setKycLevel(next);
    return null;
  };

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-amber-200/15 bg-gradient-to-br from-zinc-900/70 via-zinc-900/45 to-zinc-950/80 shadow-[0_18px_70px_-50px_rgba(201,169,97,0.35)]">
        <div className="flex flex-col gap-5 border-b border-zinc-800/70 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-100/65"><Crown size={13} /> VOYAGE · Social Lift</p>
            <h2 className="mt-2 font-serif text-2xl text-zinc-50">{t.title}</h2>
            <p className="mt-1 text-xs text-zinc-500">{t.segment}: {segment.toUpperCase()} · {t.level}: Level {level} · {circleName}</p>
          </div>
          <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] ${segment === "elite" ? "border-amber-200/40 bg-amber-200/[0.09] text-amber-100" : "border-zinc-700/80 bg-zinc-800/50 text-zinc-300"}`}>
            {segment === "elite" ? <Crown size={12} /> : <ArrowRightLeft size={12} />}{segment === "elite" ? t.elite : t.working}
          </span>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <div className="rounded-xl border border-zinc-800/80 bg-black/15 p-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{t.segment}</p>
            <p className="mt-2 text-sm text-zinc-100">{segment === "elite" ? t.elite : t.working}</p>
            <button type="button" disabled={!isOwnerOrAdmin || busy !== null} onClick={() => void persist({ segment: segment === "elite" ? "working" : "elite" }, "segment")} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-amber-200/25 bg-amber-200/[0.06] px-3 py-2 text-xs font-medium text-amber-100 transition hover:border-amber-200/45 hover:bg-amber-200/[0.1] disabled:cursor-wait disabled:opacity-50">
              {busy === "segment" ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}{segment === "elite" ? t.switchToWorking : t.switchToElite}
            </button>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-black/15 p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{t.reliability}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] tabular-nums ${reliabilityClass(reliability)}`}>{displayReliability}%</span></div>
            <label className="mt-2 block text-xs text-zinc-400" htmlFor={`reliability-${props.profileId}`}>{t.reliability}</label>
            <div className="mt-2 flex gap-2">
              <input id={`reliability-${props.profileId}`} type="number" inputMode="decimal" min={0} max={100} step="0.01" value={reliabilityDraft} onChange={(event) => setReliabilityDraft(event.target.value)} disabled={!isOwnerOrAdmin || busy !== null} className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-200/35 disabled:opacity-60" />
              <button type="button" disabled={!isOwnerOrAdmin || busy !== null || !validDraft || Math.round(parsedDraft * 100) / 100 === reliability} onClick={() => void persist({ reliability: Math.round(parsedDraft * 100) / 100 }, "reliability")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-700/80 px-3 py-2 text-xs text-zinc-200 transition hover:border-amber-200/30 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40">
                {busy === "reliability" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}{t.save}
              </button>
            </div>
            {!validDraft && <p className="mt-2 text-[11px] text-rose-300">{t.invalidReliability}</p>}
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-black/15 p-4 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{t.level}</p><p className="mt-2 text-base text-zinc-100">Level {level} · {circleName}</p></div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${kycBadge.cls}`}><ShieldCheck size={12} />{kycBadge.label} · {kycLevel}/3</span>
            </div>
            <div className="mt-4 border-t border-zinc-800/70 pt-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{t.kycFiles}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setOpenedKyc(1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 transition hover:border-amber-200/30 hover:text-amber-100"><FileText size={14} />{t.passport}<span className="text-[10px] text-zinc-600">KYC 1</span></button>
                <button type="button" onClick={() => setOpenedKyc(2)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 transition hover:border-amber-200/30 hover:text-amber-100"><PlaySquare size={14} />{t.video}<span className="text-[10px] text-zinc-600">KYC 2</span></button>
              </div>
              {!kyc.available && <p className="mt-2 text-[11px] text-amber-200/80">{t.noKycVault}</p>}
            </div>
          </div>
        </div>
        {feedback && <div role="status" className={`border-t px-5 py-3 text-xs ${feedback.ok ? "border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-200" : "border-rose-400/20 bg-rose-400/[0.04] text-rose-200"}`}>
          <p className="flex items-center gap-2">{feedback.ok ? <Check size={13} /> : <ShieldCheck size={13} />}{feedback.text}</p>
        </div>}
      </section>

      {openedKyc !== null && <KycViewer
        key={`${props.profileId}-${openedKyc}`}
        lang={lang}
        resident={{ id: props.profileId, fullName: props.fullName, kycLevel }}
        submissions={kyc.byProfile[props.profileId] ?? []}
        initialLevel={openedKyc}
        canViewPassport={canViewPassport}
        viewer={{ id: props.viewerId, email: props.viewerEmail }}
        serif="font-serif"
        onClose={closeKyc}
        onApprove={approveKyc}
        onReject={rejectKyc}
        onChanged={kyc.reload}
      />}
    </>
  );
}
