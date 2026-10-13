"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, CheckCircle2, ConciergeBell, Loader2, RefreshCw, Send, X } from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { listConciergeRequestsForStaff, replyToConciergeRequest, updateConciergeRequest, type ConciergeStatus } from "@/app/actions/concierge";

type ConciergeMessage = { id: string; request_id: string; sender_profile_id: string | null; sender_role: "resident" | "staff" | "system"; body: string; created_at: string };
type Row = {
  id: string; resident_id: string; title: string; category: string; message: string;
  trip_stage: string; desired_at: string | null; preferred_language: Lang;
  status: ConciergeStatus; admin_feedback: string | null; created_at: string; updated_at: string;
  messages?: ConciergeMessage[] | null;
  resident: { id: string; full_name: string | null; avatar_url: string | null; telegram_id: string | null; segment: string | null; level: number | null; kyc_level: number | null } | null;
};

const T: Record<Lang, Record<string, string>> = {
  EN: { title:"Concierge requests", subtitle:"Review resident requests and close each item with clear feedback.", refresh:"Refresh", loading:"Loading requests…", empty:"No concierge requests match this filter.", all:"All", open:"Open", in_progress:"In progress", done:"Completed", impossible:"Unable to complete", resident:"Resident", category:"Category", stage:"Trip stage", requested:"Request", date:"Submitted", feedback:"Feedback for resident", feedbackPlaceholder:"Explain what was done or why it cannot be completed…", markDone:"Mark done", cannot:"Cannot complete", save:"Save status", saving:"Saving…", feedbackRequired:"Add feedback before closing a request.", saved:"Request updated.", error:"Could not update request.", forbidden:"You do not have permission to access concierge requests.", before_tour:"Before trip", during_tour:"During trip", after_tour:"After trip", travel:"Travel", accommodation:"Accommodation", transport:"Transport", event:"Event", documents:"Documents", general:"Other", allStatus:"All statuses", unknownResident:"VOYAGE Resident", telegramLabel:"Telegram:", reply:"Send reply", replyHistory:"Conversation history", replySent:"Reply saved and sent to Telegram.", replySavedNoTelegram:"Reply saved, but Telegram delivery failed." },
  RU: { title:"Запросы консьержу", subtitle:"Разбирайте обращения резиденток и закрывайте каждый пункт с обратной связью.", refresh:"Обновить", loading:"Загрузка запросов…", empty:"Запросов с таким статусом нет.", all:"Все", open:"Открыт", in_progress:"В работе", done:"Выполнено", impossible:"Невозможно выполнить", resident:"Резидентка", category:"Категория", stage:"Этап поездки", requested:"Запрос", date:"Создано", feedback:"Обратная связь для резидентки", feedbackPlaceholder:"Укажите, что сделано или почему запрос невозможно выполнить…", markDone:"Отметить выполненным", cannot:"Невозможно выполнить", save:"Сохранить статус", saving:"Сохраняем…", feedbackRequired:"Добавьте обратную связь перед закрытием запроса.", saved:"Запрос обновлён.", error:"Не удалось обновить запрос.", forbidden:"Нет доступа к запросам консьержа.", before_tour:"До поездки", during_tour:"Во время поездки", after_tour:"После поездки", travel:"Путешествие", accommodation:"Проживание", transport:"Транспорт", event:"Мероприятие", documents:"Документы", general:"Другое", allStatus:"Все статусы", unknownResident:"Резидентка VOYAGE", telegramLabel:"Telegram:", reply:"Ответить", replyHistory:"История переписки", replySent:"Ответ сохранён и отправлен в Telegram.", replySavedNoTelegram:"Ответ сохранён, но Telegram не доставил сообщение." },
  ES: { title:"Solicitudes de concierge", subtitle:"Revisa las solicitudes de las residentes y ciérralas con comentarios claros.", refresh:"Actualizar", loading:"Cargando solicitudes…", empty:"No hay solicitudes para este filtro.", all:"Todas", open:"Abierta", in_progress:"En curso", done:"Completada", impossible:"No se puede completar", resident:"Residente", category:"Categoría", stage:"Etapa del viaje", requested:"Solicitud", date:"Enviada", feedback:"Respuesta para la residente", feedbackPlaceholder:"Explica qué se hizo o por qué no se puede completar…", markDone:"Marcar completada", cannot:"No se puede completar", save:"Guardar estado", saving:"Guardando…", feedbackRequired:"Añade comentarios antes de cerrar la solicitud.", saved:"Solicitud actualizada.", error:"No se pudo actualizar la solicitud.", forbidden:"No tienes permiso para ver las solicitudes de concierge.", before_tour:"Antes del viaje", during_tour:"Durante el viaje", after_tour:"Después del viaje", travel:"Viaje", accommodation:"Alojamiento", transport:"Transporte", event:"Evento", documents:"Documentos", general:"Otro", allStatus:"Todos los estados", unknownResident:"Residente VOYAGE", telegramLabel:"Telegram:", reply:"Responder", replyHistory:"Historial de conversación", replySent:"Respuesta guardada y enviada por Telegram.", replySavedNoTelegram:"Respuesta guardada, pero Telegram no pudo entregarla." },
  PT: { title:"Pedidos de concierge", subtitle:"Analise os pedidos das residentes e finalize cada item com uma resposta clara.", refresh:"Atualizar", loading:"Carregando pedidos…", empty:"Não há pedidos para este filtro.", all:"Todos", open:"Aberto", in_progress:"Em andamento", done:"Concluído", impossible:"Não foi possível concluir", resident:"Residente", category:"Categoria", stage:"Etapa da viagem", requested:"Pedido", date:"Enviado", feedback:"Resposta para a residente", feedbackPlaceholder:"Explique o que foi feito ou por que não pode ser concluído…", markDone:"Marcar como concluído", cannot:"Não é possível concluir", save:"Salvar status", saving:"Salvando…", feedbackRequired:"Adicione uma resposta antes de encerrar o pedido.", saved:"Pedido atualizado.", error:"Não foi possível atualizar o pedido.", forbidden:"Você não tem permissão para ver os pedidos de concierge.", before_tour:"Antes da viagem", during_tour:"Durante a viagem", after_tour:"Depois da viagem", travel:"Viagem", accommodation:"Hospedagem", transport:"Transporte", event:"Evento", documents:"Documentos", general:"Outro", allStatus:"Todos os status", unknownResident:"Residente VOYAGE", telegramLabel:"Telegram:", reply:"Responder", replyHistory:"Histórico da conversa", replySent:"Resposta salva e enviada pelo Telegram.", replySavedNoTelegram:"Resposta salva, mas o Telegram não conseguiu entregá-la." },
};

const STATUSES: ConciergeStatus[] = ["open", "in_progress", "done", "impossible"];
function fmt(value: string, lang: Lang) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(lang === "RU" ? "ru-RU" : lang === "ES" ? "es-ES" : lang === "PT" ? "pt-BR" : "en-US", { dateStyle:"medium", timeStyle:"short" }).format(d); }

export default function ConciergeAdminChecklist() {
  const { lang } = useLanguage(); const t = T[lang] ?? T.EN;
  const [rows, setRows] = useState<Row[]>([]); const [filter, setFilter] = useState<"all"|ConciergeStatus>("all");
  const [feedback, setFeedback] = useState<Record<string,string>>({}); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string|null>(null); const [notice, setNotice] = useState<{ok:boolean;text:string}|null>(null);

  const refresh = useCallback(async () => { setLoading(true); const res = await listConciergeRequestsForStaff(); setLoading(false); if (!res.ok) { setNotice({ok:false,text:res.reason === "forbidden" ? t.forbidden : t.error}); return; } setRows(res.requests as Row[]); setFeedback((old) => { const next = {...old}; for (const row of res.requests as Row[]) if (next[row.id] === undefined) next[row.id] = ""; return next; }); }, [t.error,t.forbidden]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const closeRequest = async (row: Row, status: "done"|"impossible") => {
    const reply = (feedback[row.id] ?? "").trim();
    if (!reply) { setNotice({ok:false,text:t.feedbackRequired}); return; }
    setBusy(row.id); setNotice(null);
    const result = await replyToConciergeRequest({ id: row.id, status, message: reply });
    setBusy(null);
    if (!result.ok) { setNotice({ok:false,text:result.reason === "forbidden" ? t.forbidden : t.error}); return; }
    setFeedback((old) => ({ ...old, [row.id]: "" }));
    setNotice({ok: true, text: result.telegramSent ? t.replySent : (result.warning ?? t.replySavedNoTelegram)});
    await refresh();
  };
  const sendReply = async (row: Row) => {
    const message = (feedback[row.id] ?? "").trim();
    if (!message) { setNotice({ok:false,text:t.feedbackRequired}); return; }
    const status: ConciergeStatus = row.status === "open" ? "in_progress" : row.status;
    setBusy(row.id); setNotice(null);
    const result = await replyToConciergeRequest({ id: row.id, status, message });
    setBusy(null);
    if (!result.ok) { setNotice({ok:false,text:result.reason === "forbidden" ? t.forbidden : t.error}); return; }
    setFeedback((old) => ({ ...old, [row.id]: "" }));
    setNotice({ok: true, text: result.telegramSent ? t.replySent : (result.warning ?? t.replySavedNoTelegram)});
    await refresh();
  };
  const changeStatus = async (row: Row, status: ConciergeStatus) => {
    if (status === "done" || status === "impossible") { await closeRequest(row,status); return; }
    setBusy(row.id);
    const result = await updateConciergeRequest({id:row.id,status});
    setBusy(null);
    if (!result.ok) { setNotice({ok:false,text:result.reason === "forbidden" ? t.forbidden : t.error}); return; }
    setNotice({ok:true,text:t.saved}); await refresh();
  };
  const filtered = filter === "all" ? rows : rows.filter((r)=>r.status === filter);

  return <main className="mx-auto w-full max-w-7xl px-4 pb-8 pt-2 sm:px-6 lg:px-8">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/[0.06] text-amber-200"><ConciergeBell size={21}/></div><h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{t.title}</h1><p className="mt-2 text-sm text-zinc-400">{t.subtitle}</p></div><button onClick={()=>void refresh()} className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-zinc-300 transition hover:border-amber-200/20 hover:text-amber-100"><RefreshCw size={15}/>{t.refresh}</button></header>
    {notice && <div role="status" className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${notice.ok ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200" : "border-rose-500/20 bg-rose-500/[0.06] text-rose-200"}`}>{notice.ok?<CheckCircle2 size={16}/>:<AlertCircle size={16}/>} {notice.text}</div>}
    <div className="mb-5 flex flex-wrap gap-2">{(["all",...STATUSES] as const).map((s)=><button type="button" key={s} onClick={()=>setFilter(s)} className={`rounded-full border px-3.5 py-2 text-xs transition ${filter===s ? "border-amber-200/30 bg-amber-200/[0.08] text-amber-100" : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-200"}`}>{s==="all"?t.allStatus:t[s]}</button>)}</div>
    {loading ? <div className="flex items-center gap-2 py-12 text-sm text-zinc-500"><Loader2 size={16} className="animate-spin"/>{t.loading}</div> : filtered.length===0 ? <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">{t.empty}</div> : <div className="space-y-4">{filtered.map((row)=><article key={row.id} className="rounded-2xl border border-zinc-800/70 bg-zinc-900/45 p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-zinc-100">{row.title}</h2><span className="rounded-full border border-zinc-700/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-zinc-400">{t[row.status]}</span></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500"><span>{t.category}: {t[row.category] ?? row.category}</span><span>{t.stage}: {t[row.trip_stage] ?? row.trip_stage}</span><span>{t.date}: {fmt(row.created_at,lang)}</span>{row.desired_at&&<span>{fmt(row.desired_at,lang)}</span>}</div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{row.message}</p>{(row.messages ?? []).length > 0 && <div className="mt-5 rounded-xl border border-zinc-800/60 bg-zinc-950/35 p-4"><p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/65">{t.replyHistory}</p><div className="space-y-3">{[...(row.messages ?? [])].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)).map((message)=><div key={message.id} className="rounded-lg border border-zinc-800/50 bg-zinc-900/45 p-3"><div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500"><span>{message.sender_role === "staff" ? t.feedback : t.resident}</span><time>{fmt(message.created_at,lang)}</time></div><p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{message.body}</p></div>)}</div></div>}</div>
      <div className="min-w-0 rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3 xl:w-64"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{t.resident}</p><Link href={`/admin/database/${row.resident_id}`} className="mt-2 flex items-center gap-3 rounded-lg outline-none transition hover:bg-zinc-900/70 focus-visible:ring-1 focus-visible:ring-amber-200/50"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-800 text-xs text-zinc-300">{row.resident?.avatar_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.resident.avatar_url} alt="" className="h-full w-full object-cover" />
            </>
          ) : (row.resident?.full_name ?? "?").slice(0,1).toUpperCase()}</div><span className="min-w-0"><span className="block truncate text-sm font-medium text-zinc-200">{row.resident?.full_name || t.unknownResident}</span><span className="mt-0.5 block truncate text-xs text-zinc-500">{row.resident?.segment ?? "working"} · KYC{row.resident?.kyc_level ?? 0}</span></span></Link>{row.resident?.telegram_id&&<p className="mt-2 truncate text-xs text-zinc-600">{t.telegramLabel} {row.resident.telegram_id}</p>}</div></div>
      <div className="mt-5 border-t border-zinc-800/60 pt-4"><label className="mb-1.5 block text-xs font-medium text-zinc-400">{t.feedback}</label><textarea value={feedback[row.id] ?? ""} onChange={(e)=>setFeedback((old)=>({...old,[row.id]:e.target.value}))} maxLength={4000} rows={2} placeholder={t.feedbackPlaceholder} className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950/60 px-3.5 py-3 text-sm leading-6 text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-200/35"/><div className="mt-3 flex flex-wrap items-center gap-2"><select value={row.status} disabled={busy===row.id} onChange={(e)=>void changeStatus(row,e.target.value as ConciergeStatus)} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-zinc-300 outline-none focus:border-amber-200/30">{STATUSES.map((s)=><option key={s} value={s}>{t[s]}</option>)}</select><button type="button" onClick={()=>void sendReply(row)} disabled={busy===row.id} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/25 bg-amber-200/[0.08] px-3.5 py-2.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-200/[0.14] disabled:opacity-50">{busy===row.id?<Loader2 className="animate-spin" size={14}/>:<Send size={14}/>} {t.reply}</button><button type="button" onClick={()=>void closeRequest(row,"done")} disabled={busy===row.id} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/[0.12] disabled:opacity-50">{busy===row.id?<Loader2 className="animate-spin" size={14}/>:<Check size={14}/>} {t.markDone}</button><button type="button" onClick={()=>void closeRequest(row,"impossible")} disabled={busy===row.id} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] px-3.5 py-2.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/[0.1] disabled:opacity-50"><X size={14}/>{t.cannot}</button></div></div>
    </article>)}</div>}
  </main>;
}
