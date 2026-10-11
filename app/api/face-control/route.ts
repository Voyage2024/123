import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function activeBan(until: unknown, permanent: unknown) {
  if (permanent === true || until === "infinity") return true;
  if (typeof until !== "string" || !until) return false;
  const time = Date.parse(until);
  return Number.isFinite(time) && time > Date.now();
}

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: "Supabase server configuration is incomplete." }, { status: 503 });
    }

    const body = (await request.json().catch(() => null)) as { id?: unknown; action?: unknown } | null;
    const targetId = typeof body?.id === "string" ? body.id : "";
    const action = body?.action;
    if (!targetId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
      return NextResponse.json({ error: "Некорректный ID анкеты." }, { status: 400 });
    }
    if (action !== "approve" && action !== "decline") {
      return NextResponse.json({ error: "Некорректное действие." }, { status: 400 });
    }

    const token = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: "Необходима авторизация." }, { status: 401 });

    const userClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: "Сессия недействительна." }, { status: 401 });

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: actor, error: actorError } = await admin
      .from("profiles")
      .select("role, banned_until, ban_permanent")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (actorError || !actor) return NextResponse.json({ error: "Не удалось проверить роль вызывающего." }, { status: 403 });
    if (activeBan(actor.banned_until, actor.ban_permanent)) return NextResponse.json({ error: "Аккаунт заблокирован." }, { status: 403 });
    if (actor.role !== "owner" && actor.role !== "admin") return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, email, telegram_id, status, role, kyc_level")
      .eq("id", targetId)
      .maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: "Анкета не найдена." }, { status: 404 });
    if (profile.role !== "resident") return NextResponse.json({ error: "Face Control доступен только для анкет резидентов." }, { status: 400 });

    if (action === "decline") {
      const { error } = await admin.from("profiles").update({ status: "rejected", kyc_level: 0 }).eq("id", targetId);
      if (error) return NextResponse.json({ error: `Не удалось отклонить анкету: ${error.message}` }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (profile.status === "approved" && Number(profile.kyc_level ?? 0) >= 1) {
      return NextResponse.json({ error: "Анкета уже одобрена." }, { status: 409 });
    }

    // Never create a second Auth identity: profiles.id is the canonical auth.users.id in this schema.
    const { data: authTarget, error: targetAuthError } = await admin.auth.admin.getUserById(targetId);
    if (targetAuthError || !authTarget.user) {
      return NextResponse.json({ error: "У анкеты нет связанного Auth-аккаунта. Проверьте profiles.id и auth.users.id." }, { status: 409 });
    }

    const login = `voyage_${crypto.randomBytes(4).toString("hex")}`;
    const password = crypto.randomBytes(14).toString("base64url");
    const accountEmail = authTarget.user.email?.trim().toLowerCase() ||
      (typeof profile.email === "string" && profile.email.includes("@")
        ? profile.email.trim().toLowerCase()
        : `${login}@members.voyage-club.app`);

    const { error: credentialError } = await admin.auth.admin.updateUserById(targetId, {
      email: accountEmail,
      email_confirm: true,
      password,
      user_metadata: {
        ...(authTarget.user.user_metadata ?? {}),
        login,
        full_name: profile.full_name,
        profile_id: targetId,
        telegram_id: profile.telegram_id,
      },
    });
    if (credentialError) {
      return NextResponse.json({ error: `Не удалось подготовить доступ: ${credentialError.message}` }, { status: 500 });
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ status: "approved", kyc_level: 1, email: accountEmail })
      .eq("id", targetId);
    if (updateError) return NextResponse.json({ error: `Auth доступ подготовлен, но профиль не обновлён: ${updateError.message}` }, { status: 500 });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!profile.telegram_id || !botToken) {
      return NextResponse.json({
        ok: true,
        warning: !profile.telegram_id
          ? "Анкета одобрена, но telegram_id не указан. Передайте доступы вручную через защищённый канал."
          : "Анкета одобрена, но TELEGRAM_BOT_TOKEN не настроен. Передайте доступы вручную через защищённый канал.",
      });
    }

    const message =
      `Ваша анкета VOYAGE одобрена.\n\n` +
      `Вход: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://voyage-club.app"}/login\n` +
      `Email: ${accountEmail}\n` +
      `Временный пароль: ${password}\n\n` +
      `После входа смените пароль.`;
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: profile.telegram_id, text: message }),
      cache: "no-store",
    });
    if (!telegramResponse.ok) {
      console.error("[face-control] Telegram delivery failed:", await telegramResponse.text().catch(() => ""));
      return NextResponse.json({ ok: true, warning: "Анкета одобрена, но Telegram не доставил сообщение. Передайте доступы вручную через защищённый канал." });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[face-control] Unexpected error", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера." }, { status: 500 });
  }
}
