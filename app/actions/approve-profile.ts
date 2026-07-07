'use server';

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

// Admin-клиент ТОЛЬКО на сервере, service_role никогда не попадает в браузер
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function generatePassword(length = 16) {
  // без неоднозначных символов, чтобы удобно диктовать/копировать
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => charset[b % charset.length]).join('');
}

type ApproveResult =
  | { success: true; email: string; password: string }
  | { success: false; error: string };

export async function approveProfile(profileId: string): Promise<ApproveResult> {
  // TODO: здесь обязательно проверьте, что вызывающий — админ
  // (например, через createServerClient из @supabase/ssr + проверку роли),
  // иначе экшен сможет дёрнуть кто угодно.

  // 1. Читаем заявку и проверяем состояние
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, status, user_id')
    .eq('id', profileId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: 'Заявка не найдена' };
  }
  if (profile.status === 'approved' && profile.user_id) {
    return { success: false, error: 'Заявка уже одобрена, аккаунт существует' };
  }
  if (!profile.email) {
    return { success: false, error: 'В анкете нет email — не из чего создать аккаунт' };
  }

  // 2. Создаём auth-юзера
  const password = generatePassword();

  const { data: created, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email: profile.email,
      password,
      email_confirm: true, // сразу подтверждён, письмо не шлём
      user_metadata: {
        full_name: profile.full_name,
        profile_id: profile.id, // обратная ссылка — удобно для отладки
      },
      app_metadata: {
        role: 'model', // app_metadata юзер сам менять не может — годится для ролей
      },
    });

  if (createError || !created.user) {
    // частый кейс: юзер с таким email уже есть
    return {
      success: false,
      error: `Не удалось создать аккаунт: ${createError?.message ?? 'unknown'}`,
    };
  }

  // 3. Связываем профиль с auth-юзером и меняем статус
  const { error: linkError } = await supabaseAdmin
    .from('profiles')
    .update({
      user_id: created.user.id,
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .is('user_id', null); // защита от гонки двойного одобрения

  if (linkError) {
    // Компенсация: не оставляем "сироту" в auth.users
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return {
      success: false,
      error: `Аккаунт создан, но привязка не удалась, изменения откатились: ${linkError.message}`,
    };
  }

  // 4. Возвращаем доступы админу, чтобы он передал их модели
  return { success: true, email: profile.email, password };
}