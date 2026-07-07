"use client";
 
import { useEffect, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import type { Application } from "./FaceControlList";
 
/* ──────────────────────────────────────────────────────────────────────
 * Access Credentials — блок доступов гостя в модалке Face Control.
 *
 * Вставьте в CandidateModal.tsx рядом с остальными блоками анкеты:
 *
 *   import AccessCredentials from "./AccessCredentials";
 *   ...
 *   <AccessCredentials application={application} />
 *
 * Показывает login (profiles.email) и password (profiles.temp_password)
 * с кнопками копирования: по одной на каждое поле + "Copy both".
 * ──────────────────────────────────────────────────────────────────── */
 
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback для http/старых webview
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
 
function CopyButton({
  value,
  copyKey,
  copied,
  onCopied,
  title,
}: {
  value: string;
  copyKey: string;
  copied: string | null;
  onCopied: (key: string | null) => void;
  title: string;
}) {
  const isCopied = copied === copyKey;
 
  return (
    <button
      type="button"
      title={title}
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyToClipboard(value);
        onCopied(ok ? copyKey : null);
      }}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-700/70 bg-zinc-800/60 text-zinc-400 transition-colors hover:border-amber-500/40 hover:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
    >
      {isCopied ? (
        <Check size={15} strokeWidth={2} className="text-emerald-400" />
      ) : (
        <Copy size={15} strokeWidth={1.75} />
      )}
    </button>
  );
}
 
export default function AccessCredentials({
  application,
}: {
  application: Application;
}) {
  // Какое поле только что скопировано: "login" | "password" | "both"
  const [copied, setCopied] = useState<string | null>(null);
 
  // Сбрасываем галочку через пару секунд
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);
 
  const login = application.email;
  const password = application.temp_password;
 
  // Боту ещё нечего было записать — блок не показываем вовсе.
  if (!login && !password) return null;
 
  const bothText = `Login: ${login ?? "—"}\nPassword: ${password ?? "—"}`;
 
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-medium tracking-wide text-zinc-200">
          <KeyRound size={15} strokeWidth={1.75} className="text-amber-300/80" />
          Access Credentials
        </h3>
 
        {login && password && (
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await copyToClipboard(bothText);
              setCopied(ok ? "both" : null);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700/70 bg-zinc-800/60 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-amber-500/40 hover:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
          >
            {copied === "both" ? (
              <>
                <Check size={13} strokeWidth={2} className="text-emerald-400" />
                Скопировано
              </>
            ) : (
              <>
                <Copy size={13} strokeWidth={1.75} />
                Copy both
              </>
            )}
          </button>
        )}
      </div>
 
      <dl className="space-y-2">
        {/* Login */}
        <div className="flex items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
          <dt className="w-20 shrink-0 text-xs uppercase tracking-wider text-zinc-500">
            Login
          </dt>
          <dd className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-100">
            {login ?? <span className="text-zinc-600">не задан</span>}
          </dd>
          {login && (
            <CopyButton
              value={login}
              copyKey="login"
              copied={copied}
              onCopied={setCopied}
              title="Скопировать логин"
            />
          )}
        </div>
 
        {/* Password */}
        <div className="flex items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
          <dt className="w-20 shrink-0 text-xs uppercase tracking-wider text-zinc-500">
            Password
          </dt>
          <dd className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-100">
            {password ?? <span className="text-zinc-600">не задан</span>}
          </dd>
          {password && (
            <CopyButton
              value={password}
              copyKey="password"
              copied={copied}
              onCopied={setCopied}
              title="Скопировать пароль"
            />
          )}
        </div>
      </dl>
    </section>
  );
}