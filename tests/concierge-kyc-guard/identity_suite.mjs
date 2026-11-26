// VOYAGE · анкета резидентки: город / «о себе» / гражданство / дата рождения + аудируемый путь идентификационных данных.
// Стенд: дамп 20.10 + 36 миграций + geo/tour-catalog-managers/casting-detail + F-1, F-1b, F-1c + 20261127090000
//        + 20261128090000 (эта поставка) + seed_stand(_geo).sql + seed_candidates.sql (из manager-candidate-profile.zip).
// usage: node tests/identity_suite.mjs <bundle.mjs>   (бандл собирает tests/build_actions.mjs)
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const A = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const OWNER = "10000000-0000-4000-8000-000000000001", ADMIN = "10000000-0000-4000-8000-000000000002";
const M1 = "10000000-0000-4000-8000-000000000003";
const R1 = "10000000-0000-4000-8000-000000000011";   // KYC 3, паспорт одобрен
const R2 = "10000000-0000-4000-8000-000000000012";   // KYC 1
const R3 = "10000000-0000-4000-8000-000000000013";   // KYC 0
const C1 = "30000000-0000-4000-8000-000000000001";

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}  (ожидалось: ${JSON.stringify(want)}, получено: ${JSON.stringify(got)})`); }
};
const sql = (q) => { try { return execFileSync("psql", ["-h", "127.0.0.1", "-p", "55432", "-U", "postgres", "-d", "postgres", "-At", "-q", "-c", q], { env: { ...process.env, PGPASSWORD: "postgres" }, stdio: ["ignore", "pipe", "pipe"] }).toString().trim(); } catch (e) { return "ERR " + String(e.stderr).trim(); } };
const as = (uid, q, end) => { try { return execFileSync("bash", [path.join(here, "as.sh"), uid, q, ...(end ? [end] : [])], { stdio: ["ignore", "pipe", "pipe"] }).toString().trim().split("\n").pop(); } catch (e) { return String(e.stderr).trim(); } };
const row = (id) => JSON.parse(sql(`select json_build_object('location',location,'about',about,'citizenship',citizenship,'birth_date',birth_date,'kyc_level',kyc_level,'height',height,'clothing_size',clothing_size,'full_name',full_name,'usdt_wallet',usdt_wallet,'status',status) from public.profiles where id='${id}'`));
const asUser = (uid) => { globalThis.__testUid = uid; };
const audits = (id) => Number(sql(`select count(*) from public.audit_logs where action='profile.identity_change'${id ? ` and target_profile_id='${id}'` : ""}`));
const lastAudit = (id) => JSON.parse(sql(`select json_build_object('actor',actor_profile_id,'role',actor_role,'ip',ip,'meta',metadata) from public.audit_logs where action='profile.identity_change' and target_profile_id='${id}' order by id desc limit 1`) || "null");

// Исходные данные
sql(`update public.profiles set location='Москва, Россия', about='Люблю яхты', citizenship='Россия', birth_date='2000-05-01', height=172, clothing_size='S', banned_until=null where id='${R1}'`);
sql(`update public.profiles set location=null, about=null, citizenship=null, birth_date=null, kyc_level=0, banned_until=null where id='${R3}'`);
sql(`update public.profiles set citizenship='Казахстан', birth_date='1999-01-02', banned_until=null where id='${R2}'`);
sql(`delete from public.kyc_submissions where profile_id in ('${R2}','${R3}')`);
sql(`delete from public.partner_concierge_requests where resident_id in ('${R1}','${R2}','${R3}')`);
const r1start = row(R1);

console.log("── 0. Причина: старый путь (upsert из браузера) ──");
for (const f of [["location", "'Дубай'"], ["about", "'текст'"], ["citizenship", "'Франция'"], ["birth_date", "'2001-01-01'"]]) {
  check(`прямая запись ${f[0]} от резидентки отклоняется (42501)`, /permission denied for table profiles/.test(as(R3, `update public.profiles set ${f[0]}=${f[1]} where id='${R3}';`)), true);
}

console.log("── 1. Город и «о себе» — резидентка сама ──");
asUser(R1);
let r = await A.updateResidentProfileFields({ location: "  Дубай,   ОАЭ " });
check("R1 (KYC 3): город → «Дубай, ОАЭ»", [r.ok, r.location], [true, "Дубай, ОАЭ"]);
r = await A.updateResidentProfileFields({ about: "Люблю море.\r\nГоворю на трёх языках." });
check("R1: «о себе» с переносом строки", [r.ok, row(R1).about], [true, "Люблю море.\nГоворю на трёх языках."]);
const cp = JSON.parse(as(M1, `select public.partner_manager_candidate_profile('${C1}', '${R1}')::text;`));
check("анкета менеджера видит новый город и «о себе»", [cp.location, cp.about], ["Дубай, ОАЭ", "Люблю море.\nГоворю на трёх языках."]);
check("город с <script> → invalid", (await A.updateResidentProfileFields({ location: "<script>x</script>" })).reason, "invalid");
check("город и гражданство в одном вызове → invalid (одна ветка за вызов)", (await A.updateResidentProfileFields({ location: "Париж", citizenship: "Россия" })).reason, "invalid");

console.log("── 2. До отправки KYC — гражданство и дата сама, с записью в журнал ──");
asUser(R3);
check("R3 без документов: блокировки нет", (await A.getResidentIdentityLock()).locked, false);
let a0 = audits(R3);
r = await A.updateResidentProfileFields({ citizenship: "Франция" });
check("R3: гражданство → Франция", [r.ok, r.citizenship, row(R3).citizenship], [true, "Франция", "Франция"]);
r = await A.updateResidentProfileFields({ birth_date: "2001-03-15" });
check("R3: дата рождения → 2001-03-15", [r.ok, r.birth_date, row(R3).birth_date], [true, "2001-03-15", "2001-03-15"]);
const la = lastAudit(R3);
check("журнал: 2 записи, источник resident_self, автор — сама резидентка", [audits(R3) - a0, la.meta.source, la.actor, la.role], [2, "resident_self", R3, "resident"]);
check("журнал: было → стало", [la.meta.changes.birth_date.from, la.meta.changes.birth_date.to], [null, "2001-03-15"]);
check("дата 2001-02-30 → invalid", (await A.updateResidentProfileFields({ birth_date: "2001-02-30" })).reason, "invalid");
check("гражданство цифрами → invalid", (await A.updateResidentProfileFields({ citizenship: "12345" })).reason, "invalid");
check("RPC в БД тоже проверяет значения (обход action)", /invalid_value/.test(as(R3, `select public.voyage_resident_set_identity('{"birth_date":"2099-01-01"}'::jsonb);`)), true);
check("RPC не принимает чужие поля (kyc_level)", /field_not_allowed/.test(as(R3, `select public.voyage_resident_set_identity('{"kyc_level":"3"}'::jsonb);`)), true);
check("запрос команде до KYC не нужен → not_locked", (await A.requestResidentIdentityChange({ citizenship: "Италия" })).reason, "not_locked");

console.log("── 3. С момента отправки документов — только через запрос ──");
sql(`insert into public.kyc_submissions (profile_id, level, file_path, status) values ('${R3}', 1, '${R3}/passport/p.jpg', 'pending')`);
check("паспорт на проверке (pending): блокировка включена", (await A.getResidentIdentityLock()).locked, true);
check("pending: смена гражданства → identity_locked", (await A.updateResidentProfileFields({ citizenship: "Италия" })).reason, "identity_locked");
check("pending: смена даты → identity_locked", (await A.updateResidentProfileFields({ birth_date: "2001-03-16" })).reason, "identity_locked");
check("pending: прямой вызов RPC в обход action тоже отклоняется БД", /identity_locked/.test(as(R3, `select public.voyage_resident_set_identity('{"citizenship":"Италия"}'::jsonb);`)), true);
check("pending: профиль не изменился", [row(R3).citizenship, row(R3).birth_date], ["Франция", "2001-03-15"]);
check("pending: город по-прежнему можно", (await A.updateResidentProfileFields({ location: "Рим" })).ok, true);
check("pending: повтор того же значения — не изменение, проходит", (await A.updateResidentProfileFields({ citizenship: "Франция" })).ok, true);
sql(`update public.kyc_submissions set status='rejected' where profile_id='${R3}'`);
check("паспорт отклонён (только rejected): снова можно самой", [(await A.getResidentIdentityLock()).locked, (await A.updateResidentProfileFields({ citizenship: "Франция Республика" })).ok], [false, true]);
sql(`insert into public.kyc_submissions (profile_id, level, file_path, status) values ('${R3}', 2, '${R3}/video/v.mp4', 'pending')`);
check("видео KYC 2 на проверке — тоже блокирует", (await A.updateResidentProfileFields({ citizenship: "Италия" })).reason, "identity_locked");
sql(`update public.kyc_submissions set status='approved' where profile_id='${R3}' and level=2`);
check("одобрено при kyc_level 0 — блокирует", (await A.updateResidentProfileFields({ birth_date: "2001-01-01" })).reason, "identity_locked");
asUser(R2);
check("R2 (kyc_level 1, заявок нет) — блокирует", (await A.updateResidentProfileFields({ birth_date: "1999-01-03" })).reason, "identity_locked");
asUser(R1);
check("R1 (KYC 3): смена гражданства → identity_locked", (await A.updateResidentProfileFields({ citizenship: "Франция" })).reason, "identity_locked");
check("R1: очистить дату → identity_locked", (await A.updateResidentProfileFields({ birth_date: "" })).reason, "identity_locked");
check("функция блокировки недоступна клиенту напрямую", /permission denied/.test(as(R1, `select public.voyage_identity_locked('${R2}');`)), true);

console.log("── 4. Запрос на изменение: только своя анкета, без подмены id, без ПДн в Telegram ──");
asUser(R1);
globalThis.__conciergeCalls = [];
r = await A.requestResidentIdentityChange({ birth_date: "2000-05-10", comment: "В паспорте\u0007 10.05.2000\u0000", language: "RU", user_id: R2, resident_id: R2, profileId: R2, id: R2 });
check("R1: запрос создан", r.ok, true);
const req = JSON.parse(sql(`select json_build_object('resident',resident_id,'title',title,'category',category,'message',message,'status',status) from public.partner_concierge_requests where id='${r.requestId}'`));
check("заявка — на текущую резидентку, подменённые user_id/resident_id/profileId проигнорированы", req.resident, R1);
check("у R2 заявки не появилось", sql(`select count(*) from public.partner_concierge_requests where resident_id='${R2}'`), "0");
check("в createConciergeRequest не передаётся никакой id", Object.keys(globalThis.__conciergeCalls[0]).sort(), ["category", "desiredAt", "language", "message", "title", "tripStage"]);
check("заявка: категория documents, заголовок [Данные KYC]", [req.category, req.title], ["documents", "[Данные KYC] Изменение гражданства / даты рождения"]);
check("текст заявки (уходит в Telegram) без значений: нет дат, гражданства, комментария", [/2000-05/.test(req.message), /Россия/.test(req.message), /паспорте/.test(req.message), /дата рождения/.test(req.message)], [false, false, false, true]);
const det = JSON.parse(sql(`select json_build_object('role',sender_role,'sender',sender_profile_id,'body',body) from public.partner_concierge_messages where request_id='${r.requestId}'`));
check("значения — отдельным сообщением в переписке заявки от имени резидентки", [det.role, det.sender, /Дата рождения: 2000-05-01 → 2000-05-10/.test(det.body)], ["resident", R1, true]);
check("комментарий очищен от управляющих символов", /Комментарий: В паспорте 10\.05\.2000$/.test(det.body), true);
check("профиль НЕ изменён запросом", row(R1).birth_date, "2000-05-01");
check("повторный запрос, пока первый открыт → already_requested", (await A.requestResidentIdentityChange({ citizenship: "Франция" })).reason, "already_requested");
check("запрос без изменений → nothing_to_change", (await A.requestResidentIdentityChange({ birth_date: "2000-05-01" })).reason, "nothing_to_change");
check("длинный комментарий обрезается до 1000", (await import(pathToFileURL(path.resolve(process.argv[2])).href)).fieldsLib.sanitizeRequestComment("x".repeat(5000)).length, 1000);
asUser(null);
check("без сессии → unauthenticated", (await A.requestResidentIdentityChange({ citizenship: "Франция" })).reason, "unauthenticated");
asUser(M1);
check("менеджер не может создать такой запрос", ["forbidden", "not_found", "not_locked"].includes((await A.requestResidentIdentityChange({ citizenship: "Франция" })).reason), true);

console.log("── 5. Правка командой клуба: журнал и UPDATE — одна транзакция ──");
a0 = audits(R1);
asUser(R1);
check("резидентка → forbidden", (await A.staffUpdateResidentIdentity({ profileId: R1, birth_date: "2000-05-10", reason: "сама себе" })).reason, "forbidden");
asUser(M1);
check("менеджер → forbidden", (await A.staffUpdateResidentIdentity({ profileId: R1, birth_date: "2000-05-10", reason: "менеджер" })).reason, "forbidden");
asUser(ADMIN);
check("без причины → reason_required", (await A.staffUpdateResidentIdentity({ profileId: R1, birth_date: "2000-05-10", reason: "" })).reason, "reason_required");
check("RPC в обход action без причины — тоже отказ", /reason_required/.test(as(ADMIN, `select public.voyage_staff_set_resident_identity('${R1}', '{"birth_date":"2000-05-10"}'::jsonb, '');`)), true);
r = await A.staffUpdateResidentIdentity({ profileId: R1, birth_date: "2000-05-10", reason: "Сверено с паспортом, заявка консьержу" });
check("admin: дата рождения → 2000-05-10", [r.ok, r.birth_date, row(R1).birth_date], [true, "2000-05-10", "2000-05-10"]);
let la1 = lastAudit(R1);
check("журнал: автор admin, источник staff, причина, IP, было → стало", [la1.actor, la1.role, la1.meta.source, la1.meta.reason, la1.ip, la1.meta.changes.birth_date.from, la1.meta.changes.birth_date.to], [ADMIN, "admin", "staff", "Сверено с паспортом, заявка консьержу", "203.0.113.7", "2000-05-01", "2000-05-10"]);
check("action вернул id именно этой записи журнала", r.auditId, Number(sql(`select max(id) from public.audit_logs where action='profile.identity_change' and target_profile_id='${R1}'`)));
// Атомарность 1: UPDATE профиля падает → записи в журнале нет
sql(`create or replace function public._test_fail_profile() returns trigger language plpgsql as $$ begin if new.citizenship = 'Сбой' then raise exception 'test: profile update failed'; end if; return new; end $$;
     create trigger _test_fail_profile before update on public.profiles for each row execute function public._test_fail_profile();`);
const aBefore = audits(R1);
r = await A.staffUpdateResidentIdentity({ profileId: R1, citizenship: "Сбой", reason: "Проверка атомарности" });
check("UPDATE профиля не прошёл → ошибка", r.ok, false);
check("…и в журнале нет записи об изменении", audits(R1), aBefore);
check("…и гражданство прежнее", row(R1).citizenship, "Россия");
sql(`drop trigger _test_fail_profile on public.profiles; drop function public._test_fail_profile();`);
// Атомарность 2: запись журнала падает → профиль не меняется
sql(`create or replace function public._test_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'test: audit insert failed'; end $$;
     create trigger _test_fail_audit before insert on public.audit_logs for each row execute function public._test_fail_audit();`);
r = await A.staffUpdateResidentIdentity({ profileId: R1, citizenship: "Франция", reason: "Проверка атомарности" });
check("журнал не записался → ошибка, профиль НЕ изменён", [r.ok, row(R1).citizenship], [false, "Россия"]);
sql(`drop trigger _test_fail_audit on public.audit_logs; drop function public._test_fail_audit();`);
asUser(OWNER);
r = await A.staffUpdateResidentIdentity({ profileId: R1, citizenship: "Российская Федерация", reason: "Как в загранпаспорте" });
check("owner: гражданство → Российская Федерация", [r.ok, row(R1).citizenship], [true, "Российская Федерация"]);
check("ровно одна запись журнала на каждую успешную правку (2)", audits(R1) - a0, 2);
check("без изменений → nothing_to_change, журнал не растёт", [(await A.staffUpdateResidentIdentity({ profileId: R1, citizenship: "Российская Федерация", reason: "повтор правки" })).reason, audits(R1) - a0], ["nothing_to_change", 2]);
asUser(ADMIN);
check("admin не может менять данные owner", (await A.staffUpdateResidentIdentity({ profileId: OWNER, citizenship: "Франция", reason: "проверка прав" })).reason, "forbidden");
check("журнал нельзя удалить", /append-only/.test(sql(`delete from public.audit_logs where action='profile.identity_change'`)), true);
check("KYC не тронут: уровень 3, заявка одобрена", [row(R1).kyc_level, sql(`select status from public.kyc_submissions where profile_id='${R1}' limit 1`)], [3, "approved"]);

console.log("── 6. Справочник /admin и другие пути — без обхода журнала ──");
a0 = audits(R1);
check("club_admin_update_profile: смена гражданства → identity_requires_audit", /identity_requires_audit/.test(as(ADMIN, `select public.club_admin_update_profile('${R1}', '{"citizenship":"Франция","location":"Париж"}'::jsonb);`)), true);
check("…ничего не изменилось и журнал не тронут", [row(R1).citizenship, row(R1).location, audits(R1) - a0], ["Российская Федерация", "Дубай, ОАЭ", 0]);
as(ADMIN, `select public.club_admin_update_profile('${R1}', '{"citizenship":"Российская Федерация","location":"Абу-Даби","full_name":"${r1start.full_name}"}'::jsonb);`, "commit");
check("то же гражданство + другой город (форма шлёт все поля) — проходит", row(R1).location, "Абу-Даби");
asUser(ADMIN);
r = await A.staffUpdateResidentIdentity({ profileId: R1, citizenship: "Франция", reason: "Справочник: сверено с паспортом" });
check("путь справочника (тот же staff-action): гражданство → Франция + журнал", [r.ok, row(R1).citizenship, audits(R1) - a0], [true, "Франция", 1]);
check("admin не может обновить profiles напрямую (права на колонки)", /permission denied/.test(as(ADMIN, `update public.profiles set citizenship='X' where id='${R1}';`)), true);
const aSql = audits(R1);
sql(`update public.profiles set birth_date='2000-05-11' where id='${R1}'`);
check("даже прямой UPDATE из SQL Editor / service_role пишет журнал (источник service_or_sql)", [audits(R1) - aSql, lastAudit(R1).meta.source], [1, "service_or_sql"]);
sql(`update public.profiles set birth_date='2000-05-10' where id='${R1}'`);
check("правка города/имени/роста журнал идентификации не пишет", (() => { const b = audits(R1); sql(`update public.profiles set location='Абу-Даби', height=173 where id='${R1}'`); return audits(R1) - b; })(), 0);
check("anon не может вызвать функции идентификации", ["voyage_staff_set_resident_identity(uuid,jsonb,text,text,text)", "voyage_resident_set_identity(jsonb)", "voyage_identity_locked(uuid)"].map((f) => sql(`select has_function_privilege('anon','public.${f}','execute')`)), ["f", "f", "f"]);

console.log("── 7. Регресс ──");
asUser(R1);
check("рост через resident-physical", (await A.updateResidentPhysical({ height: "174" })).height, "174");
check("размеры через resident-sizes", (await A.updateResidentSizes({ clothing_size: "M" })).clothing_size, "M");
const cp2 = JSON.parse(as(M1, `select public.partner_manager_candidate_profile('${C1}', '${R1}')::text;`));
check("анкета менеджера: возраст есть, точной даты и гражданства нет", [typeof cp2.age, "birth_date" in cp2, "citizenship" in cp2], ["number", false, false]);
globalThis.__updates = [];
r = await A.updateResidentProfileFields({ location: "Абу-Даби, ОАЭ", kyc_level: 0, full_name: "HACK", usdt_wallet: "X", status: "approved" });
check("лишние ключи от клиента отбрасываются", globalThis.__updates[0].sort(), ["location", "updated_at"]);
check("kyc_level / имя / кошелёк как были", [row(R1).kyc_level, row(R1).full_name, row(R1).usdt_wallet], [r1start.kyc_level, r1start.full_name, r1start.usdt_wallet]);
asUser(R2);
sql(`update public.profiles set banned_until = now() + interval '1 day' where id='${R2}'`);
check("забаненная → forbidden", (await A.updateResidentProfileFields({ location: "X" })).reason, "forbidden");
sql(`update public.profiles set banned_until = null where id='${R2}'`);
check("права на таблицы не менялись: authenticated UPDATE только full_name/name/avatar_url",
  sql(`select string_agg(column_name, ',' order by column_name) from information_schema.column_privileges where table_schema='public' and table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE'`), "avatar_url,full_name,name");

// вернуть исходные данные стенда
sql(`update public.profiles set location='Москва, Россия', about='Люблю яхты', citizenship='RU-CITIZEN', birth_date='2000-05-01', height=172, weight=52, measurements='86-60-90', clothing_size='S' where id='${R1}'`);
sql(`delete from public.kyc_submissions where profile_id='${R3}'`);
sql(`delete from public.partner_concierge_requests where resident_id in ('${R1}','${R2}','${R3}')`);
console.log(`ИТОГО: PASS ${pass} · FAIL ${fail}`);
process.exit(fail ? 1 : 0);
