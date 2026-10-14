"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, Check, Copy, KeyRound, LoaderCircle, Mail, ShieldCheck, UserPlus, X } from "lucide-react";
import { addStaff, type AddStaffErrorCode, type AddStaffResult, type NewStaffRole } from "@/app/actions/add-staff";

export type AddStaffModalLabels = {
  title: string;
  description: string;
  fullName: string;
  fullNamePlaceholder: string;
  email: string;
  role: string;
  roleAdmin: string;
  roleManager: string;
  submit: string;
  creating: string;
  cancel: string;
  close: string;
  successTitle: string;
  successDescription: string;
  linkLabel: string;
  expires: string;
  copy: string;
  copied: string;
  createdRole: string;
  errors: Record<"access" | "invalid" | "duplicate" | "failed", string>;
};

function errorGroup(code: AddStaffErrorCode): "access" | "invalid" | "duplicate" | "failed" {
  if (code === "not_authenticated" || code === "owner_only") return "access";
  if (code === "invalid_name" || code === "invalid_email" || code === "invalid_role") return "invalid";
  if (code === "email_already_exists") return "duplicate";
  return "failed";
}

export default function AddStaffModal({
  labels,
  onClose,
  onCreated,
}: {
  labels: AddStaffModalLabels;
  onClose: () => void;
  onCreated: (result: Extract<AddStaffResult, { ok: true }>) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<NewStaffRole>("manager");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Extract<AddStaffResult, { ok: true }> | null>(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const result = await addStaff({ full_name: fullName, email, role });
      if (!result.ok) {
        setError(labels.errors[errorGroup(result.error)]);
        return;
      }
      setSuccess(result);
      onCreated(result);
    } catch {
      setError(labels.errors.failed);
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.link);
      setCopied(true);
    } catch {
      window.prompt(labels.copy, success.link);
    }
  };

  const expiry = success ? new Date(success.expiresAt) : null;
  const expiryText = expiry && Number.isFinite(expiry.getTime())
    ? expiry.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : success?.expiresAt;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-staff-title"
        className="relative my-8 w-full max-w-xl overflow-hidden rounded-2xl border border-amber-200/20 bg-zinc-950 p-6 shadow-2xl shadow-black/60 sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute right-4 top-4 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-100 disabled:opacity-40"
          aria-label={labels.close}
        >
          <X size={17} />
        </button>

        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200/20 bg-amber-200/[0.06] text-amber-100/80">
          {success ? <ShieldCheck size={19} /> : <UserPlus size={19} />}
        </span>
        <h2 id="add-staff-title" className="mt-5 font-serif text-2xl text-zinc-50">
          {success ? labels.successTitle : labels.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {success ? labels.successDescription : labels.description}
        </p>

        {success ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-black/25 p-4">
              <p className="text-sm font-medium text-zinc-100">{success.fullName}</p>
              <p className="mt-1 text-xs text-zinc-500">{success.email}</p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-amber-100/70">{labels.createdRole}: {success.role === "admin" ? labels.roleAdmin : labels.roleManager}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{labels.linkLabel}</p>
              <div className="mt-2 rounded-xl border border-zinc-800 bg-black/30 p-3">
                <p className="break-all font-mono text-xs leading-6 text-amber-100/90">{success.link}</p>
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">{labels.expires}: <span className="tabular-nums text-zinc-300">{expiryText}</span></p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="rounded-xl border border-zinc-800 px-4 py-3 text-xs text-zinc-400 transition-colors hover:text-zinc-100">{labels.close}</button>
              <button type="button" onClick={() => void copyLink()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200/25 bg-amber-200/[0.07] px-4 py-3 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-200/[0.12]">
                {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? labels.copied : labels.copy}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="mt-5 space-y-4">
            <div>
              <label htmlFor="add-staff-full-name" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{labels.fullName}</label>
              <input
                id="add-staff-full-name"
                name="full_name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder={labels.fullNamePlaceholder}
                disabled={submitting}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-700 focus:border-amber-200/30 disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="add-staff-email" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{labels.email}</label>
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  id="add-staff-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-3 pl-10 pr-3.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-700 focus:border-amber-200/30 disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label htmlFor="add-staff-role" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{labels.role}</label>
              <select
                id="add-staff-role"
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value as NewStaffRole)}
                disabled={submitting}
                className="w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 text-sm text-zinc-100 outline-none transition-colors focus:border-amber-200/30 disabled:opacity-50"
              >
                <option value="manager">{labels.roleManager}</option>
                <option value="admin">{labels.roleAdmin}</option>
              </select>
            </div>
            {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-900/50 bg-rose-950/20 px-3.5 py-3 text-xs leading-5 text-rose-200"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</div>}
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-zinc-800 px-4 py-3 text-xs text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-40">{labels.cancel}</button>
              <button type="submit" disabled={submitting || fullName.trim().length < 2 || !email.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200/25 bg-amber-200/[0.08] px-5 py-3 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-200/[0.13] disabled:cursor-not-allowed disabled:opacity-40">
                {submitting ? <LoaderCircle size={14} className="animate-spin" /> : <KeyRound size={14} />}{submitting ? labels.creating : labels.submit}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
