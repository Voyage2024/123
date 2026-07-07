import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. ЗАЩИТА: Проверяем, кто стучится в этот API
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');

    // Создаем обычного клиента для проверки токена (без админских прав)
    const supabaseNormal = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Спрашиваем у базы: чей это токен?
    const { data: { user }, error: userError } = await supabaseNormal.auth.getUser(token);

    // Проверяем, что это именно ты!
    if (userError || user?.email !== 'fridelltubaugh129@gmail.com') {
      return NextResponse.json({ error: "Доступ запрещен. Только для админа." }, { status: 403 });
    }

    // 2. ЕСЛИ ЭТО ТЫ: Включаем режим Бога и создаем юзера
    const body = await request.json();
    const { email, password, full_name, location, citizenship, status, kyc_level } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email и пароль обязательны" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, 
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { name: full_name }
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    const newUserId = authData.user.id;

    // 3. Обновляем профиль
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUserId,
        full_name: full_name || null,
        location: location || null,
        citizenship: citizenship || null,
        status: status === "__none__" ? null : status,
        kyc_level: Number(kyc_level) || 1,
      }, { onConflict: "id" });

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

    // Обрати внимание: мы возвращаем userId, как и просил Клод!
    return NextResponse.json({ success: true, userId: newUserId });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}