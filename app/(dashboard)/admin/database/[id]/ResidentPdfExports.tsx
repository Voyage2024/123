"use client";

import { useState } from "react";
import { FileDown, Loader2, Lock } from "lucide-react";
import { getResidentDossierPdf, getResidentPresentationPdf } from "@/app/actions/resident-dossier";
import type { PdfActionError } from "@/lib/resident-pdf/types";

/* ──────────────────────────────────────────────────────────────────────
 * Кнопки PDF в карточке резидентки (/admin/database/[id]).
 *
 * - «Презентационный PDF» — owner и admin.
 * - «🔒 Скачать полное досье-PDF» — рендерится только для owner.
 * Это лишь интерфейс: роль заново проверяет server action, а для досье
 * он же пишет запись в audit_logs до выдачи данных.
 * ──────────────────────────────────────────────────────────────────── */

const ERRORS: Record<PdfActionError | "build", string> = {
  invalid: "Некорректный профиль.",
  unauthenticated: "Сессия истекла — войдите заново.",
  forbidden: "Недостаточно прав для этой выгрузки.",
  not_found: "Профиль не найден.",
  not_resident: "PDF доступен только для резиденток.",
  audit_failed: "Не удалось записать журнал выгрузки — досье не выдано. Проверьте, применена ли миграция audit_logs.",
  server_error: "Ошибка сервера. Попробуйте ещё раз.",
  build: "Не удалось собрать PDF в браузере. Обновите страницу и повторите.",
};

function fileStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

export default function ResidentPdfExports({ profileId, viewerRole }: { profileId: string; viewerRole: string }) {
  const [busy, setBusy] = useState<"presentation" | "dossier" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const isOwner = viewerRole === "owner";
  const canPresent = isOwner || viewerRole === "admin";
  if (!canPresent) return null;

  async function downloadPresentation() {
    if (busy) return;
    setBusy("presentation");
    setMessage(null);
    try {
      const result = await getResidentPresentationPdf(profileId);
      if (!result.ok) {
        setMessage({ ok: false, text: ERRORS[result.reason] ?? ERRORS.server_error });
        return;
      }
      const { buildPresentationPdf, savePdf } = await import("@/lib/resident-pdf/build");
      const bytes = await buildPresentationPdf(result.data);
      savePdf(bytes, `voyage-presentation-${result.data.memberNo}.pdf`);
      setMessage({ ok: true, text: "Презентационный PDF скачан." });
    } catch (err) {
      console.error("[pdf] presentation", err instanceof Error ? err.message : err);
      setMessage({ ok: false, text: ERRORS.build });
    } finally {
      setBusy(null);
    }
  }

  async function downloadDossier() {
    if (busy || !isOwner) return;
    setBusy("dossier");
    setMessage(null);
    try {
      const result = await getResidentDossierPdf(profileId);
      if (!result.ok) {
        setMessage({ ok: false, text: ERRORS[result.reason] ?? ERRORS.server_error });
        return;
      }
      const { buildDossierPdf, savePdf } = await import("@/lib/resident-pdf/build");
      const { bytes, skipped } = await buildDossierPdf(result.data);
      savePdf(bytes, `voyage-dossier-${result.data.memberNo}-${fileStamp()}.pdf`);
      setMessage({
        ok: true,
        text: `Досье скачано, выгрузка записана в журнал (#${result.data.auditId}).${skipped.length ? ` Не вошло: ${skipped.join(", ")}.` : ""}`,
      });
    } catch (err) {
      console.error("[pdf] dossier", err instanceof Error ? err.message : err);
      setMessage({ ok: false, text: ERRORS.build });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200/15 bg-zinc-900/30 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100/65">PDF · выгрузка профиля</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Презентация — буклет для клиента без контактов и паспорта.
            {isOwner && " Полное досье — со всеми приватными данными, каждая выгрузка фиксируется в журнале."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadPresentation}
            disabled={busy !== null}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-200/40 px-3.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-200/10 disabled:cursor-wait disabled:opacity-60"
          >
            {busy === "presentation" ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Презентационный PDF
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={downloadDossier}
              disabled={busy !== null}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-200/50 bg-amber-200 px-3.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
            >
              {busy === "dossier" ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              🔒 Скачать полное досье-PDF
            </button>
          )}
        </div>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mt-3 text-xs ${message.ok ? "text-emerald-300/80" : "text-rose-300"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
