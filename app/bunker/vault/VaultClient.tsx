"use client";

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import {
  Braces,
  Copy,
  CreditCard,
  Delete,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LockOpen,
  NotebookText,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getVaultPepper } from "@/app/actions/bunker";
import { useBunkerToast } from "@/app/bunker/_components/toast";
import {
  Button,
  Card,
  ConfirmButton,
  Empty,
  Fab,
  Field,
  IconButton,
  PageHeader,
  Segmented,
  Sheet,
  Skeleton,
  cx,
  inputClass,
} from "@/app/bunker/_components/ui";
import { errorText } from "@/app/bunker/_lib/useBunkerRows";
import {
  createVaultKeyMaterial,
  decryptSecret,
  encryptSecret,
  generatePassword,
  isValidPin,
  unlockVault,
} from "@/lib/bunker/crypto";
import { plural, relativeTime } from "@/lib/bunker/format";
import { supabase } from "@/lib/supabase";
import {
  VAULT_CATEGORIES,
  type BunkerVaultKeys,
  type BunkerVaultRow,
  type VaultCategory,
  type VaultSecret,
} from "@/lib/bunker/types";

/* ──────────────────────────────────────────────────────────────────────
 * /bunker/vault — сейф (zero-knowledge).
 *
 * Всё шифруется и расшифровывается в этой вкладке (lib/bunker/crypto.ts).
 * Ключ — non-extractable CryptoKey в памяти; расшифрованные записи тоже
 * только в памяти. Блокировка (сворачивание приложения, 3 минуты без
 * действий, кнопка) стирает и то и другое.
 *
 * Забытый PIN = потерянные данные: восстановить нечем, кроме сброса сейфа.
 * ──────────────────────────────────────────────────────────────────── */

const IDLE_LOCK_MS = 3 * 60 * 1000;
const CLIPBOARD_CLEAR_MS = 30 * 1000;
const ATTEMPTS_KEY = "voyage-bunker:vault-attempts";

const CATEGORY_ICON: Record<VaultCategory, typeof KeyRound> = {
  login: KeyRound,
  api_key: Braces,
  card: CreditCard,
  note: NotebookText,
};

type Item = { row: BunkerVaultRow; secret: VaultSecret };
type Phase = "loading" | "setup" | "locked" | "unlocked" | "error";

function readAttempts(): { count: number; until: number } {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? "") as { count: number; until: number };
  } catch {
    return { count: 0, until: 0 };
  }
}
function writeAttempts(v: { count: number; until: number }) {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(v));
  } catch {
    /* приватный режим — просто без счётчика */
  }
}

export default function VaultClient() {
  const notify = useBunkerToast();
  const [phase, setPhase] = useState<Phase>("loading");
  const [keys, setKeys] = useState<BunkerVaultKeys | null>(null);
  const [pepper, setPepper] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const keyRef = useRef<CryptoKey | null>(null);

  const [tab, setTab] = useState<VaultCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Item | "new" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /* ── загрузка ключевой записи ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data, error }, pep] = await Promise.all([
        supabase.from("bunker_vault_keys").select("*").maybeSingle(),
        getVaultPepper().catch(() => ({ pepper: null })),
      ]);
      if (cancelled) return;
      setPepper(pep.pepper);
      if (error) {
        setFatal(errorText(error));
        setPhase("error");
        return;
      }
      setKeys(data as BunkerVaultKeys | null);
      setPhase(data ? "locked" : "setup");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lock = useCallback(() => {
    keyRef.current = null;
    setItems([]);
    setOpen(null);
    setSettingsOpen(false);
    setPhase((p) => (p === "unlocked" ? "locked" : p));
  }, []);

  /* ── авто-блокировка: свернули приложение / ушли со вкладки / простой ── */
  useEffect(() => {
    if (phase !== "unlocked") return;
    let idle = setTimeout(lock, IDLE_LOCK_MS);
    const bump = () => {
      clearTimeout(idle);
      idle = setTimeout(lock, IDLE_LOCK_MS);
    };
    const onHidden = () => document.visibilityState === "hidden" && lock();
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", lock);
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    return () => {
      clearTimeout(idle);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", lock);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [phase, lock]);

  // Ушли со страницы сейфа внутри приложения — тоже блокируем.
  useEffect(() => () => void (keyRef.current = null), []);

  const loadItems = async (key: CryptoKey) => {
    const { data, error } = await supabase.from("bunker_vault").select("*").order("created_at", { ascending: false });
    if (error) {
      notify(errorText(error), { tone: "error" });
      return false;
    }
    const decrypted: Item[] = [];
    let broken = 0;
    for (const row of (data ?? []) as BunkerVaultRow[]) {
      try {
        decrypted.push({ row, secret: await decryptSecret(key, row.category, row.ciphertext, row.iv) });
      } catch {
        broken++;
      }
    }
    if (broken) notify(`${broken} запис(ей) не расшифровано — повреждены или другой ключ`, { tone: "error" });
    setItems(decrypted);
    return true;
  };

  /* ── первый PIN ── */
  const setup = async (pin: string) => {
    const { key, row } = await createVaultKeyMaterial(pin, pepper);
    const { data, error } = await supabase.from("bunker_vault_keys").insert(row).select("*").single();
    if (error) {
      notify(errorText(error), { tone: "error" });
      return;
    }
    keyRef.current = key;
    setKeys(data as BunkerVaultKeys);
    setItems([]);
    setPhase("unlocked");
    notify("Сейф создан и открыт");
  };

  /* ── разблокировка ── */
  const unlock = async (pin: string): Promise<string | null> => {
    if (!keys) return "Нет ключа сейфа";
    const att = readAttempts();
    if (att.until > Date.now()) return `Подожди ${Math.ceil((att.until - Date.now()) / 1000)} с`;
    if (keys.uses_pepper && !pepper) return "На сервере не задан BUNKER_VAULT_PEPPER — без него сейф не открыть";

    const key = await unlockVault(pin, keys, keys.uses_pepper ? pepper : null);
    if (!key) {
      const count = att.count + 1;
      const until = count >= 5 ? Date.now() + 30_000 * 2 ** (count - 5) : 0;
      writeAttempts({ count, until });
      return count >= 5 ? `Неверный PIN. Пауза ${Math.round((until - Date.now()) / 1000)} с` : "Неверный PIN";
    }
    writeAttempts({ count: 0, until: 0 });
    keyRef.current = key;
    await loadItems(key);
    setPhase("unlocked");
    return null;
  };

  /* ── сохранение записи ── */
  const saveItem = async (category: VaultCategory, secret: VaultSecret, existing?: BunkerVaultRow) => {
    const key = keyRef.current;
    if (!key) return false;
    const { ciphertext, iv } = await encryptSecret(key, category, secret);
    const query = existing
      ? supabase.from("bunker_vault").update({ category, ciphertext, iv, title: null }).eq("id", existing.id)
      : supabase.from("bunker_vault").insert({ category, ciphertext, iv, title: null });
    const { data, error } = await query.select("*").single();
    if (error) {
      notify(errorText(error), { tone: "error" });
      return false;
    }
    const item = { row: data as BunkerVaultRow, secret };
    setItems((list) => (existing ? list.map((i) => (i.row.id === existing.id ? item : i)) : [item, ...list]));
    notify("Зашифровано и сохранено");
    return true;
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("bunker_vault").delete().eq("id", id);
    if (error) return notify(errorText(error), { tone: "error" });
    setItems((list) => list.filter((i) => i.row.id !== id));
    setOpen(null);
  };

  /* ── смена PIN: перешифровываем всё одной транзакцией ── */
  const changePin = async (newPin: string) => {
    const { key, row } = await createVaultKeyMaterial(newPin, pepper);
    const payload = [];
    for (const item of items) {
      const enc = await encryptSecret(key, item.row.category, item.secret);
      payload.push({ id: item.row.id, ...enc });
    }
    const { error } = await supabase.rpc("bunker_vault_rekey", {
      p_salt: row.salt,
      p_iterations: row.iterations,
      p_check_ciphertext: row.check_ciphertext,
      p_check_iv: row.check_iv,
      p_uses_pepper: row.uses_pepper,
      p_items: payload,
    });
    if (error) {
      notify(errorText(error), { tone: "error" });
      return false;
    }
    keyRef.current = key;
    setKeys((k) => (k ? { ...k, ...row } : k));
    await loadItems(key);
    notify("PIN изменён, всё перешифровано");
    return true;
  };

  const resetVault = async () => {
    const del = await supabase.from("bunker_vault").delete().not("id", "is", null);
    const delKeys = await supabase.from("bunker_vault_keys").delete().not("user_id", "is", null);
    if (del.error || delKeys.error) return notify(errorText(del.error ?? delKeys.error), { tone: "error" });
    keyRef.current = null;
    setItems([]);
    setKeys(null);
    setSettingsOpen(false);
    writeAttempts({ count: 0, until: 0 });
    setPhase("setup");
    notify("Сейф сброшен");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => tab === "all" || i.row.category === tab)
      .filter((i) => !q || i.secret.title.toLowerCase().includes(q) || (i.secret.username ?? "").toLowerCase().includes(q) || (i.secret.url ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.secret.title.localeCompare(b.secret.title, "ru"));
  }, [items, tab, query]);

  /* ═══════════════ экраны ═══════════════ */

  if (phase === "loading") {
    return (
      <>
        <PageHeader eyebrow="Zero-knowledge" title="Сейф" />
        <Skeleton className="mx-auto h-[420px] max-w-sm" />
      </>
    );
  }

  if (phase === "error") {
    return (
      <>
        <PageHeader eyebrow="Zero-knowledge" title="Сейф" />
        <Empty icon={<X className="h-5 w-5" />} title="Сейф недоступен" text={fatal ?? undefined} />
      </>
    );
  }

  if (phase === "setup") return <SetupScreen onDone={setup} hasPepper={!!pepper} />;
  if (phase === "locked") return <LockScreen onSubmit={unlock} />;

  return (
    <>
      <PageHeader
        eyebrow="Открыт · AES-256-GCM"
        title="Сейф"
        subtitle={`${items.length} ${plural(items.length, ["запись", "записи", "записей"])} · авто-блокировка через 3 мин`}
        action={
          <div className="flex gap-1">
            <IconButton label="Настройки сейфа" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-5 w-5" />
            </IconButton>
            <IconButton label="Заблокировать" onClick={lock} className="text-[#c9a961]">
              <Lock className="h-5 w-5" />
            </IconButton>
          </div>
        }
      />

      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-[#121215] px-4 focus-within:border-[#c9a961]/50">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию, логину, сайту…"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-zinc-600"
          type="search"
          autoComplete="off"
        />
      </div>

      <div className="bunker-scroll-x -mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented
          className="w-max min-w-full"
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "Все", count: items.length },
            ...(Object.keys(VAULT_CATEGORIES) as VaultCategory[]).map((c) => ({
              value: c,
              label: c === "login" ? "Логины" : c === "api_key" ? "API" : c === "card" ? "Карты" : "Заметки",
              count: items.filter((i) => i.row.category === c).length,
            })),
          ]}
        />
      </div>

      <div className="mt-5 space-y-2">
        {filtered.length === 0 ? (
          <Empty
            icon={<ShieldCheck className="h-5 w-5" />}
            title={query ? "Ничего не найдено" : "Сейф пуст"}
            text={query ? undefined : "Пароли, API-ключи, карты и секретные заметки — шифруются до отправки."}
            action={!query ? <Button onClick={() => setOpen("new")}><Plus className="h-4 w-4" />Добавить</Button> : undefined}
          />
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((item) => (
              <VaultRow key={item.row.id} item={item} onOpen={() => setOpen(item)} />
            ))}
          </AnimatePresence>
        )}
      </div>

      <Fab label="Новая запись" onClick={() => setOpen("new")}>
        <Plus className="h-6 w-6" />
      </Fab>

      <ItemSheet
        key={open === "new" ? `new-${tab}` : open?.row.id ?? "none"}
        item={open === "new" ? null : open}
        open={open !== null}
        defaultCategory={tab === "all" ? "login" : tab}
        onClose={() => setOpen(null)}
        onSave={async (category, secret, existing) => {
          if (await saveItem(category, secret, existing)) setOpen(null);
        }}
        onDelete={deleteItem}
      />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        keys={keys}
        hasPepper={!!pepper}
        onChangePin={changePin}
        onReset={resetVault}
      />
    </>
  );
}

/* ═══════════════ буфер обмена ═══════════════ */

let clipboardTimer: ReturnType<typeof setTimeout> | null = null;

function useCopy() {
  const notify = useBunkerToast();
  return async (value: string | undefined, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return notify("Браузер не дал доступ к буферу", { tone: "error" });
    }
    notify(`${label} скопирован · очистится через 30 с`);
    if (clipboardTimer) clearTimeout(clipboardTimer);
    clipboardTimer = setTimeout(async () => {
      // Очищаем, только если в буфере всё ещё наш секрет (если браузер даёт прочитать).
      try {
        const current = await navigator.clipboard.readText().catch(() => value);
        if (current === value) await navigator.clipboard.writeText("");
      } catch {
        /* iOS разрешает запись в буфер только при активной вкладке — тогда не выйдет */
      }
    }, CLIPBOARD_CLEAR_MS);
  };
}

/* ═══════════════ список ═══════════════ */

function mask(value: string | undefined, visibleTail = 0) {
  if (!value) return "";
  return visibleTail ? `•••• ${value.replace(/\s/g, "").slice(-visibleTail)}` : "••••••••";
}

function subtitleFor(item: Item) {
  const s = item.secret;
  switch (item.row.category) {
    case "login":
      return s.username || s.url || "••••••••";
    case "api_key":
      return s.apiKey ? `${s.apiKey.slice(0, 4)}••••••${s.apiKey.slice(-4)}` : "";
    case "card":
      return [mask(s.cardNumber, 4), s.expiry].filter(Boolean).join(" · ");
    case "note":
      return `секретная заметка · ${relativeTime(item.row.updated_at)}`;
  }
}

function primarySecret(item: Item): { value?: string; label: string } {
  switch (item.row.category) {
    case "login":
      return { value: item.secret.password, label: "Пароль" };
    case "api_key":
      return { value: item.secret.apiKey, label: "Ключ" };
    case "card":
      return { value: item.secret.cardNumber?.replace(/\s/g, ""), label: "Номер карты" };
    case "note":
      return { value: item.secret.notes, label: "Текст" };
  }
}

function VaultRow({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const copy = useCopy();
  const Icon = CATEGORY_ICON[item.row.category];
  const primary = primarySecret(item);
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}>
      <Card className="flex items-center gap-3 px-3.5 py-3">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#c9a961]/10 text-[#c9a961]">
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-medium text-white">{item.secret.title || "Без названия"}</span>
            <span className="block truncate font-mono text-[12px] text-zinc-500">{subtitleFor(item)}</span>
          </span>
        </button>
        {primary.value && item.row.category !== "note" && (
          <IconButton label={`Скопировать: ${primary.label}`} onClick={() => copy(primary.value, primary.label)}>
            <Copy className="h-4 w-4" />
          </IconButton>
        )}
      </Card>
    </motion.div>
  );
}

/* ═══════════════ PIN-экраны ═══════════════ */

function PinPad({
  onSubmit,
  minLength = 4,
  maxLength = 6,
  busy,
  error,
  errorTick = 0,
}: {
  onSubmit: (pin: string) => void;
  minLength?: number;
  maxLength?: number;
  busy?: boolean;
  error?: string | null;
  /** растёт при каждой ошибке — даже если текст тот же */
  errorTick?: number;
}) {
  const [pin, setPin] = useState("");
  const controls = useAnimationControls();

  useEffect(() => {
    if (!errorTick) return;
    void controls.start({ x: [0, -12, 12, -8, 8, -4, 0], transition: { duration: 0.42 } });
  }, [errorTick, controls]);

  const press = useCallback(
    (d: string) => {
      if (busy) return;
      if (d === "del") return setPin((p) => p.slice(0, -1));
      if (d === "ok") {
        if (pin.length < minLength) return;
        onSubmit(pin);
        return setPin("");
      }
      setPin((p) => (p.length < maxLength ? p + d : p));
    },
    [busy, pin, minLength, maxLength, onSubmit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") press("ok");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"];

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <motion.div animate={controls} className="mb-3 flex justify-center gap-3.5">
        {Array.from({ length: maxLength }).map((_, i) => (
          <motion.span
            key={i}
            animate={{ scale: i < pin.length ? 1 : 0.8, backgroundColor: i < pin.length ? "#c9a961" : "rgba(255,255,255,0)" }}
            transition={{ type: "spring", stiffness: 600, damping: 26 }}
            className={cx("h-3.5 w-3.5 rounded-full border", i < minLength ? "border-[#c9a961]/70" : "border-white/20")}
          />
        ))}
      </motion.div>
      <p className={cx("mb-6 h-5 text-center text-sm", error ? "text-red-300" : "text-zinc-600")}>
        {busy ? "Проверяю…" : error ?? `${minLength}–${maxLength} цифр`}
      </p>
      <div className="grid grid-cols-3 gap-4">
        {keys.map((k) => (
          <motion.button
            key={k}
            whileTap={{ scale: 0.86, backgroundColor: "rgba(201,169,97,0.25)" }}
            onClick={() => press(k)}
            disabled={busy || (k === "ok" && pin.length < minLength)}
            aria-label={k === "del" ? "Стереть" : k === "ok" ? "Готово" : k}
            className={cx(
              "flex aspect-square items-center justify-center rounded-full text-2xl font-light transition-colors disabled:opacity-30",
              k === "ok"
                ? "bg-[#c9a961] text-black"
                : k === "del"
                  ? "text-zinc-400"
                  : "border border-white/[0.08] bg-white/[0.03] text-white",
            )}
          >
            {k === "del" ? <Delete className="h-6 w-6" /> : k === "ok" ? <LockOpen className="h-6 w-6" /> : k}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function LockScreen({ onSubmit }: { onSubmit: (pin: string) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col items-center justify-center py-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#c9a961]/30 bg-[#c9a961]/10 text-[#c9a961] shadow-[0_0_40px_-8px_rgba(201,169,97,0.5)]"
      >
        <Lock className="h-7 w-7" strokeWidth={1.5} />
      </motion.div>
      <h1 className="voyage-cormorant text-4xl text-white">Сейф закрыт</h1>
      <p className="mb-8 mt-1 text-sm text-zinc-500">Введи Master PIN</p>
      <PinPad
        busy={busy}
        error={error}
        errorTick={tick}
        onSubmit={async (pin) => {
          setBusy(true);
          setError(null);
          // даём кадру отрисовать «Проверяю…»: PBKDF2 занимает ~0.5 с
          await new Promise((r) => setTimeout(r, 30));
          const err = await onSubmit(pin).catch((e: unknown) => errorText(e));
          setBusy(false);
          if (err) {
            setError(err);
            setTick((t) => t + 1);
          }
        }}
      />
    </div>
  );
}

function SetupScreen({ onDone, hasPepper }: { onDone: (pin: string) => Promise<void>; hasPepper: boolean }) {
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const fail = (text: string) => {
    setError(text);
    setTick((t) => t + 1);
  };

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col items-center justify-center py-6">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#c9a961]/30 bg-[#c9a961]/10 text-[#c9a961]">
        <ShieldCheck className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <h1 className="voyage-cormorant text-center text-4xl text-white">{first ? "Повтори PIN" : "Задай Master PIN"}</h1>
      <p className="mb-6 mt-2 max-w-xs text-center text-sm text-zinc-500">
        PIN не хранится нигде — ни в базе, ни на сервере. Если забудешь, записи не восстановить.
        {hasPepper ? " Ключ дополнительно усилен серверным pepper." : ""}
      </p>
      <PinPad
        busy={busy}
        error={error}
        errorTick={tick}
        onSubmit={async (pin) => {
          if (!isValidPin(pin)) return fail("Только цифры, 4–6 штук");
          if (!first) {
            setError(null);
            return setFirst(pin);
          }
          if (pin !== first) {
            setFirst(null);
            return fail("Не совпало, начнём заново");
          }
          setBusy(true);
          await new Promise((r) => setTimeout(r, 30));
          try {
            await onDone(pin);
          } catch (e) {
            setFirst(null);
            fail(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/* ═══════════════ карточка записи ═══════════════ */

const FIELDS: Record<VaultCategory, Array<{ key: keyof VaultSecret; label: string; secret?: boolean; mono?: boolean; multiline?: boolean; placeholder?: string; inputMode?: "numeric" }>> = {
  login: [
    { key: "username", label: "Логин / e-mail", mono: true },
    { key: "password", label: "Пароль", secret: true, mono: true },
    { key: "url", label: "Сайт", placeholder: "https://" },
    { key: "notes", label: "Заметки", multiline: true },
  ],
  api_key: [
    { key: "apiKey", label: "Ключ / токен", secret: true, mono: true },
    { key: "url", label: "Сервис / endpoint" },
    { key: "notes", label: "Заметки", multiline: true },
  ],
  card: [
    { key: "cardholder", label: "Держатель" },
    { key: "cardNumber", label: "Номер карты", secret: true, mono: true, inputMode: "numeric", placeholder: "0000 0000 0000 0000" },
    { key: "expiry", label: "Срок", mono: true, placeholder: "MM/YY" },
    { key: "cvv", label: "CVV", secret: true, mono: true, inputMode: "numeric" },
    { key: "pin", label: "PIN карты", secret: true, mono: true, inputMode: "numeric" },
    { key: "notes", label: "Заметки", multiline: true },
  ],
  note: [{ key: "notes", label: "Текст", secret: true, multiline: true }],
};

function ItemSheet({
  item,
  open,
  defaultCategory,
  onClose,
  onSave,
  onDelete,
}: {
  item: Item | null;
  open: boolean;
  defaultCategory: VaultCategory;
  onClose: () => void;
  onSave: (category: VaultCategory, secret: VaultSecret, existing?: BunkerVaultRow) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const copy = useCopy();
  const [editing, setEditing] = useState(!item);
  const [category, setCategory] = useState<VaultCategory>(item?.row.category ?? defaultCategory);
  const [draft, setDraft] = useState<VaultSecret>(item?.secret ?? { title: "" });
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggle = (k: string) =>
    setRevealed((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const save = async () => {
    if (!draft.title.trim()) return;
    setBusy(true);
    const clean = Object.fromEntries(Object.entries(draft).filter(([, v]) => typeof v === "string" && v.trim() !== "")) as VaultSecret;
    await onSave(category, { ...clean, title: draft.title.trim() }, item?.row);
    setBusy(false);
  };

  const fields = FIELDS[category];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? (item ? "Редактирование" : "Новая запись") : item?.secret.title}
      footer={
        editing ? (
          <div className="flex gap-2">
            {item && (
              <Button tone="ghost" onClick={() => (setDraft(item.secret), setCategory(item.row.category), setEditing(false))}>
                Отмена
              </Button>
            )}
            <Button className="flex-1" onClick={save} disabled={!draft.title.trim() || busy}>
              <Lock className="h-4 w-4" />
              {busy ? "Шифрую…" : "Зашифровать и сохранить"}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            {item && <ConfirmButton onConfirm={() => onDelete(item.row.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>}
            <Button tone="ghost" className="flex-1" onClick={() => setEditing(true)}>
              Изменить
            </Button>
          </div>
        )
      }
    >
      {editing ? (
        <div className="space-y-4">
          {!item && (
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(VAULT_CATEGORIES) as VaultCategory[]).map((c) => {
                const Icon = CATEGORY_ICON[c];
                return (
                  <motion.button
                    key={c}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setCategory(c)}
                    className={cx(
                      "flex flex-col items-center gap-1.5 rounded-xl border py-3 text-[11px]",
                      category === c ? "border-[#c9a961]/50 bg-[#c9a961]/10 text-[#f1e2bb]" : "border-white/[0.06] text-zinc-500",
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.6} />
                    {VAULT_CATEGORIES[c].label}
                  </motion.button>
                );
              })}
            </div>
          )}
          <Field label="Название">
            <input
              autoFocus={!item}
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder={category === "card" ? "Tinkoff Black" : category === "api_key" ? "OpenAI prod" : "Gmail"}
              className={inputClass}
              autoComplete="off"
            />
          </Field>
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              <div className="relative">
                {f.multiline ? (
                  <textarea
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    rows={f.key === "notes" && category === "note" ? 8 : 3}
                    className={cx(inputClass, "resize-none")}
                    autoComplete="off"
                  />
                ) : (
                  <input
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    type={f.secret && !revealed.has(f.key) ? "password" : "text"}
                    inputMode={f.inputMode}
                    placeholder={f.placeholder}
                    className={cx(inputClass, f.mono && "font-mono", f.secret && "pr-20")}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                )}
                {f.secret && !f.multiline && (
                  <div className="absolute inset-y-0 right-1 flex items-center">
                    {f.key === "password" && (
                      <IconButton
                        label="Сгенерировать"
                        className="h-8 w-8"
                        onClick={() => {
                          setDraft((d) => ({ ...d, password: generatePassword(20) }));
                          setRevealed((s) => new Set(s).add("password"));
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </IconButton>
                    )}
                    <IconButton label="Показать" className="h-8 w-8" onClick={() => toggle(f.key)}>
                      {revealed.has(f.key) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </IconButton>
                  </div>
                )}
              </div>
            </Field>
          ))}
        </div>
      ) : (
        item && (
          <div className="space-y-2">
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
              {VAULT_CATEGORIES[item.row.category].label} · изменено {relativeTime(item.row.updated_at)}
            </p>
            {fields
              .filter((f) => item.secret[f.key])
              .map((f) => {
                const value = item.secret[f.key] ?? "";
                const shown = !f.secret || revealed.has(f.key);
                return (
                  <div key={f.key} className="rounded-xl bg-white/[0.03] px-3.5 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">{f.label}</p>
                    <div className="mt-0.5 flex items-start gap-2">
                      <p
                        className={cx(
                          "min-w-0 flex-1 break-all text-[15px] text-zinc-100",
                          f.mono && "font-mono",
                          f.multiline && "whitespace-pre-wrap break-words",
                        )}
                      >
                        {shown ? value : f.key === "cardNumber" ? mask(value, 4) : "••••••••"}
                      </p>
                      {f.secret && (
                        <IconButton label={shown ? "Скрыть" : "Показать"} className="h-8 w-8" onClick={() => toggle(f.key)}>
                          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </IconButton>
                      )}
                      {!f.multiline && (
                        <IconButton label="Скопировать" className="h-8 w-8" onClick={() => copy(f.key === "cardNumber" ? value.replace(/\s/g, "") : value, f.label)}>
                          <Copy className="h-4 w-4" />
                        </IconButton>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )
      )}
    </Sheet>
  );
}

/* ═══════════════ настройки сейфа ═══════════════ */

function SettingsSheet({
  open,
  onClose,
  keys,
  hasPepper,
  onChangePin,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  keys: BunkerVaultKeys | null;
  hasPepper: boolean;
  onChangePin: (pin: string) => Promise<boolean>;
  onReset: () => Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState("");

  const valid = isValidPin(pin) && pin === pin2;

  return (
    <Sheet open={open} onClose={onClose} title="Настройки сейфа">
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/[0.06] p-4 text-sm text-zinc-400">
          <p className="flex items-center gap-2 text-zinc-200">
            <ShieldCheck className="h-4 w-4 text-[#c9a961]" /> Как это защищено
          </p>
          <ul className="mt-2 space-y-1 text-[13px] leading-relaxed">
            <li>• AES-256-GCM, случайный iv на каждую запись.</li>
            <li>• Ключ из PIN: PBKDF2-SHA256, {keys?.iterations.toLocaleString("ru-RU")} итераций, своя соль.</li>
            <li>• Pepper сервера: {keys?.uses_pepper ? "используется" : hasPepper ? "задан, применится после смены PIN" : "не задан"}.</li>
            <li>• В базе — только шифротекст. Названия тоже зашифрованы.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-200">Сменить PIN</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Новый PIN (4–6 цифр)"
            className={cx(inputClass, "font-mono tracking-[0.4em]")}
            autoComplete="off"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
            placeholder="Ещё раз"
            className={cx(inputClass, "font-mono tracking-[0.4em]")}
            autoComplete="off"
          />
          <Button
            className="w-full"
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onChangePin(pin);
              setBusy(false);
              if (ok) {
                setPin("");
                setPin2("");
                onClose();
              }
            }}
          >
            {busy ? "Перешифровываю…" : "Сменить и перешифровать"}
          </Button>
        </div>

        <div className="space-y-3 rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <p className="text-sm font-medium text-red-200">Сбросить сейф</p>
          <p className="text-[13px] text-zinc-500">Удалит все записи и ключ. Отменить нельзя. Напиши УДАЛИТЬ, чтобы подтвердить.</p>
          <input value={confirmReset} onChange={(e) => setConfirmReset(e.target.value)} className={inputClass} placeholder="УДАЛИТЬ" />
          {confirmReset.trim() === "УДАЛИТЬ" ? (
            <ConfirmButton onConfirm={() => void onReset()} confirmLabel="Удалить всё безвозвратно">
              <Trash2 className="h-4 w-4" /> Сбросить
            </ConfirmButton>
          ) : (
            <Button tone="danger" disabled>
              <Trash2 className="h-4 w-4" /> Сбросить
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
