"use client";

/* «Кто смотрел»: менеджеры по короткому имени, персонал — «Администрация VOYAGE». */

import { Eye, ShieldCheck, Video } from "lucide-react";
import { mediaCopy, type ProfileViews } from "@/lib/resident-media";

function when(at: string, lang: string) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const locale = lang === "RU" ? "ru-RU" : lang === "ES" ? "es-ES" : lang === "PT" ? "pt-PT" : "en-GB";
  return d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ProfileViewsPanel({ views, lang }: { views: ProfileViews | null; lang: string }) {
  const c = mediaCopy(lang);
  const items = views?.items ?? [];
  const ctx = (k: string) => (k === "tour" ? c.viewsContextTour : k === "admin" ? c.viewsContextAdmin : c.viewsContextCasting);
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400"><Eye size={13} className="text-[#c9a961]" /> {c.viewsTitle}</p>
        <span className="text-[11px] text-amber-100/80">{c.viewsWeek(views?.week ?? 0)}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">{c.viewsEmpty}</p>
      ) : (
        <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {items.slice(0, 30).map((v, i) => (
            <li key={`${v.at}-${i}`} className="flex items-center gap-2.5 rounded-xl border border-zinc-800/50 bg-black/20 px-3 py-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${v.staff ? "border-zinc-700 text-zinc-400" : "border-[#c9a961]/40 text-amber-100"}`}>
                {v.staff ? <ShieldCheck size={13} /> : v.what === "video" ? <Video size={13} /> : <Eye size={13} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-zinc-200">
                  {v.staff ? c.viewsStaff : v.viewer}
                  {v.badge && !v.staff && <span className="ml-1.5 rounded-full border border-[#c9a961]/30 px-1.5 text-[9px] uppercase tracking-wider text-amber-100/80">{v.badge.replace(/_/g, " ")}</span>}
                </span>
                <span className="block truncate text-[10.5px] text-zinc-500">
                  {v.what === "video" ? c.viewsWhatVideo : c.viewsWhatProfile} · {ctx(v.context)}{v.contextLabel ? ` · ${v.contextLabel}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-[10px] text-zinc-500">{when(v.at, lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
