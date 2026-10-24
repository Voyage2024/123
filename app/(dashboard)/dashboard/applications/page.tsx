"use client";

/* VOYAGE · My Applications
 * The existing MyApplications component owns the current Tour/Event tabs.
 * This route adds the casting-response panel without replacing that workflow.
 */

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Clock3,
  FileText,
  Hourglass,
  ListChecks,
  MapPin,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import MyApplications from "@/app/components/MyApplications";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/app/context/LanguageContext";
import { projectLabel } from "@/lib/project-types";
import PageExplainerHeader, {
  ResidentPageShell,
  type ExplainerDict,
} from "@/app/(dashboard)/dashboard/_components/PageExplainerHeader";

type CastingResponse = {
  response_id: string;
  casting_id: string;
  city: string;
  project_type: string;
  starts_on: string;
  ends_on: string;
  fee_amount: number | string | null;
  fee_currency: string | null;
  status: "ready" | "option" | "selected" | "declined" | "withdrawn" | string;
  option_expires_at: string | null;
  response_created_at: string;
  response_updated_at: string;
};

type MainTab = "applications" | "castings";

const COPY: ExplainerDict = {
  EN: {
    eyebrow: "Application status",
    title: "My Applications",
    subtitle: "Your tour, event and casting responses in one place. Track decisions and option deadlines here.",
    steps: ["Pick a tour, event or casting", "The team reviews your response", "See the current status here"],
    cards: [
      { title: "Current status", text: "Each card shows the response status recorded by the club team." },
      { title: "Option · a spot held for you", text: "An option is time-limited. The deadline is shown on its card." },
    ],
  },
  RU: {
    eyebrow: "Статус заявок",
    title: "Мои заявки",
    subtitle: "Заявки на туры, мероприятия и отклики на кастинги в одном месте. Здесь видны решение команды и срок опциона.",
    steps: ["Выберите тур, мероприятие или кастинг", "Команда рассматривает отклик", "Проверяйте актуальный статус здесь"],
    cards: [
      { title: "Актуальный статус", text: "На карточке отображается статус отклика, сохранённый командой клуба." },
      { title: "Опцион · место за вами", text: "Опцион действует ограниченное время. Срок указан прямо на карточке." },
    ],
  },
  ES: {
    eyebrow: "Estado de solicitudes",
    title: "Mis solicitudes",
    subtitle: "Tus solicitudes para tours y eventos, y tus respuestas a castings, en un solo lugar.",
    steps: ["Elige un tour, evento o casting", "El equipo revisa tu respuesta", "Consulta el estado aquí"],
    cards: [
      { title: "Estado actual", text: "Cada tarjeta muestra el estado guardado por el equipo del club." },
      { title: "Opción · plaza reservada", text: "La opción tiene una duración limitada; la fecha límite aparece en la tarjeta." },
    ],
  },
  PT: {
    eyebrow: "Status das solicitações",
    title: "Minhas solicitações",
    subtitle: "Solicitações de tours e eventos, além de respostas a castings, em um só lugar.",
    steps: ["Escolha um tour, evento ou casting", "A equipe analisa sua resposta", "Consulte o status aqui"],
    cards: [
      { title: "Status atual", text: "Cada cartão mostra o status salvo pela equipe do clube." },
      { title: "Opção · vaga reservada", text: "A opção tem prazo limitado; a data aparece no cartão." },
    ],
  },
};

const LOCALE: Record<string, string> = { EN: "en-US", RU: "ru-RU", ES: "es-ES", PT: "pt-BR" };
const STATUS: Record<string, Record<string, string>> = {
  EN: { ready: "Under review", option: "Option", selected: "Handshake · approved", declined: "Declined", withdrawn: "Withdrawn" },
  RU: { ready: "На рассмотрении", option: "Опцион", selected: "Рукопожатие · одобрено", declined: "Отклонено", withdrawn: "Отозвано" },
  ES: { ready: "En revisión", option: "Opción", selected: "Aprobada · confirmada", declined: "Rechazada", withdrawn: "Retirada" },
  PT: { ready: "Em análise", option: "Opção", selected: "Aprovada · confirmada", declined: "Recusada", withdrawn: "Retirada" },
};
const STATUS_TONE: Record<string, string> = {
  ready: "border-amber-200/20 bg-amber-200/5 text-amber-100/90",
  option: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  selected: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  declined: "border-rose-400/20 bg-rose-400/10 text-rose-200/80",
  withdrawn: "border-zinc-700 bg-zinc-900 text-zinc-400",
};

function formatDate(value: string, locale: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

function formatFee(amount: number | string | null, currency: string | null, locale: string) {
  if (amount === null || currency === null) return locale.startsWith("ru") ? "По договорённости" : "Negotiable";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

function CastingResponsesPanel({ lang }: { lang: string }) {
  const [rows, setRows] = useState<CastingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const locale = LOCALE[lang] ?? "en-US";
  const t = STATUS[lang] ?? STATUS.EN;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await (supabase as any).rpc("partner_resident_my_responses");
    if (rpcError) {
      setRows([]);
      setError(rpcError.message || "Could not load casting responses.");
    } else {
      setRows((Array.isArray(data) ? data : []) as CastingResponse[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="mt-5 space-y-4" aria-label={lang === "RU" ? "Отклики на кастинги" : "Casting responses"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/60">Casting responses</p>
          <h2 className="mt-1 font-serif text-2xl text-zinc-100">{lang === "RU" ? "Отклики на кастинги" : lang === "ES" ? "Respuestas a castings" : lang === "PT" ? "Respostas a castings" : "Casting responses"}</h2>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300 transition hover:border-amber-200/25 hover:text-amber-100 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {lang === "RU" ? "Обновить" : lang === "ES" ? "Actualizar" : lang === "PT" ? "Atualizar" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-6 text-sm text-zinc-500">{lang === "RU" ? "Загружаем отклики…" : "Loading responses…"}</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5 text-sm text-rose-200">
          <p>{lang === "RU" ? "Не удалось загрузить отклики на кастинги." : "Could not load casting responses."}</p>
          <button type="button" onClick={() => void load()} className="mt-3 underline underline-offset-4">{lang === "RU" ? "Повторить" : "Try again"}</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 px-5 py-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 text-amber-200/70"><Sparkles size={21} /></span>
          <p className="mt-4 text-sm text-zinc-200">{lang === "RU" ? "Пока нет откликов на кастинги" : lang === "ES" ? "Todavía no hay respuestas a castings" : lang === "PT" ? "Ainda não há respostas a castings" : "No casting responses yet"}</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-zinc-500">{lang === "RU" ? "Когда вы нажмёте «Готова в тур» на карточке кастинга, его статус появится здесь." : "When you respond to a casting, its status will appear here."}</p>
          <Link href="/dashboard/castings" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-200/25 bg-amber-200/5 px-4 py-2.5 text-sm text-amber-100 transition hover:bg-amber-200/10">{lang === "RU" ? "Открыть кастинги" : "Browse castings"}<ChevronRight size={15} /></Link>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => {
            const status = String(row.status).toLowerCase();
            const label = t[status] ?? status;
            return (
              <article key={row.response_id} className="group rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/65 to-zinc-950/70 p-4 transition-colors hover:border-amber-200/20 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500"><MapPin size={12} className="text-amber-200/60" /> {row.city}</div>
                    <h3 className="mt-2 truncate font-serif text-xl text-zinc-100">{projectLabel(row.project_type, lang)}</h3>
                  </div>
                  <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${STATUS_TONE[status] ?? STATUS_TONE.withdrawn}`}>
                    {status === "selected" ? <BadgeCheck size={12} /> : status === "option" ? <Clock3 size={12} /> : <Hourglass size={12} />}
                    {label}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-white/[0.04] bg-black/15 p-3">
                  <div><p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">{lang === "RU" ? "Даты" : "Dates"}</p><p className="mt-1 text-xs text-zinc-300">{formatDate(row.starts_on, locale)} – {formatDate(row.ends_on, locale)}</p></div>
                  <div><p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">{lang === "RU" ? "Гонорар" : "Fee"}</p><p className="mt-1 text-xs text-zinc-300">{formatFee(row.fee_amount, row.fee_currency, locale)}</p></div>
                </div>
                {status === "option" && row.option_expires_at && <p className="mt-3 inline-flex items-center gap-2 text-xs text-violet-200/90"><Clock3 size={13} /> {lang === "RU" ? "Опцион действует до" : "Option expires"} {new Date(row.option_expires_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</p>}
                <p className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-600"><CalendarClock size={12} /> {lang === "RU" ? "Обновлено" : "Updated"}: {new Date(row.response_updated_at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function ResidentApplicationsPage() {
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<MainTab>("applications");
  const isRu = lang === "RU";

  return (
    <ResidentPageShell>
      <PageExplainerHeader
        copy={COPY}
        icon={FileText}
        stepIcons={[MapPin, Hourglass, BadgeCheck]}
        cards={[{ icon: ListChecks }, { icon: CalendarClock, href: "/dashboard/parties" }]}
      />

      <div className="mt-8">
        <div className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-1.5" role="tablist" aria-label={isRu ? "Тип заявок" : "Application type"}>
          <button type="button" role="tab" aria-selected={activeTab === "applications"} onClick={() => setActiveTab("applications")} className={`rounded-xl px-4 py-2.5 text-sm transition-colors ${activeTab === "applications" ? "bg-amber-200 text-zinc-950 shadow-sm" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"}`}>
            {isRu ? "Туры и мероприятия" : lang === "ES" ? "Tours y eventos" : lang === "PT" ? "Tours e eventos" : "Tours & Events"}
          </button>
          <button type="button" role="tab" aria-selected={activeTab === "castings"} onClick={() => setActiveTab("castings")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-colors ${activeTab === "castings" ? "bg-amber-200 text-zinc-950 shadow-sm" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"}`}>
            <Sparkles size={15} /> {isRu ? "Кастинги" : "Castings"}
          </button>
        </div>
      </div>

      {activeTab === "applications" ? (
        <div className="mt-5"><MyApplications locale={lang.toLowerCase() as "ru" | "en" | "es" | "pt"} /></div>
      ) : (
        <CastingResponsesPanel lang={lang} />
      )}
    </ResidentPageShell>
  );
}
