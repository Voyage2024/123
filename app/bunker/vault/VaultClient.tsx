"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Braces,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  NotebookText,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { changeMasterPin } from "@/app/actions/bunker";
import { useBunkerLock } from "@/app/bunker/_components/BunkerLock";
import { PinPad } from "@/app/bunker/_components/PinPad";
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
import { bunkerDb } from "@/app/bunker/_lib/db";
import { errorText } from "@/app/bunker/_lib/useBunkerRows";
import { createVaultKeyMaterial, decryptSecret, encryptSecret, generatePassword, unlockVault } from "@/lib/bunker/crypto";
import { plural, relativeTime } from "@/lib/bunker/format";
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
 * Отдельного PIN у сейфа больше нет: ключ AES-256-GCM выводится из
 * Master PIN при входе в бункер (BunkerLock) и живёт только в памяти до
 * блокировки. В режиме Duress тот же экран открывает камуфляжный сейф,
 * зашифрованный ключом из Duress PIN.
 *
 * Всё шифруется и расшифровывается в браузере (lib/bunker/crypto.ts),
 * в базу уходят только шифротекст и iv.
 * ──────────────────────────────────────────────────────────────────── */

const CLIPBOARD_CLEAR_MS = 30 * 1000;

const CATEGORY_ICON: Record<VaultCategory, typeof KeyRound> = {
  login: KeyRound,
  api_key: Braces,
  card: CreditCard,
  note: NotebookText,
};

type Item = { row: BunkerVaultRow; secret: VaultSecret };

async function decryptAll(key: CryptoKey, rows: BunkerVaultRow[]) {
  const items: Item[] = [];
  let broken = 0;
  for (const row of rows) {
    try {
      items.push({ row, secret: await decryptSecret(key, row.category, row.ciphertext, row.iv) });
    } catch {
      broken++;
    }
  }
  return { items, broken };
}

async function loadRows() {
  return bunkerDb<BunkerVaultRow[]>({ kind: "select", table: "bunker_vault", order: [{ column: "created_at", ascending: false }] });
}

export default function VaultClient() {
  const { vault } = useBunkerLock();

  if (!vault) {
    return (
      <>
        <PageHeader eyebrow="Zero-knowledge" title="Сейф" />
        <Skeleton className="h-40" />
      </>
    );
  }
  if (vault.status === "pepper-missing") {
    return (
      <>
        <PageHeader eyebrow="Zero-knowledge" title="Сейф" />
        <Empty
          icon={<X className="h-5 w-5" />}
          title="Сейф недоступен"
          text="Сейф зашифрован с серверным pepper, а BUNKER_VAULT_PEPPER на сервере сейчас не задан. Верни переменную на Vercel."
        />
      </>
    );
  }
  if (vault.status === "mismatch" || !vault.key) return <VaultMigration />;
  return <VaultBody vaultKey={vault.key} keys={vault.keys} hasPepper={!!vault.pepper} />;
}

function VaultBody({ vaultKey, keys, hasPepper }: { vaultKey: CryptoKey; keys: BunkerVaultKeys | null; hasPepper: boolean }) {
  const notify = useBunkerToast();
  const { lock } = useBunkerLock();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<VaultCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Item | "new" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await loadRows();
      if (cancelled || res.locked) return;
      if (res.error) notify(res.error, { tone: "error" });
      const { items: list, broken } = await decryptAll(vaultKey, res.data ?? []);
      if (cancelled) return;
      if (broken) notify(`Не расшифровано записей: ${broken}`, { tone: "error" });
      setItems(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultKey, notify]);

  const saveItem = async (category: VaultCategory, secret: VaultSecret, existing?: BunkerVaultRow) => {
    const { ciphertext, iv } = await encryptSecret(vaultKey, category, secret);
    const values = { category, ciphertext, iv, title: null };
    const res = existing
      ? await bunkerDb<BunkerVaultRow>({ kind: "update", table: "bunker_vault", id: existing.id, patch: values })
      : await bunkerDb<BunkerVaultRow>({ kind: "insert", table: "bunker_vault", values });
    if (res.error || !res.data) {
      if (!res.locked) notify(errorText(res.error), { tone: "error" });
      return false;
    }
    const item = { row: res.data, secret };
    setItems((list) => (existing ? list.map((i) => (i.row.id === existing.id ? item : i)) : [item, ...list]));
    notify("Зашифровано и сохранено");
    return true;
  };

  const deleteItem = async (id: string) => {
    const res = await bunkerDb({ kind: "delete", table: "bunker_vault", id });
    if (res.error) return void (!res.locked && notify(errorText(res.error), { tone: "error" }));
    setItems((list) => list.filter((i) => i.row.id !== id));
    setOpen(null);
  };

  // Сброс: удаляем записи и ключ; новый ключ создастся из PIN при следующем входе.
  const resetVault = async () => {
    const del = await bunkerDb({ kind: "deleteAll", table: "bunker_vault" });
    const delKeys = await bunkerDb({ kind: "deleteAll", table: "bunker_vault_keys" });
    if (del.error || delKeys.error) return void notify(errorText(del.error ?? delKeys.error), { tone: "error" });
    lock();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => tab === "all" || i.row.category === tab)
      .filter((i) => !q || i.secret.title.toLowerCase().includes(q) || (i.secret.username ?? "").toLowerCase().includes(q) || (i.secret.url ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.secret.title.localeCompare(b.secret.title, "ru"));
  }, [items, tab, query]);

  return (
    <>
      <PageHeader
        eyebrow="Открыт · AES-256-GCM"
        title="Сейф"
        subtitle={`${items.length} ${plural(items.length, ["запись", "записи", "записей"])} · закрывается вместе с бункером`}
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
        <Segmented<VaultCategory | "all">
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
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[66px]" />)
        ) : filtered.length === 0 ? (
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
        hasPepper={hasPepper}
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

/* ═══════════════ перенос сейфа со старого PIN ═══════════════ */

/**
 * Сейф создан в прошлой версии своим PIN, который не совпадает с Master PIN.
 * Шаг 1 — старый PIN сейфа (расшифровываем всё в памяти), шаг 2 — Master PIN
 * (перешифровываем и сохраняем одной транзакцией вместе с проверкой PIN).
 */
function VaultMigration() {
  const notify = useBunkerToast();
  const { vault, setVault, lock } = useBunkerLock();
  const [step, setStep] = useState<"old" | "master">("old");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fail = (text: string) => {
    setError(text);
    setTick((t) => t + 1);
  };

  const onOld = async (pin: string) => {
    if (!vault?.keys) return;
    setBusy(true);
    setError(null);
    const key = await unlockVault(pin, vault.keys, vault.keys.uses_pepper ? vault.pepper : null);
    if (!key) {
      setBusy(false);
      return fail("Не подходит");
    }
    const res = await loadRows();
    const { items: list, broken } = await decryptAll(key, res.data ?? []);
    setBusy(false);
    if (res.error || broken) return fail("Не всё расшифровалось, перенос остановлен");
    setItems(list);
    setStep("master");
  };

  const onMaster = async (pin: string) => {
    setBusy(true);
    setError(null);
    const { key, row } = await createVaultKeyMaterial(pin, vault?.pepper ?? null);
    const payload = [];
    for (const item of items) payload.push({ id: item.row.id, ...(await encryptSecret(key, item.row.category, item.secret)) });
    const res = await changeMasterPin(pin, pin, { ...row, items: payload });
    setBusy(false);
    if (res.status !== "ok") return fail(res.status === "error" ? res.message : "Неверный Master PIN");
    setVault({ key, keys: vault?.keys ? { ...vault.keys, ...row } : null, pepper: vault?.pepper ?? null, status: "ready" });
    notify("Сейф перешифрован под Master PIN");
  };

  return (
    <>
      <PageHeader eyebrow="Zero-knowledge" title="Сейф" />
      <Card className="mb-6 p-4 text-sm text-zinc-400">
        {step === "old"
          ? "Сейф зашифрован старым PIN сейфа из прошлой версии. Введи его один раз — дальше сейф будет открываться Master PIN."
          : "Теперь Master PIN: под него перешифруем все записи."}
      </Card>
      <PinPad busy={busy} error={error} errorTick={tick} hint={step === "old" ? "Старый PIN сейфа" : "Master PIN"} onSubmit={step === "old" ? onOld : onMaster} />
      <div className="mt-8 text-center">
        <ConfirmButton
          confirmLabel="Удалить сейф безвозвратно?"
          onConfirm={async () => {
            await bunkerDb({ kind: "deleteAll", table: "bunker_vault" });
            await bunkerDb({ kind: "deleteAll", table: "bunker_vault_keys" });
            lock();
          }}
        >
          <Trash2 className="h-4 w-4" /> Не помню — сбросить сейф
        </ConfirmButton>
      </div>
    </>
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
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  keys: BunkerVaultKeys | null;
  hasPepper: boolean;
  onReset: () => Promise<void>;
}) {
  const [confirmReset, setConfirmReset] = useState("");

  return (
    <Sheet open={open} onClose={onClose} title="Настройки сейфа">
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/[0.06] p-4 text-sm text-zinc-400">
          <p className="flex items-center gap-2 text-zinc-200">
            <ShieldCheck className="h-4 w-4 text-[#c9a961]" /> Как это защищено
          </p>
          <ul className="mt-2 space-y-1 text-[13px] leading-relaxed">
            <li>• AES-256-GCM, случайный iv на каждую запись.</li>
            <li>• Ключ из Master PIN: PBKDF2-SHA256, {keys?.iterations.toLocaleString("ru-RU")} итераций, своя соль.</li>
            <li>• Pepper сервера: {keys?.uses_pepper ? "используется" : hasPepper ? "задан, применится после смены Master PIN" : "не задан"}.</li>
            <li>• В базе — только шифротекст. Названия тоже зашифрованы.</li>
            <li>• Master PIN меняется в «Безопасности» на главном экране — сейф перешифруется сам.</li>
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <p className="text-sm font-medium text-red-200">Сбросить сейф</p>
          <p className="text-[13px] text-zinc-500">
            Удалит все записи и ключ, бункер закроется. При следующем входе сейф создастся заново. Отменить нельзя. Напиши УДАЛИТЬ.
          </p>
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
