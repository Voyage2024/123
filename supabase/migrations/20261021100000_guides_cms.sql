-- ════════════════════════════════════════════════════════════════════════
-- VOYAGE · Гайды и шпаргалки из базы (CMS для блока на главной)
-- supabase/migrations/20261021100000_guides_cms.sql
--
--   1. Таблица public.guides (+ updated_at, индексы, проверки)
--   2. RLS: опубликованное читают все, черновики и запись — admin/owner
--   3. Бакет Storage guide-files (только PDF, до 20 МБ):
--      читают все, загружают/меняют/удаляют только admin/owner
--   4. Сид: текущий гайд «Чемодан в тур без паники» на RU/EN/ES/PT,
--      чтобы главная не опустела сразу после переключения на базу
--
-- Роли проверяются через уже существующую public.is_admin()
-- (= has_role('admin','owner')), как в остальных политиках дампа.
-- Скрипт идемпотентный: повторный запуск ничего не ломает.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ─── 1. Таблица ────────────────────────────────────────────────────────

create table if not exists public.guides (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  slug          text not null,
  description   text not null default '',
  content       text not null default '',
  reading_time  text,
  pdf_url       text,
  language      text not null default 'ru',
  tags          text[] not null default '{}'::text[],
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint guides_slug_key        unique (slug),
  constraint guides_slug_format     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  constraint guides_title_length    check (char_length(btrim(title)) between 3 and 200),
  constraint guides_language_check  check (language in ('ru', 'en', 'es', 'pt'))
);

comment on table  public.guides              is 'Гайды и шпаргалки клуба: блок на главной и страницы /guides/[slug]. Управление — /admin/guides.';
comment on column public.guides.slug         is 'Уникальный url-идентификатор: латиница, цифры и дефисы.';
comment on column public.guides.content      is 'Полный текст гайда, markdown (заголовки #, списки, **жирный**, *курсив*, ссылки, цитаты >).';
comment on column public.guides.reading_time is 'Свободный текст, например «7 мин чтения».';
comment on column public.guides.pdf_url      is 'Публичная ссылка на PDF в бакете guide-files (или путь от корня сайта).';
comment on column public.guides.language     is 'ru | en | es | pt';

create index if not exists guides_public_feed_idx
  on public.guides (language, created_at desc)
  where is_published;

drop trigger if exists guides_set_updated_at on public.guides;
create trigger guides_set_updated_at
  before update on public.guides
  for each row execute function public.set_updated_at();

-- ─── 2. RLS ────────────────────────────────────────────────────────────

alter table public.guides enable row level security;

drop policy if exists guides_select_published on public.guides;
create policy guides_select_published on public.guides
  for select to anon, authenticated
  using (is_published);

drop policy if exists guides_select_admin on public.guides;
create policy guides_select_admin on public.guides
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists guides_insert_admin on public.guides;
create policy guides_insert_admin on public.guides
  for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists guides_update_admin on public.guides;
create policy guides_update_admin on public.guides
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists guides_delete_admin on public.guides;
create policy guides_delete_admin on public.guides
  for delete to authenticated
  using ((select public.is_admin()));

grant select on table public.guides to anon;
grant select, insert, update, delete on table public.guides to authenticated;
grant all on table public.guides to service_role;

-- ─── 3. Storage: бакет guide-files ─────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guide-files', 'guide-files', true, 20971520, array['application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "guide-files: public read" on storage.objects;
create policy "guide-files: public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'guide-files');

drop policy if exists "guide-files: admin uploads" on storage.objects;
create policy "guide-files: admin uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'guide-files' and (select public.is_admin()));

drop policy if exists "guide-files: admin updates" on storage.objects;
create policy "guide-files: admin updates" on storage.objects
  for update to authenticated
  using (bucket_id = 'guide-files' and (select public.is_admin()))
  with check (bucket_id = 'guide-files' and (select public.is_admin()));

drop policy if exists "guide-files: admin deletes" on storage.objects;
create policy "guide-files: admin deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'guide-files' and (select public.is_admin()));

-- ─── 4. Сид: текущий гайд с главной ────────────────────────────────────
-- PDF пока указывает на public/guides/voyage-suitcase-guide.pdf (как было
-- в коде). Позже можно открыть гайд в /admin/guides и загрузить PDF в Storage.
-- Полного текста статьи в коде не было, поэтому content пустой: на странице
-- гайда покажутся описание и кнопка «Скачать PDF». Текст добавляется в админке.

insert into public.guides (title, slug, description, content, reading_time, pdf_url, language, tags, is_published, created_at)
values
  (
    'Чемодан в тур без паники: что реально взять с собой для работы и жизни, а что оставить дома',
    'chemodan-v-tur-bez-paniki',
    'Проверенный список вещей для тура: образы под разные форматы вечеров, бьюти-минимум, документы и мелочи, о которых вспоминают уже в самолёте. Плюс то, что можно смело оставить дома.',
    '',
    '7 мин чтения',
    '/guides/voyage-suitcase-guide.pdf',
    'ru',
    array['образы', 'бьюти', 'документы'],
    true,
    now()
  ),
  (
    'Packing for a tour without panic: what to actually bring for work and life, and what to leave at home',
    'packing-for-a-tour-without-panic',
    'A tested packing list for the tour: looks for different evening formats, a beauty minimum, documents and the small things people remember only on the plane. Plus what you can safely leave at home.',
    '',
    '7 min read',
    '/guides/voyage-suitcase-guide.pdf',
    'en',
    array['looks', 'beauty', 'documents'],
    true,
    now()
  ),
  (
    'La maleta del tour sin pánico: qué llevar de verdad para el trabajo y la vida, y qué dejar en casa',
    'la-maleta-del-tour-sin-panico',
    'Una lista probada para el tour: looks para distintos formatos de noche, lo mínimo de belleza, documentos y esos detalles que se recuerdan ya en el avión. Y lo que puedes dejar en casa sin miedo.',
    '',
    '7 min de lectura',
    '/guides/voyage-suitcase-guide.pdf',
    'es',
    array['looks', 'belleza', 'documentos'],
    true,
    now()
  ),
  (
    'A mala do tour sem pânico: o que realmente levar para o trabalho e a vida, e o que deixar em casa',
    'a-mala-do-tour-sem-panico',
    'Uma lista testada para o tour: looks para diferentes formatos de noite, o mínimo de beleza, documentos e os detalhes que só lembramos no avião. E o que você pode deixar em casa sem medo.',
    '',
    '7 min de leitura',
    '/guides/voyage-suitcase-guide.pdf',
    'pt',
    array['looks', 'beleza', 'documentos'],
    true,
    now()
  )
on conflict (slug) do nothing;

commit;
