"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bold,
  Code,
  Eye,
  Heading1,
  Heading2,
  Italic,
  List,
  ListChecks,
  NotebookPen,
  Pencil,
  Pin,
  Plus,
  Quote,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Button,
  Chip,
  ConfirmButton,
  Empty,
  Fab,
  IconButton,
  PageHeader,
  Sheet,
  Skeleton,
  cx,
} from "@/app/bunker/_components/ui";
import { useProjects, type ProjectsApi } from "@/app/bunker/_lib/projects";
import { useBunkerRows } from "@/app/bunker/_lib/useBunkerRows";
import { plural, relativeTime } from "@/lib/bunker/format";
import { plainPreview, renderMarkdown } from "@/lib/bunker/markdown";
import type { BunkerNote } from "@/lib/bunker/types";

/* ──────────────────────────────────────────────────────────────────────
 * /bunker/notes — заметки и стратегии (Markdown).
 * Поиск по заголовку и тексту, фильтр по проектам, закреп сверху.
 * Существующая заметка сохраняется сама через секунду после правки.
 * ──────────────────────────────────────────────────────────────────── */

export default function NotesClient() {
  const notes = useBunkerRows<BunkerNote>("bunker_notes", [
    { column: "is_pinned", ascending: false },
    { column: "updated_at", ascending: false },
  ]);
  const projects = useProjects();
  const [query, setQuery] = useState("");
  const [project, setProject] = useState<string | null>(null);
  const [editing, setEditing] = useState<BunkerNote | "new" | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.rows
      .filter((n) => !project || n.category === project)
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
      .sort((a, b) => (a.is_pinned !== b.is_pinned ? (a.is_pinned ? -1 : 1) : a.updated_at < b.updated_at ? 1 : -1));
  }, [notes.rows, query, project]);

  const pinned = filtered.filter((n) => n.is_pinned);
  const rest = filtered.filter((n) => !n.is_pinned);

  return (
    <>
      <PageHeader eyebrow="Мысли" title="Заметки" subtitle={`${notes.rows.length} ${plural(notes.rows.length, ["заметка", "заметки", "заметок"])}`} />

      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-[#121215] px-4 focus-within:border-[#c9a961]/50">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по тексту…"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-zinc-600"
          type="search"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Очистить" className="text-zinc-500">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="bunker-scroll-x -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Chip active={!project} onClick={() => setProject(null)}>
          Все
        </Chip>
        {projects.all.map((p) => (
          <Chip key={p.slug} active={project === p.slug} color={p.color} onClick={() => setProject(project === p.slug ? null : p.slug)}>
            {p.emoji} {p.name}
          </Chip>
        ))}
      </div>

      <div className="mt-5">
        {notes.loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : notes.error ? (
          <Empty icon={<X className="h-5 w-5" />} title="Не удалось загрузить заметки" text={notes.error} />
        ) : filtered.length === 0 ? (
          <Empty
            icon={<NotebookPen className="h-5 w-5" />}
            title={query ? "Ничего не найдено" : "Заметок пока нет"}
            text={query ? "Попробуй другое слово." : "Стратегии, идеи, списки — с Markdown-разметкой."}
            action={!query ? <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Новая заметка</Button> : undefined}
          />
        ) : (
          <>
            {pinned.length > 0 && (
              <NoteGrid title="Закреплённые" notes={pinned} projects={projects} onOpen={setEditing} query={query} />
            )}
            {rest.length > 0 && (
              <NoteGrid title={pinned.length ? "Остальные" : undefined} notes={rest} projects={projects} onOpen={setEditing} query={query} />
            )}
          </>
        )}
      </div>

      <Fab label="Новая заметка" onClick={() => setEditing("new")}>
        <Plus className="h-6 w-6" />
      </Fab>

      <NoteEditor
        key={editing === "new" ? "new" : editing?.id ?? "none"}
        note={editing === "new" ? null : editing}
        open={editing !== null}
        defaultCategory={project}
        projects={projects}
        onClose={() => setEditing(null)}
        onCreate={(values) => notes.insert(values)}
        onUpdate={(id, values) => notes.update(id, values)}
        onDelete={async (id) => {
          if (await notes.remove(id)) setEditing(null);
        }}
      />
    </>
  );
}

function NoteGrid({
  title,
  notes,
  projects,
  onOpen,
  query,
}: {
  title?: string;
  notes: BunkerNote[];
  projects: ProjectsApi;
  onOpen: (n: BunkerNote) => void;
  query: string;
}) {
  return (
    <section className="mb-6">
      {title && <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">{title}</h2>}
      <motion.div layout className="columns-2 gap-3 md:columns-3 [&>*]:mb-3">
        <AnimatePresence initial={false}>
          {notes.map((n) => {
            const p = n.category ? projects.bySlug.get(n.category) : null;
            const preview = plainPreview(n.content, query ? 220 : 160);
            return (
              <motion.button
                key={n.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onOpen(n)}
                className={cx(
                  "block w-full break-inside-avoid rounded-2xl border bg-[#121215] p-4 text-left transition-colors md:hover:border-white/[0.12]",
                  n.is_pinned ? "border-[#c9a961]/25" : "border-white/[0.06]",
                )}
              >
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-white">{n.title || "Без названия"}</p>
                  {n.is_pinned && <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c9a961]" />}
                </div>
                {preview && <p className="mt-1.5 line-clamp-6 text-[13px] leading-relaxed text-zinc-500">{preview}</p>}
                <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-600">
                  {p && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color ?? "#a1a1aa" }} />
                      {p.name}
                    </span>
                  )}
                  <span>{relativeTime(n.updated_at)}</span>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}

type NoteValues = Pick<BunkerNote, "title" | "content" | "category" | "is_pinned">;

function NoteEditor({
  note,
  open,
  defaultCategory,
  projects,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  note: BunkerNote | null;
  open: boolean;
  defaultCategory: string | null;
  projects: ProjectsApi;
  onClose: () => void;
  onCreate: (values: NoteValues) => Promise<BunkerNote | null>;
  onUpdate: (id: string, values: Partial<NoteValues>) => Promise<BunkerNote | null>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<NoteValues>(() => ({
    title: note?.title ?? "",
    content: note?.content ?? "",
    category: note?.category ?? defaultCategory,
    is_pinned: note?.is_pinned ?? false,
  }));
  const [id, setId] = useState(note?.id ?? null);
  const [preview, setPreview] = useState(!!note?.content);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const saved = useRef(JSON.stringify(draft));
  const creating = useRef(false);

  const dirty = JSON.stringify(draft) !== saved.current;

  const persist = async () => {
    if (!dirty) return true;
    const snapshot = draft;
    if (!id) {
      if (!snapshot.title.trim() && !snapshot.content.trim()) return true;
      if (creating.current) return false;
      creating.current = true;
      setStatus("saving");
      const row = await onCreate(snapshot);
      creating.current = false;
      if (!row) return setStatus("idle"), false;
      setId(row.id);
      saved.current = JSON.stringify(snapshot);
      setStatus("saved");
      return true;
    }
    setStatus("saving");
    const row = await onUpdate(id, snapshot);
    if (row) saved.current = JSON.stringify(snapshot);
    setStatus(row ? "saved" : "idle");
    return !!row;
  };

  // Автосохранение через секунду тишины
  useEffect(() => {
    if (!open || !dirty) return;
    const t = setTimeout(() => void persist(), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, open]);

  const close = async () => {
    await persist();
    onClose();
  };

  const wrap = (before: string, after = before, placeholder = "текст") => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const selected = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    setDraft((d) => ({ ...d, content: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };

  const linePrefix = (prefix: string) => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: s, value } = el;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    setDraft((d) => ({ ...d, content: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + prefix.length, s + prefix.length);
    });
  };

  // Enter внутри списка продолжает список
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    const el = e.currentTarget;
    const { selectionStart: s, value } = el;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const line = value.slice(lineStart, s);
    const m = /^(\s*)([-*] \[[ xX]\] |[-*•] |(\d+)[.)] )(.*)$/.exec(line);
    if (!m) return;
    e.preventDefault();
    if (!m[4].trim()) {
      const next = value.slice(0, lineStart) + value.slice(s);
      setDraft((d) => ({ ...d, content: next }));
      requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
      return;
    }
    const marker = m[3] ? `${Number(m[3]) + 1}. ` : m[2].includes("[") ? "- [ ] " : m[2];
    const insert = `\n${m[1]}${marker}`;
    const next = value.slice(0, s) + insert + value.slice(s);
    setDraft((d) => ({ ...d, content: next }));
    requestAnimationFrame(() => el.setSelectionRange(s + insert.length, s + insert.length));
  };

  const tools = [
    { icon: Heading1, label: "Заголовок", run: () => linePrefix("# ") },
    { icon: Heading2, label: "Подзаголовок", run: () => linePrefix("## ") },
    { icon: Bold, label: "Жирный", run: () => wrap("**") },
    { icon: Italic, label: "Курсив", run: () => wrap("*") },
    { icon: List, label: "Список", run: () => linePrefix("- ") },
    { icon: ListChecks, label: "Чек-лист", run: () => linePrefix("- [ ] ") },
    { icon: Quote, label: "Цитата", run: () => linePrefix("> ") },
    { icon: Code, label: "Код", run: () => wrap("`") },
  ];

  return (
    <Sheet
      open={open}
      onClose={close}
      wide
      title={
        <span className="text-zinc-400">
          {status === "saving" ? "Сохраняю…" : status === "saved" && !dirty ? "Сохранено" : id ? "Заметка" : "Новая заметка"}
        </span>
      }
      footer={
        <div className="flex gap-2">
          {id && <ConfirmButton onConfirm={() => onDelete(id)}><Trash2 className="h-4 w-4" /></ConfirmButton>}
          <Button
            tone="ghost"
            onClick={() => setDraft((d) => ({ ...d, is_pinned: !d.is_pinned }))}
            className={draft.is_pinned ? "text-[#c9a961]" : undefined}
          >
            <Pin className="h-4 w-4" />
            {draft.is_pinned ? "Закреплена" : "Закрепить"}
          </Button>
          <Button className="flex-1" onClick={close}>
            Готово
          </Button>
        </div>
      }
    >
      <input
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        placeholder="Заголовок"
        // inline-размер: mobile.css ставит всем полям 16px
        style={{ fontSize: 30 }}
        className="voyage-cormorant w-full bg-transparent text-white outline-none placeholder:text-zinc-700"
      />

      <div className="bunker-scroll-x -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip active={!draft.category} onClick={() => setDraft((d) => ({ ...d, category: null }))}>
          Без проекта
        </Chip>
        {projects.all.map((p) => (
          <Chip key={p.slug} active={draft.category === p.slug} color={p.color} onClick={() => setDraft((d) => ({ ...d, category: p.slug }))}>
            {p.emoji} {p.name}
          </Chip>
        ))}
      </div>

      <div className="sticky top-0 z-10 -mx-5 mt-3 flex items-center gap-0.5 border-y border-white/[0.05] bg-[#111114]/95 px-3 py-1 backdrop-blur">
        {!preview &&
          tools.map(({ icon: Icon, label, run }) => (
            <IconButton key={label} label={label} onClick={run} className="h-9 w-9">
              <Icon className="h-4 w-4" />
            </IconButton>
          ))}
        <div className="flex-1" />
        <IconButton label={preview ? "Редактировать" : "Просмотр"} onClick={() => setPreview((v) => !v)} className="h-9 w-9 text-[#c9a961]">
          {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </IconButton>
      </div>

      {preview ? (
        <div
          className="bunker-md min-h-[40dvh] py-4"
          onDoubleClick={() => setPreview(false)}
          dangerouslySetInnerHTML={{
            __html: draft.content.trim() ? renderMarkdown(draft.content) : '<p style="color:#52525b">Пусто. Нажми карандаш, чтобы писать.</p>',
          }}
        />
      ) : (
        <textarea
          ref={textRef}
          autoFocus={!note}
          value={draft.content}
          onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
          onKeyDown={onKeyDown}
          placeholder={"Пиши свободно. Markdown:\n# Заголовок\n- список\n- [ ] задача\n**жирный**, *курсив*"}
          className="block min-h-[50dvh] w-full resize-none bg-transparent py-4 font-mono text-[14px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700"
        />
      )}
    </Sheet>
  );
}
