// VOYAGE · Identity & KYC в карточке резидентки: Approve & Apply / Reject / Edit identity.
// Стенд: тот же, что у identity_suite.mjs (дамп + 36 миграций + установленные пакеты + 20261128090000).
// usage: node tests/requests_suite.mjs <bundle.mjs>   (бандл собирает tests/build_actions.mjs)
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const A = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const OWNER = "10000000-0000-4000-8000-000000000001", ADMIN = "10000000-0000-4000-8000-000000000002";
const M1 = "10000000-0000-4000-8000-000000000003";
const R1 = "10000000-0000-4000-8000-000000000011";   // KYC 3
const R2 = "10000000-0000-4000-8000-000000000012";   // KYC 1

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}  (ожидалось: ${JSON.stringify(want)}, получено: ${JSON.stringify(got)})`); }
};
const sql = (q) => { try { return execFileSync("psql", ["-h", "127.0.0.1", "-p", "55432", "-U", "postgres", "-d", "postgres", "-At", "-q", "-c", q], { env: { ...process.env, PGPASSWORD: "postgres" }, stdio: ["ignore", "pipe", "pipe"] }).toString().trim(); } catch (e) { return "ERR " + String(e.stderr).trim(); } };
const asUser = (uid) => { globalThis.__testUid = uid; };
const ident = (id) => JSON.parse(sql(`select json_build_object('citizenship',citizenship,'birth_date',birth_date) from public.profiles where id='${id}'`));
const other = (id) => sql(`select md5(row(location,about,height,weight,measurements,clothing_size,shoe_size,photo_urls,full_name,kyc_level,status,usdt_wallet,tour_points)::text) from public.profiles where id='${id}'`);
const audits = (id) => Number(sql(`select count(*) from public.audit_logs where action='profile.identity_change' and target_profile_id='${id}'`));
const lastAudit = (id) => JSON.parse(sql(`select json_build_object('id',id,'actor',actor_profile_id,'role',actor_role,'meta',metadata) from public.audit_logs where action='profile.identity_change' and target_profile_id='${id}' order by id desc limit 1`) || "null");
const req = (id) => JSON.parse(sql(`select json_build_object('status',status,'resolved_by',resolved_by,'feedback',admin_feedback) from public.partner_concierge_requests where id='${id}'`) || "null");
const staffMsgs = (id) => JSON.parse(sql(`select coalesce(json_agg(body order by created_at),'[]') from public.partner_concierge_messages where request_id='${id}' and sender_role='staff'`));
const tg = () => (globalThis.__telegram ?? []).length;
const card = async (id) => A.loadIdentityCard(A.getTelegramServiceClient(), id);
const ask = async (uid, input) => { asUser(uid); return A.requestResidentIdentityChange(input); };
const approve = async (uid, requestId, reason) => { asUser(uid); return A.approveResidentIdentityRequest({ requestId, reason }); };
const reject = async (uid, requestId, reason) => { asUser(uid); return A.rejectResidentIdentityRequest({ requestId, reason }); };
const failAudit = (on) => sql(on
  ? `create or replace function public._test_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'test: audit failed'; end $$; create trigger _test_fail_audit before insert on public.audit_logs for each row execute function public._test_fail_audit();`
  : `drop trigger if exists _test_fail_audit on public.audit_logs; drop function if exists public._test_fail_audit();`);

// Исходное состояние
failAudit(false);
sql(`update public.profiles set citizenship='Россия', birth_date='2000-05-01', status='approved', banned_until=null where id='${R1}'`);
sql(`update public.profiles set citizenship='Казахстан', birth_date='1999-01-02', status='approved', banned_until=null where id='${R2}'`);
sql(`delete from public.partner_concierge_requests where resident_id in ('${R1}','${R2}')`);
const r1other = other(R1), r2other = other(R2);

console.log("── 1. Основной сценарий: запрос → карточка → Approve & Apply ──");
let r = await ask(R1, { citizenship: "Франция", comment: "Новый паспорт", language: "RU" });
check("резидентка отправила запрос", r.ok, true);
const q1 = r.requestId;
let c = await card(R1);
check("карточка: один активный запрос", c.active.length, 1);
check("карточка: поле, было, стало, комментарий", c.active[0].proposal, { comment: "Новый паспорт", citizenship: { from: "Россия", to: "Франция" } });
check("карточка: дата подачи и статус", [Boolean(c.active[0].created_at), c.active[0].status], [true, "open"]);
check("карточка: заявки KYC (статус KYC)", c.submissions.some((s) => s.level === 1 && s.status === "approved"), true);

const a0 = audits(R1), t0 = tg();
check("менеджер → forbidden", (await approve(M1, q1, "сверено с паспортом")).reason, "forbidden");
check("сама резидентка → forbidden", (await approve(R1, q1, "сверено с паспортом")).reason, "forbidden");
check("без сессии → unauthenticated", (await approve(null, q1, "сверено с паспортом")).reason, "unauthenticated");
check("без причины → reason_required", (await approve(ADMIN, q1, " ")).reason, "reason_required");
check("…после отказов: профиль, запрос, журнал, уведомления не тронуты", [ident(R1).citizenship, req(q1).status, audits(R1) - a0, tg() - t0], ["Россия", "open", 0, 0]);

failAudit(true);
r = await approve(ADMIN, q1, "сверено с паспортом");
failAudit(false);
check("ошибка аудита → ошибка, запрос не закрыт", [r.ok, r.reason, req(q1).status], [false, "server_error", "open"]);
check("…профиль не изменён, журнал пуст, уведомления нет", [ident(R1).citizenship, audits(R1) - a0, tg() - t0], ["Россия", 0, 0]);

r = await approve(ADMIN, q1, "Сверено с паспортом 12 345678");
check("admin: Approve & Apply → ok, статус done", [r.ok, r.status, r.notified], [true, "done", true]);
check("гражданство обновлено", ident(R1), { citizenship: "Франция", birth_date: "2000-05-01" });
check("ровно одна новая запись в журнале", audits(R1) - a0, 1);
const la = lastAudit(R1);
check("журнал: автор admin, источник staff, было → стало", [la.actor, la.role, la.meta.source, la.meta.changes.citizenship.from, la.meta.changes.citizenship.to], [ADMIN, "admin", "staff", "Россия", "Франция"]);
check("журнал: причина со ссылкой на запрос и словами admin", la.meta.reason.startsWith(`[запрос ${q1}] Одобрен запрос резидентки: Сверено с паспортом 12 345678`), true);
check("action вернул id этой записи журнала", r.auditId, la.id);
check("запрос закрыт: done, resolved_by = admin", [req(q1).status, req(q1).resolved_by], ["done", ADMIN]);
check("резидентке: сообщение в переписке + Telegram", [staffMsgs(q1).length, tg() - t0], [1, 1]);
check("уведомление без самих значений", /Франция|Россия/.test(staffMsgs(q1)[0]), false);
check("уведомление называет изменённое поле", staffMsgs(q1)[0].includes("гражданство"), true);
check("остальные поля профиля не тронуты", other(R1), r1other);

const a1 = audits(R1), t1 = tg();
r = await approve(ADMIN, q1, "повторное нажатие");
check("повторное применение → already_processed", r.reason, "already_processed");
r = await approve(OWNER, q1, "повторное нажатие");
check("…и для owner тоже", r.reason, "already_processed");
check("…журнал и уведомления не выросли", [audits(R1) - a1, tg() - t1], [0, 0]);
check("отклонить уже одобренный нельзя", (await reject(ADMIN, q1, "передумали")).reason, "already_processed");
check("карточка: активных нет, в истории «done»", [(await card(R1)).active.length, (await card(R1)).closed[0]?.status], [0, "done"]);

console.log("── 2. Оба поля сразу: без частичного изменения ──");
r = await ask(R1, { citizenship: "Италия", birth_date: "2000-05-10", comment: "", language: "EN" });
const q2 = r.requestId;
check("запрос с двумя полями создан", r.ok, true);
const a2 = audits(R1);
failAudit(true);
r = await approve(OWNER, q2, "сверено с паспортом");
failAudit(false);
check("ошибка аудита → ни одно поле не изменилось, запрос открыт", [ident(R1), req(q2).status, audits(R1) - a2], [{ citizenship: "Франция", birth_date: "2000-05-01" }, "open", 0]);
sql(`create or replace function public._test_fail_profile() returns trigger language plpgsql as $$ begin if new.birth_date = '2000-05-10' then raise exception 'test: profile update failed'; end if; return new; end $$; create trigger _test_fail_profile before update on public.profiles for each row execute function public._test_fail_profile();`);
r = await approve(OWNER, q2, "сверено с паспортом");
sql(`drop trigger if exists _test_fail_profile on public.profiles; drop function if exists public._test_fail_profile();`);
check("ошибка UPDATE даты → гражданство тоже не изменилось, запрос открыт", [r.reason, ident(R1), req(q2).status, audits(R1) - a2], ["server_error", { citizenship: "Франция", birth_date: "2000-05-01" }, "open", 0]);
r = await approve(OWNER, q2, "сверено с паспортом");
check("owner: оба поля применены", [r.ok, ident(R1)], [true, { citizenship: "Италия", birth_date: "2000-05-10" }]);
const la2 = lastAudit(R1);
check("одна запись журнала с обоими изменениями", [audits(R1) - a2, Object.keys(la2.meta.changes).sort()], [1, ["birth_date", "citizenship"]]);
check("уведомление на языке запроса (EN), оба поля", staffMsgs(q2)[0], "Your request has been approved. Updated in your profile: citizenship, date of birth. You can see the new details in your dashboard.");

console.log("── 3. Reject ──");
r = await ask(R1, { birth_date: "2001-01-01", comment: "Ошибка в дате", language: "RU" });
const q3 = r.requestId;
const a3 = audits(R1), t3 = tg();
check("менеджер не может отклонить", (await reject(M1, q3, "Не подтверждаю")).reason, "forbidden");
check("отказ без причины → reason_required", (await reject(ADMIN, q3, "нет")).reason, "reason_required");
r = await reject(ADMIN, q3, "Дата не совпадает с паспортом. Пришлите скан.");
check("admin: Reject → ok, статус impossible («Отклонён»)", [r.ok, r.status, req(q3).status], [true, "impossible", "impossible"]);
check("профиль не изменён, журнал не вырос", [ident(R1), audits(R1) - a3], [{ citizenship: "Италия", birth_date: "2000-05-10" }, 0]);
check("резидентке ушла причина отказа", [staffMsgs(q3)[0].includes("Дата не совпадает с паспортом"), tg() - t3], [true, 1]);
check("повторный отказ → already_processed", (await reject(ADMIN, q3, "ещё раз нет")).reason, "already_processed");
check("одобрить отклонённый нельзя", (await approve(ADMIN, q3, "сверено с паспортом")).reason, "already_processed");
check("остальные поля профиля не тронуты", other(R1), r1other);

console.log("── 4. Актуальность запроса ──");
r = await ask(R1, { citizenship: "Испания", language: "RU" });
const q4 = r.requestId;
asUser(ADMIN);
await A.staffUpdateResidentIdentity({ profileId: R1, citizenship: "Греция", reason: "Ручное исправление по паспорту" });
const a4 = audits(R1);
r = await approve(ADMIN, q4, "сверено с паспортом");
check("данные изменились после подачи → stale, ничего не меняем", [r.reason, r.fields, ident(R1).citizenship, req(q4).status, audits(R1) - a4], ["stale", ["citizenship"], "Греция", "open", 0]);
await reject(ADMIN, q4, "Гражданство уже исправлено вручную.");

r = await ask(R1, { citizenship: "Португалия", language: "RU" });
const q5 = r.requestId;
asUser(ADMIN);
await A.staffUpdateResidentIdentity({ profileId: R1, citizenship: "Португалия", reason: "Исправлено до разбора запроса" });
const a5 = audits(R1);
r = await approve(ADMIN, q5, "сверено с паспортом");
check("значение уже как в запросе → закрыт без повторной записи в журнал", [r.ok, r.alreadyApplied, audits(R1) - a5, req(q5).status], [true, true, 0, "done"]);

console.log("── 5. Сбои закрытия и уведомления ──");
r = await ask(R1, { citizenship: "Мальта", language: "RU" });
const q6 = r.requestId;
const a6 = audits(R1);
globalThis.__failUpdate = "partner_concierge_requests";
r = await approve(ADMIN, q6, "сверено с паспортом");
globalThis.__failUpdate = null;
check("закрытие не прошло → close_failed, изменение применено и в журнале", [r.reason, r.applied, ident(R1).citizenship, audits(R1) - a6, req(q6).status], ["close_failed", true, "Мальта", 1, "open"]);
r = await approve(ADMIN, q6, "сверено с паспортом");
check("повтор закрывает запрос без второй записи в журнале", [r.ok, r.alreadyApplied, audits(R1) - a6, req(q6).status], [true, true, 1, "done"]);

r = await ask(R1, { citizenship: "Кипр", language: "RU" });
const q7 = r.requestId;
globalThis.__replyFail = true;
r = await approve(ADMIN, q7, "сверено с паспортом");
globalThis.__replyFail = false;
check("уведомление не ушло → данные применены, запрос закрыт, предупреждение", [r.ok, r.notified, Boolean(r.warning), req(q7).status, ident(R1).citizenship], [true, false, true, "done", "Кипр"]);
check("закрытый запрос хранит текст для резидентки (admin_feedback)", req(q7).feedback.includes("гражданство"), true);

console.log("── 6. Два одновременных нажатия ──");
r = await ask(R2, { citizenship: "Узбекистан", language: "RU" });
const q8 = r.requestId;
const a8 = audits(R2), t8 = tg();
asUser(ADMIN);
const both = await Promise.all([A.approveResidentIdentityRequest({ requestId: q8, reason: "сверено с паспортом" }), A.approveResidentIdentityRequest({ requestId: q8, reason: "сверено с паспортом" })]);
check("успешно только одно из двух", both.filter((x) => x.ok).length, 1);
check("второе → already_processed", both.find((x) => !x.ok)?.reason, "already_processed");
check("одна запись журнала, одно уведомление", [audits(R2) - a8, tg() - t8, staffMsgs(q8).length], [1, 1, 1]);

console.log("── 7. Неразборчивый запрос и чужие заявки ──");
const q9 = sql(`insert into public.partner_concierge_requests (resident_id,title,category,message,trip_stage,preferred_language,status) values ('${R2}','[Данные KYC] Изменение гражданства / даты рождения','documents','Резидентка просит изменить данные','before_tour','RU','open') returning id`).split("\n")[0];
sql(`insert into public.partner_concierge_messages (request_id,sender_profile_id,sender_role,body) values ('${q9}','${R2}','resident','хочу поменять всё')`);
c = await card(R2);
check("карточка: запрос виден, изменения не распознаны", [c.active.length, c.active[0]?.proposal], [1, null]);
check("Approve неразборчивого → unparseable, ничего не меняем", [(await approve(ADMIN, q9, "сверено с паспортом")).reason, ident(R2).citizenship], ["unparseable", "Узбекистан"]);
check("его можно отклонить", (await reject(ADMIN, q9, "Опишите, какие данные изменить.")).ok, true);
const qg = sql(`insert into public.partner_concierge_requests (resident_id,title,category,message,trip_stage,preferred_language,status) values ('${R2}','Трансфер из аэропорта','transport','Нужен трансфер','before_tour','RU','open') returning id`).split("\n")[0];
check("обычная заявка консьержу → not_found (не трогаем)", [(await approve(ADMIN, qg, "сверено с паспортом")).reason, (await reject(ADMIN, qg, "не относится")).reason, req(qg).status], ["not_found", "not_found", "open"]);
check("неверный id → invalid", (await approve(ADMIN, "not-a-uuid", "сверено")).reason, "invalid");

console.log("── 8. Edit identity: ручное исправление без запроса ──");
const a10 = audits(R2);
asUser(ADMIN);
check("без причины → reason_required", (await A.staffUpdateResidentIdentity({ profileId: R2, birth_date: "1999-02-01", reason: "" })).reason, "reason_required");
check("менеджер → forbidden", (asUser(M1), await A.staffUpdateResidentIdentity({ profileId: R2, birth_date: "1999-02-01", reason: "ошибка в дате" })).reason, "forbidden");
asUser(ADMIN);
r = await A.staffUpdateResidentIdentity({ profileId: R2, birth_date: "1999-02-01", reason: "Ошибка при вводе: в паспорте 01.02.1999" });
const la10 = lastAudit(R2);
check("admin исправил дату без запроса", [r.ok, ident(R2).birth_date], [true, "1999-02-01"]);
check("журнал: старое/новое, автор, источник, причина", [audits(R2) - a10, la10.meta.changes.birth_date.from, la10.meta.changes.birth_date.to, la10.actor, la10.meta.source, la10.meta.reason], [1, "1999-01-02", "1999-02-01", ADMIN, "staff", "Ошибка при вводе: в паспорте 01.02.1999"]);
check("admin не может менять данные owner", (await A.staffUpdateResidentIdentity({ profileId: OWNER, citizenship: "Франция", reason: "проверка прав" })).reason, "forbidden");
check("через action нельзя передать другие поля", "location" in (await A.staffUpdateResidentIdentity({ profileId: R2, location: "Париж", reason: "проверка полей" })), false);
check("остальные поля R2 не тронуты", other(R2), r2other);

console.log("── 9. Права и регресс ──");
check("менеджер по-прежнему не видит гражданство/дату (UPDATE/SELECT колонок)", sql(`select string_agg(privilege_type||':'||column_name, ',' order by privilege_type, column_name) from information_schema.column_privileges where table_schema='public' and table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE'`), "UPDATE:avatar_url,UPDATE:full_name,UPDATE:name");
check("в БД не появилось новых функций (только объекты v2 и прежние)", sql(`select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname ~ 'identity|approve|reject')`), "admin_reject_partner_application,club_admin_reject_kyc,consume_telegram_identity_recovery,is_approved_member,resident_score_events_reject_mutation,voyage_audit_profile_identity,voyage_identity_links,voyage_identity_locked,voyage_identity_map,voyage_identity_normalize,voyage_live_identity,voyage_notify_application_approved,voyage_reject_operator_application,voyage_reject_scout_application,voyage_resident_set_identity,voyage_staff_set_resident_identity");
check("статусы заявок консьержу не менялись", sql(`select pg_get_constraintdef(oid) from pg_constraint where conname='partner_concierge_requests_status_check'`), "CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'done'::text, 'impossible'::text])))");

sql(`delete from public.partner_concierge_requests where resident_id in ('${R1}','${R2}')`);
console.log(`ИТОГО: PASS ${pass} · FAIL ${fail}`);
process.exit(fail ? 1 : 0);
