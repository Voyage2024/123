-- ════════════════════════════════════════════════════════════════════
-- ROLLBACK · 20261125091000_tour_catalog_managers_backfill.sql
-- Отзывает назначения, созданные backfill (source = 'backfill'), которые ещё
-- активны. Строки НЕ удаляются: история назначений неизменна (так задумано),
-- в ней останется «отозвано: rollback backfill». Кастинги и поездки не трогаются.
-- Записи отчёта в audit_logs остаются (журнал append-only).
-- Выполнять в SQL Editor целиком. Безопасно повторять.
-- ════════════════════════════════════════════════════════════════════
begin;
update public.tour_catalog_managers
   set is_active = false,
       revoked_at = now(),
       revoked_by = null,
       revoke_reason = 'rollback backfill 20261125091000'
 where source = 'backfill' and is_active;
commit;
