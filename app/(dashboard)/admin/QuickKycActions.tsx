"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { setResidentKycLevel } from "@/app/actions/admin-kyc";
import { useLanguage } from "@/app/context/LanguageContext";

type Copy = { saved: string; failed: string; forbidden: string; levels: string };
const T: Record<"EN" | "RU" | "ES" | "PT", Copy> = {
  EN: { saved: "KYC level updated", failed: "Could not update KYC level", forbidden: "You do not have permission", levels: "Set KYC level" },
  RU: { saved: "Уровень KYC обновлён", failed: "Не удалось обновить уровень KYC", forbidden: "Недостаточно прав", levels: "Установить уровень KYC" },
  ES: { saved: "Nivel KYC actualizado", failed: "No se pudo actualizar el nivel KYC", forbidden: "No tienes permisos", levels: "Establecer nivel KYC" },
  PT: { saved: "Nível KYC atualizado", failed: "Não foi possível atualizar o nível KYC", forbidden: "Você não tem permissão", levels: "Definir nível KYC" },
};

export default function QuickKycActions({ profileId, currentLevel }: { profileId: string; currentLevel: number | null }) {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const router = useRouter();
  const [busyLevel, setBusyLevel] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const choose = (level: number) => {
    if (busyLevel !== null || isPending) return;
    setError("");
    setBusyLevel(level);
    startTransition(async () => {
      const result = await setResidentKycLevel(profileId, level);
      if (!result.ok) setError(result.reason === "forbidden" ? t.forbidden : t.failed);
      else router.refresh();
      setBusyLevel(null);
    });
  };
  return (
    <div className="flex min-w-[220px] flex-col gap-1.5">
      <span className="text-[9px] uppercase tracking-[0.16em] text-zinc-600">{t.levels}</span>
      <div className="flex flex-wrap gap-1.5">
        {[0, 1, 2, 3].map((level) => (
          <button key={level} type="button" onClick={() => choose(level)} disabled={isPending || busyLevel !== null} aria-label={`KYC ${level}`} aria-pressed={Number(currentLevel ?? 0) === level} className={`inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold transition disabled:cursor-wait disabled:opacity-50 ${Number(currentLevel ?? 0) === level ? "border-amber-200/40 bg-amber-200/10 text-amber-100" : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-amber-200/25 hover:text-zinc-100"}`}>
            {busyLevel === level ? <LoaderCircle size={12} className="animate-spin" /> : Number(currentLevel ?? 0) === level ? <Check size={11} /> : null}KYC {level}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="max-w-[260px] text-[10px] text-rose-300">{error}</p>}
    </div>
  );
}
