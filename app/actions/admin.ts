"use server"; // Это говорит Next.js, что код должен работать только на сервере!

import { createClient } from '@supabase/supabase-js';

// Создаем "админское" подключение с помощью Мастер-ключа
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createResident(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Мастер-ключ позволяет нам создавать подтвержденных юзеров сразу с именем
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true, // Без подтверждений по почте
    user_metadata: { name: name } // Сразу кладем имя в карман!
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}