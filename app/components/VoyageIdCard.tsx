"use client";
 
import { ShieldCheck, ShieldQuestion } from "lucide-react";
 
interface VoyageIdCardProps {
  fullName: string | null;
  status: string | null;
  kycLevel: number | null;
}
 
/**
 * Read-only «цифровая VIP-карта» резидента.
 * Чисто презентационный компонент — данные приходят пропсами из profile,
 * поэтому он свободно живёт внутри клиентского ResidentProfilePage.
 */
export function VoyageIdCard({ fullName, status, kycLevel }: VoyageIdCardProps) {
  const verified = kycLevel != null && kycLevel > 0;
  const KycIcon = verified ? ShieldCheck : ShieldQuestion;
 
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-zinc-900/40 p-6 backdrop-blur-md shadow-[0_0_50px_-15px_rgba(212,168,83,0.35)]">
      {/* золотое свечение */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(212,168,83,0.18) 0%, transparent 70%)",
        }}
      />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-amber-500/25" />
 
      {/* верхняя строка: подпись + «чип» */}
      <div className="relative flex items-start justify-between">
        <p className="text-[10px] tracking-[0.3em] uppercase text-amber-200/60 font-semibold">
          Digital Membership
        </p>
        <div className="h-8 w-11 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-700 shadow-inner" />
      </div>
 
      {/* статус — крупно */}
      <div className="relative mt-8">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Current Status
        </p>
        <p
          className="text-3xl tracking-wide text-amber-200/90 md:text-4xl"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          {status ?? "Ожидает выдачи статуса"}
        </p>
      </div>
 
      {/* KYC + владелец карты */}
      <div className="relative mt-6 flex items-end justify-between">
        <div className="flex items-center gap-2.5">
          <KycIcon
            className={`h-5 w-5 ${verified ? "text-amber-400" : "text-zinc-500"}`}
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              KYC
            </p>
            <p
              className={`text-xs font-medium ${
                verified ? "text-amber-300/90" : "text-zinc-500"
              }`}
            >
              {verified ? `Level ${kycLevel}` : "Not Verified"}
            </p>
          </div>
        </div>
 
        <div className="text-right">
          <p
            className="text-sm tracking-wide text-zinc-200"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            {fullName ?? "—"}
          </p>
          <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600">
            Cardholder
          </p>
        </div>
      </div>
    </div>
  );
}