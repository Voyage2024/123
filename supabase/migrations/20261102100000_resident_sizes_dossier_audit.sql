-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Размеры резидентки + журнал аудита выгрузок досье
--
-- 1) profiles.clothing_size / profiles.shoe_size
--    Колонки nullable: у существующих профилей размеров нет, и NOT NULL
--    сломал бы их (и любые UPDATE таких строк). Обязательность держит
--    анкета резидентки и server action updateResidentSizes (стереть
--    указанный размер нельзя). CHECK дублирует сетку из lib/resident-sizes.ts.
--    Пишет только service_role (server action), поэтому UPDATE-grant для
--    authenticated НЕ выдаём. SELECT у authenticated табличный — новые
--    колонки он покрывает автоматически; RLS на чтение не меняется.
--
-- 2) public.audit_logs — журнал «кто, кого и когда скачал».
--    Вставляет только service_role из server action (в том же вызове,
--    что отдаёт данные досье). Читать может только owner. Записи
--    неизменяемые: UPDATE/DELETE запрещены триггером даже service_role.
--
-- 3) Достижение status_legend: «Легенда Status» → «Легенда Voyage»
--    в уже выданных записях ledger (ключ не меняется).
--
-- Идемпотентно: можно запускать повторно.
-- ════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Размеры ──────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists clothing_size text,
  add column if not exists shoe_size numeric(3,1);

alter table public.profiles drop constraint if exists profiles_clothing_size_check;
alter table public.profiles
  add constraint profiles_clothing_size_check
  check (clothing_size is null or clothing_size in ('XXS','XS','S','M','L','XL','XXL'));

alter table public.profiles drop constraint if exists profiles_shoe_size_check;
alter table public.profiles
  add constraint profiles_shoe_size_check
  check (shoe_size is null or (shoe_size between 33 and 46 and shoe_size * 2 = trunc(shoe_size * 2)));

comment on column public.profiles.clothing_size is
  'VOYAGE: размер одежды XXS…XXL. Обязателен в анкете (валидация в приложении), в БД nullable для старых профилей.';
comment on column public.profiles.shoe_size is
  'VOYAGE: размер обуви EU 33…46, шаг 0.5. Обязателен в анкете (валидация в приложении), в БД nullable для старых профилей.';

-- ── 2. Журнал аудита ────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id                 bigint generated always as identity primary key,
  created_at         timestamptz not null default now(),
  action             text not null,
  actor_profile_id   uuid,
  actor_user_id      uuid,
  actor_email        text,
  actor_role         text,
  target_profile_id  uuid,
  target_label       text,
  ip                 text,
  user_agent         text,
  metadata           jsonb not null default '{}'::jsonb,
  constraint audit_logs_action_check check (action ~ '^[a-z0-9_.:-]{3,64}$'),
  constraint audit_logs_ua_length check (user_agent is null or char_length(user_agent) <= 512),
  constraint audit_logs_ip_length check (ip is null or char_length(ip) <= 128)
);

comment on table public.audit_logs is
  'VOYAGE: неизменяемый журнал чувствительных действий (выгрузка досье резиденток и т.п.). Пишет service_role, читает owner.';

-- Без внешних ключей намеренно: запись должна пережить удаление резидентки и владельца.
create index if not exists audit_logs_target_idx on public.audit_logs (target_profile_id, created_at desc);
create index if not exists audit_logs_actor_idx  on public.audit_logs (actor_profile_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action, created_at desc);

alter table public.audit_logs enable row level security;

revoke all on table public.audit_logs from anon, authenticated;
grant select on table public.audit_logs to authenticated;
grant all on table public.audit_logs to service_role;

drop policy if exists audit_logs_owner_select on public.audit_logs;
create policy audit_logs_owner_select on public.audit_logs
  for select to authenticated
  using (public.is_owner());

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  -- Ретенцию (чистку старых записей) можно сделать вручную из SQL Editor:
  --   set local voyage.audit_maintenance = 'on'; delete from public.audit_logs where ...;
  if current_setting('voyage.audit_maintenance', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'audit_logs is append-only' using errcode = '42501';
end $$;

drop trigger if exists audit_logs_immutable on public.audit_logs;
create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- ── 3. Переименование достижения в уже выданных записях ─────────────
update public.resident_achievements
   set title = case
     when title ilike '%status legend%' then 'Voyage Legend'
     when title ilike 'leyenda status%' then 'Leyenda Voyage'
     when title ilike 'lenda status%'   then 'Lenda Voyage'
     else 'Легенда Voyage'
   end
 where achievement_key = 'status_legend'
   and title ilike '%status%';

commit;
