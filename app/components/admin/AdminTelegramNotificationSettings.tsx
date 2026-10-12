"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, LoaderCircle, Send } from "lucide-react";
import { getMyAdminTelegramSettings, saveMyAdminTelegramSettings } from "@/app/actions/admin-notifications";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";

type Copy = { title: string; subtitle: string; chatId: string; chatHint: string; enabled: string; language: string; save: string; loading: string; saved: string; error: string; invalid: string; myidTitle: string; myidBody: string; disabledRole: string };
const T: Record<Lang, Copy> = {
  EN: { title: "Telegram application alerts", subtitle: "Receive a Telegram message when someone applies to join VOYAGE.", chatId: "Recipient Telegram ID", chatHint: "Open your bot, send /start and then /myid. Copy the numeric ID here. Negative IDs are allowed for groups.", enabled: "Notify me about new applications", language: "Notification language", save: "Save preferences", loading: "Loading settings…", saved: "Notification preferences saved.", error: "Could not save the notification settings.", invalid: "Enter a numeric Telegram ID, or leave it blank.", myidTitle: "How to find your ID", myidBody: "Open VOYAGE Concierge in Telegram, send /start and /myid, then copy the ID it replies with.", disabledRole: "Telegram alerts are available to Owner and Admin accounts." },
  RU: { title: "Уведомления о новых заявках в Telegram", subtitle: "Получайте сообщение в Telegram, когда кто-то подаёт заявку на вступление в VOYAGE.", chatId: "Telegram ID получателя", chatHint: "Откройте бота, отправьте /start, затем /myid. Скопируйте числовой ID сюда. Для групп допускаются отрицательные ID.", enabled: "Уведомлять о новых заявках", language: "Язык уведомлений", save: "Сохранить настройки", loading: "Загружаем настройки…", saved: "Настройки уведомлений сохранены.", error: "Не удалось сохранить настройки уведомлений.", invalid: "Введите числовой Telegram ID или оставьте поле пустым.", myidTitle: "Как узнать свой ID", myidBody: "Откройте VOYAGE Concierge в Telegram, отправьте /start и /myid, затем скопируйте ответивший ID.", disabledRole: "Telegram-уведомления доступны владельцу и администратору." },
  ES: { title: "Alertas de solicitudes por Telegram", subtitle: "Recibe un mensaje de Telegram cuando alguien solicite entrar en VOYAGE.", chatId: "ID de Telegram del destinatario", chatHint: "Abre el bot, envía /start y luego /myid. Copia aquí el ID numérico. Se admiten IDs negativos para grupos.", enabled: "Avisarme de nuevas solicitudes", language: "Idioma de las notificaciones", save: "Guardar preferencias", loading: "Cargando ajustes…", saved: "Preferencias guardadas.", error: "No se pudieron guardar los ajustes.", invalid: "Introduce un ID numérico de Telegram o deja el campo vacío.", myidTitle: "Cómo encontrar tu ID", myidBody: "Abre VOYAGE Concierge en Telegram, envía /start y /myid, y copia el ID que responde.", disabledRole: "Las alertas de Telegram están disponibles para Owner y Admin." },
  PT: { title: "Alertas de novas candidaturas no Telegram", subtitle: "Receba uma mensagem no Telegram quando alguém se candidatar ao VOYAGE.", chatId: "ID do Telegram do destinatário", chatHint: "Abra o bot, envie /start e depois /myid. Copie o ID numérico aqui. IDs negativos para grupos são aceitos.", enabled: "Avisar sobre novas candidaturas", language: "Idioma das notificações", save: "Salvar preferências", loading: "Carregando configurações…", saved: "Preferências salvas.", error: "Não foi possível salvar as configurações.", invalid: "Informe um ID numérico do Telegram ou deixe o campo vazio.", myidTitle: "Como encontrar seu ID", myidBody: "Abra o VOYAGE Concierge no Telegram, envie /start e /myid, depois copie o ID retornado.", disabledRole: "Os alertas do Telegram estão disponíveis para Owner e Admin." },
};

export default function AdminTelegramNotificationSettings() {
  const { role } = useAuth();
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const [telegramId, setTelegramId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [language, setLanguage] = useState<Lang>(lang);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    if (role !== "owner" && role !== "admin") return;
    let alive = true;
    void getMyAdminTelegramSettings().then((result) => {
      if (!alive) return;
      if (result.ok) {
        setTelegramId(result.settings.notifications_tg_id ?? "");
        setEnabled(result.settings.notify_new_applications);
        setLanguage(result.settings.notification_language);
      } else setMessage(t.error);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [role, t.error]);
  if (role !== "owner" && role !== "admin") return null;
  const save = () => {
    if (telegramId.trim() && !/^-?[0-9]{5,20}$/.test(telegramId.trim())) { setMessage(t.invalid); return; }
    setMessage("");
    startTransition(async () => {
      const result = await saveMyAdminTelegramSettings({ telegramId, enabled, language });
      setMessage(result.ok ? t.saved : result.reason === "invalid" ? t.invalid : t.error);
    });
  };
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 shadow-xl shadow-black/10 sm:p-6">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-200/[0.05] text-amber-100"><BellRing size={18} /></span><div><h2 className="font-serif text-xl text-zinc-100">{t.title}</h2><p className="mt-1 text-sm leading-6 text-zinc-500">{t.subtitle}</p></div></div>
      {loading ? <p className="mt-5 flex items-center gap-2 text-sm text-zinc-500"><LoaderCircle size={15} className="animate-spin" />{t.loading}</p> : <div className="mt-5 space-y-5">
        <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">{t.chatId}</span><input value={telegramId} onChange={(event) => setTelegramId(event.target.value)} inputMode="numeric" autoComplete="off" placeholder="123456789" maxLength={20} className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-3 text-sm text-zinc-100 outline-none transition focus:border-amber-200/50"/><span className="mt-2 block text-xs leading-5 text-zinc-600">{t.chatHint}</span></label>
        <label className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3.5 py-3"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="mt-1 accent-amber-200"/><span className="text-sm text-zinc-200">{t.enabled}</span></label>
        <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">{t.language}</span><select value={language} onChange={(event) => setLanguage(event.target.value as Lang)} className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-amber-200/50"><option value="EN">English</option><option value="RU">Русский</option><option value="ES">Español</option><option value="PT">Português</option></select></label>
        {message && <p role="status" className={`rounded-lg border px-3 py-2 text-xs ${message === t.saved ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-200" : "border-rose-500/20 bg-rose-500/5 text-rose-200"}`}>{message}</p>}
        <div className="flex justify-end"><button type="button" onClick={save} disabled={isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-200/40 bg-amber-200 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-100 disabled:opacity-50">{isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}{t.save}</button></div>
      </div>}
    </section>
  );
}
