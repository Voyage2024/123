"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cormorant } from "@/app/components/profile/fonts";
import { RookieFigure, VeteranFigure } from "@/app/(public)/login/_components/LoginCharacters";
import {
  SCENE_MOODS,
  getLoginDialogueCopy,
  type LoginDialogueCopy,
  type LoginScene,
} from "@/app/(public)/login/_components/loginDialogue.copy";

// ---------------------------------------------------------------------------
// Ход реплик внутри сцены: сначала говорит «Новичок», потом «Опытная» печатает
// и отвечает. При смене сцены всё начинается заново.
// ---------------------------------------------------------------------------

type Phase = "rookie" | "typing" | "reply";

const EASE = [0.22, 1, 0.36, 1] as const;

function useDialoguePhase(scene: LoginScene, reduced: boolean): Phase {
  const [state, setState] = useState<{ scene: LoginScene; phase: Phase }>({ scene, phase: "rookie" });

  useEffect(() => {
    if (reduced) {
      setState({ scene, phase: "reply" });
      return;
    }
    setState({ scene, phase: "rookie" });
    // На загрузке и ошибке отвечает быстрее — там важна реакция
    const urgent = scene === "loading" || scene === "error";
    const t1 = window.setTimeout(() => setState({ scene, phase: "typing" }), urgent ? 450 : 900);
    const t2 = window.setTimeout(() => setState({ scene, phase: "reply" }), urgent ? 1000 : 1700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [scene, reduced]);

  // Пока эффект не отработал для новой сцены, не показываем ответ от старой
  if (state.scene !== scene) return reduced ? "reply" : "rookie";
  return state.phase;
}

function TypingDots({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-amber-200/70"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

const bubbleMotion = {
  initial: { opacity: 0, y: 10, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { duration: 0.38, ease: EASE },
};

// ---------------------------------------------------------------------------
// Десктоп: сцена с двумя фигурами и облачками над ними
// ---------------------------------------------------------------------------

function Speaker({ name, tag, gold }: { name: string; tag: string; gold?: boolean }) {
  return (
    <p className="mb-1.5 flex items-center gap-2 text-[9px] uppercase tracking-[0.3em]">
      <span className={gold ? "text-amber-200/80" : "text-zinc-400"}>{name}</span>
      <span className="h-px w-3 bg-zinc-700" />
      <span className="text-zinc-600">{tag}</span>
    </p>
  );
}

function StageDialogue({ scene, copy, phase }: { scene: LoginScene; copy: LoginDialogueCopy; phase: Phase }) {
  const line = copy.scenes[scene];
  const moods = SCENE_MOODS[scene];
  const reduced = useReducedMotion() ?? false;
  const rookieActive = phase !== "reply";
  const nervous = scene === "password" || scene === "error";

  return (
    <section aria-label={copy.regionLabel} className="relative w-full max-w-[460px] select-none">
      {/* Облачка */}
      <div className="relative flex min-h-[270px] flex-col justify-end gap-3 pb-5">
        <AnimatePresence mode="wait">
          <motion.div key={scene} className="flex flex-col gap-3" exit={{ opacity: 0, transition: { duration: 0.18 } }}>
            <motion.div
              {...bubbleMotion}
              className="relative max-w-[290px] self-start rounded-2xl rounded-bl-sm border border-zinc-700/70 bg-zinc-900/85 px-4 py-3 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur"
            >
              <Speaker name={copy.rookieName} tag={copy.rookieTag} />
              <p className="text-[13px] leading-relaxed text-zinc-200">{line.rookie}</p>
              <span className="absolute -bottom-[7px] left-6 h-3 w-3 rotate-45 border-b border-r border-zinc-700/70 bg-zinc-900" />
            </motion.div>

            <div className="flex min-h-[64px] justify-end">
              <AnimatePresence mode="wait" initial={false}>
                {phase === "typing" && (
                  <motion.div
                    key="typing"
                    {...bubbleMotion}
                    className="self-end rounded-2xl rounded-br-sm border border-amber-200/20 bg-zinc-950/80 px-4 py-3"
                  >
                    <TypingDots label={copy.typing} />
                  </motion.div>
                )}
                {phase === "reply" && (
                  <motion.div
                    key="reply"
                    {...bubbleMotion}
                    className="relative max-w-[310px] self-end rounded-2xl rounded-br-sm border border-amber-200/25 bg-gradient-to-br from-amber-200/[0.09] to-zinc-950/90 px-4 py-3 shadow-[0_10px_40px_-20px_rgba(253,230,138,0.25)] backdrop-blur"
                  >
                    <Speaker name={copy.veteranName} tag={copy.veteranTag} gold />
                    <p className={`${cormorant.className} text-[17px] italic leading-snug text-amber-50/95`}>
                      {line.veteran}
                    </p>
                    <span className="absolute -bottom-[7px] right-8 h-3 w-3 rotate-45 border-b border-r border-amber-200/25 bg-zinc-950" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Фигуры */}
      <div className="relative flex items-end justify-between">
        <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-200/35 to-transparent" />
        <div className="pointer-events-none absolute inset-x-16 -bottom-6 h-12 rounded-[50%] bg-amber-200/[0.05] blur-2xl" />

        <motion.div
          key={`rookie-${scene}`}
          className="relative z-10 w-[190px]"
          animate={nervous && !reduced ? { x: [0, -3, 3, -2, 2, 0] } : { x: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <motion.div
            animate={{
              opacity: rookieActive ? 1 : 0.72,
              y: reduced ? 0 : [0, -3, 0],
            }}
            transition={{
              opacity: { duration: 0.4 },
              y: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <RookieFigure mood={moods.rookie} className="h-auto w-full" />
          </motion.div>
        </motion.div>

        <motion.div
          className="relative -ml-8 w-[220px]"
          animate={{
            opacity: rookieActive ? 0.7 : 1,
            y: reduced ? 0 : [0, -2, 0],
          }}
          transition={{
            opacity: { duration: 0.4 },
            y: { duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.6 },
          }}
        >
          <VeteranFigure mood={moods.veteran} className="h-auto w-full" />
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Мобильные: один компактный баббл с мини-аватарами, можно свернуть
// ---------------------------------------------------------------------------

function CompactDialogue({ scene, copy, phase }: { scene: LoginScene; copy: LoginDialogueCopy; phase: Phase }) {
  const [open, setOpen] = useState(true);
  const line = copy.scenes[scene];
  const moods = SCENE_MOODS[scene];
  const latest = phase === "reply" ? line.veteran : line.rookie;

  return (
    <section
      aria-label={copy.regionLabel}
      className="w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? copy.collapse : copy.expand}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="flex shrink-0 -space-x-2">
          <span className="h-8 w-8 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
            <RookieFigure mood={moods.rookie} variant="avatar" className="h-full w-full" />
          </span>
          <span className="h-8 w-8 overflow-hidden rounded-full border border-amber-200/40 bg-zinc-900">
            <VeteranFigure mood={moods.veteran} variant="avatar" className="h-full w-full" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          {open ? (
            <span className="block text-[9px] uppercase tracking-[0.3em] text-zinc-500">
              {copy.rookieName} <span className="text-zinc-700">·</span>{" "}
              <span className="text-amber-200/70">{copy.veteranName}</span>
            </span>
          ) : (
            <span className="block truncate text-xs text-zinc-400">{latest}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className={`shrink-0 text-zinc-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="min-h-[136px] pt-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={scene}
                  className="space-y-2.5"
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                >
                  <motion.p {...bubbleMotion} className="border-l border-zinc-700 pl-3 text-[13px] leading-relaxed text-zinc-300">
                    {line.rookie}
                  </motion.p>
                  <AnimatePresence mode="wait" initial={false}>
                    {phase === "typing" && (
                      <motion.div key="typing" {...bubbleMotion} className="border-l border-amber-200/40 py-1 pl-3">
                        <TypingDots label={copy.typing} />
                      </motion.div>
                    )}
                    {phase === "reply" && (
                      <motion.p
                        key="reply"
                        {...bubbleMotion}
                        className={`${cormorant.className} border-l border-amber-200/40 pl-3 text-[16px] italic leading-snug text-amber-50/90`}
                      >
                        {line.veteran}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ---------------------------------------------------------------------------

export interface LoginDialogueProps {
  scene: LoginScene;
  lang: string;
  /** stage — фигуры + облачка (десктоп), compact — единый баббл (мобильные) */
  layout: "stage" | "compact";
}

export default function LoginDialogue({ scene, lang, layout }: LoginDialogueProps) {
  const reduced = useReducedMotion() ?? false;
  const phase = useDialoguePhase(scene, reduced);
  const copy = getLoginDialogueCopy(lang);

  return layout === "stage" ? (
    <StageDialogue scene={scene} copy={copy} phase={phase} />
  ) : (
    <CompactDialogue scene={scene} copy={copy} phase={phase} />
  );
}
