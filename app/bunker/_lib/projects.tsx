"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, Field, IconButton, Sheet, cx, inputClass } from "@/app/bunker/_components/ui";
import { useBunkerRows } from "@/app/bunker/_lib/useBunkerRows";
import { slugify } from "@/lib/bunker/format";
import type { BunkerProject } from "@/lib/bunker/types";

/* Проекты — строки bunker_projects (в режиме Duress — камуфляжные).
 * В задачах и заметках хранится slug проекта (category). */

export function useProjects() {
  const custom = useBunkerRows<BunkerProject>("bunker_projects", [{ column: "sort" }, { column: "created_at" }]);
  const all = useMemo(() => [...custom.rows].sort((a, b) => a.sort - b.sort), [custom.rows]);
  const bySlug = useMemo(() => new Map(all.map((p) => [p.slug, p])), [all]);
  return { all, custom, bySlug };
}

export type ProjectsApi = ReturnType<typeof useProjects>;

const PALETTE = ["#c9a961", "#6ee7b7", "#93c5fd", "#c4b5fd", "#fda4af", "#fcd34d", "#5eead4", "#a1a1aa"];

export function ProjectsSheet({ open, onClose, projects }: { open: boolean; onClose: () => void; projects: ProjectsApi }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("◆");
  const [color, setColor] = useState(PALETTE[0]);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    let slug = slugify(trimmed);
    if (projects.bySlug.has(slug)) slug = `${slug.slice(0, 33)}-${Date.now().toString(36).slice(-5)}`;
    setBusy(true);
    const row = await projects.custom.insert({
      slug,
      name: trimmed.slice(0, 40),
      emoji: emoji.trim().slice(0, 8) || null,
      color,
      sort: projects.custom.rows.length + 10,
    });
    setBusy(false);
    if (row) {
      projects.custom.setRows((list) => [...list.filter((p) => p.id !== row.id), row]);
      setName("");
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Проекты и теги">
      <div className="space-y-2">
        {projects.all.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
            <span className="w-6 text-center text-lg">{p.emoji ?? "◆"}</span>
            <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? "#a1a1aa" }} />
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{p.name}</span>
            <IconButton label="Удалить проект" onClick={() => projects.custom.remove(p.id)}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-white/[0.06] p-4">
        <p className="text-sm font-medium text-zinc-300">Новый проект / тег</p>
        <div className="flex gap-3">
          <Field label="Иконка">
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className={cx(inputClass, "w-16 text-center")} />
          </Field>
          <div className="flex-1">
            <Field label="Название">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Например, Бали-2027"
                className={inputClass}
              />
            </Field>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cx("h-8 w-8 rounded-full border-2 transition-transform", color === c ? "scale-110 border-white" : "border-transparent")}
              style={{ background: c }}
            />
          ))}
        </div>
        <Button onClick={create} disabled={!name.trim() || busy} className="w-full">
          <Plus className="h-4 w-4" /> Добавить
        </Button>
        <p className="text-xs text-zinc-600">
          Удаление проекта не трогает задачи и заметки: они останутся с этим тегом, но без названия.
        </p>
      </div>
    </Sheet>
  );
}
