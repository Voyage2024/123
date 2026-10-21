-- ════════════════════════════════════════════════════════════════════════
-- VOYAGE · Гайды: SEO-поля и картинки в тексте статей
-- supabase/migrations/20261021110000_guides_seo_images.sql
--
-- Накатывается ПОСЛЕ 20261021100000_guides_cms.sql (таблица guides,
-- бакет guide-files). Скрипт идемпотентный.
--
--   1. public.guides: seo_title, seo_description, seo_keywords
--   2. Бакет guide-images (jpg/png/webp/gif/avif, до 5 МБ):
--      читают все, загружают/меняют/удаляют только admin/owner
--   3. Повторно фиксирует настройки бакета guide-files (PDF до 20 МБ)
--
-- Пустые SEO-поля допустимы: на странице гайда тогда берутся title и
-- description. Роли — через public.is_admin(), как в остальном дампе.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ─── 1. SEO-поля ───────────────────────────────────────────────────────

alter table public.guides
  add column if not exists seo_title       text,
  add column if not exists seo_description text,
  add column if not exists seo_keywords    text;

comment on column public.guides.seo_title       is 'Мета-тег <title>. Пусто → используется title. Рекомендуется до 60 символов.';
comment on column public.guides.seo_description is 'Мета-тег description для выдачи. Пусто → используется description. Рекомендуется 120–160 символов.';
comment on column public.guides.seo_keywords    is 'SEO-ядро через запятую.';
comment on column public.guides.content         is 'Полный текст: Markdown + HTML (таблицы, <img>, <figure> и т.д.). HTML очищается при выводе на сайт.';

alter table public.guides drop constraint if exists guides_seo_title_length;
alter table public.guides add constraint guides_seo_title_length
  check (seo_title is null or char_length(seo_title) <= 120);

alter table public.guides drop constraint if exists guides_seo_description_length;
alter table public.guides add constraint guides_seo_description_length
  check (seo_description is null or char_length(seo_description) <= 320);

alter table public.guides drop constraint if exists guides_seo_keywords_length;
alter table public.guides add constraint guides_seo_keywords_length
  check (seo_keywords is null or char_length(seo_keywords) <= 1000);

-- ─── 2. Бакет guide-images ─────────────────────────────────────────────
-- SVG сознательно не разрешён: это документ со скриптами, а не картинка.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guide-images', 'guide-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "guide-images: public read" on storage.objects;
create policy "guide-images: public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'guide-images');

drop policy if exists "guide-images: admin uploads" on storage.objects;
create policy "guide-images: admin uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'guide-images' and (select public.is_admin()));

drop policy if exists "guide-images: admin updates" on storage.objects;
create policy "guide-images: admin updates" on storage.objects
  for update to authenticated
  using (bucket_id = 'guide-images' and (select public.is_admin()))
  with check (bucket_id = 'guide-images' and (select public.is_admin()));

drop policy if exists "guide-images: admin deletes" on storage.objects;
create policy "guide-images: admin deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'guide-images' and (select public.is_admin()));

-- ─── 3. guide-files (на случай, если бакет создавали вручную) ──────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guide-files', 'guide-files', true, 20971520, array['application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─── 4. SEO по умолчанию для стартового гайда про чемодан ─────────────

update public.guides set
  seo_title       = coalesce(seo_title, 'Что взять в тур: чек-лист чемодана | VOYAGE'),
  seo_description = coalesce(seo_description, 'Чек-лист чемодана для тура: образы под разные вечера, бьюти-минимум, документы и мелочи, о которых вспоминают в самолёте. И что можно оставить дома.'),
  seo_keywords    = coalesce(seo_keywords, 'что взять в тур, чемодан в поездку, чек-лист вещей, список вещей в путешествие, бьюти-минимум')
where slug = 'chemodan-v-tur-bez-paniki';

update public.guides set
  seo_title       = coalesce(seo_title, 'What to pack for a tour: suitcase checklist | VOYAGE'),
  seo_description = coalesce(seo_description, 'A suitcase checklist for the tour: looks for every evening, a beauty minimum, documents and the small things people remember on the plane.'),
  seo_keywords    = coalesce(seo_keywords, 'what to pack for a tour, packing list, travel checklist, beauty minimum')
where slug = 'packing-for-a-tour-without-panic';

update public.guides set
  seo_title       = coalesce(seo_title, 'Qué llevar al tour: checklist de la maleta | VOYAGE'),
  seo_description = coalesce(seo_description, 'Checklist de la maleta para el tour: looks para cada noche, lo mínimo de belleza, documentos y los detalles que se recuerdan en el avión.'),
  seo_keywords    = coalesce(seo_keywords, 'qué llevar de viaje, lista de equipaje, checklist maleta, belleza básica')
where slug = 'la-maleta-del-tour-sin-panico';

update public.guides set
  seo_title       = coalesce(seo_title, 'O que levar no tour: checklist da mala | VOYAGE'),
  seo_description = coalesce(seo_description, 'Checklist da mala para o tour: looks para cada noite, o mínimo de beleza, documentos e os detalhes que só lembramos no avião.'),
  seo_keywords    = coalesce(seo_keywords, 'o que levar na viagem, lista de mala, checklist de viagem, beleza básica')
where slug = 'a-mala-do-tour-sem-panico';

commit;
