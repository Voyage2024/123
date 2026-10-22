"use client";

import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Circle,
  Inbox,
  ListChecks,
  Pin,
  PinOff,
  Plus,
  Settings2,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { useBunkerToast } from "@/app/bunker/_components/toast";
import {
  Button,
  Chip,
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
import { ProjectsSheet, useProjects, type ProjectsApi } from "@/app/bunker/_lib/projects";
import { useBunkerRows } from "@/app/bunker/_lib/useBunkerRows";
import { addDays, daysBetween, humanDay, isoDay, uid, weekdayShort } from "@/lib/bunker/format";
import { BUILTIN_PROJECT_HINTS, PRIORITY_META, type BunkerTask, type Subtask, type TaskPriority } from "@/lib/bunker/types";

/* ──────────────────────────────────────────────────────────────────────
 * /bunker/tasks — планер в духе Things 3.
 *
 *   Сегодня     — открытые с дедлайном сегодня и просроченные;
 *   Предстоящие — неделя-лента + группы по дням;
 *   Входящие    — без проекта и без даты (быстрые мысли);
 *   Все         — открытые по проектам.
 *
 * Быстрый ввод понимает «!1 / !2 / !3» (приоритет) и «#voyage» (проект).
 * Свайп вправо — выполнено, влево — закрепить.
 * ──────────────────────────────────────────────────────────────────── */

type View = "today" | "upcoming" | "inbox" | "all";

const VIEW_HINT: Record<View, string> = {
  today: "Горящее на сегодня и всё просроченное",
  upcoming: "Фокус на неделю вперёд",
  inbox: "Быстрые мысли — разберёшь потом",
  all: "Все открытые задачи по проектам",
};

function sortTasks(a: BunkerTask, b: BunkerTask) {
  if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  if ((a.due_date ?? "9") !== (b.due_date ?? "9")) return (a.due_date ?? "9") < (b.due_date ?? "9") ? -1 : 1;
  return a.created_at < b.created_at ? 1 : -1;
}

function parseQuickAdd(text: string, projects: ProjectsApi) {
  let priority: TaskPriority | null = null;
  let category: string | null = null;
  const title = text
    .replace(/(^|\s)!([123])(?=\s|$)/g, (_, pre: string, p: string) => {
      priority = Number(p) as TaskPriority;
      return pre;
    })
    .replace(/(^|\s)#([\p{L}\p{N}-]+)/gu, (m, pre: string, tag: string) => {
      const needle = tag.toLowerCase();
      const hit = projects.all.find((p) => p.slug === needle || p.name.toLowerCase().startsWith(needle));
      if (!hit) return m;
      category = hit.slug;
      return pre;
    })
    .replace(/\s+/g, " ")
    .trim();
  return { title, priority: priority as TaskPriority | null, category: category as string | null };
}

export default function TasksClient() {
  const notify = useBunkerToast();
  const tasks = useBunkerRows<BunkerTask>("bunker_tasks", [{ column: "created_at", ascending: false }]);
  const projects = useProjects();

  const [view, setView] = useState<View>("today");
  const [project, setProject] = useState<string | null>(null);
  const [editing, setEditing] = useState<BunkerTask | "new" | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [quick, setQuick] = useState("");
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const quickRef = useRef<HTMLInputElement>(null);

  const today = isoDay();

  const inProject = (t: BunkerTask) => !project || t.category === project;
  const open = tasks.rows.filter((t) => t.status === "open" && inProject(t));

  const lists = useMemo(() => {
    const todayList = open.filter((t) => t.due_date && t.due_date <= today).sort(sortTasks);
    const upcoming = open.filter((t) => t.due_date && t.due_date > today).sort(sortTasks);
    const inbox = open.filter((t) => !t.category && !t.due_date).sort(sortTasks);
    return { todayList, upcoming, inbox };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.rows, project, today]);

  const doneRecently = tasks.rows
    .filter((t) => t.status === "done" && inProject(t))
    .filter((t) => (view === "today" ? (t.completed_at ?? "").slice(0, 10) === today || t.due_date === today : true))
    .sort((a, b) => ((a.completed_at ?? "") < (b.completed_at ?? "") ? 1 : -1))
    .slice(0, 30);

  const counts = {
    today: open.filter((t) => t.due_date && t.due_date <= today).length,
    upcoming: lists.upcoming.length,
    inbox: lists.inbox.length,
    all: open.length,
  };

  const complete = async (task: BunkerTask) => {
    const next = task.status === "done" ? "open" : "done";
    const row = await tasks.update(task.id, { status: next });
    if (row && next === "done") {
      notify(`«${task.title.slice(0, 40)}» — готово`, {
        action: { label: "Вернуть", run: () => void tasks.update(task.id, { status: "open" }) },
      });
    }
  };

  const togglePin = (task: BunkerTask) => tasks.update(task.id, { is_pinned: !task.is_pinned });

  const submitQuick = async () => {
    const parsed = parseQuickAdd(quick, projects);
    if (!parsed.title) return;
    const due =
      view === "today" ? today : view === "upcoming" ? pickedDay ?? addDays(today, 1) : null;
    const row = await tasks.insert({
      title: parsed.title,
      priority: parsed.priority ?? 3,
      category: parsed.category ?? (view === "inbox" ? null : project),
      due_date: view === "inbox" && !parsed.category ? null : due,
      subtasks: [],
    });
    if (row) setQuick("");
  };

  const upcomingDays = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
  const upcomingGroups = useMemo(() => {
    const groups = new Map<string, BunkerTask[]>();
    for (const t of lists.upcoming) {
      if (pickedDay && t.due_date !== pickedDay) continue;
      const key = daysBetween(today, t.due_date!) <= 14 ? t.due_date! : "later";
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    return [...groups.entries()].sort(([a], [b]) => (a === "later" ? 1 : b === "later" ? -1 : a < b ? -1 : 1));
  }, [lists.upcoming, pickedDay, today]);

  const allGroups = useMemo(() => {
    const groups = new Map<string, BunkerTask[]>();
    for (const t of [...open].sort(sortTasks)) groups.set(t.category ?? "", [...(groups.get(t.category ?? "") ?? []), t]);
    const order = (slug: string) => {
      if (!slug) return -1;
      const i = projects.all.findIndex((p) => p.slug === slug);
      return i === -1 ? 999 : i;
    };
    return [...groups.entries()].sort(([a], [b]) => order(a) - order(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.rows, project, projects.all]);

  const row = (t: BunkerTask) => (
    <TaskRow
      key={t.id}
      task={t}
      today={today}
      projects={projects}
      onToggle={() => complete(t)}
      onPin={() => togglePin(t)}
      onOpen={() => setEditing(t)}
    />
  );

  const overdue = lists.todayList.filter((t) => t.due_date! < today);
  const dueToday = lists.todayList.filter((t) => t.due_date === today);

  return (
    <>
      <PageHeader
        eyebrow="Планер"
        title="Задачи"
        subtitle={VIEW_HINT[view]}
        action={
          <IconButton label="Проекты" onClick={() => setProjectsOpen(true)}>
            <Settings2 className="h-5 w-5" />
          </IconButton>
        }
      />

      <Segmented
        value={view}
        onChange={(v) => {
          setView(v);
          setPickedDay(null);
        }}
        options={[
          { value: "today", label: <span className="inline-flex items-center gap-1.5"><Sun className="hidden h-3.5 w-3.5 sm:block" />Сегодня</span>, count: counts.today },
          { value: "upcoming", label: <span className="inline-flex items-center gap-1.5"><CalendarDays className="hidden h-3.5 w-3.5 sm:block" /><span className="hidden sm:inline">Предстоящие</span><span className="sm:hidden">Скоро</span></span>, count: counts.upcoming },
          { value: "inbox", label: <span className="inline-flex items-center gap-1.5"><Inbox className="hidden h-3.5 w-3.5 sm:block" />Входящие</span>, count: counts.inbox },
          { value: "all", label: "Все" },
        ]}
      />

      <div className="bunker-scroll-x -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Chip active={!project} onClick={() => setProject(null)}>
          Все проекты
        </Chip>
        {projects.all.map((p) => (
          <Chip key={p.slug} active={project === p.slug} color={p.color} onClick={() => setProject(project === p.slug ? null : p.slug)}>
            <span>{p.emoji}</span>
            {p.name}
          </Chip>
        ))}
        <Chip onClick={() => setProjectsOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Проект
        </Chip>
      </div>
      {project && BUILTIN_PROJECT_HINTS[project] && (
        <p className="mt-2 text-xs text-zinc-600">{BUILTIN_PROJECT_HINTS[project]}</p>
      )}

      {/* Быстрый ввод */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitQuick();
        }}
        className="mt-4 flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-[#121215] py-1.5 pl-4 pr-1.5 focus-within:border-[#c9a961]/50"
      >
        <Plus className="h-4 w-4 shrink-0 text-[#c9a961]" />
        <input
          ref={quickRef}
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder={
            view === "inbox"
              ? "Мысль на лету…"
              : view === "upcoming"
                ? `Задача на ${humanDay(pickedDay ?? addDays(today, 1)).toLowerCase()}…`
                : "Новая задача на сегодня…  !1  #voyage"
          }
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-zinc-600"
          enterKeyHint="done"
        />
        <AnimatePresence>
          {quick.trim() && (
            <motion.button
              type="submit"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c9a961] text-black"
              aria-label="Добавить"
            >
              <Check className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </form>

      {view === "upcoming" && (
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {upcomingDays.map((day) => {
            const n = lists.upcoming.filter((t) => t.due_date === day).length;
            const active = pickedDay === day;
            return (
              <motion.button
                key={day}
                whileTap={{ scale: 0.92 }}
                onClick={() => setPickedDay(active ? null : day)}
                className={cx(
                  "flex flex-col items-center rounded-2xl border py-2 transition-colors",
                  active ? "border-[#c9a961]/60 bg-[#c9a961]/15" : "border-white/[0.06] bg-[#121215]",
                )}
              >
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">{weekdayShort(day)}</span>
                <span className={cx("text-lg font-medium tabular-nums", active ? "text-[#f1e2bb]" : "text-zinc-200")}>
                  {Number(day.slice(8))}
                </span>
                <span className="mt-0.5 flex h-1.5 gap-0.5">
                  {Array.from({ length: Math.min(n, 3) }).map((_, i) => (
                    <span key={i} className="h-1 w-1 rounded-full bg-[#c9a961]" />
                  ))}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}

      <div className="mt-5">
        {tasks.loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[62px]" />
            ))}
          </div>
        ) : tasks.error ? (
          <Empty icon={<X className="h-5 w-5" />} title="Не удалось загрузить задачи" text={tasks.error} />
        ) : (
          <>
            {view === "today" && (
              <>
                {overdue.length > 0 && (
                  <Section title="Просрочено" tone="danger" count={overdue.length}>
                    {overdue.map(row)}
                  </Section>
                )}
                <Section title={overdue.length ? "Сегодня" : undefined}>
                  {dueToday.map(row)}
                </Section>
                {lists.todayList.length === 0 && (
                  <Empty
                    icon={<Sun className="h-5 w-5" />}
                    title="На сегодня всё чисто"
                    text="Добавь задачу выше или перенеси что-нибудь из Входящих."
                  />
                )}
              </>
            )}

            {view === "upcoming" &&
              (upcomingGroups.length ? (
                upcomingGroups.map(([day, list]) => (
                  <Section key={day} title={day === "later" ? "Позже" : humanDay(day, today)} count={list.length}>
                    {list.map(row)}
                  </Section>
                ))
              ) : (
                <Empty icon={<CalendarDays className="h-5 w-5" />} title="Впереди пусто" text="Запланируй что-нибудь на неделю." />
              ))}

            {view === "inbox" &&
              (lists.inbox.length ? (
                <Section>{lists.inbox.map(row)}</Section>
              ) : (
                <Empty icon={<Inbox className="h-5 w-5" />} title="Входящие разобраны" text="Записывай сюда всё, что приходит в голову." />
              ))}

            {view === "all" &&
              (allGroups.length ? (
                allGroups.map(([slug, list]) => {
                  const p = projects.bySlug.get(slug);
                  return (
                    <Section key={slug || "none"} title={p ? `${p.emoji ?? ""} ${p.name}` : slug ? `#${slug}` : "Без проекта"} count={list.length}>
                      {list.map(row)}
                    </Section>
                  );
                })
              ) : (
                <Empty icon={<ListChecks className="h-5 w-5" />} title="Открытых задач нет" />
              ))}

            {doneRecently.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setShowDone((v) => !v)}
                  className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-300"
                >
                  <ChevronDown className={cx("h-4 w-4 transition-transform", showDone && "rotate-180")} />
                  Выполнено · {doneRecently.length}
                </button>
                <AnimatePresence initial={false}>
                  {showDone && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 space-y-2">{doneRecently.map(row)}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>

      <Fab label="Новая задача" onClick={() => setEditing("new")}>
        <Plus className="h-6 w-6" />
      </Fab>

      <TaskSheet
        key={editing === "new" ? "new" : editing?.id ?? "none"}
        task={editing}
        defaults={{
          category: project,
          due_date: view === "today" ? today : view === "upcoming" ? pickedDay ?? addDays(today, 1) : null,
        }}
        projects={projects}
        onClose={() => setEditing(null)}
        onSave={async (values, id) => {
          const saved = id ? await tasks.update(id, values) : await tasks.insert(values);
          if (saved) setEditing(null);
        }}
        onDelete={async (id) => {
          if (await tasks.remove(id)) setEditing(null);
        }}
      />
      <ProjectsSheet open={projectsOpen} onClose={() => setProjectsOpen(false)} projects={projects} />
    </>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title?: string;
  count?: number;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      {title && (
        <h2
          className={cx(
            "mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em]",
            tone === "danger" ? "text-red-400/90" : "text-zinc-500",
          )}
        >
          {title}
          {count !== undefined && <span className="tabular-nums text-zinc-600">{count}</span>}
        </h2>
      )}
      <motion.div layout className="space-y-2">
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </motion.div>
    </section>
  );
}

function TaskRow({
  task,
  today,
  projects,
  onToggle,
  onPin,
  onOpen,
}: {
  task: BunkerTask;
  today: string;
  projects: ProjectsApi;
  onToggle: () => void;
  onPin: () => void;
  onOpen: () => void;
}) {
  const x = useMotionValue(0);
  const doneOpacity = useTransform(x, [20, 90], [0, 1]);
  const pinOpacity = useTransform(x, [-20, -90], [0, 1]);
  const dragged = useRef(false);

  const project = task.category ? projects.bySlug.get(task.category) : null;
  const subDone = task.subtasks.filter((s) => s.done).length;
  const done = task.status === "done";
  const overdue = !done && task.due_date && task.due_date < today;
  const prio = PRIORITY_META[task.priority];

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 90) onToggle();
    else if (info.offset.x < -90) onPin();
    setTimeout(() => (dragged.current = false), 0);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
      className="relative overflow-hidden rounded-2xl"
    >
      <motion.div style={{ opacity: doneOpacity }} className="absolute inset-0 flex items-center bg-emerald-500/20 pl-5 text-emerald-300">
        <Check className="h-5 w-5" />
      </motion.div>
      <motion.div style={{ opacity: pinOpacity }} className="absolute inset-0 flex items-center justify-end bg-[#c9a961]/20 pr-5 text-[#c9a961]">
        {task.is_pinned ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />}
      </motion.div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragSnapToOrigin
        dragMomentum={false}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={onDragEnd}
        style={{ x, touchAction: "pan-y" }}
        className={cx(
          "relative flex items-start gap-3 rounded-2xl border bg-[#121215] px-3.5 py-3",
          task.is_pinned ? "border-[#c9a961]/25" : "border-white/[0.06]",
        )}
      >
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={onToggle}
          aria-label={done ? "Вернуть в работу" : "Выполнить"}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
          style={{ borderColor: done ? "#c9a961" : prio.color, background: done ? "#c9a961" : "transparent" }}
        >
          <AnimatePresence>
            {done && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Check className="h-3.5 w-3.5 text-black" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <button className="min-w-0 flex-1 text-left" onClick={() => !dragged.current && onOpen()}>
          <span className={cx("block text-[15px] leading-snug", done ? "text-zinc-500 line-through" : "text-zinc-100")}>
            {task.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-500">
            {task.priority < 3 && (
              <span className="font-medium" style={{ color: prio.color }}>
                {prio.short}
              </span>
            )}
            {task.due_date && (
              <span className={cx("inline-flex items-center gap-1", overdue && "text-red-400")}>
                <CalendarDays className="h-3 w-3" />
                {humanDay(task.due_date, today)}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListChecks className="h-3 w-3" />
                {subDone}/{task.subtasks.length}
              </span>
            )}
            {project && (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: project.color ?? "#a1a1aa" }} />
                {project.name}
              </span>
            )}
          </span>
        </button>

        {task.is_pinned && <Pin className="mt-1 h-3.5 w-3.5 shrink-0 text-[#c9a961]" />}
      </motion.div>
    </motion.div>
  );
}

type TaskValues = Pick<BunkerTask, "title" | "description" | "priority" | "category" | "due_date" | "subtasks" | "is_pinned" | "status">;

function TaskSheet({
  task,
  defaults,
  projects,
  onClose,
  onSave,
  onDelete,
}: {
  task: BunkerTask | "new" | null;
  defaults: { category: string | null; due_date: string | null };
  projects: ProjectsApi;
  onClose: () => void;
  onSave: (values: TaskValues, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const existing = task && task !== "new" ? task : null;
  const [draft, setDraft] = useState<TaskValues>(() =>
    existing
      ? {
          title: existing.title,
          description: existing.description,
          priority: existing.priority,
          category: existing.category,
          due_date: existing.due_date,
          subtasks: existing.subtasks,
          is_pinned: existing.is_pinned,
          status: existing.status,
        }
      : { title: "", description: "", priority: 3, category: defaults.category, due_date: defaults.due_date, subtasks: [], is_pinned: false, status: "open" },
  );
  const [newSub, setNewSub] = useState("");
  const [saving, setSaving] = useState(false);
  const today = isoDay();

  const set = <K extends keyof TaskValues>(key: K, value: TaskValues[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setSubs = (fn: (list: Subtask[]) => Subtask[]) => setDraft((d) => ({ ...d, subtasks: fn(d.subtasks) }));

  const addSub = () => {
    const title = newSub.trim();
    if (!title) return;
    setSubs((list) => [...list, { id: uid(), title, done: false }]);
    setNewSub("");
  };

  const save = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    await onSave({ ...draft, title: draft.title.trim(), description: draft.description?.trim() || null }, existing?.id);
    setSaving(false);
  };

  return (
    <Sheet
      open={task !== null}
      onClose={onClose}
      title={existing ? "Задача" : "Новая задача"}
      footer={
        <div className="flex gap-2">
          {existing && (
            <ConfirmButton onConfirm={() => onDelete(existing.id)}>
              <Trash2 className="h-4 w-4" />
            </ConfirmButton>
          )}
          {existing && (
            <Button tone="ghost" onClick={() => set("status", draft.status === "done" ? "open" : "done")}>
              {draft.status === "done" ? <Circle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {draft.status === "done" ? "Открыть" : "Готово"}
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={!draft.title.trim() || saving}>
            {saving ? "Сохраняю…" : "Сохранить"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <input
          autoFocus={!existing}
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Что нужно сделать?"
          style={{ fontSize: 20 }}
          className="w-full bg-transparent font-medium text-white outline-none placeholder:text-zinc-600"
        />
        <textarea
          value={draft.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Заметки к задаче…"
          rows={3}
          className={cx(inputClass, "resize-none")}
        />

        <Field label="Приоритет">
          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 3] as TaskPriority[]).map((p) => (
              <motion.button
                key={p}
                whileTap={{ scale: 0.95 }}
                onClick={() => set("priority", p)}
                className={cx(
                  "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm transition-colors",
                  draft.priority === p ? "border-white/20 bg-white/[0.07] text-white" : "border-white/[0.06] text-zinc-500",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PRIORITY_META[p].color }} />
                {PRIORITY_META[p].short} · {PRIORITY_META[p].label}
              </motion.button>
            ))}
          </div>
        </Field>

        <Field label="Срок">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Сегодня", value: today },
              { label: "Завтра", value: addDays(today, 1) },
              { label: "Через неделю", value: addDays(today, 7) },
              { label: "Без даты", value: null },
            ].map((o) => (
              <Chip key={o.label} active={draft.due_date === o.value} onClick={() => set("due_date", o.value)}>
                {o.label}
              </Chip>
            ))}
            <input
              type="date"
              value={draft.due_date ?? ""}
              onChange={(e) => set("due_date", e.target.value || null)}
              className={cx(inputClass, "h-9 w-auto rounded-full py-0 text-[13px] [color-scheme:dark]")}
            />
          </div>
        </Field>

        <Field label="Проект">
          <div className="flex flex-wrap gap-2">
            <Chip active={!draft.category} onClick={() => set("category", null)}>
              Без проекта
            </Chip>
            {projects.all.map((p) => (
              <Chip key={p.slug} active={draft.category === p.slug} color={p.color} onClick={() => set("category", p.slug)}>
                {p.emoji} {p.name}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label={`Чек-лист${draft.subtasks.length ? ` · ${draft.subtasks.filter((s) => s.done).length}/${draft.subtasks.length}` : ""}`}>
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {draft.subtasks.map((s) => (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2"
                >
                  <button
                    onClick={() => setSubs((list) => list.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                    className={cx(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2",
                      s.done ? "border-[#c9a961] bg-[#c9a961]" : "border-zinc-600",
                    )}
                    aria-label="Отметить"
                  >
                    {s.done && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
                  </button>
                  <input
                    value={s.title}
                    onChange={(e) => setSubs((list) => list.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
                    className={cx("min-w-0 flex-1 bg-transparent text-sm outline-none", s.done ? "text-zinc-500 line-through" : "text-zinc-200")}
                  />
                  <button onClick={() => setSubs((list) => list.filter((x) => x.id !== s.id))} aria-label="Удалить пункт" className="text-zinc-600 hover:text-red-300">
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="flex items-center gap-2">
              <input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSub();
                  }
                }}
                placeholder="Добавить пункт…"
                className={inputClass}
              />
              <IconButton label="Добавить пункт" onClick={addSub} className="bg-white/[0.04]">
                <Plus className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </Field>

        <button
          onClick={() => set("is_pinned", !draft.is_pinned)}
          className={cx(
            "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
            draft.is_pinned ? "border-[#c9a961]/40 bg-[#c9a961]/10 text-[#f1e2bb]" : "border-white/[0.06] text-zinc-400",
          )}
        >
          <Pin className="h-4 w-4" />
          {draft.is_pinned ? "Закреплена наверху" : "Закрепить наверху"}
        </button>
      </div>
    </Sheet>
  );
}
