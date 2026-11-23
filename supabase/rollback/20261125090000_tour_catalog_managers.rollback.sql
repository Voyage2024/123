-- ════════════════════════════════════════════════════════════════════
-- ROLLBACK · 20261125090000_tour_catalog_managers.sql
--
-- ВНИМАНИЕ: удаляет таблицы назначений и заметок владельца вместе с данными.
-- Перед запуском выгрузите их (Table Editor → Export CSV или):
--   select * from public.tour_catalog_managers;
--   select * from public.tour_catalog_owner_notes;
-- Сначала откатите 20261125091000 (если применялась) — не обязательно, таблица
-- всё равно удаляется.
--
-- Возвращает политики tour_catalog к состоянию 20261103090000 (менеджеры снова
-- видят весь каталог, правят только owner/admin). Записи истории в audit_logs
-- остаются (журнал append-only). Отзыв TRUNCATE у authenticated НЕ
-- возвращается намеренно: TRUNCATE обходит RLS.
-- Код Next.js этой поставки после отката нужно вернуть к предыдущей версии
-- (страница /partner/castings/tours ждёт новые RPC; форма кастинга сама
-- откатывается на прежний запрос к tour_catalog).
-- ════════════════════════════════════════════════════════════════════
begin;

drop trigger if exists partner_castings_catalog_assignment on public.partner_castings;
drop trigger if exists tour_catalog_zz_manager_guard on public.tour_catalog;
drop trigger if exists tour_catalog_audit on public.tour_catalog;

drop policy if exists tour_catalog_select on public.tour_catalog;
create policy tour_catalog_select on public.tour_catalog
  for select to authenticated
  using (is_active or (select public.is_staff()));

drop policy if exists tour_catalog_update on public.tour_catalog;
create policy tour_catalog_update on public.tour_catalog
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop function if exists public.voyage_catalog_tours_for_casting();
drop function if exists public.voyage_my_catalog_tours();
drop function if exists public.voyage_owner_catalog_tour_history(uuid, integer);
drop function if exists public.voyage_owner_revoke_catalog_manager(uuid, text, uuid);
drop function if exists public.voyage_owner_transfer_casting(uuid, uuid);
drop function if exists public.voyage_owner_assign_catalog_manager(uuid, uuid, text);
drop function if exists public.voyage_owner_catalog_assignments(uuid);
drop function if exists public.voyage_owner_catalog_manager_candidates(text, integer);
drop function if exists public.voyage_catalog_assignment_json(public.tour_catalog_managers);
drop function if exists public.partner_castings_catalog_assignment();
drop function if exists public.tour_catalog_audit();
drop function if exists public.tour_catalog_manager_guard();

drop index if exists public.audit_logs_catalog_tour_idx;

drop table if exists public.tour_catalog_owner_notes;
drop table if exists public.tour_catalog_managers;

drop function if exists public.voyage_catalog_manager_can_read(uuid);
drop function if exists public.voyage_catalog_i_manage(uuid);
drop function if exists public.tour_catalog_owner_notes_audit();
drop function if exists public.tour_catalog_owner_notes_touch();
drop function if exists public.tour_catalog_managers_guard();
drop function if exists public.tour_catalog_managers_labels();
drop function if exists public.voyage_catalog_manager_eligible(uuid);

commit;
