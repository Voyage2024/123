"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Clock3, ConciergeBell, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import {
  createConciergeRequest,
  listMyConciergeRequests,
  type ConciergeCategory,
  type ConciergeStage,
} from "@/app/actions/concierge";

type RequestRow = {
  id: string;
  title: string;
  category: ConciergeCategory;
  message: string;
  trip_stage: ConciergeStage;
  desired_at: string | null;
  preferred_language: Lang;
  status: "open" | "in_progress" | "done" | "impossible";
  admin_feedback: string | null;
  created_at: string;
  updated_at: string;
};

type Dictionary = {
  title: string;
  subtitle: string;
  newRequest: string;
  requestTitle: string;
  requestTitlePlaceholder: string;
  category: string;
  message: string;
  messagePlaceholder: string;
  stage: string;
  desiredAt: string;
  optional: string;
  send: string;
  sending: string;
  myRequests: string;
  noRequests: string;
  created: string;
  categories: Record<ConciergeCategory, string>;
  stages: Record<ConciergeStage, string>;
  statuses: Record<RequestRow["status"], string>;
  feedback: string;
  validation: string;
  sent: string;
  refresh: string;
  error: string;
  unauthorized: string;
};

const T: Record<Lang, Dictionary> = {
  EN: {
    title: "Voyage Concierge", subtitle: "Personal assistance before, during and after your trip.", newRequest: "New request", requestTitle: "Subject", requestTitlePlaceholder: "What do you need help with?", category: "Category", message: "Details", messagePlaceholder: "Describe your question or request…", stage: "Trip stage", desiredAt: "Preferred date and time", optional: "Optional", send: "Send request", sending: "Sending…", myRequests: "Your requests", noRequests: "No requests yet. Your concierge team is available when you need help.", created: "Created", categories: { travel: "Travel", accommodation: "Accommodation", transport: "Transport", event: "Event", documents: "Documents", general: "Other" }, stages: { before_tour: "Before the trip", during_tour: "During the trip", after_tour: "After the trip" }, statuses: { open: "Open", in_progress: "In progress", done: "Completed", impossible: "Unable to complete" }, feedback: "Concierge feedback", validation: "Enter a subject (at least 3 characters) and details (at least 5 characters).", sent: "Your request has been sent.", refresh: "Refresh", error: "We couldn't send your request. Please try again.", unauthorized: "Sign in with an approved resident account to create a request."
  },
  RU: {
    title: "Консьерж VOYAGE", subtitle: "Персональная помощь до, во время и после поездки.", newRequest: "Новый запрос", requestTitle: "Тема", requestTitlePlaceholder: "С чем вам помочь?", category: "Категория", message: "Подробности", messagePlaceholder: "Опишите вопрос или просьбу…", stage: "Этап поездки", desiredAt: "Желаемые дата и время", optional: "Необязательно", send: "Отправить запрос", sending: "Отправляем…", myRequests: "Ваши запросы", noRequests: "Запросов пока нет. Команда консьержа на связи, когда понадобится помощь.", created: "Создано", categories: { travel: "Путешествие", accommodation: "Проживание", transport: "Транспорт", event: "Мероприятие", documents: "Документы", general: "Другое" }, stages: { before_tour: "До поездки", during_tour: "Во время поездки", after_tour: "После поездки" }, statuses: { open: "Открыт", in_progress: "В работе", done: "Выполнен", impossible: "Не удалось выполнить" }, feedback: "Ответ консьержа", validation: "Укажите тему (не менее 3 символов) и описание (не менее 5 символов).", sent: "Запрос отправлен.", refresh: "Обновить", error: "Не удалось отправить запрос. Попробуйте ещё раз.", unauthorized: "Для запроса войдите в подтверждённый аккаунт резидента."
  },
  ES: {
    title: "Concierge VOYAGE", subtitle: "Asistencia personal antes, durante y después de tu viaje.", newRequest: "Nueva solicitud", requestTitle: "Asunto", requestTitlePlaceholder: "¿Con qué necesitas ayuda?", category: "Categoría", message: "Detalles", messagePlaceholder: "Describe tu pregunta o solicitud…", stage: "Etapa del viaje", desiredAt: "Fecha y hora preferidas", optional: "Opcional", send: "Enviar solicitud", sending: "Enviando…", myRequests: "Tus solicitudes", noRequests: "Todavía no hay solicitudes. El equipo de concierge está disponible cuando lo necesites.", created: "Creada", categories: { travel: "Viaje", accommodation: "Alojamiento", transport: "Transporte", event: "Evento", documents: "Documentos", general: "Otro" }, stages: { before_tour: "Antes del viaje", during_tour: "Durante el viaje", after_tour: "Después del viaje" }, statuses: { open: "Abierta", in_progress: "En curso", done: "Completada", impossible: "No se pudo completar" }, feedback: "Respuesta de concierge", validation: "Introduce un asunto (mínimo 3 caracteres) y detalles (mínimo 5 caracteres).", sent: "Solicitud enviada.", refresh: "Actualizar", error: "No se pudo enviar la solicitud. Inténtalo de nuevo.", unauthorized: "Inicia sesión con una cuenta de residente aprobada para crear una solicitud."
  },
  PT: {
    title: "Concierge VOYAGE", subtitle: "Assistência pessoal antes, durante e depois da sua viagem.", newRequest: "Novo pedido", requestTitle: "Assunto", requestTitlePlaceholder: "Como podemos ajudar?", category: "Categoria", message: "Detalhes", messagePlaceholder: "Descreva sua pergunta ou pedido…", stage: "Etapa da viagem", desiredAt: "Data e hora preferidas", optional: "Opcional", send: "Enviar pedido", sending: "Enviando…", myRequests: "Seus pedidos", noRequests: "Ainda não há pedidos. A equipe de concierge está disponível quando você precisar.", created: "Criado", categories: { travel: "Viagem", accommodation: "Hospedagem", transport: "Transporte", event: "Evento", documents: "Documentos", general: "Outro" }, stages: { before_tour: "Antes da viagem", during_tour: "Durante a viagem", after_tour: "Depois da viagem" }, statuses: { open: "Aberto", in_progress: "Em andamento", done: "Concluído", impossible: "Não foi possível concluir" }, feedback: "Resposta do concierge", validation: "Informe um assunto (mínimo de 3 caracteres) e detalhes (mínimo de 5 caracteres).", sent: "Pedido enviado.", refresh: "Atualizar", error: "Não foi possível enviar seu pedido. Tente novamente.", unauthorized: "Entre com uma conta de residente aprovada para criar um pedido."
  },
};

const CATEGORIES: ConciergeCategory[] = ["travel", "accommodation", "transport", "event", "documents", "general"];
const STAGES: ConciergeStage[] = ["before_tour", "during_tour", "after_tour"];

function locale(lang: Lang) { return lang === "RU" ? "ru-RU" : lang === "ES" ? "es-ES" : lang === "PT" ? "pt-BR" : "en-US"; }
function dateTime(value: string, lang: Lang) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(locale(lang), { dateStyle: "medium", timeStyle: "short" }).format(d); }

export default function ResidentConcierge() {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ConciergeCategory>("general");
  const [message, setMessage] = useState("");
  const [tripStage, setTripStage] = useState<ConciergeStage>("before_tour");
  const [desiredAt, setDesiredAt] = useState("");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{kind:"success"|"error"; text:string}|null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMyConciergeRequests();
      if (result.ok) setRequests(result.requests as RequestRow[]);
      else if (result.reason === "unauthenticated" || result.reason === "forbidden") setNotice({kind:"error", text:t.unauthorized});
      else setNotice({kind:"error", text:t.error});
    } catch {
      setNotice({kind:"error", text:t.error});
    } finally {
      setLoading(false);
    }
  }, [t.error, t.unauthorized]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const canSubmit = useMemo(() => title.trim().length >= 3 && title.trim().length <= 120 && message.trim().length >= 5 && message.trim().length <= 4000, [title, message]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setNotice(null);
    if (!canSubmit) { setNotice({kind:"error", text:t.validation}); return; }
    setSubmitting(true);
    try {
      const result = await createConciergeRequest({ title, category, message, tripStage, desiredAt: desiredAt || null, language: lang });
      if (!result.ok) { setNotice({kind:"error", text: result.reason === "unauthenticated" || result.reason === "resident_only" || result.reason === "not_approved" || result.reason === "banned" ? t.unauthorized : result.reason === "validation" || result.reason === "invalid_date" ? t.validation : t.error}); return; }
      setTitle(""); setMessage(""); setDesiredAt(""); setCategory("general"); setTripStage("before_tour");
      setNotice({kind:"success", text:t.sent});
      await refresh();
    } catch {
      setNotice({kind:"error", text:t.error});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.header initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="mb-8">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] text-amber-200"><ConciergeBell size={21}/></div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{t.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{t.subtitle}</p>
      </motion.header>

      {notice && <div role="status" className={`mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${notice.kind === "success" ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200" : "border-rose-500/20 bg-rose-500/[0.06] text-rose-200"}`}>{notice.kind === "success" ? <CheckCircle2 size={17}/> : <AlertCircle size={17}/>}<span>{notice.text}</span></div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/45 p-5 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-6">
          <h2 className="mb-5 text-lg font-semibold text-zinc-100">{t.newRequest}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">{t.requestTitle}</span><input maxLength={120} value={title} onChange={(e)=>setTitle(e.target.value)} placeholder={t.requestTitlePlaceholder} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/65 px-3.5 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-200/35" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">{t.category}</span><select value={category} onChange={(e)=>setCategory(e.target.value as ConciergeCategory)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/65 px-3 py-3 text-sm text-zinc-200 outline-none focus:border-amber-200/35">{CATEGORIES.map((v)=><option value={v} key={v}>{t.categories[v]}</option>)}</select></label>
              <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">{t.stage}</span><select value={tripStage} onChange={(e)=>setTripStage(e.target.value as ConciergeStage)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/65 px-3 py-3 text-sm text-zinc-200 outline-none focus:border-amber-200/35">{STAGES.map((v)=><option value={v} key={v}>{t.stages[v]}</option>)}</select></label>
            </div>
            <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">{t.message}</span><textarea rows={5} maxLength={4000} value={message} onChange={(e)=>setMessage(e.target.value)} placeholder={t.messagePlaceholder} className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950/65 px-3.5 py-3 text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-200/35" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-400">{t.desiredAt} <span className="text-zinc-600">({t.optional})</span></span><input type="datetime-local" value={desiredAt} onChange={(e)=>setDesiredAt(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/65 px-3.5 py-3 text-sm text-zinc-200 outline-none focus:border-amber-200/35" /></label>
            <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/20 bg-amber-200/[0.09] px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/[0.14] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <Loader2 size={16} className="animate-spin"/> : <Send size={15}/>} {submitting ? t.sending : t.send}</button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/35 p-5 backdrop-blur-xl sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-zinc-100">{t.myRequests}</h2><button type="button" onClick={()=>void refresh()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition hover:border-amber-200/20 hover:text-amber-100 disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/>{t.refresh}</button></div>
          {loading ? <div className="flex items-center gap-2 py-10 text-sm text-zinc-500"><Loader2 size={16} className="animate-spin"/>{t.sending}</div> : requests.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-sm leading-6 text-zinc-500">{t.noRequests}</div> : <div className="space-y-3">{requests.map((request)=>{
            const isDone = request.status === "done", isImpossible = request.status === "impossible";
            return <article key={request.id} className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-medium text-zinc-100">{request.title}</h3><p className="mt-1 text-xs text-zinc-500">{t.categories[request.category]} · {t.stages[request.trip_stage]}</p></div><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${isDone ? "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-200" : isImpossible ? "border-rose-500/25 bg-rose-500/[0.07] text-rose-200" : "border-amber-200/20 bg-amber-200/[0.05] text-amber-100"}`}>{isDone ? <CheckCircle2 size={12}/> : isImpossible ? <XCircle size={12}/> : <Clock3 size={12}/>} {t.statuses[request.status]}</span></div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{request.message}</p>
              <p className="mt-3 text-[11px] text-zinc-600">{t.created}: {dateTime(request.created_at, lang)}</p>
              {request.admin_feedback && <div className="mt-4 rounded-lg border border-amber-200/10 bg-amber-200/[0.04] p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/75">{t.feedback}</p><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{request.admin_feedback}</p></div>}
            </article>;
          })}</div>}
        </section>
      </div>
    </main>
  );
}
