"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Coins, Plus, TrendingDown, TrendingUp, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useBunkerToast } from "@/app/bunker/_components/toast";
import {
  Button,
  Card,
  Chip,
  ConfirmButton,
  Empty,
  Fab,
  Field,
  PageHeader,
  ProgressBar,
  Segmented,
  Sheet,
  Skeleton,
  cx,
  inputClass,
  progressColor,
} from "@/app/bunker/_components/ui";
import { bunkerDb } from "@/app/bunker/_lib/db";
import { errorText, useBunkerRows } from "@/app/bunker/_lib/useBunkerRows";
import { daysBetween, humanDay, isoDay, money, percent, shortDate } from "@/lib/bunker/format";
import { renderMarkdown } from "@/lib/bunker/markdown";
import {
  CURRENCIES,
  INVESTMENT_CATEGORIES,
  type BunkerDebt,
  type BunkerInvestment,
  type DebtPayment,
  type InvestmentCategory,
} from "@/lib/bunker/types";

/* ──────────────────────────────────────────────────────────────────────
 * /bunker/finance — долги и инвестиции.
 *
 * Долги: взнос пишется RPC bunker_debt_add_payment (атомарно в history),
 * paid_amount и статус пересчитывает триггер в базе.
 * Инвестиции: итоги считаются по каждой валюте отдельно (без курсов).
 * ──────────────────────────────────────────────────────────────────── */

type Tab = "debts" | "investments";

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;

export default function FinanceClient() {
  const [tab, setTab] = useState<Tab>("debts");
  return (
    <>
      <PageHeader eyebrow="Капитал" title="Финансы" subtitle={tab === "debts" ? "Погашение обязательств" : "Портфель и стратегия"} />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "debts", label: "📉 Долги" },
          { value: "investments", label: "📈 Инвестиции" },
        ]}
      />
      <div className="mt-5">{tab === "debts" ? <Debts /> : <Investments />}</div>
    </>
  );
}

/* ═════════════════════════════ ДОЛГИ ═════════════════════════════ */

function Debts() {
  const debts = useBunkerRows<BunkerDebt>("bunker_debts", [{ column: "due_date", ascending: true }, { column: "created_at" }]);
  const [filter, setFilter] = useState<"active" | "paid">("active");
  const [editing, setEditing] = useState<BunkerDebt | "new" | null>(null);
  const [paying, setPaying] = useState<BunkerDebt | null>(null);

  const list = debts.rows.filter((d) => (filter === "paid" ? d.status === "paid" : d.status !== "paid"));

  const totals = useMemo(() => {
    const map = new Map<string, { total: number; paid: number }>();
    for (const d of debts.rows) {
      if (d.status === "paid") continue;
      const t = map.get(d.currency) ?? { total: 0, paid: 0 };
      t.total += num(d.total_amount);
      t.paid += num(d.paid_amount);
      map.set(d.currency, t);
    }
    return [...map.entries()];
  }, [debts.rows]);

  if (debts.loading) return <ListSkeleton />;
  if (debts.error) return <Empty icon={<X className="h-5 w-5" />} title="Не удалось загрузить" text={debts.error} />;

  return (
    <>
      {totals.length > 0 && (
        <Card className="mb-4 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Осталось погасить</p>
          <div className="mt-3 space-y-4">
            {totals.map(([currency, t]) => {
              const pct = t.total ? (t.paid / t.total) * 100 : 0;
              return (
                <div key={currency}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="voyage-cormorant text-3xl text-white">{money(t.total - t.paid, currency)}</span>
                    <span className="text-sm tabular-nums" style={{ color: progressColor(pct) }}>
                      {Math.round(pct)}% закрыто
                    </span>
                  </div>
                  <ProgressBar value={pct} />
                  <p className="mt-1.5 text-xs text-zinc-500">
                    выплачено {money(t.paid, currency)} из {money(t.total, currency)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="mb-3 flex gap-2">
        <Chip active={filter === "active"} onClick={() => setFilter("active")}>
          Активные · {debts.rows.filter((d) => d.status !== "paid").length}
        </Chip>
        <Chip active={filter === "paid"} onClick={() => setFilter("paid")}>
          Закрытые · {debts.rows.filter((d) => d.status === "paid").length}
        </Chip>
      </div>

      {list.length === 0 ? (
        <Empty
          icon={<TrendingDown className="h-5 w-5" />}
          title={filter === "active" ? "Долгов нет — красота" : "Пока ничего не закрыто"}
          text={filter === "active" ? "Добавь обязательство, чтобы следить за графиком." : undefined}
          action={filter === "active" ? <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Добавить долг</Button> : undefined}
        />
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {list.map((d) => (
              <DebtCard key={d.id} debt={d} onOpen={() => setEditing(d)} onPay={() => setPaying(d)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <Fab label="Новый долг" onClick={() => setEditing("new")}>
        <Plus className="h-6 w-6" />
      </Fab>

      <DebtSheet
        key={editing === "new" ? "new" : editing?.id ?? "none"}
        debt={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSave={async (values, id) => {
          const row = id ? await debts.update(id, values) : await debts.insert(values);
          if (row) setEditing(null);
        }}
        onDelete={async (id) => {
          if (await debts.remove(id)) setEditing(null);
        }}
        onHistoryChange={async (id, history) => {
          const row = await debts.update(id, { history });
          if (row) setEditing(row);
        }}
      />
      <PaymentSheet
        key={`pay-${paying?.id ?? "none"}`}
        debt={paying}
        onClose={() => setPaying(null)}
        onSaved={(row) => {
          debts.replace(row);
          setPaying(null);
        }}
      />
    </>
  );
}

function DebtCard({ debt, onOpen, onPay }: { debt: BunkerDebt; onOpen: () => void; onPay: () => void }) {
  const total = num(debt.total_amount);
  const paid = num(debt.paid_amount);
  const left = Math.max(0, total - paid);
  const pct = total ? (paid / total) * 100 : 0;
  const today = isoDay();
  const daysLeft = debt.due_date ? daysBetween(today, debt.due_date) : null;
  const monthly = debt.monthly_payment ? num(debt.monthly_payment) : null;
  const paymentsLeft = monthly ? Math.ceil(left / monthly) : null;
  const last = debt.history[debt.history.length - 1];

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
      <Card className="p-4">
        <button onClick={onOpen} className="block w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[16px] font-medium text-white">{debt.title}</p>
              {debt.counterparty && <p className="truncate text-xs text-zinc-500">{debt.counterparty}</p>}
            </div>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
              style={{ color: progressColor(pct), background: `${progressColor(pct)}1a` }}
            >
              {Math.round(pct)}%
            </span>
          </div>

          <ProgressBar value={pct} className="mt-4" />

          <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
            <Stat label="Всего" value={money(total, debt.currency, { compact: true })} />
            <Stat label="Выплачено" value={money(paid, debt.currency, { compact: true })} />
            <Stat label="Остаток" value={money(left, debt.currency, { compact: true })} accent />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-zinc-500">
            {debt.due_date && (
              <span className={cx("inline-flex items-center gap-1", daysLeft !== null && daysLeft < 0 && debt.status !== "paid" && "text-red-400")}>
                <CalendarClock className="h-3.5 w-3.5" />
                до {shortDate(debt.due_date)}
                {daysLeft !== null && debt.status !== "paid" && (daysLeft >= 0 ? ` · ${daysLeft} дн.` : " · просрочено")}
              </span>
            )}
            {monthly && debt.status !== "paid" && (
              <span>
                {money(monthly, debt.currency)}/мес · ещё ~{paymentsLeft}
              </span>
            )}
            {debt.status === "paused" && <span className="text-amber-300">на паузе</span>}
            {last && <span>последний взнос {humanDay(last.date)}</span>}
          </div>
        </button>

        {debt.status !== "paid" && (
          <Button tone="outline" className="mt-4 h-10 w-full" onClick={onPay}>
            <Coins className="h-4 w-4" /> Внести платёж
          </Button>
        )}
      </Card>
    </motion.div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.03] px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className={cx("truncate font-medium tabular-nums", accent ? "text-[#e9d7a8]" : "text-zinc-200")}>{value}</p>
    </div>
  );
}

function PaymentSheet({ debt, onClose, onSaved }: { debt: BunkerDebt | null; onClose: () => void; onSaved: (row: BunkerDebt) => void }) {
  const notify = useBunkerToast();
  const left = debt ? Math.max(0, num(debt.total_amount) - num(debt.paid_amount)) : 0;
  const [amount, setAmount] = useState(() => String(debt?.monthly_payment ? Math.min(num(debt.monthly_payment), left) : ""));
  const [date, setDate] = useState(isoDay());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const value = Number(amount.replace(",", ".").replace(/\s/g, ""));

  const submit = async () => {
    if (!debt || !(value > 0)) return;
    setBusy(true);
    const { data, error, locked } = await bunkerDb<BunkerDebt>({
      kind: "rpc",
      fn: "bunker_debt_add_payment",
      args: { p_debt_id: debt.id, p_amount: value, p_paid_on: date, p_note: note || null },
    });
    setBusy(false);
    if (locked) return;
    if (error || !data) return notify(errorText(error), { tone: "error" });
    const row = data;
    notify(row.status === "paid" ? "Долг закрыт полностью 🎉" : `Взнос ${money(value, debt.currency)} записан`);
    onSaved(row);
  };

  return (
    <Sheet
      open={!!debt}
      onClose={onClose}
      title="Взнос"
      footer={
        <Button className="w-full" onClick={submit} disabled={!(value > 0) || busy}>
          {busy ? "Записываю…" : "Записать платёж"}
        </Button>
      }
    >
      {debt && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            {debt.title} · остаток <span className="text-[#e9d7a8]">{money(left, debt.currency)}</span>
          </p>
          <Field label={`Сумма, ${debt.currency}`}>
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={cx(inputClass, "voyage-cormorant h-14")}
              style={{ fontSize: 30 }}
              placeholder="0"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[debt.monthly_payment ? num(debt.monthly_payment) : null, left / 4, left / 2, left]
              .filter((v): v is number => !!v && v > 0)
              .map((v, i) => (
                <Chip key={i} onClick={() => setAmount(String(Math.round(v * 100) / 100))}>
                  {i === 0 && debt.monthly_payment ? "Ежемесячный" : v === left ? "Весь остаток" : money(v, debt.currency, { compact: true })}
                </Chip>
              ))}
          </div>
          <Field label="Дата">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cx(inputClass, "[color-scheme:dark]")} />
          </Field>
          <Field label="Комментарий">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Перевод с карты…" className={inputClass} />
          </Field>
        </div>
      )}
    </Sheet>
  );
}

type DebtValues = Pick<BunkerDebt, "title" | "counterparty" | "total_amount" | "currency" | "due_date" | "monthly_payment" | "status" | "notes">;

function DebtSheet({
  debt,
  open,
  onClose,
  onSave,
  onDelete,
  onHistoryChange,
}: {
  debt: BunkerDebt | null;
  open: boolean;
  onClose: () => void;
  onSave: (values: DebtValues, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onHistoryChange: (id: string, history: DebtPayment[]) => Promise<void>;
}) {
  const [title, setTitle] = useState(debt?.title ?? "");
  const [counterparty, setCounterparty] = useState(debt?.counterparty ?? "");
  const [total, setTotal] = useState(debt ? String(num(debt.total_amount)) : "");
  const [currency, setCurrency] = useState(debt?.currency ?? "USD");
  const [due, setDue] = useState(debt?.due_date ?? "");
  const [monthly, setMonthly] = useState(debt?.monthly_payment ? String(num(debt.monthly_payment)) : "");
  const [paused, setPaused] = useState(debt?.status === "paused");
  const [notes, setNotes] = useState(debt?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const totalNum = Number(total.replace(",", ".").replace(/\s/g, ""));
  const monthlyNum = Number(monthly.replace(",", ".").replace(/\s/g, ""));
  const valid = title.trim() && totalNum > 0;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    await onSave(
      {
        title: title.trim(),
        counterparty: counterparty.trim() || null,
        total_amount: totalNum,
        currency,
        due_date: due || null,
        monthly_payment: monthlyNum > 0 ? monthlyNum : null,
        // paid/active решит триггер по history; паузу ставим явно
        status: paused ? "paused" : "active",
        notes: notes.trim() || null,
      },
      debt?.id,
    );
    setBusy(false);
  };

  const history = [...(debt?.history ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={debt ? debt.title : "Новый долг"}
      footer={
        <div className="flex gap-2">
          {debt && <ConfirmButton onConfirm={() => onDelete(debt.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>}
          <Button className="flex-1" onClick={save} disabled={!valid || busy}>
            {busy ? "Сохраняю…" : "Сохранить"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Кому / институт">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ипотека, Тинькофф, Алексей…" className={inputClass} />
        </Field>
        <Field label="Детали">
          <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Договор №, банк, контакт" className={inputClass} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Общая сумма">
            <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className={inputClass} placeholder="0" />
          </Field>
          <Field label="Валюта">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дедлайн">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cx(inputClass, "[color-scheme:dark]")} />
          </Field>
          <Field label="Платёж в месяц">
            <input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} className={inputClass} placeholder="—" />
          </Field>
        </div>
        <Field label="Заметки">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cx(inputClass, "resize-none")} />
        </Field>
        <button
          onClick={() => setPaused((v) => !v)}
          className={cx(
            "w-full rounded-xl border px-4 py-3 text-left text-sm",
            paused ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-white/[0.06] text-zinc-400",
          )}
        >
          {paused ? "На паузе · нажми, чтобы вернуть в активные" : "Поставить на паузу"}
        </button>

        {debt && (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">История платежей · {history.length}</p>
            {history.length === 0 ? (
              <p className="text-sm text-zinc-600">Пока ни одного взноса.</p>
            ) : (
              <div className="space-y-1.5">
                {history.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="w-24 shrink-0 text-zinc-500">{shortDate(p.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-zinc-400">{p.note}</span>
                    <span className="tabular-nums text-emerald-300">+{money(num(p.amount), debt.currency)}</span>
                    <button
                      aria-label="Удалить платёж"
                      className="text-zinc-600 hover:text-red-300"
                      onClick={() => onHistoryChange(debt.id, debt.history.filter((x) => x.id !== p.id))}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function CurrencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, "w-28 [color-scheme:dark]")}>
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

/* ═══════════════════════════ ИНВЕСТИЦИИ ═══════════════════════════ */

function Investments() {
  const items = useBunkerRows<BunkerInvestment>("bunker_investments", [{ column: "created_at", ascending: false }]);
  const [cat, setCat] = useState<InvestmentCategory | null>(null);
  const [editing, setEditing] = useState<BunkerInvestment | "new" | null>(null);

  const totals = useMemo(() => {
    const map = new Map<string, { invested: number; current: number; byCat: Map<InvestmentCategory, number> }>();
    for (const i of items.rows) {
      const t = map.get(i.currency) ?? { invested: 0, current: 0, byCat: new Map() };
      t.invested += num(i.initial_amount);
      t.current += num(i.current_value);
      t.byCat.set(i.category, (t.byCat.get(i.category) ?? 0) + num(i.current_value));
      map.set(i.currency, t);
    }
    return [...map.entries()].sort((a, b) => b[1].current - a[1].current);
  }, [items.rows]);

  const list = items.rows.filter((i) => !cat || i.category === cat);

  if (items.loading) return <ListSkeleton />;
  if (items.error) return <Empty icon={<X className="h-5 w-5" />} title="Не удалось загрузить" text={items.error} />;

  return (
    <>
      {totals.map(([currency, t]) => {
        const pnl = t.current - t.invested;
        const roi = t.invested ? (pnl / t.invested) * 100 : 0;
        return (
          <Card key={currency} className="mb-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Портфель · {currency}</p>
                <p className="voyage-cormorant mt-1 text-4xl text-white">{money(t.current, currency)}</p>
                <p className="mt-1 text-xs text-zinc-500">вложено {money(t.invested, currency)}</p>
              </div>
              <div className={cx("text-right", pnl >= 0 ? "text-emerald-300" : "text-red-300")}>
                <p className="inline-flex items-center gap-1 text-sm font-medium">
                  {pnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {percent(roi)}
                </p>
                <p className="text-xs tabular-nums">{(pnl >= 0 ? "+" : "") + money(pnl, currency)}</p>
              </div>
            </div>
            {t.current > 0 && (
              <>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  {[...t.byCat.entries()].map(([c, v]) => (
                    <motion.div
                      key={c}
                      initial={{ width: 0 }}
                      animate={{ width: `${(v / t.current) * 100}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 22 }}
                      style={{ background: INVESTMENT_CATEGORIES[c].color }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                  {[...t.byCat.entries()].map(([c, v]) => (
                    <span key={c} className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: INVESTMENT_CATEGORIES[c].color }} />
                      {INVESTMENT_CATEGORIES[c].label} {Math.round((v / t.current) * 100)}%
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>
        );
      })}

      <div className="bunker-scroll-x -mx-4 mb-3 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Chip active={!cat} onClick={() => setCat(null)}>
          Все
        </Chip>
        {(Object.keys(INVESTMENT_CATEGORIES) as InvestmentCategory[]).map((c) => (
          <Chip key={c} active={cat === c} color={INVESTMENT_CATEGORIES[c].color} onClick={() => setCat(cat === c ? null : c)}>
            {INVESTMENT_CATEGORIES[c].label}
          </Chip>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty
          icon={<TrendingUp className="h-5 w-5" />}
          title="Активов пока нет"
          text="Крипта, недвижимость, фонды, займы, доли — всё в одном месте."
          action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Добавить актив</Button>}
        />
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {list.map((i) => {
              const invested = num(i.initial_amount);
              const current = num(i.current_value);
              const pnl = current - invested;
              const roi = invested ? (pnl / invested) * 100 : 0;
              const meta = INVESTMENT_CATEGORIES[i.category];
              return (
                <motion.div key={i.id} layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <Card as="button" onClick={() => setEditing(i)} className="p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                        style={{ background: `${meta.color}1f`, color: meta.color }}
                      >
                        {meta.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-white">{i.title}</p>
                        <p className="text-xs text-zinc-500">{meta.label}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[15px] font-medium tabular-nums text-white">{money(current, i.currency, { compact: true })}</p>
                        <p className={cx("text-xs tabular-nums", pnl >= 0 ? "text-emerald-300" : "text-red-300")}>
                          {invested ? percent(roi) : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-zinc-500">
                      <span>вложено {money(invested, i.currency, { compact: true })}</span>
                      <span className={pnl >= 0 ? "text-emerald-400/80" : "text-red-400/80"}>
                        {(pnl >= 0 ? "+" : "") + money(pnl, i.currency, { compact: true })}
                      </span>
                      {i.expected_roi !== null && <span>цель {percent(num(i.expected_roi))} годовых</span>}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <Fab label="Новый актив" onClick={() => setEditing("new")}>
        <Plus className="h-6 w-6" />
      </Fab>

      <InvestmentSheet
        key={editing === "new" ? "new" : editing?.id ?? "none"}
        item={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSave={async (values, id) => {
          const row = id ? await items.update(id, values) : await items.insert(values);
          if (row) setEditing(null);
        }}
        onDelete={async (id) => {
          if (await items.remove(id)) setEditing(null);
        }}
      />
    </>
  );
}

type InvestmentValues = Pick<BunkerInvestment, "title" | "category" | "initial_amount" | "current_value" | "currency" | "expected_roi" | "notes">;

function InvestmentSheet({
  item,
  open,
  onClose,
  onSave,
  onDelete,
}: {
  item: BunkerInvestment | null;
  open: boolean;
  onClose: () => void;
  onSave: (values: InvestmentValues, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [category, setCategory] = useState<InvestmentCategory>(item?.category ?? "crypto");
  const [initial, setInitial] = useState(item ? String(num(item.initial_amount)) : "");
  const [current, setCurrent] = useState(item ? String(num(item.current_value)) : "");
  const [currency, setCurrency] = useState(item?.currency ?? "USD");
  const [roi, setRoi] = useState(item?.expected_roi !== null && item?.expected_roi !== undefined ? String(item.expected_roi) : "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [preview, setPreview] = useState(!!item?.notes);
  const [busy, setBusy] = useState(false);

  const parse = (s: string) => Number(s.replace(",", ".").replace(/\s/g, ""));
  const initialNum = parse(initial);
  const currentNum = current.trim() ? parse(current) : initialNum;
  const valid = title.trim() && initialNum >= 0 && currentNum >= 0 && Number.isFinite(initialNum) && Number.isFinite(currentNum);
  const pnl = currentNum - initialNum;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    await onSave(
      {
        title: title.trim(),
        category,
        initial_amount: initialNum || 0,
        current_value: currentNum || 0,
        currency,
        expected_roi: roi.trim() && Number.isFinite(parse(roi)) ? parse(roi) : null,
        notes: notes.trim() || null,
      },
      item?.id,
    );
    setBusy(false);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? item.title : "Новый актив"}
      wide
      footer={
        <div className="flex gap-2">
          {item && <ConfirmButton onConfirm={() => onDelete(item.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>}
          <Button className="flex-1" onClick={save} disabled={!valid || busy}>
            {busy ? "Сохраняю…" : "Сохранить"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Название">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="BTC, апартаменты в Дананге, доля в…" className={inputClass} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(INVESTMENT_CATEGORIES) as InvestmentCategory[]).map((c) => (
            <Chip key={c} active={category === c} color={INVESTMENT_CATEGORIES[c].color} onClick={() => setCategory(c)}>
              {INVESTMENT_CATEGORIES[c].emoji} {INVESTMENT_CATEGORIES[c].label}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Вложено">
            <input inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} className={inputClass} placeholder="0" />
          </Field>
          <Field label="Текущая оценка">
            <input inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} placeholder={initial || "0"} />
          </Field>
          <Field label="Валюта">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
        </div>
        {initialNum > 0 && Number.isFinite(pnl) && (
          <p className={cx("text-sm tabular-nums", pnl >= 0 ? "text-emerald-300" : "text-red-300")}>
            {(pnl >= 0 ? "+" : "") + money(pnl, currency)} · ROI {percent((pnl / initialNum) * 100)}
          </p>
        )}
        <Field label="Ожидаемая доходность, % годовых">
          <input inputMode="decimal" value={roi} onChange={(e) => setRoi(e.target.value)} className={inputClass} placeholder="например, 12" />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Стратегия и реинвест</span>
            <button className="text-xs text-[#c9a961]" onClick={() => setPreview((v) => !v)}>
              {preview ? "Редактировать" : "Просмотр"}
            </button>
          </div>
          {preview && notes.trim() ? (
            <div className="bunker-md rounded-xl border border-white/[0.06] bg-black/30 p-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(notes) }} />
          ) : (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder={"## Тезис\n- точка входа…\n- выход при…\n\n## Реинвест\n- 30% дивидендов в…"}
              className={cx(inputClass, "font-mono text-[13px]")}
            />
          )}
        </div>
      </div>
    </Sheet>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-36" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    </div>
  );
}
