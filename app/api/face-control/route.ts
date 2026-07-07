import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// crypto.randomBytes → нужен Node-рантайм, не Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ──────────────────────────────────────────────────────────────────────
 * POST /api/face-control  { id: string, action: "approve" | "decline" }
 *
 * Одобрение/отклонение кандидата. Проверяем, что вызывает залогиненный
 * админ (по access-token из заголовка Authorization), затем сервис-ключом
 * меняем статус, а при approve — создаём аккаунт, генерим логин/пароль и
 * шлём поздравление в Telegram по telegram_id.
 *
 * ENV (все секретные — БЕЗ NEXT_PUBLIC, только в .env.local / на сервере):
 *   NEXT_PUBLIC_SUPABASE_URL       (уже есть)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  (уже есть)
 *   SUPABASE_SERVICE_ROLE_KEY      ← секрет! Settings → API → service_role
 *   TELEGRAM_BOT_TOKEN             ← секрет! токен бота от @BotFather
 *   NEXT_PUBLIC_SITE_URL           ← адрес сайта для ссылки на вход
 * ──────────────────────────────────────────────────────────────────── */

const ADMIN_EMAIL = "fridelltubaugh129@gmail.com"; // тот же, что в Sidebar/admin
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const { id, action } = (await req.json()) as {
      id?: string;
      action?: "approve" | "decline";
    };

    if (!id || (action !== "approve" && action !== "decline")) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // ── 1) Авторизация: вызывающий должен быть админом ──────────────────
    const token = (req.headers.get("authorization") ?? "").replace(
      /^Bearer\s+/i,
      "",
    );
    if (!token) {
      return NextResponse.json({ error: "Нет токена" }, { status: 401 });
    }

    // Клиент «от имени пользователя» — чтобы узнать, кто он.
    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userData.user) {
      return NextResponse.json({ error: "Сессия недействительна" }, { status: 401 });
    }
    const callerEmail = userData.user.email?.toLowerCase().trim();
    if (callerEmail !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    // ── 2) Админский клиент (service role) для привилегированных операций ─
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Тянем анкету (telegram_id обязателен для уведомления).
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, full_name, telegram_id, status")
      .eq("id", id)
      .single();
    if (pErr || !profile) {
      return NextResponse.json({ error: "Анкета не найдена" }, { status: 404 });
    }

    /* ── DECLINE ──────────────────────────────────────────────────────── */
    if (action === "decline") {
      const { error } = await admin
        .from("profiles")
        .update({ status: "declined", kyc_level: -1 })
        .eq("id", id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    /* ── APPROVE ──────────────────────────────────────────────────────── */
    // Идемпотентность: если анкета уже одобрена — НЕ создаём второй аккаунт.
    if (profile.status === "approved") {
      return NextResponse.json(
        { error: "Кандидат уже одобрен ранее." },
        { status: 409 },
      );
    }

    // Генерируем логин и временный пароль криптостойко.
    const login = `voyage_${crypto.randomBytes(3).toString("hex")}`;
    const password = crypto.randomBytes(9).toString("base64url"); // ~12 симв.

    // Supabase Auth логинит по email. Если в анкете нет реального email —
    // делаем технический на основе логина (кандидат заходит по нему).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const realEmail = (profile as any).email?.trim?.();
    const accountEmail = realEmail || `${login}@members.voyage-club.app`;

    // Создаём аккаунт.
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: accountEmail,
        password,
        email_confirm: true, // без письма-подтверждения
        user_metadata: {
          login,
          full_name: profile.full_name,
          profile_id: profile.id,
          telegram_id: profile.telegram_id,
        },
      });
    if (createErr) {
      return NextResponse.json(
        { error: `Не удалось создать аккаунт: ${createErr.message}` },
        { status: 500 },
      );
    }

    // Обновляем анкету: одобрено.
    // Если добавишь колонку user_id (uuid) — можно связать профиль с аккаунтом:
    //   user_id: created.user?.id
    const { error: updErr } = await admin
      .from("profiles")
      .update({ status: "approved", kyc_level: 1 })
      .eq("id", id);
    if (updErr) {
      return NextResponse.json(
        { error: `Аккаунт создан, но профиль не обновлён: ${updErr.message}` },
        { status: 500 },
      );
    }

    // ── Telegram: поздравление с логином и паролем ──────────────────────
    if (profile.telegram_id) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN!;
      const text =
        `🎉 Поздравляем! Ваша анкета одобрена.\n\n` +
        `Теперь вам доступен личный кабинет для работы над зарубежными проектами.\n\n` +
        `🔗 Вход: ${SITE_URL}/login\n` +
        `👤 Логин: ${accountEmail}\n` +
        `🔑 Временный пароль: ${password}\n\n` +
        `⚠️ Обязательно смените пароль после первого входа.`;

      const tgRes = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: profile.telegram_id, text }),
        },
      );

      if (!tgRes.ok) {
        const body = await tgRes.text().catch(() => "");
        console.error("[face-control] Telegram sendMessage failed:", body);
        // Аккаунт уже создан — не валим весь запрос, но предупреждаем.
        return NextResponse.json({
          ok: true,
          warning: "Аккаунт создан, но уведомление в Telegram не отправлено.",
        });
      }
    } else {
      return NextResponse.json({
        ok: true,
        warning: "Аккаунт создан, но у анкеты нет telegram_id — уведомление не отправлено.",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[face-control] route error:", e);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
