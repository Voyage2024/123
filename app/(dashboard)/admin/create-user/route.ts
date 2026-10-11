import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateUserPayload = {
  email?: unknown;
  password?: unknown;
  full_name?: unknown;
  location?: unknown;
  citizenship?: unknown;
  status?: unknown;
  kyc_level?: unknown;
};

function activeBan(until: unknown, permanent: unknown) {
  if (permanent === true || until === "infinity") return true;
  if (typeof until !== "string" || !until) return false;
  const ms = Date.parse(until);
  return Number.isFinite(ms) && ms > Date.now();
}

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: "Supabase server configuration is incomplete." }, { status: 503 });
    }

    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });

    const asUser = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authResult, error: authError } = await asUser.auth.getUser(token);
    if (authError || !authResult.user) {
      return NextResponse.json({ error: "Сессия недействительна." }, { status: 401 });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: actor, error: actorError } = await admin
      .from("profiles")
      .select("role, banned_until, ban_permanent")
      .eq("id", authResult.user.id)
      .maybeSingle();
    if (actorError || !actor) return NextResponse.json({ error: "Не удалось проверить роль пользователя." }, { status: 403 });
    if (activeBan(actor.banned_until, actor.ban_permanent)) return NextResponse.json({ error: "Аккаунт заблокирован." }, { status: 403 });
    if (actor.role !== "owner" && actor.role !== "admin") return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });

    const body = (await request.json()) as CreateUserPayload;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = typeof body.full_name === "string" ? body.full_name.trim().replace(/\s+/g, " ") : "";
    const location = typeof body.location === "string" ? body.location.trim().slice(0, 120) : "";
    const citizenship = typeof body.citizenship === "string" ? body.citizenship.trim().slice(0, 120) : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Укажите корректный email." }, { status: 400 });
    }
    if (password.length < 10 || password.length > 128) {
      return NextResponse.json({ error: "Пароль должен содержать от 10 до 128 символов." }, { status: 400 });
    }
    if (fullName.length < 2 || fullName.length > 100) {
      return NextResponse.json({ error: "ФИО должно содержать от 2 до 100 символов." }, { status: 400 });
    }

    const requestedKyc = Number(body.kyc_level);
    const kycLevel = Number.isInteger(requestedKyc) ? Math.min(3, Math.max(0, requestedKyc)) : 0;
    const requestedStatus = typeof body.status === "string" ? body.status.trim() : "pending";
    const status = ["pending", "approved", "rejected", "declined", "blocked"].includes(requestedStatus)
      ? (requestedStatus === "declined" ? "rejected" : requestedStatus)
      : "pending";

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, name: fullName },
    });
    if (createError || !created.user) {
      return NextResponse.json({ error: createError?.message ?? "Не удалось создать Auth-пользователя." }, { status: 400 });
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: created.user.id,
      full_name: fullName,
      name: fullName,
      email,
      location: location || null,
      citizenship: citizenship || null,
      status,
      kyc_level: kycLevel,
      role: "resident",
      segment: "working",
      reliability: 100,
    }, { onConflict: "id" });

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: `Не удалось создать профиль: ${profileError.message}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId: created.user.id }, { status: 201 });
  } catch (error) {
    console.error("[admin/create-user] Unexpected error", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера." }, { status: 500 });
  }
}
