"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Пробивщик гостей
 *
 * Поиск при вводе (телефон / WhatsApp / @ник / имя) → карточка гостя:
 * статус VIP / Осторожно / ЧС, заметки команды, быстрые ссылки.
 *   оператор        — смотрит, создаёт карточку, добавляет заметку;
 *   менеджер, owner — + меняет статус, скрывает заметки;
 *   owner           — + удаляет карточку.
 * Режим onPick — встроенный пробивщик в форме букинга.
 * Все записи идут через RPC voyage_guest_* (права — в БД).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Plus, Search, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, BTN_GOLD } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { GUEST_STATUSES, GUEST_TAGS, GUEST_TAGS_GOOD, errorCode, parseGuest, type GuestCard, type GuestStatus, type GuestTag } from "@/lib/tour-ops/types";
import { opsError } from "@/lib/tour-ops/i18n";
import { guestLinks, normalizePhone, parseGuestContact } from "@/lib/tour-ops/guest-links";
import { fmtDateTime, viewerTimezone } from "@/lib/tour-ops/time";
import { Chip, CopyButton, Field, GUEST_TONE, INPUT, Notice, useOps } from "@/app/components/tour-ops/ops-ui";

type Props = {
  canModerate: boolean;
  canDelete?: boolean;
  tourId?: string | null;
  onPick?: (guest: GuestCard) => void;
};

export default function GuestDesk({ canModerate, canDelete = false, tourId = null, onPick }: Props) {
  const { t, lang } = useOps();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GuestCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GuestCard | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc("voyage_guest_lookup", { p_query: q });
      if (id !== seq.current) return;
      setSearching(false);
      if (rpcError) {
        setError(opsError(t, errorCode(rpcError.message)));
        return;
      }
      setError(null);
      setResults((Array.isArray(data) ? data : []).map(parseGuest).filter((g): g is GuestCard => g !== null));
    }, 350);
    return () => clearTimeout(timer);
  }, [query, t]);

  const openCard = useCallback(
    async (guestId: string) => {
      const { data, error: rpcError } = await supabase.rpc("voyage_guest_card", { p_guest: guestId });
      if (rpcError) {
        setError(opsError(t, errorCode(rpcError.message)));
        return;
      }
      setSelected(parseGuest(data));
      setCreating(false);
    },
    [t],
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden />
        <input
          className={`${INPUT} pl-9`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          placeholder={t.guests.placeholder}
          inputMode="search"
          autoComplete="off"
          aria-label={t.guests.placeholder}
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-zinc-500" aria-label={t.guests.searching} />}
      </div>

      {error && <Notice tone="rose">{error}</Notice>}

      {!selected && query.trim().length >= 3 && !searching && (
        <div className="space-y-2">
          {results.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => openCard(g.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-3.5 py-3 text-left transition hover:border-amber-200/30"
            >
              <UserRound className="size-4 shrink-0 text-zinc-500" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-100">{g.displayName || g.phone || (g.telegram ? `@${g.telegram}` : "—")}</span>
                <span className="block truncate text-[11px] text-zinc-500">
                  {[g.phone, g.telegram ? `@${g.telegram}` : null].filter(Boolean).join(" · ")} · {t.guests.reviews(g.reviewsTotal)}
                </span>
              </span>
              <Chip className={GUEST_TONE[g.status]}>{t.guests.status[g.status]}</Chip>
            </button>
          ))}
          {results.length === 0 && <p className="text-sm text-zinc-500">{t.guests.noMatch}</p>}
          {!creating && (
            <button type="button" className={BTN_GHOST} onClick={() => setCreating(true)}>
              <Plus className="size-3.5" /> {t.guests.createCard}
            </button>
          )}
        </div>
      )}
      {query.trim().length > 0 && query.trim().length < 3 && <p className="text-[12px] text-zinc-500">{t.guests.minChars}</p>}

      {creating && !selected && (
        <CreateGuest
          initial={query}
          onCreated={(id) => openCard(id)}
          onCancel={() => setCreating(false)}
        />
      )}

      {selected && (
        <GuestCardView
          guest={selected}
          canModerate={canModerate}
          canDelete={canDelete}
          tourId={tourId}
          lang={lang}
          onPick={onPick}
          onChanged={() => openCard(selected.id)}
          onDeleted={() => {
            setSelected(null);
            setResults((r) => r.filter((g) => g.id !== selected.id));
          }}
        />
      )}
    </div>
  );
}

function CreateGuest({ initial, onCreated, onCancel }: { initial: string; onCreated: (id: string) => void; onCancel: () => void }) {
  const { t } = useOps();
  const parsed = parseGuestContact(initial);
  const [name, setName] = useState(parsed.phone || parsed.telegram ? "" : initial.trim());
  const [phone, setPhone] = useState(parsed.phone ?? "");
  const [telegram, setTelegram] = useState(parsed.telegram ?? "");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("voyage_guest_upsert", {
      p_display_name: name.trim() || null,
      p_phone: phone.trim() || null,
      p_telegram: telegram.trim() || null,
      p_whatsapp: whatsapp.trim() || null,
    });
    setBusy(false);
    if (rpcError || !data) {
      setError(opsError(t, errorCode(rpcError?.message)));
      return;
    }
    onCreated(String(data));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.guests.nameField}><input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
        <Field label={t.guests.phoneField}><input className={INPUT} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={24} /></Field>
        <Field label={t.guests.telegramField}><input className={INPUT} value={telegram} onChange={(e) => setTelegram(e.target.value)} maxLength={40} /></Field>
        <Field label={t.guests.whatsappField}><input className={INPUT} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" maxLength={24} /></Field>
      </div>
      {error && <Notice tone="rose">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_GOLD} disabled={busy} onClick={submit}>{busy ? t.common.saving : t.guests.createCard}</button>
        <button type="button" className={BTN_GHOST} onClick={onCancel}>{t.common.cancel}</button>
      </div>
    </div>
  );
}

function GuestCardView({
  guest,
  canModerate,
  canDelete,
  tourId,
  lang,
  onPick,
  onChanged,
  onDeleted,
}: {
  guest: GuestCard;
  canModerate: boolean;
  canDelete: boolean;
  tourId: string | null;
  lang: ReturnType<typeof useOps>["lang"];
  onPick?: (guest: GuestCard) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { t } = useOps();
  const tz = viewerTimezone(null);
  const [tags, setTags] = useState<GuestTag[]>([]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<GuestStatus>(guest.status);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const links = guestLinks({ phone: guest.phone, whatsapp: guest.whatsapp, telegram: guest.telegram });
  const phone = normalizePhone(guest.phone ?? guest.whatsapp);

  useEffect(() => setStatus(guest.status), [guest.status]);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await fn();
    setBusy(false);
    if (rpcError) {
      setError(opsError(t, errorCode(rpcError.message)));
      return false;
    }
    return true;
  };

  const addReview = async () => {
    if (!tags.length && !note.trim()) return;
    const ok = await run(() =>
      supabase.rpc("voyage_guest_add_review", { p_guest: guest.id, p_tags: tags, p_note: note.trim() || null, p_tour: tourId, p_booking: null }),
    );
    if (ok) {
      setTags([]);
      setNote("");
      onChanged();
    }
  };

  const saveStatus = async () => {
    if ((status === "caution" || status === "blacklist") && reason.trim().length < 3) {
      setError(t.errors.reason_required);
      return;
    }
    const ok = await run(() => supabase.rpc("voyage_guest_set_status", { p_guest: guest.id, p_status: status, p_reason: reason.trim() || null }));
    if (ok) {
      setReason("");
      onChanged();
    }
  };

  const removeReview = async (id: string) => {
    const why = window.prompt(t.guests.removeReasonPrompt)?.trim();
    if (!why) return;
    if (await run(() => supabase.rpc("voyage_guest_remove_review", { p_review: id, p_reason: why }))) onChanged();
  };

  const remove = async () => {
    if (!window.confirm(`${t.common.remove}?`)) return;
    if (await run(() => supabase.rpc("voyage_guest_delete", { p_guest: guest.id }))) onDeleted();
  };

  return (
    <article className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg text-zinc-50">{guest.displayName || "—"}</p>
          <p className="mt-0.5 text-[12px] text-zinc-400">
            {[guest.phone, guest.whatsapp && guest.whatsapp !== guest.phone ? `WA ${guest.whatsapp}` : null, guest.telegram ? `@${guest.telegram}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Chip className={GUEST_TONE[guest.status]}>
            {guest.status === "blacklist" && <ShieldAlert className="size-3" />} {t.guests.status[guest.status]}
          </Chip>
          {guest.statusSetBy && <span className="text-[10px] text-zinc-500">{t.guests.statusBy(guest.statusSetBy)}</span>}
        </div>
      </header>

      {guest.statusReason && guest.status !== "neutral" && <Notice tone={guest.status === "vip" ? "amber" : "rose"}>{guest.statusReason}</Notice>}

      {Object.keys(guest.flags).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(guest.flags) as [GuestTag, number][]).map(([tag, n]) => (
            <Chip key={tag} className={GUEST_TAGS_GOOD.includes(tag) ? "border-emerald-400/30 text-emerald-200" : "border-rose-400/30 text-rose-200"}>
              {t.guests.tags[tag]} ×{n}
            </Chip>
          ))}
        </div>
      )}

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.guests.quickLinks}</p>
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              onClick={() => {
                if ((l.key === "numbuster" || l.key === "getcontact") && phone) void navigator.clipboard?.writeText(phone).catch(() => {});
              }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-700/80 px-3 text-[11px] text-zinc-300 hover:border-amber-200/40 hover:text-amber-100"
            >
              {l.key === "telegram" ? t.guests.openTelegram : l.key === "whatsapp" ? t.guests.openWhatsApp : l.key === "numbuster" ? t.guests.numbuster : t.guests.getcontact}
              <ExternalLink className="size-3" />
            </a>
          ))}
          {phone && <CopyButton text={phone} label={t.guests.copyNumber} copied={t.common.copied} />}
        </div>
      </div>

      {onPick && (
        <button type="button" className={BTN_GOLD} onClick={() => onPick(guest)}>
          {t.guests.pick}
        </button>
      )}

      <section>
        <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.guests.reviews(guest.reviewsTotal)}</p>
        {guest.reviews.length === 0 && <p className="text-sm text-zinc-500">{t.guests.noReviews}</p>}
        <ul className="space-y-2">
          {guest.reviews.map((r) => (
            <li key={r.id} className={`rounded-xl border border-zinc-800/80 px-3 py-2.5 ${r.isRemoved ? "opacity-50" : ""}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                {r.tags.map((tag) => (
                  <span key={tag} className={`text-[11px] ${GUEST_TAGS_GOOD.includes(tag) ? "text-emerald-300" : "text-rose-300"}`}>#{t.guests.tags[tag]}</span>
                ))}
              </div>
              {r.note && <p className="mt-1 whitespace-pre-line text-[13px] text-zinc-200">{r.note}</p>}
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500">
                <span>
                  {r.author} · {r.createdAt ? fmtDateTime(r.createdAt, tz, lang) : ""}
                  {r.isRemoved && ` · ${t.guests.removedNote}${r.removedReason ? `: ${r.removedReason}` : ""}`}
                </span>
                {canModerate && !r.isRemoved && (
                  <button type="button" className="text-zinc-400 underline-offset-2 hover:text-rose-200 hover:underline" onClick={() => removeReview(r.id)}>
                    {t.guests.removeReview}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2.5 border-t border-zinc-800/80 pt-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.guests.addReview}</p>
        <div className="flex flex-wrap gap-1.5">
          {GUEST_TAGS.map((tag) => {
            const on = tags.includes(tag);
            const good = GUEST_TAGS_GOOD.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => setTags((cur) => (on ? cur.filter((x) => x !== tag) : [...cur, tag]))}
                className={`min-h-8 rounded-full border px-2.5 text-[11px] transition ${
                  on ? (good ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100" : "border-rose-400/60 bg-rose-400/15 text-rose-100") : "border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t.guests.tags[tag]}
              </button>
            );
          })}
        </div>
        <textarea className={`${INPUT} min-h-20 py-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.guests.notePlaceholder} maxLength={1000} />
        <button type="button" className={BTN_GHOST} disabled={busy || (!tags.length && !note.trim())} onClick={addReview}>
          {t.guests.submitReview}
        </button>
      </section>

      {canModerate && (
        <section className="space-y-2.5 border-t border-zinc-800/80 pt-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.guests.setStatus}</p>
          <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
            <select className={INPUT} value={status} onChange={(e) => setStatus(e.target.value as GuestStatus)}>
              {GUEST_STATUSES.map((s) => (
                <option key={s} value={s}>{t.guests.status[s]}</option>
              ))}
            </select>
            <input className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.guests.statusReason} maxLength={300} />
            <button type="button" className={BTN_GHOST} disabled={busy || (status === guest.status && !reason.trim())} onClick={saveStatus}>
              {t.common.save}
            </button>
          </div>
          {guest.statusLog && guest.statusLog.length > 0 && (
            <details className="text-[12px] text-zinc-400">
              <summary className="cursor-pointer text-zinc-500">{t.guests.statusLog}</summary>
              <ul className="mt-2 space-y-1">
                {guest.statusLog.map((l, i) => (
                  <li key={i}>
                    {fmtDateTime(l.createdAt, tz, lang)} · {l.actor}: {l.oldStatus ? t.guests.status[l.oldStatus as GuestStatus] ?? l.oldStatus : "—"} → {t.guests.status[l.newStatus as GuestStatus] ?? l.newStatus}
                    {l.reason ? ` (${l.reason})` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {error && <Notice tone="rose">{error}</Notice>}

      {canDelete && (
        <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-rose-200">
          <Trash2 className="size-3.5" /> {t.common.remove}
        </button>
      )}
    </article>
  );
}
