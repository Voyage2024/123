"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownToLine, ArrowRight, Check, Inbox, KeyRound, ListTodo, NotebookPen, Pin, Plus, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useBunkerToast } from "@/app/bunker/_components/toast";
import { Card, ProgressBar, Skeleton, cx, progressColor } from "@/app/bunker/_components/ui";
import { useBunkerRows } from "@/app/bunker/_lib/useBunkerRows";
import { currencyRank } from "@/app/bunker/finance/shared";
import { addDays, humanDay, isoDay, money, percent, relativeTime } from "@/lib/bunker/format";
import { plainPreview } from "@/lib/bunker/markdown";
import {
  PRIORITY_META,
  type BunkerDebt,
  type BunkerIncome,
  type BunkerInvestment,
  type BunkerNote,
  type BunkerTask,
} from "@/lib/bunker/types";

/* ──────────────────────────────────────────────────────────────────────
 * /bunker — хаб: фокус дня, быстрая запись во Входящие, сводка по
 * деньгам, закреплённые заметки и вход в сейф.
 * ──────────────────────────────────────────────────────────────────── */

const num = (v: unknown) => Number(v ?? 0) || 0;

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const itemAnim = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 26 } } };

export default function HubClient({ name }: { name: string | null }) {
  const notify = useBunkerToast();
  const tasks = useBunkerRows<BunkerTask>("bunker_tasks", [{ column: "created_at", ascending: false }]);
  const debts = useBunkerRows<BunkerDebt>("bunker_debts");
  const investments = useBunkerRows<BunkerInvestment>("bunker_investments");
  const incomes = useBunkerRows<BunkerIncome>("bunker_incomes", [{ column: "expected_on", ascending: true }]);
  const notes = useBunkerRows<BunkerNote>("bunker_notes", [{ column: "updated_at", ascending: false }]);
  const [quick, setQuick] = useState("");

  const today = isoDay();
  const focus = useMemo(
    () =>
      tasks.rows
        .filter((t) => t.status === "open" && t.due_date && t.due_date <= today)
        .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || a.priority - b.priority),
    [tasks.rows, today],
  );
  const doneToday = tasks.rows.filter((t) => t.status === "done" && (t.completed_at ?? "").slice(0, 10) === today).length;
  const inboxCount = tasks.rows.filter((t) => t.status === "open" && !t.category && !t.due_date).length;
  const dayPct = focus.length + doneToday ? (doneToday / (focus.length + doneToday)) * 100 : 0;

  const debtByCurrency = useMemo(() => {
    const map = new Map<string, { total: number; paid: number }>();
    for (const d of debts.rows) {
      if (d.status === "paid") continue;
      const t = map.get(d.currency) ?? { total: 0, paid: 0 };
      t.total += num(d.total_amount);
      t.paid += num(d.paid_amount);
      map.set(d.currency, t);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [debts.rows]);

  const portfolio = useMemo(() => {
    const map = new Map<string, { invested: number; current: number }>();
    for (const i of investments.rows) {
      const t = map.get(i.currency) ?? { invested: 0, current: 0 };
      t.invested += num(i.initial_amount);
      t.current += num(i.current_value);
      map.set(i.currency, t);
    }
    return [...map.entries()].sort((a, b) => b[1].current - a[1].current);
  }, [investments.rows]);

  // Приходы на 30 дней вперёд (и просроченные) — по валютам, плюс ближайший
  const incoming = useMemo(() => {
    const horizon = addDays(today, 30);
    const soon = incomes.rows.filter((i) => i.status === "expected" && (!i.expected_on || i.expected_on <= horizon));
    const map = new Map<string, number>();
    for (const i of soon) map.set(i.currency, (map.get(i.currency) ?? 0) + num(i.amount));
    const next = soon
      .filter((i) => i.expected_on)
      .sort((a, b) => a.expected_on!.localeCompare(b.expected_on!))[0];
    const overdue = soon.filter((i) => i.expected_on && i.expected_on < today).length;
    return { sums: [...map.entries()].sort((a, b) => currencyRank(a[0]) - currencyRank(b[0])), next, overdue };
  }, [incomes.rows, today]);

  const pinnedNotes = notes.rows.filter((n) => n.is_pinned).slice(0, 4);
  const shownNotes = pinnedNotes.length ? pinnedNotes : notes.rows.slice(0, 2);

  const capture = async () => {
    const title = quick.trim();
    if (!title) return;
    const row = await tasks.insert({ title, priority: 3, subtasks: [] });
    if (row) {
      setQuick("");
      notify("Записано во Входящие");
    }
  };

  const complete = (t: BunkerTask) => tasks.update(t.id, { status: "done" });

  const dateLine = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      <motion.header variants={itemAnim} className="mb-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9a961]/80">{dateLine}</p>
        <h1 className="voyage-cormorant mt-1 text-[40px] font-medium leading-[1.05] text-white md:text-5xl">
          {greeting()}
          {name ? <span className="text-zinc-500">, {name.split(" ")[0]}</span> : null}
        </h1>
      </motion.header>

      {/* Быстрая запись */}
      <motion.form
        variants={itemAnim}
        onSubmit={(e) => {
          e.preventDefault();
          void capture();
        }}
        className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-[#121215] py-1.5 pl-4 pr-1.5 focus-within:border-[#c9a961]/50"
      >
        <Inbox className="h-4 w-4 shrink-0 text-[#c9a961]" />
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Мысль на лету → во Входящие"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-zinc-600"
          enterKeyHint="done"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="submit"
          disabled={!quick.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c9a961] text-black disabled:bg-white/[0.05] disabled:text-zinc-600"
          aria-label="Записать"
        >
          <Plus className="h-4 w-4" />
        </motion.button>
      </motion.form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Фокус дня */}
        <motion.div variants={itemAnim} className="md:row-span-3">
          <Card className="h-full p-5">
            <div className="flex items-center justify-between">
              <SectionTitle icon={<ListTodo className="h-4 w-4" />} title="Фокус дня" href="/bunker/tasks" />
              <span className="text-xs tabular-nums text-zinc-500">
                {doneToday}/{focus.length + doneToday}
              </span>
            </div>
            <ProgressBar value={dayPct} className="mt-3" />
            <div className="mt-4 space-y-1">
              {tasks.loading ? (
                [0, 1, 2].map((i) => <Skeleton key={i} className="h-11" />)
              ) : focus.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">
                  {doneToday ? "Всё на сегодня закрыто. Сильно." : "На сегодня задач нет."}
                </p>
              ) : (
                <AnimatePresence initial={false}>
                  {focus.slice(0, 7).map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: 40 }}
                      className="flex items-center gap-3 rounded-xl px-1 py-2"
                    >
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => complete(t)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                        style={{ borderColor: PRIORITY_META[t.priority].color }}
                        aria-label="Выполнить"
                      >
                        <Check className="h-3 w-3 text-transparent" />
                      </motion.button>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-zinc-200">{t.title}</span>
                      {t.is_pinned && <Pin className="h-3 w-3 shrink-0 text-[#c9a961]" />}
                      {t.due_date! < today && <span className="shrink-0 text-[11px] text-red-400">{humanDay(t.due_date!, today)}</span>}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
              {focus.length > 7 && (
                <Link href="/bunker/tasks" className="block pt-1 text-xs text-zinc-500">
                  и ещё {focus.length - 7}…
                </Link>
              )}
            </div>
            {inboxCount > 0 && (
              <Link
                href="/bunker/tasks"
                className="mt-4 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-400"
              >
                <span className="inline-flex items-center gap-2">
                  <Inbox className="h-4 w-4" /> Во Входящих
                </span>
                <span className="tabular-nums text-[#e9d7a8]">{inboxCount}</span>
              </Link>
            )}
          </Card>
        </motion.div>

        {/* Приходы */}
        <motion.div variants={itemAnim}>
          <Card className="h-full p-5">
            <div className="flex items-center justify-between">
              <SectionTitle icon={<ArrowDownToLine className="h-4 w-4" />} title="Приходы · 30 дней" href="/bunker/finance" />
              {incoming.overdue > 0 && <span className="text-[11px] text-red-400">просрочено {incoming.overdue}</span>}
            </div>
            {incomes.loading ? (
              <Skeleton className="mt-4 h-16" />
            ) : incoming.sums.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">Ничего не ожидается.</p>
            ) : (
              <div className="mt-3 space-y-1">
                {incoming.sums.slice(0, 2).map(([cur, v]) => (
                  <p key={cur} className="voyage-cormorant text-2xl text-white">
                    {money(v, cur)}
                  </p>
                ))}
                {incoming.next && (
                  <p className="truncate pt-1 text-xs text-zinc-500">
                    ближайший: <span className="text-zinc-300">{incoming.next.counterparty}</span> ·{" "}
                    {money(num(incoming.next.amount), incoming.next.currency, { compact: true })} ·{" "}
                    <span className={incoming.next.expected_on! < today ? "text-red-400" : "text-[#e9d7a8]"}>
                      {humanDay(incoming.next.expected_on!, today)}
                    </span>
                  </p>
                )}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Долги */}
        <motion.div variants={itemAnim}>
          <Card className="h-full p-5">
            <SectionTitle icon={<Wallet className="h-4 w-4" />} title="Долги" href="/bunker/finance?tab=debts" />
            {debts.loading ? (
              <Skeleton className="mt-4 h-16" />
            ) : debtByCurrency.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">Обязательств нет.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {debtByCurrency.slice(0, 2).map(([cur, t]) => {
                  const pct = t.total ? (t.paid / t.total) * 100 : 0;
                  return (
                    <div key={cur}>
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="voyage-cormorant text-2xl text-white">{money(t.total - t.paid, cur)}</span>
                        <span className="text-xs" style={{ color: progressColor(pct) }}>
                          {Math.round(pct)}%
                        </span>
                      </div>
                      <ProgressBar value={pct} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Портфель */}
        <motion.div variants={itemAnim}>
          <Card className="h-full p-5">
            <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="Портфель" href="/bunker/finance?tab=investments" />
            {investments.loading ? (
              <Skeleton className="mt-4 h-16" />
            ) : portfolio.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">Активов пока нет.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {portfolio.slice(0, 2).map(([cur, t]) => {
                  const roi = t.invested ? ((t.current - t.invested) / t.invested) * 100 : 0;
                  return (
                    <div key={cur} className="flex items-baseline justify-between gap-3">
                      <span className="voyage-cormorant text-2xl text-white">{money(t.current, cur)}</span>
                      <span className={cx("text-sm tabular-nums", roi >= 0 ? "text-emerald-300" : "text-red-300")}>{percent(roi)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Заметки */}
        <motion.div variants={itemAnim}>
          <Card className="h-full p-5">
            <SectionTitle icon={<NotebookPen className="h-4 w-4" />} title={pinnedNotes.length ? "Закреплённые заметки" : "Последние заметки"} href="/bunker/notes" />
            {notes.loading ? (
              <Skeleton className="mt-4 h-20" />
            ) : shownNotes.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">Заметок пока нет.</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {shownNotes.map((n) => (
                  <Link key={n.id} href="/bunker/notes" className="rounded-xl bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
                    <p className="truncate text-sm font-medium text-zinc-100">{n.title || "Без названия"}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{plainPreview(n.content, 100)}</p>
                    <p className="mt-2 text-[11px] text-zinc-600">{relativeTime(n.updated_at)}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Сейф */}
        <motion.div variants={itemAnim}>
          <Link href="/bunker/vault" className="block h-full">
            <Card className="group relative h-full overflow-hidden p-5">
              <div
                aria-hidden
                className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#c9a961]/10 blur-2xl transition-opacity group-hover:opacity-80"
              />
              <KeyRound className="relative h-6 w-6 text-[#c9a961]" strokeWidth={1.5} />
              <p className="voyage-cormorant relative mt-4 text-2xl text-white">Сейф</p>
              <p className="relative mt-1 text-xs text-zinc-500">AES-256-GCM · шифрование прямо в браузере</p>
              <span className="relative mt-4 inline-flex items-center gap-1 text-sm text-[#e9d7a8]">
                Открыть <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Card>
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}

function SectionTitle({ icon, title, href }: { icon: React.ReactNode; title: string; href: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
      <span className="text-[#c9a961]">{icon}</span>
      {title}
      <ArrowRight className="h-3 w-3 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
    </Link>
  );
}
