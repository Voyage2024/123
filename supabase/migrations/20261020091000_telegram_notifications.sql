-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Telegram-оповещения резиденток и менеджеров с учётом настроек
-- supabase/migrations/20261020091000_telegram_notifications.sql
--
-- Требует 20261020090000_member_preferences.sql.
--
-- Все оповещения идут через уже существующую очередь public.partner_notifications
-- (её разбирает /api/telegram/notify). Миграция:
--
--   1. Новые шаблоны очереди:
--        резидентка  tour_published · party_published · application_approved · points_awarded
--        менеджер    casting_response · contract_signed · docs_uploaded · review_received
--   2. Статус 'sending' + claimed_at: строку забирает один обработчик
--      (voyage_claim_partner_notification), даже если вебхуки пришли пачкой —
--      без дублей в Telegram.
--   3. voyage_notification_allowed() — тумблер из member_preferences.
--      partner_queue_notification() кладёт строку со статусом skipped / opted_out,
--      если участница отключила этот вид оповещений. Служебные письма
--      (договор, документы, KYC, ссылка входа) не отключаются.
--   4. Триггеры-источники:
--        applications / event_applications → approved   application_approved
--        partner_casting_responses → selected             application_approved (кастинг)
--        resident_score_events (+баллы)                   points_awarded, одно сообщение на транзакцию
--        map_hubs стал активным                           tour_published  (working, approved)
--        global_events стал активным                      party_published (сегмент, уровень, KYC)
--        partner_casting_responses → ready                casting_response (не чаще раза в 30 мин на кастинг)
--        partner_contract_signatures (не менеджер)        contract_signed
--        partner_events kind = docs_uploaded              docs_uploaded
--        partner_reviews resident_to_manager published    review_received (анонимно)
--
-- Рассылка о новом туре/тусовке не создаёт строк для тех, у кого нет Telegram
-- или оповещение выключено, и не повторяется для той же локации/тусовки 7 дней.
-- ════════════════════════════════════════════════════════════════════

begin;

/* ── 1–2. Очередь: шаблоны, статус sending ──────────────────────────── */

alter table public.partner_notifications
  add column if not exists claimed_at timestamptz;

alter table public.partner_notifications drop constraint if exists partner_notifications_template_check;
alter table public.partner_notifications add constraint partner_notifications_template_check check (template = any (array[
  'contract_sign_request', 'contract_reminder', 'docs_reminder', 'kyc_approved', 'access_link',
  'tour_published', 'party_published', 'application_approved', 'points_awarded',
  'casting_response', 'contract_signed', 'docs_uploaded', 'review_received'
]::text[]));

alter table public.partner_notifications drop constraint if exists partner_notifications_status_check;
alter table public.partner_notifications add constraint partner_notifications_status_check check (status = any (array[
  'queued', 'sending', 'sent', 'failed', 'skipped'
]::text[]));

create index if not exists partner_notifications_dedupe_idx
  on public.partner_notifications (template, recipient_id, ((payload ->> 'ref_id')), created_at desc);

-- Забрать строку на отправку. Возвращает строку, только если этот вызов её «взял».
-- Повисшие в sending дольше 10 минут (упал процесс) снова доступны.
create or replace function public.voyage_claim_partner_notification(p_id uuid, p_include_failed boolean default false)
returns setof public.partner_notifications
language sql security definer
set search_path to ''
as $$
  update public.partner_notifications n
     set status = 'sending', claimed_at = now()
   where n.id = p_id
     and n.attempts < 3
     and (
       n.status = 'queued'
       or (p_include_failed and n.status = 'failed')
       or (n.status = 'sending' and n.claimed_at < now() - interval '10 minutes')
     )
  returning n.*
$$;

revoke all on function public.voyage_claim_partner_notification(uuid, boolean) from public, anon, authenticated;
grant execute on function public.voyage_claim_partner_notification(uuid, boolean) to service_role;

/* ── 3. Настройки → можно ли слать ─────────────────────────────────── */

create or replace function public.voyage_notification_allowed(p_recipient uuid, p_template text)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select coalesce((
    select case p_template
             when 'tour_published'       then mp.notify_tours
             when 'party_published'      then mp.notify_parties
             when 'application_approved' then mp.notify_approvals
             when 'points_awarded'       then mp.notify_points
             when 'casting_response'     then mp.notify_casting_responses
             when 'contract_signed'      then mp.notify_contract_signed
             when 'docs_uploaded'        then mp.notify_docs_uploaded
             when 'review_received'      then mp.notify_reviews
             else true
           end
    from public.member_preferences mp
    where mp.profile_id = p_recipient
  ), true)
$$;

revoke all on function public.voyage_notification_allowed(uuid, text) from public, anon;
grant execute on function public.voyage_notification_allowed(uuid, text) to authenticated, service_role;

create or replace function public.partner_queue_notification(p_recipient uuid, p_template text, p_tour uuid, p_payload jsonb, p_created_by uuid)
returns text
language plpgsql security definer
set search_path to ''
as $$
declare
  v_error text := case
    when not public.voyage_notification_allowed(p_recipient, p_template) then 'opted_out'
    when not public.partner_has_telegram(p_recipient) then 'no_telegram'
  end;
  v_status text := case when v_error is null then 'queued' else 'skipped' end;
begin
  insert into public.partner_notifications (recipient_id, template, tour_id, payload, status, error, created_by)
  values (p_recipient, p_template, p_tour, coalesce(p_payload, '{}'::jsonb), v_status, v_error, p_created_by);
  return v_status;
end;
$$;

revoke all on function public.partner_queue_notification(uuid, text, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.partner_queue_notification(uuid, text, uuid, jsonb, uuid) to service_role;

-- Тихая версия для массовых и второстепенных событий: если слать некому —
-- строку не создаёт (лишняя строка = лишний вызов вебхука).
create or replace function public.voyage_queue_if_allowed(p_recipient uuid, p_template text, p_tour uuid, p_payload jsonb)
returns boolean
language plpgsql security definer
set search_path to ''
as $$
begin
  if p_recipient is null
     or not public.voyage_notification_allowed(p_recipient, p_template)
     or not public.partner_has_telegram(p_recipient) then
    return false;
  end if;
  insert into public.partner_notifications (recipient_id, template, tour_id, payload, status, created_by)
  values (p_recipient, p_template, p_tour, coalesce(p_payload, '{}'::jsonb), 'queued', auth.uid());
  return true;
end;
$$;

revoke all on function public.voyage_queue_if_allowed(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.voyage_queue_if_allowed(uuid, text, uuid, jsonb) to service_role;

/* ── 4a. Одобрение заявки на тур / тусовку / кастинг ──────────────── */

create or replace function public.voyage_notify_application_approved()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_payload jsonb;
begin
  if new.status is distinct from 'approved' or old.status is not distinct from 'approved' then
    return null;
  end if;

  if tg_table_name = 'applications' then
    select jsonb_build_object('kind', 'tour', 'ref_id', h.id, 'title_i18n', h.name, 'region', h.region)
      into v_payload
      from public.map_hubs h where h.id = new.hub_id;
    v_payload := coalesce(v_payload, jsonb_build_object('kind', 'tour', 'ref_id', new.hub_id, 'title', new.hub_id));
  else
    select jsonb_build_object('kind', 'party', 'ref_id', e.id, 'title', e.title, 'region', e.region)
      into v_payload
      from public.global_events e where e.id = new.event_id;
    v_payload := coalesce(v_payload, jsonb_build_object('kind', 'party', 'ref_id', new.event_id));
  end if;

  perform public.voyage_queue_if_allowed(new.user_id, 'application_approved', null, v_payload);
  return null;
end;
$$;

drop trigger if exists voyage_notify_application_approved on public.applications;
create trigger voyage_notify_application_approved
  after update of status on public.applications
  for each row when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.voyage_notify_application_approved();

drop trigger if exists voyage_notify_application_approved on public.event_applications;
create trigger voyage_notify_application_approved
  after update of status on public.event_applications
  for each row when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.voyage_notify_application_approved();

/* ── 4b. Отклики на кастинг: менеджеру — новый «Готова», резидентке — «выбрана» ── */

create or replace function public.voyage_notify_casting_response()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  c public.partner_castings%rowtype;
  v_tour uuid;
begin
  select * into c from public.partner_castings where id = new.casting_id;
  if not found then return null; end if;

  -- Резидентку выбрали (рукопожатие): она в составе тура
  if new.status = 'selected' and (tg_op = 'INSERT' or old.status is distinct from 'selected') then
    select t.id into v_tour from public.partner_tours t
     where t.casting_id = c.id order by t.created_at desc limit 1;
    perform public.voyage_queue_if_allowed(new.resident_id, 'application_approved', v_tour,
      jsonb_build_object('kind', 'casting', 'ref_id', c.id, 'city', c.city, 'project', c.project_type,
                         'starts_on', c.starts_on, 'ends_on', c.ends_on));
    return null;
  end if;

  -- Новый отклик «Готова» → менеджеру кастинга, не чаще раза в 30 минут на кастинг
  if new.status = 'ready' and (tg_op = 'INSERT' or old.status is distinct from 'ready')
     and not public.partner_is_blacklisted(new.resident_id)
     and c.status in ('open', 'shortlist')
     and not exists (
       select 1 from public.partner_notifications n
        where n.recipient_id = c.manager_id and n.template = 'casting_response'
          and n.payload ->> 'ref_id' = c.id::text
          and n.status in ('queued', 'sending', 'sent')
          and n.created_at > now() - interval '30 minutes'
     ) then
    perform public.voyage_queue_if_allowed(c.manager_id, 'casting_response', null,
      jsonb_build_object(
        'ref_id', c.id, 'city', c.city, 'project', c.project_type,
        'code', public.partner_blind_code(new.id),
        'count', (select count(*) from public.partner_casting_responses r
                   where r.casting_id = c.id and r.status = 'ready'
                     and r.created_at > c.manager_seen_at
                     and not public.partner_is_blacklisted(r.resident_id)),
        'slots', c.slots
      ));
  end if;
  return null;
end;
$$;

drop trigger if exists voyage_notify_casting_response on public.partner_casting_responses;
create trigger voyage_notify_casting_response
  after insert or update of status on public.partner_casting_responses
  for each row execute function public.voyage_notify_casting_response();

/* ── 4c. Начисление баллов: одно сообщение на транзакцию ──────────── */

create or replace function public.voyage_notify_points_awarded()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_row public.partner_notifications%rowtype;
  v_label text := coalesce(nullif(new.metadata ->> 'source_label', ''), new.reason);
begin
  if new.points <= 0 then return null; end if;
  if not exists (select 1 from public.profiles p where p.id = new.profile_id and p.role = 'resident') then
    return null;
  end if;

  -- Тур закрыт → тур + штамп + комбо + ачивка приходят в одной транзакции.
  -- Складываем их в одно сообщение: now() одинаков в пределах транзакции.
  select * into v_row from public.partner_notifications n
   where n.recipient_id = new.profile_id and n.template = 'points_awarded'
     and n.status = 'queued' and n.created_at = now()
   order by n.created_at desc
   limit 1
   for update;

  if found then
    update public.partner_notifications n
       set payload = jsonb_build_object(
             'points', coalesce((v_row.payload ->> 'points')::int, 0) + new.points,
             'items', coalesce(v_row.payload -> 'items', '[]'::jsonb)
                      || jsonb_build_array(jsonb_build_object('category', new.category, 'points', new.points, 'label', v_label)),
             'activity_id', coalesce(v_row.payload ->> 'activity_id', new.activity_id::text)
           )
     where n.id = v_row.id;
  else
    perform public.voyage_queue_if_allowed(new.profile_id, 'points_awarded', null,
      jsonb_build_object(
        'points', new.points,
        'items', jsonb_build_array(jsonb_build_object('category', new.category, 'points', new.points, 'label', v_label)),
        'activity_id', new.activity_id
      ));
  end if;
  return null;
end;
$$;

drop trigger if exists voyage_notify_points_awarded on public.resident_score_events;
create trigger voyage_notify_points_awarded
  after insert on public.resident_score_events
  for each row when (new.points > 0)
  execute function public.voyage_notify_points_awarded();

/* ── 4d. Новый тур на карте → working-резиденткам ─────────────────── */

create or replace function public.voyage_notify_tour_published()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  if coalesce(new.is_active, true) is not true then return null; end if;
  if tg_op = 'UPDATE' and coalesce(old.is_active, true) is true then return null; end if;

  insert into public.partner_notifications (recipient_id, template, payload, status, created_by)
  select p.id, 'tour_published',
         jsonb_build_object('ref_id', new.id, 'title_i18n', new.name, 'subtitle_i18n', new.subtitle, 'region', new.region),
         'queued', auth.uid()
    from public.profiles p
   where p.role = 'resident'
     and p.status = 'approved'
     and p.segment = 'working'
     and not coalesce(p.is_npc, false)
     and nullif(btrim(p.telegram_id), '') is not null
     and public.voyage_notification_allowed(p.id, 'tour_published')
     and not exists (
       select 1 from public.partner_notifications n
        where n.template = 'tour_published' and n.recipient_id = p.id
          and n.payload ->> 'ref_id' = new.id
          and n.created_at > now() - interval '7 days'
     );
  return null;
end;
$$;

drop trigger if exists voyage_notify_tour_published on public.map_hubs;
create trigger voyage_notify_tour_published
  after insert or update of is_active on public.map_hubs
  for each row execute function public.voyage_notify_tour_published();

/* ── 4e. Новая тусовка → кому она доступна ────────────────────────── */

create or replace function public.voyage_notify_party_published()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  if new.is_active is not true then return null; end if;
  if tg_op = 'UPDATE' and old.is_active is true then return null; end if;
  if new.application_closes_at is not null and new.application_closes_at <= now() then return null; end if;

  insert into public.partner_notifications (recipient_id, template, payload, status, created_by)
  select p.id, 'party_published',
         jsonb_build_object('ref_id', new.id, 'title', new.title, 'region', new.region,
                            'closes_at', new.application_closes_at),
         'queued', auth.uid()
    from public.profiles p
   where p.role = 'resident'
     and p.status = 'approved'
     and not coalesce(p.is_npc, false)
     and (new.audience_segment = 'all' or p.segment = new.audience_segment)
     and coalesce(p.level, 1) >= new.minimum_level
     and coalesce(p.kyc_level, 0) >= new.minimum_kyc_level
     and nullif(btrim(p.telegram_id), '') is not null
     and public.voyage_notification_allowed(p.id, 'party_published')
     and not exists (
       select 1 from public.partner_notifications n
        where n.template = 'party_published' and n.recipient_id = p.id
          and n.payload ->> 'ref_id' = new.id::text
          and n.created_at > now() - interval '7 days'
     );
  return null;
end;
$$;

drop trigger if exists voyage_notify_party_published on public.global_events;
create trigger voyage_notify_party_published
  after insert or update of is_active on public.global_events
  for each row execute function public.voyage_notify_party_published();

/* ── 4f. Менеджеру: подпись договора участницей ───────────────────── */

create or replace function public.voyage_notify_contract_signed()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_contract public.partner_contracts%rowtype;
  t public.partner_tours%rowtype;
  v_signed int;
  v_required int;
begin
  select * into v_contract from public.partner_contracts where id = new.contract_id;
  if not found then return null; end if;
  select * into t from public.partner_tours where id = v_contract.tour_id;
  if not found or new.signer_id = t.manager_id then return null; end if;

  select count(*)::int + 1 into v_required
    from public.partner_tour_members m
   where m.tour_id = t.id and m.status in ('confirmed', 'flown');
  select count(*)::int into v_signed
    from public.partner_contract_signatures s
   where s.contract_id = v_contract.id
     and (s.signer_id = t.manager_id or s.signer_id in (
           select m.resident_id from public.partner_tour_members m
            where m.tour_id = t.id and m.status in ('confirmed', 'flown')));

  perform public.voyage_queue_if_allowed(t.manager_id, 'contract_signed', t.id,
    jsonb_build_object(
      'ref_id', t.id, 'city', t.city, 'project', t.project_type, 'departs_at', t.departs_at,
      'version', v_contract.version, 'signed', v_signed, 'required', v_required,
      'name', (select public.partner_short_name(p.full_name) from public.profiles p where p.id = new.signer_id)
    ));
  return null;
end;
$$;

drop trigger if exists voyage_notify_contract_signed on public.partner_contract_signatures;
create trigger voyage_notify_contract_signed
  after insert on public.partner_contract_signatures
  for each row execute function public.voyage_notify_contract_signed();

/* ── 4g. Менеджеру: участница загрузила документы ─────────────────── */

create or replace function public.voyage_notify_docs_uploaded()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  t public.partner_tours%rowtype;
begin
  select * into t from public.partner_tours where id = new.tour_id;
  if not found or coalesce(new.actor_id, new.subject_id) = t.manager_id then return null; end if;

  perform public.voyage_queue_if_allowed(t.manager_id, 'docs_uploaded', t.id,
    jsonb_build_object(
      'ref_id', t.id, 'city', t.city, 'project', t.project_type, 'departs_at', t.departs_at,
      'name', (select public.partner_short_name(p.full_name) from public.profiles p
                where p.id = coalesce(new.subject_id, new.actor_id))
    ));
  return null;
end;
$$;

drop trigger if exists voyage_notify_docs_uploaded on public.partner_events;
create trigger voyage_notify_docs_uploaded
  after insert on public.partner_events
  for each row when (new.kind = 'docs_uploaded')
  execute function public.voyage_notify_docs_uploaded();

/* ── 4h. Менеджеру: опубликован отзыв резидентки (без имени автора) ── */

create or replace function public.voyage_notify_review_received()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  t public.partner_tours%rowtype;
begin
  if new.direction <> 'resident_to_manager' or new.status <> 'published' then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'published' then return null; end if;

  select * into t from public.partner_tours where id = new.tour_id;
  perform public.voyage_queue_if_allowed(new.subject_id, 'review_received', new.tour_id,
    jsonb_build_object('ref_id', new.id, 'rating', new.rating, 'city', t.city, 'project', t.project_type,
                       'has_comment', new.comment is not null));
  return null;
end;
$$;

drop trigger if exists voyage_notify_review_received on public.partner_reviews;
create trigger voyage_notify_review_received
  after insert or update of status on public.partner_reviews
  for each row execute function public.voyage_notify_review_received();

-- Триггерные функции не вызываются напрямую
revoke all on function public.voyage_notify_application_approved() from public, anon, authenticated;
revoke all on function public.voyage_notify_casting_response() from public, anon, authenticated;
revoke all on function public.voyage_notify_points_awarded() from public, anon, authenticated;
revoke all on function public.voyage_notify_tour_published() from public, anon, authenticated;
revoke all on function public.voyage_notify_party_published() from public, anon, authenticated;
revoke all on function public.voyage_notify_contract_signed() from public, anon, authenticated;
revoke all on function public.voyage_notify_docs_uploaded() from public, anon, authenticated;
revoke all on function public.voyage_notify_review_received() from public, anon, authenticated;

commit;
