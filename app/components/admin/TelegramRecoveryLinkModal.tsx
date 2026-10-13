"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, X } from "lucide-react";

export type RecoveryModalLabels = {
  title: string;
  description: string;
  expires: string;
  copy: string;
  copied: string;
  close: string;
};

const DEFAULT_LABELS: RecoveryModalLabels = {
  title: "Восстановление доступа",
  description: "Передайте эту ссылку пользователю по проверенному каналу. Она одноразовая и действует 15 минут.",
  expires: "Ссылка действует до",
  copy: "Скопировать ссылку",
  copied: "Ссылка скопирована",
  close: "Закрыть",
};

export default function TelegramRecoveryLinkModal({
  link,
  expiresAt,
  profileName,
  labels = DEFAULT_LABELS,
  onClose,
}: {
  link: string;
  expiresAt: string;
  profileName: string;
  labels?: RecoveryModalLabels;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const expiry = new Date(expiresAt);
  const expiryLabel = Number.isNaN(expiry.getTime())
    ? expiresAt
    : expiry.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt("Copy this one-time recovery link", link);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="telegram-recovery-title" className="relative my-8 w-full max-w-xl overflow-hidden rounded-2xl border border-amber-200/20 bg-zinc-950 p-6 shadow-2xl shadow-black/60 sm:p-7">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-100" aria-label={labels.close}>
          <X size={17} />
        </button>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200/20 bg-amber-200/[0.06] text-amber-100/80">
          <KeyRound size={18} />
        </span>
        <h2 id="telegram-recovery-title" className="mt-5 font-serif text-2xl text-zinc-50">{labels.title}</h2>
        <p className="mt-2 text-sm text-zinc-400">{profileName}</p>
        <p className="mt-3 text-xs leading-5 text-zinc-500">{labels.description}</p>
        <div className="mt-5 rounded-xl border border-zinc-800 bg-black/25 p-3">
          <p className="break-all font-mono text-xs leading-6 text-amber-100/90">{link}</p>
        </div>
        <p className="mt-3 text-[11px] text-zinc-500">{labels.expires}: <span className="tabular-nums text-zinc-300">{expiryLabel}</span></p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-zinc-800 px-4 py-3 text-xs text-zinc-400 transition-colors hover:text-zinc-100">{labels.close}</button>
          <button type="button" onClick={() => void copyLink()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200/25 bg-amber-200/[0.07] px-4 py-3 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-200/[0.12]">
            {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? labels.copied : labels.copy}
          </button>
        </div>
      </section>
    </div>
  );
}
