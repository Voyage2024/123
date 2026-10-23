"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, Inbox, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useBunkerToast } from "@/app/bunker/_components/toast";
import { Button, Card, Chip, ConfirmButton, Empty, Fab, Field, Segmented, Sheet, cx, inputClass } from "@/app/bunker/_components/ui";
import { useProjects, type ProjectsApi } from "@/app/bunker/_lib/projects";
import { useBunkerRows } from "@/app/bunker/_lib/useBunkerRows";
import { CurrencySelect, ListSkeleton, currencyRank, num, parseAmount } from "@/app/bunker/finance/shared";
import { addDays, daysBetween, humanDay, isoDay, money, parseDay, plural, shortDate } from "@/lib/bunker/format";
import type { BunkerIncome, IncomeStatus } from "@/lib/bunker/types";

/* ──────────────────────────────────────────────────────────────────────
 * Приходы: кто, сколько и когда должен перевести.
 *
 * «Ожидается» — лента по срокам (просрочено → сегодня → неделя → позже →
 * без даты), «Получено» — история по месяцам. Кнопка «Получено» на
 * карточке закрывает приход сегодняшней датой и полной суммой (это же
 * делает триггер в базе), в тосте есть «Отменить».
 *
 * Итоги считаются по каждой валюте отдельно, без курсов — как в долгах.
 * В режиме Duress таблица та же, RLS отдаёт только камуфляжные строки.
 * ──────────────────────────────────────────────────────────────────── */

type View = "expected" | "received";
type Bucket = "overdue" | "today" | "week" | "later" | "nodate";

const BUCKETS: Array<{ key: Bucket; title: string }> = [
  { key: "overdue", title: "Просрочено" },
  { key: "today", title: "Сегодня" },
  { key: "week", title: "Ближайшие 7 дней" },
  { key: "later", title: "Позже" },
  { key: "nodate", title: "Без даты" },
];

function bucketOf(income: BunkerIncome, today: string): Bucket {
  if (!income.expected_on) return "nodate";
  const d = daysBetween(today, income.expected_on);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  return d <= 7 ? "week" : "later";
}

/** Суммы по валютам: [["USD", 1200], ["RUB", 5000]]. */
function sumByCurrency(list: BunkerIncome[], pick: (i: BunkerIncome) => number) {
  const map = new Map<string, number>();
  for (const i of list) map.set(i.currency, (map.get(i.currency) ?? 0) + pick(i));
  return [...map.entries()].sort((a, b) => currencyRank(a[0]) - currencyRank(b[0]));
}

const joinSums = (sums: Array<[string, number]>) => sums.map(([cur, v]) => money(v, cur, { compact: true })).join(" · ");

function dueLabel(income: BunkerIncome, today: string) {
  if (!income.expected_on) return { text: "без даты", tone: "text-zinc-500" };
  const d = daysBetween(today, income.expected_on);
  if (d < 0) return { text: `${humanDay(income.expected_on, today)} · просрочено ${-d} ${plural(-d, ["день", "дня", "дней"])}`, tone: "text-red-400" };
  if (d === 0) return { text: "Сегодня", tone: "text-[#e9d7a8]" };
  if (d === 1) return { text: "Завтра", tone: "text-[#e9d7a8]" };
  return { text: `${humanDay(income.expected_on, today)} · через ${d} ${plural(d, ["день", "дня", "дней"])}`, tone: d <= 7 ? "text-zinc-300" : "text-zinc-500" };
}

export default function Incomes() {
  const notify = useBunkerToast();
  const incomes = useBunkerRows<BunkerIncome>("bunker_incomes", [{ column: "expected_on", ascending: true }, { column: "created_at" }]);
  const projects = useProjects();
  const [view, setView] = useState<View>("expected");
  const [project, setProject] = useState<string | null>(null);
  const [editing, setEditing] = useState<BunkerIncome | "new" | null>(null);

  const today = isoDay();
  const scoped = incomes.rows.filter((i) => !project || i.category === project);
  const expected = scoped.filter((i) => i.status === "expected");
  const received = scoped.filter((i) => i.status === "received");

  const summary = useMemo(() => {
    const week = expected.filter((i) => i.expected_on && daysBetween(today, i.expected_on) <= 7 && daysBetween(today, i.expected_on) >= 0);
    const overdue = expected.filter((i) => bucketOf(i, today) === "overdue");
    const monthStart = `${today.slice(0, 7)}-01`;
    const thisMonth = received.filter((i) => (i.received_on ?? "") >= monthStart);
    return {
      total: sumByCurrency(expected, (i) => num(i.amount)),
      week: sumByCurrency(week, (i) => num(i.amount)),
      overdue: sumByCurrency(overdue, (i) => num(i.amount)),
      overdueCount: overdue.length,
      month: sumByCurrency(thisMonth, (i) => num(i.received_amount ?? i.amount)),
    };
  }, [expected, received, today]);

  const groups = useMemo(() => {
    const sorted = [...expected].sort(
      (a, b) => (a.expected_on ?? "9999").localeCompare(b.expected_on ?? "9999") || num(b.amount) - num(a.amount),
    );
    return BUCKETS.map((b) => ({ ...b, items: sorted.filter((i) => bucketOf(i, today) === b.key) })).filter((g) => g.items.length);
  }, [expected, today]);

  const history = useMemo(() => {
    const sorted = [...received].sort((a, b) => (b.received_on ?? "").localeCompare(a.received_on ?? ""));
    const months = new Map<string, BunkerIncome[]>();
    for (const i of sorted) {
      const key = (i.received_on ?? i.updated_at).slice(0, 7);
      months.set(key, [...(months.get(key) ?? []), i]);
    }
    return [...months.entries()];
  }, [received]);

  const markReceived = async (income: BunkerIncome) => {
    const row = await incomes.update(income.id, { status: "received", received_on: today, received_amount: num(income.amount) });
    if (!row) return;
    notify(`${income.counterparty}: +${money(num(income.amount), income.currency)}`, {
      action: {
        label: "Отменить",
        run: () => void incomes.update(income.id, { status: "expected", received_on: null, received_amount: null }),
      },
    });
  };

  if (incomes.loading) return <ListSkeleton />;
  if (incomes.error) return <Empty icon={<X className="h-5 w-5" />} title="Не удалось загрузить" text={incomes.error} />;

  const usedProjects = projects.all.filter((p) => incomes.rows.some((i) => i.category === p.slug));

  return (
    <>
      {/* Итоги */}
      <Card className="mb-4 p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Ожидается</p>
        {summary.total.length === 0 ? (
          <p className="voyage-cormorant mt-2 text-3xl text-zinc-500">—</p>
        ) : (
          <div className="mt-2 space-y-1">
            {summary.total.map(([cur, v]) => (
              <p key={cur} className="voyage-cormorant text-3xl leading-tight text-white">
                {money(v, cur)}
              </p>
            ))}
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-3">
          <SummaryLine label="7 дней" value={summary.week.length ? joinSums(summary.week) : "—"} tone="text-[#e9d7a8]" />
          <SummaryLine
            label={summary.overdueCount ? `Просрочено · ${summary.overdueCount}` : "Просрочено"}
            value={summary.overdue.length ? joinSums(summary.overdue) : "—"}
            tone={summary.overdue.length ? "text-red-300" : "text-zinc-500"}
          />
          <SummaryLine label="Пришло в этом месяце" value={summary.month.length ? joinSums(summary.month) : "—"} tone="text-emerald-300" />
        </div>
      </Card>

      <Segmented<View>
        value={view}
        onChange={setView}
        options={[
          { value: "expected", label: "Ожидаются", count: expected.length },
          { value: "received", label: "Получено", count: received.length },
        ]}
      />

      {usedProjects.length > 0 && (
        <div className="bunker-scroll-x -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Chip active={!project} onClick={() => setProject(null)}>
            Все проекты
          </Chip>
          {usedProjects.map((p) => (
            <Chip key={p.id} active={project === p.slug} color={p.color} onClick={() => setProject(project === p.slug ? null : p.slug)}>
              {p.emoji} {p.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-4">
        {view === "expected" ? (
          groups.length === 0 ? (
            <Empty
              icon={<Inbox className="h-5 w-5" />}
              title="Ничего не ожидается"
              text="Добавь, кто и когда должен перевести деньги."
              action={
                <Button onClick={() => setEditing("new")}>
                  <Plus className="h-4 w-4" />
                  Добавить приход
                </Button>
              }
            />
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <section key={g.key}>
                  <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                    <p className={cx("text-[11px] font-medium uppercase tracking-[0.18em]", g.key === "overdue" ? "text-red-400" : "text-zinc-500")}>
                      {g.title} · {g.items.length}
                    </p>
                    <p className="truncate text-xs tabular-nums text-zinc-500">{joinSums(sumByCurrency(g.items, (i) => num(i.amount)))}</p>
                  </div>
                  <motion.div layout className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                    <AnimatePresence initial={false}>
                      {g.items.map((i) => (
                        <IncomeCard
                          key={i.id}
                          income={i}
                          today={today}
                          projects={projects}
                          onOpen={() => setEditing(i)}
                          onReceived={() => markReceived(i)}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </section>
              ))}
            </div>
          )
        ) : history.length === 0 ? (
          <Empty icon={<Check className="h-5 w-5" />} title="Поступлений пока нет" text="Отмеченные «Получено» приходы собираются здесь по месяцам." />
        ) : (
          <div className="space-y-5">
            {history.map(([month, items]) => (
              <section key={month}>
                <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    {new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(parseDay(`${month}-01`))}
                  </p>
                  <p className="truncate text-xs tabular-nums text-emerald-300/80">
                    +{joinSums(sumByCurrency(items, (i) => num(i.received_amount ?? i.amount)))}
                  </p>
                </div>
                <Card className="divide-y divide-white/[0.04] p-1.5">
                  {items.map((i) => (
                    <ReceivedRow key={i.id} income={i} projects={projects} onOpen={() => setEditing(i)} />
                  ))}
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>

      <Fab label="Новый приход" onClick={() => setEditing("new")}>
        <Plus className="h-6 w-6" />
      </Fab>

      <IncomeSheet
        key={editing === "new" ? "new" : editing?.id ?? "none"}
        income={editing === "new" ? null : editing}
        defaultProject={project}
        open={editing !== null}
        projects={projects}
        counterparties={[...new Set(incomes.rows.map((i) => i.counterparty))]}
        onClose={() => setEditing(null)}
        onSave={async (values, id) => {
          const row = id ? await incomes.update(id, values) : await incomes.insert(values);
          if (row) {
            setEditing(null);
            if (!id) notify(row.status === "received" ? "Поступление записано" : "Приход добавлен в ожидания");
          }
        }}
        onDelete={async (id) => {
          if (await incomes.remove(id)) setEditing(null);
        }}
      />
    </>
  );
}

function SummaryLine({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 sm:block">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className={cx("truncate font-medium tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function ProjectTag({ slug, projects }: { slug: string | null; projects: ProjectsApi }) {
  const p = slug ? projects.bySlug.get(slug) : undefined;
  if (!p) return null;
  return (
    <span className="inline-flex max-w-[45%] items-center gap-1 truncate">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.color ?? "#a1a1aa" }} />
      <span className="truncate">{p.name}</span>
    </span>
  );
}

function IncomeCard({
  income,
  today,
  projects,
  onOpen,
  onReceived,
}: {
  income: BunkerIncome;
  today: string;
  projects: ProjectsApi;
  onOpen: () => void;
  onReceived: () => void;
}) {
  const due = dueLabel(income, today);
  const color = (income.category && projects.bySlug.get(income.category)?.color) || "#c9a961";

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}>
      <Card className="flex items-stretch gap-3 p-3.5">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold uppercase"
            style={{ background: `${color}1f`, color }}
          >
            {income.counterparty.trim().charAt(0) || "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[15px] font-medium text-white">{income.counterparty}</span>
              <span className="voyage-cormorant shrink-0 text-[22px] leading-none text-[#f1e2bb]">
                {money(num(income.amount), income.currency, { compact: true })}
              </span>
            </span>
            {income.title && <span className="mt-0.5 block truncate text-xs text-zinc-500">{income.title}</span>}
            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-500">
              <span className={cx("inline-flex items-center gap-1", due.tone)}>
                <CalendarClock className="h-3.5 w-3.5" />
                {due.text}
              </span>
              <ProjectTag slug={income.category} projects={projects} />
            </span>
          </span>
        </button>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onReceived}
          aria-label={`Получено: ${income.counterparty}`}
          className="flex w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] text-[10px] font-medium text-emerald-300 transition-colors hover:bg-emerald-400/15"
        >
          <Check className="h-5 w-5" strokeWidth={2} />
          Получено
        </motion.button>
      </Card>
    </motion.div>
  );
}

function ReceivedRow({ income, projects, onOpen }: { income: BunkerIncome; projects: ProjectsApi; onOpen: () => void }) {
  const got = num(income.received_amount ?? income.amount);
  const planned = num(income.amount);
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.03]">
      <span className="w-14 shrink-0 text-xs tabular-nums text-zinc-500">
        {income.received_on ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(parseDay(income.received_on)) : "—"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-zinc-200">{income.counterparty}</span>
        <span className="flex gap-3 truncate text-[11px] text-zinc-500">
          {income.title && <span className="truncate">{income.title}</span>}
          <ProjectTag slug={income.category} projects={projects} />
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm tabular-nums text-emerald-300">+{money(got, income.currency)}</span>
        {got !== planned && <span className="block text-[11px] tabular-nums text-zinc-600">из {money(planned, income.currency)}</span>}
      </span>
    </button>
  );
}

type IncomeValues = Pick<
  BunkerIncome,
  "counterparty" | "title" | "amount" | "currency" | "status" | "expected_on" | "received_on" | "received_amount" | "category" | "notes"
>;

function endOfMonth(today: string) {
  const d = parseDay(today);
  return isoDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function IncomeSheet({
  income,
  defaultProject,
  open,
  projects,
  counterparties,
  onClose,
  onSave,
  onDelete,
}: {
  income: BunkerIncome | null;
  defaultProject: string | null;
  open: boolean;
  projects: ProjectsApi;
  counterparties: string[];
  onClose: () => void;
  onSave: (values: IncomeValues, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const today = isoDay();
  const [counterparty, setCounterparty] = useState(income?.counterparty ?? "");
  const [title, setTitle] = useState(income?.title ?? "");
  const [amount, setAmount] = useState(income ? String(num(income.amount)) : "");
  const [currency, setCurrency] = useState(income?.currency ?? "USD");
  const [status, setStatus] = useState<IncomeStatus>(income?.status ?? "expected");
  const [expectedOn, setExpectedOn] = useState(income ? (income.expected_on ?? "") : addDays(today, 7));
  const [receivedOn, setReceivedOn] = useState(income?.received_on ?? today);
  const [receivedAmount, setReceivedAmount] = useState(income?.received_amount != null ? String(num(income.received_amount)) : "");
  const [category, setCategory] = useState<string | null>(income ? income.category : defaultProject);
  const [notes, setNotes] = useState(income?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const amountNum = parseAmount(amount);
  const receivedNum = parseAmount(receivedAmount);
  const valid = counterparty.trim().length > 0 && amountNum > 0 && (status === "expected" || !receivedAmount.trim() || receivedNum >= 0);

  const quickDates: Array<[string, string]> = [
    ["Сегодня", today],
    ["Завтра", addDays(today, 1)],
    ["Через неделю", addDays(today, 7)],
    ["Конец месяца", endOfMonth(today)],
  ];

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    await onSave(
      {
        counterparty: counterparty.trim().slice(0, 200),
        title: title.trim() || null,
        amount: amountNum,
        currency,
        status,
        expected_on: expectedOn || null,
        received_on: status === "received" ? receivedOn || today : null,
        received_amount: status === "received" ? (receivedAmount.trim() && receivedNum >= 0 ? receivedNum : amountNum) : null,
        category,
        notes: notes.trim() || null,
      },
      income?.id,
    );
    setBusy(false);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={income ? income.counterparty : "Новый приход"}
      footer={
        <div className="flex gap-2">
          {income && (
            <ConfirmButton onConfirm={() => onDelete(income.id)}>
              <Trash2 className="h-4 w-4" />
            </ConfirmButton>
          )}
          <Button className="flex-1" onClick={save} disabled={!valid || busy}>
            {busy ? "Сохраняю…" : "Сохранить"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Segmented<IncomeStatus>
          value={status}
          onChange={setStatus}
          options={[
            { value: "expected", label: "Ожидается" },
            { value: "received", label: "Получено" },
          ]}
        />

        <Field label="От кого">
          <input
            autoFocus={!income}
            list="bunker-income-counterparties"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="Клиент, партнёр, компания…"
            className={inputClass}
          />
          <datalist id="bunker-income-counterparties">
            {counterparties.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="За что">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Счёт №, предоплата, комиссия…" className={inputClass} />
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Сумма">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={cx(inputClass, "voyage-cormorant h-14")}
              style={{ fontSize: 28 }}
              placeholder="0"
            />
          </Field>
          <Field label="Валюта">
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
        </div>

        <Field label="Ожидается">
          <input type="date" value={expectedOn} onChange={(e) => setExpectedOn(e.target.value)} className={cx(inputClass, "[color-scheme:dark]")} />
        </Field>
        <div className="-mt-1 flex flex-wrap gap-2">
          {quickDates.map(([label, day]) => (
            <Chip key={label} active={expectedOn === day} onClick={() => setExpectedOn(day)}>
              {label}
            </Chip>
          ))}
          <Chip active={!expectedOn} onClick={() => setExpectedOn("")}>
            Без даты
          </Chip>
        </div>

        <AnimatePresence initial={false}>
          {status === "received" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3">
                <Field label="Пришло">
                  <input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className={cx(inputClass, "[color-scheme:dark]")} />
                </Field>
                <Field label={`Сумма, ${currency}`}>
                  <input
                    inputMode="decimal"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    className={inputClass}
                    placeholder={amount || "0"}
                  />
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Проект</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={!category} onClick={() => setCategory(null)}>
              Без проекта
            </Chip>
            {projects.all.map((p) => (
              <Chip key={p.id} active={category === p.slug} color={p.color} onClick={() => setCategory(p.slug)}>
                {p.emoji} {p.name}
              </Chip>
            ))}
          </div>
        </div>

        <Field label="Комментарий">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="За что перевод, на чьей стороне согласование, реквизиты…"
            className={cx(inputClass, "resize-none")}
          />
        </Field>

        {income && (
          <p className="text-xs text-zinc-600">
            создано {shortDate(income.created_at)}
            {income.status === "received" && income.received_on ? ` · получено ${shortDate(income.received_on)}` : ""}
          </p>
        )}
      </div>
    </Sheet>
  );
}
