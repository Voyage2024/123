\set ON_ERROR_STOP 1
-- Тестовые пользователи (локальный стенд): owner, admin, менеджеры A/B/C, резидентка
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-4000-8000-0000000000a1','owner@t.local','authenticated','authenticated','{}','{}',now(),now()),
 ('00000000-0000-4000-8000-0000000000a5','adm@t.local','authenticated','authenticated','{}','{}',now(),now()),
 ('00000000-0000-4000-8000-0000000000b1','mgr-a@t.local','authenticated','authenticated','{}','{}',now(),now()),
 ('00000000-0000-4000-8000-0000000000b2','mgr-b@t.local','authenticated','authenticated','{}','{}',now(),now()),
 ('00000000-0000-4000-8000-0000000000b3','mgr-c@t.local','authenticated','authenticated','{}','{}',now(),now()),
 ('00000000-0000-4000-8000-0000000000c1','res@t.local','authenticated','authenticated','{}','{}',now(),now())
on conflict do nothing;
update public.profiles set role='owner', status='approved', full_name='Owner' where id='00000000-0000-4000-8000-0000000000a1';
update public.profiles set role='admin', status='approved', full_name='Admin' where id='00000000-0000-4000-8000-0000000000a5';
update public.profiles set role='manager', status='approved', full_name='Manager A', agency_name='Agency A', telegram_username='mgr_a' where id='00000000-0000-4000-8000-0000000000b1';
update public.profiles set role='manager', status='approved', full_name='Manager B', agency_name='Agency B' where id='00000000-0000-4000-8000-0000000000b2';
update public.profiles set role='manager', status='approved', full_name='Manager C' where id='00000000-0000-4000-8000-0000000000b3';
update public.profiles set role='resident', status='approved', segment='working', kyc_level=3 where id='00000000-0000-4000-8000-0000000000c1';

-- Сценарии backfill (туры и кастинги «как до миграции»)
insert into public.tour_catalog (slug, city, map_hub_id, title_i18n, fee_amount, fee_currency) values
 ('paris-single','x','paris','{"RU":"Париж · один менеджер"}', 500, 'USD'),
 ('london-multi','x','london','{"RU":"Лондон · два менеджера"}', null, null),
 ('bangkok-empty','x','bangkok','{"RU":"Бангкок · без кастингов"}', null, null),
 ('seattle-admin','x','seattle','{"RU":"Сиэтл · кастинг от admin"}', null, null),
 ('italy-banned','x','italy','{"RU":"Италия · менеджер заблокирован"}', null, null),
 ('greece-trip','x','greece','{"RU":"Греция · поездка у другого менеджера"}', null, null)
on conflict do nothing;

insert into public.partner_castings (manager_id, city, project_type, starts_on, ends_on, slots, closes_at, catalog_tour_id)
select m::uuid, 'x', 'tour', '2026-12-05', '2026-12-20', 3, now()+interval '10 days', (select id from public.tour_catalog where slug=s)
from (values
  ('00000000-0000-4000-8000-0000000000b1','paris-single'),
  ('00000000-0000-4000-8000-0000000000b1','london-multi'),
  ('00000000-0000-4000-8000-0000000000b2','london-multi'),
  ('00000000-0000-4000-8000-0000000000a5','seattle-admin'),
  ('00000000-0000-4000-8000-0000000000b3','italy-banned'),
  ('00000000-0000-4000-8000-0000000000b1','greece-trip')) v(m, s);

-- Поездка из кастинга greece-trip ведётся другим менеджером (противоречие)
insert into public.partner_tours (casting_id, manager_id, city, project_type, departs_at)
select c.id, '00000000-0000-4000-8000-0000000000b2', c.city, c.project_type, now()+interval '20 days'
from public.partner_castings c join public.tour_catalog t on t.id=c.catalog_tour_id where t.slug='greece-trip';

-- Менеджер C заблокирован после создания кастинга
update public.profiles set ban_permanent = true where id='00000000-0000-4000-8000-0000000000b3';
