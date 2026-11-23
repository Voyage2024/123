#!/bin/bash
# VOYAGE · сценарные тесты RLS/RPC: менеджеры туров каталога (20261125090000 + 091000)
# Запуск на ЛОКАЛЬНОМ стенде (не на Production!): ./suite.sh  (нужен ./t.sh рядом)
cd "$(dirname "$0")"
O=00000000-0000-4000-8000-0000000000a1; ADM=00000000-0000-4000-8000-0000000000a5
MA=00000000-0000-4000-8000-0000000000b1; MB=00000000-0000-4000-8000-0000000000b2; R=00000000-0000-4000-8000-0000000000c1
VM=00000000-0000-4000-8000-000000c1ab00
TOUR="(select id from tour_catalog where slug='dubai-season')"
CNT() { echo "do \$\$ begin if ($1) is distinct from $2 then raise exception 'EXPECTED % GOT %', $2, ($1); end if; end \$\$;"; }
ROWS() { echo "do \$\$ declare n int; begin $1; get diagnostics n = row_count; if n <> $2 then raise exception 'EXPECTED % ROWS GOT %', $2, n; end if; end \$\$;"; }

echo "## Owner"
./t.sh "owner: создаёт тур Dubai · Season (гонорар 500 USD)" $O "insert into tour_catalog (slug, city, map_hub_id, title_i18n, conditions_i18n, fee_amount, fee_currency) values ('dubai-season','x','dubai','{\"RU\":\"Dubai · Season\"}','{\"RU\":\"Перелёт оплачивает организатор\"}',500,'USD');" ok
./t.sh "owner: внутренняя заметка" $O "insert into tour_catalog_owner_notes (catalog_tour_id, body) values ($TOUR, 'SECRET-NOTE-XYZ Анна TG @anna WA +971');" ok
./t.sh "owner: назначает VOYAGE Management" $O "select voyage_owner_assign_catalog_manager($TOUR, '$VM', 'старт');" ok
./t.sh "owner: назначает Manager A" $O "select voyage_owner_assign_catalog_manager($TOUR, '$MA');" ok
./t.sh "owner: назначает Manager B" $O "select voyage_owner_assign_catalog_manager($TOUR, '$MB');" ok
./t.sh "owner: повторное активное назначение A нельзя" $O "select voyage_owner_assign_catalog_manager($TOUR, '$MA');" err:manager_already_assigned
./t.sh "owner: резидентку назначить нельзя" $O "select voyage_owner_assign_catalog_manager($TOUR, '$R');" err:manager_not_eligible
./t.sh "owner: admin назначить нельзя" $O "select voyage_owner_assign_catalog_manager($TOUR, '$ADM');" err:manager_not_eligible
./t.sh "owner: заблокированного менеджера C назначить нельзя" $O "select voyage_owner_assign_catalog_manager($TOUR, '00000000-0000-4000-8000-0000000000b3');" err:manager_not_eligible
./t.sh "owner: 3 активных назначения" $O "$(CNT "select jsonb_array_length(voyage_owner_catalog_assignments($TOUR))" 3)" ok

echo "## Manager A"
./t.sh "A: видит назначенный тур" $MA "$(CNT "select count(*) from tour_catalog where slug='dubai-season'" 1)" ok
./t.sh "A: не видит тур без назначения (bangkok-empty)" $MA "$(CNT "select count(*) from tour_catalog where slug='bangkok-empty'" 0)" ok
./t.sh "A: «Мои направления» = dubai-season, london-multi, paris-single" $MA "$(CNT "select jsonb_array_length(voyage_my_catalog_tours())" 3)" ok
./t.sh "A: видит базовые условия (гонорар 500)" $MA "$(CNT "select fee_amount::int from tour_catalog where slug='dubai-season'" 500)" ok
./t.sh "A: правит условия тура" $MA "update tour_catalog set conditions_i18n='{\"RU\":\"Перелёт и отель — организатор (A)\"}', height_min=172, is_active=true where slug='dubai-season';" ok
./t.sh "A: локацию тура менять нельзя" $MA "update tour_catalog set map_hub_id='paris' where slug='dubai-season';" err:catalog_field_forbidden
./t.sh "A: порядок (sort_order) менять нельзя" $MA "update tour_catalog set sort_order=99 where slug='dubai-season';" err:catalog_field_forbidden
./t.sh "A: slug менять нельзя" $MA "update tour_catalog set slug='hack' where slug='dubai-season';" err:catalog_field_forbidden
./t.sh "A: чужой тур не правится (0 строк)" $MA "$(ROWS "update tour_catalog set height_min=150 where slug='bangkok-empty'" 0)" ok
./t.sh "A: создать тур в каталоге нельзя" $MA "insert into tour_catalog (slug, city, map_hub_id, title_i18n) values ('a-own','x','dubai','{\"RU\":\"A\"}');" err:row-level
./t.sh "A: удалить тур нельзя (0 строк)" $MA "$(ROWS "delete from tour_catalog where slug='dubai-season'" 0)" ok
./t.sh "A: создаёт кастинг 5–20 декабря с гонораром 600" $MA "insert into partner_castings (city, project_type, starts_on, ends_on, slots, closes_at, catalog_tour_id, fee_amount, fee_currency) values ('x','tour','2026-12-05','2026-12-20',3, now()+interval '9 days', $TOUR, 600, 'USD');" ok
./t.sh "A: второй кастинг 10–25 января (базовые 500)" $MA "insert into partner_castings (city, project_type, starts_on, ends_on, slots, closes_at, catalog_tour_id, fee_amount, fee_currency) values ('x','tour','2027-01-10','2027-01-25',2, now()+interval '9 days', $TOUR, 500, 'USD');" ok
./t.sh "A: меняет условия своего кастинга (650)" $MA "update partner_castings set fee_amount=650 where catalog_tour_id=$TOUR and starts_on='2026-12-05';" ok
./t.sh "A: каталог не изменился (гонорар 500)" - "$(CNT "select fee_amount::int from tour_catalog where slug='dubai-season'" 500)" ok
./t.sh "A: кастинг на чужой тур нельзя" $MA "insert into partner_castings (city, project_type, starts_on, ends_on, slots, closes_at, catalog_tour_id) values ('x','tour','2027-01-10','2027-01-20',2, now()+interval '9 days',(select id from tour_catalog where slug='bangkok-empty'));" err:catalog_tour
./t.sh "A: подмена manager_id (кастинг от имени B) нельзя" $MA "insert into partner_castings (manager_id, city, project_type, starts_on, ends_on, slots, closes_at, catalog_tour_id) values ('$MB','x','tour','2027-02-01','2027-02-15',2, now()+interval '9 days', $TOUR);" err:organizer_forbidden
./t.sh "A: заметку не видит (0 строк)" $MA "$(CNT "select count(*) from tour_catalog_owner_notes" 0)" ok
./t.sh "A: заметку записать нельзя" $MA "insert into tour_catalog_owner_notes (catalog_tour_id, body) values ($TOUR, 'x');" err:row-level
./t.sh "A: видит только свои назначения" $MA "$(CNT "select count(*) from tour_catalog_managers where manager_id <> auth.uid()" 0)" ok
./t.sh "A: назначать менеджеров нельзя" $MA "select voyage_owner_assign_catalog_manager((select id from tour_catalog where slug='paris-single'), '$MB');" err:owner_only
./t.sh "A: прямой insert в назначения нельзя" $MA "insert into tour_catalog_managers (catalog_tour_id, manager_id) values ((select id from tour_catalog where slug='paris-single'), '$MA');" err:permission
./t.sh "A: история изменений недоступна" $MA "select voyage_owner_catalog_tour_history($TOUR);" err:owner_only
./t.sh "A: TRUNCATE каталога нельзя" $MA "truncate tour_catalog cascade;" err:permission
./t.sh "A: ни один ответ RPC не содержит заметку" $MA "$(CNT "select (voyage_my_catalog_tours()::text || coalesce(voyage_catalog_tour_brief($TOUR)::text,'') || coalesce((select jsonb_agg(c)::text from partner_castings_list() c),'')) like '%SECRET-NOTE%'" false)" ok

echo "## Manager B"
./t.sh "B: видит изменения A (рост 172)" $MB "$(CNT "select height_min from tour_catalog where slug='dubai-season'" 172)" ok
./t.sh "B: создаёт свой кастинг 1–15 февраля" $MB "insert into partner_castings (city, project_type, starts_on, ends_on, slots, closes_at, catalog_tour_id) values ('x','tour','2027-02-01','2027-02-15',2, now()+interval '9 days', $TOUR);" ok
./t.sh "B: в «Мои направления» видит 3 кастинга тура, из них 1 свой" $MB "$(CNT "select count(*) filter (where (c->>'is_mine')::boolean) || '/' || count(*) from jsonb_array_elements((select t->'castings' from jsonb_array_elements(voyage_my_catalog_tours()) t where t->>'slug'='dubai-season')) c" "'1/3'")" ok
./t.sh "B: кастинги A через таблицу не видит (RLS)" $MB "$(CNT "select count(*) from partner_castings where manager_id='$MA'" 0)" ok
./t.sh "B: отозвать назначение нельзя" $MB "select voyage_owner_revoke_catalog_manager((select id from tour_catalog_managers where manager_id='$MA' and is_active limit 1));" err:owner_only
./t.sh "B: прямой update назначений нельзя" $MB "update tour_catalog_managers set is_active=false where manager_id='$MA';" err:permission
./t.sh "B: заметку не читает" $MB "$(CNT "select count(*) from tour_catalog_owner_notes" 0)" ok

echo "## Admin (права не расширены)"
./t.sh "admin: заметку не видит" $ADM "$(CNT "select count(*) from tour_catalog_owner_notes" 0)" ok
./t.sh "admin: заметку записать нельзя" $ADM "insert into tour_catalog_owner_notes (catalog_tour_id, body) values ($TOUR, 'x');" err:row-level
./t.sh "admin: назначения не видит" $ADM "$(CNT "select count(*) from tour_catalog_managers" 0)" ok
./t.sh "admin: назначать нельзя" $ADM "select voyage_owner_assign_catalog_manager($TOUR, '$MA');" err:owner_only
./t.sh "admin: история недоступна" $ADM "select voyage_owner_catalog_tour_history($TOUR);" err:owner_only
./t.sh "admin: правит каталог как раньше" $ADM "update tour_catalog set sort_order=5 where slug='dubai-season';" ok

echo "## Поездка и отзыв назначения A"
./t.sh "A: поездка из первого кастинга (partner_create_tour)" $MA "select partner_create_tour((select id from partner_castings where catalog_tour_id=$TOUR and starts_on='2026-12-05'), now()+interval '30 days');" ok
./t.sh "owner: отзывает A, открытые кастинги без поездки → VOYAGE Management" $O "$(CNT "select (r->>'transferred')::jsonb ->> 0 is not null and jsonb_array_length(r->'kept')=1 from voyage_owner_revoke_catalog_manager((select id from tour_catalog_managers where manager_id='$MA' and catalog_tour_id=$TOUR and is_active), 'Ушёл из агентства', '$VM') r" true)" ok
./t.sh "кастинг января перешёл к VOYAGE Management, автор декабрьского (с поездкой) не изменился" - "$(CNT "select string_agg(case when manager_id='$VM' then 'VM' when manager_id='$MA' then 'A' else '?' end, ',' order by starts_on) from partner_castings where catalog_tour_id=$TOUR" "'A,VM,?'")" ok
./t.sh "поездка цела, manager_id = A" - "$(CNT "select count(*) from partner_tours where manager_id='$MA' and casting_id=(select id from partner_castings where catalog_tour_id=$TOUR and starts_on='2026-12-05')" 1)" ok
./t.sh "A: условия тура больше не правит (0 строк)" $MA "$(ROWS "update tour_catalog set height_min=180 where slug='dubai-season'" 0)" ok
./t.sh "A: новый кастинг на тур нельзя" $MA "insert into partner_castings (city, project_type, starts_on, ends_on, slots, closes_at, catalog_tour_id) values ('x','tour','2027-03-01','2027-03-10',2, now()+interval '9 days', $TOUR);" err:catalog_tour_not_assigned
./t.sh "A: в старом кастинге менять условия нельзя" $MA "update partner_castings set fee_amount=900 where catalog_tour_id=$TOUR and starts_on='2026-12-05';" err:catalog_assignment_revoked
./t.sh "A: продлить приём откликов нельзя" $MA "update partner_castings set closes_at=closes_at+interval '7 days' where catalog_tour_id=$TOUR and starts_on='2026-12-05';" err:catalog_assignment_revoked
./t.sh "A: старый кастинг → шорт-лист можно" $MA "update partner_castings set status='shortlist' where catalog_tour_id=$TOUR and starts_on='2026-12-05';" ok
./t.sh "A: переоткрыть набор нельзя" $MA "update partner_castings set status='open' where catalog_tour_id=$TOUR and starts_on='2026-12-05';" err:catalog_assignment_revoked
./t.sh "A: закрыть старый кастинг можно" $MA "update partner_castings set status='closed' where catalog_tour_id=$TOUR and starts_on='2026-12-05';" ok
./t.sh "A: свой старый кастинг и тур по нему видит (только чтение)" $MA "$(CNT "select count(*) from tour_catalog where slug='dubai-season'" 1)" ok
./t.sh "A: в «Мои направления» тура больше нет" $MA "$(CNT "select count(*) from jsonb_array_elements(voyage_my_catalog_tours()) t where t->>'slug'='dubai-season'" 0)" ok
./t.sh "A: вернуть себе назначение напрямую нельзя" $MA "update tour_catalog_managers set is_active=true, revoked_at=null where manager_id=auth.uid();" err:permission
./t.sh "owner: полный доступ сохраняется" $O "update tour_catalog set fee_amount=550 where slug='dubai-season';" ok
./t.sh "owner: заметка на месте после отзыва" $O "$(CNT "select count(*) from tour_catalog_owner_notes where body like 'SECRET-NOTE%'" 1)" ok
./t.sh "owner: история назначений (кто назначил/отозвал)" $O "$(CNT "select count(*) from jsonb_array_elements(voyage_owner_catalog_assignments($TOUR)) a where a->>'is_active'='false' and a->>'revoked_by_name' is not null and a->>'revoke_reason'='Ушёл из агентства'" 1)" ok
./t.sh "owner: история условий содержит правку менеджера A (роль manager, старое/новое)" $O "$(CNT "select count(*) from jsonb_array_elements(voyage_owner_catalog_tour_history($TOUR)) h where h->>'action'='tour_catalog.update' and h->>'actor_role'='manager' and h->'metadata'->'changes'->'height_min'->>'new'='172'" 1)" ok
./t.sh "owner: в журнале нет текста заметки" - "$(CNT "select count(*) from audit_logs where metadata::text like '%SECRET-NOTE%'" 0)" ok
./t.sh "история назначений неизменна даже для postgres" - "delete from tour_catalog_managers where manager_id='$MA';" err:assignment_history_immutable
./t.sh "журнал audit_logs неизменен" - "delete from audit_logs where action like 'tour_catalog.%';" err:append-only
./t.sh "owner: повторно назначить A можно (новая строка истории)" $O "select voyage_owner_assign_catalog_manager($TOUR, '$MA', 'вернулся');" ok
./t.sh "у A снова доступ" $MA "$(CNT "select count(*) from jsonb_array_elements(voyage_my_catalog_tours()) t where t->>'slug'='dubai-season'" 1)" ok

echo "## Резидентка"
./t.sh "R: видит активные туры как раньше" $R "$(CNT "select count(*) > 0 from tour_catalog" true)" ok
./t.sh "R: назначения не видит" $R "$(CNT "select count(*) from tour_catalog_managers" 0)" ok
./t.sh "R: заметку не видит" $R "$(CNT "select count(*) from tour_catalog_owner_notes" 0)" ok
./t.sh "R: «Мои направления» пусто" $R "$(CNT "select voyage_my_catalog_tours()" "'[]'::jsonb")" ok
./t.sh "R: кандидатов в менеджеры не получает" $R "select voyage_owner_catalog_manager_candidates('a');" err:owner_only
./t.sh "R: лента кастингов без заметки и назначений" $R "$(CNT "select coalesce(partner_resident_feed()::text,'') ~ '(SECRET-NOTE|co_managers|tour_catalog_managers)'" false)" ok
./t.sh "R: править тур нельзя (0 строк)" $R "$(ROWS "update tour_catalog set height_min=150 where slug='dubai-season'" 0)" ok

echo "## anon"
out=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 55432 -U postgres -d postgres -tA -c "begin; set local role anon; select count(*) from tour_catalog_owner_notes;" 2>&1)
echo "$out" | grep -q "permission denied" && echo "PASS  anon: заметки — permission denied" || echo "FAIL  anon: заметки :: $out"
out=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 55432 -U postgres -d postgres -tA -c "begin; set local role anon; select voyage_my_catalog_tours();" 2>&1)
echo "$out" | grep -q "permission denied" && echo "PASS  anon: RPC менеджера — permission denied" || echo "FAIL  anon: RPC :: $out"
