import { createClient } from '@supabase/supabase-js';

// Достаем твои ключи из скрытого файла .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Создаем и экспортируем "клиент" — это и есть наша линия связи с базой
export const supabase = createClient(supabaseUrl, supabaseAnonKey);