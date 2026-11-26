// VOYAGE · Защита KYC-запросов в «Консьерже»: «[Данные KYC]» закрываются только из карточки резидентки.
// Настоящий app/actions/concierge.ts + настоящие действия карточки, стенд как у requests_suite.mjs.
// usage: node tests/build_actions.mjs <repo> /tmp/g.mjs real-concierge && node tests/concierge_guard_suite.mjs /tmp/g.mjs
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.TELEGRAM_BOT_TOKEN = "123456:stand-test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://stand.supabase.co"; process.env.SUPABASE_SERVICE_ROLE_KEY = "stand-service-key"; // клиент подменён psql-стендом
const A = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const OWNER = "10000000-0000-4000-8000-000000000001", ADMIN = "10000000-0000-4000-8000-000000000002";
const M1 = "10000000-0000-4000-8000-000000000003";
const R1 = "10000000-0000-4000-8000-000000000011";
const R2 = "10000000-0000-4000-8000-000000000012";

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}  (ожидалось: ${JSON.stringify(want)}, получено: ${JSON.stringify(got)})`); }
};
const sql = (q) => { try { return execFileSync("psql", ["-h", "127.0.0.1", "-p", "55432", "-U", "postgres", "-d", "postgres", "-At", "-q", "-c", q], { env: { ...process.env, PGPASSWORD: "postgres" }, stdio: ["ignore", "pipe", "pipe"] }).toString().trim(); } catch (e) { return "ERR " + String(e.stderr).trim(); } };
const asUser = (uid) => { globalThis.__testUid = uid; };
const citizenship = (id) => sql(`select citizenship from public.profiles where id='${id}'`);
const audits = (id) => Number(sql(`select count(*) from public.audit_logs where action='profile.identity_change' and target_profile_id='${id}'`));
const status = (id) => sql(`select status from public.partner_concierge_requests where id='${id}'`);
const staffMsgs = (id) => Number(sql(`select count(*) from public.partner_concierge_messages where request_id='${id}' and sender_role='staff'`));
const tg = () => (globalThis.__telegram ?? []).length;
const as = async (uid, fn) => { asUser(uid); return fn(); };

const tgBefore = { r1: sql(`select coalesce(telegram_id::text,'') from public.profiles where id='${R1}'`), r2: sql(`select coalesce(telegram_id::text,'') from public.profiles where id='${R2}'`) };
sql(`update public.profiles set citizenship='Россия', birth_date='2000-05-01', status='approved', banned_until=null, telegram_id=700000011 where id='${R1}'`);
sql(`update public.profiles set status='approved', banned_until=null, telegram_id=700000012 where id='${R2}'`);
sql(`delete from public.partner_concierge_requests where resident_id in ('${R1}','${R2}')`);

console.log("── 1. KYC-запрос нельзя закрыть из общего списка «Консьержа» ──");
let r = await as(R1, () => A.requestResidentIdentityChange({ citizenship: "Франция", comment: "Новый паспорт", language: "RU" }));
check("резидентка отправила запрос (настоящий createConciergeRequest)", r.ok, true);
const q1 = r.requestId;
const a0 = audits(R1);
for (const [who, uid] of [["admin", ADMIN], ["owner", OWNER], ["менеджер", M1]]) {
  check(`${who}: «Выполнено» (updateConciergeRequest done) → отказ`, (await as(uid, () => A.updateConciergeRequest({ id: q1, status: "done", feedback: "Готово" }))).reason, "identity_request");
  check(`${who}: «Невозможно» (updateConciergeRequest impossible) → отказ`, (await as(uid, () => A.updateConciergeRequest({ id: q1, status: "impossible", feedback: "Нет" }))).reason, "identity_request");
  check(`${who}: ответ со статусом done → отказ`, (await as(uid, () => A.replyToConciergeRequest({ id: q1, status: "done", message: "Сделано" }))).reason, "identity_request");
  check(`${who}: ответ со статусом impossible → отказ`, (await as(uid, () => A.replyToConciergeRequest({ id: q1, status: "impossible", message: "Нельзя" }))).reason, "identity_request");
}
check("…запрос открыт, профиль и журнал не тронуты, сообщений от персонала нет", [status(q1), citizenship(R1), audits(R1) - a0, staffMsgs(q1)], ["open", "Россия", 0, 0]);

r = await as(ADMIN, () => A.replyToConciergeRequest({ id: q1, message: "Проверяем документы, вернёмся сегодня." }));
check("переписка разрешена: ответ без смены статуса → ok, open → in_progress", [r.ok, status(q1), staffMsgs(q1)], [true, "in_progress", 1]);
check("ответ ушёл резидентке в Telegram", tg(), 1);
check("in_progress → open через общий список → отказ", (await as(ADMIN, () => A.updateConciergeRequest({ id: q1, status: "open" }))).reason, "identity_request");
check("in_progress → in_progress (тот же статус) → ok", (await as(ADMIN, () => A.updateConciergeRequest({ id: q1, status: "in_progress" }))).ok, true);

console.log("── 2. Карточка резидентки: Approve & Apply закрывает запрос через тот же «Консьерж» ──");
const t1 = tg();
r = await as(ADMIN, () => A.approveResidentIdentityRequest({ requestId: q1, reason: "Сверено с паспортом" }));
check("Approve & Apply → ok, уведомление доставлено", [r.ok, r.notified, r.warning ?? null], [true, true, null]);
check("данные применены, одна запись журнала, запрос done", [citizenship(R1), audits(R1) - a0, status(q1)], ["Франция", 1, "done"]);
check("резидентке: сообщение в переписке и Telegram", [staffMsgs(q1), tg() - t1], [2, 1]);
check("после закрытия: переоткрыть из общего списка нельзя", (await as(ADMIN, () => A.updateConciergeRequest({ id: q1, status: "open" }))).reason, "identity_request");
check("…и перевести в «Невозможно» тоже нельзя", (await as(ADMIN, () => A.replyToConciergeRequest({ id: q1, status: "impossible", message: "Ошибка" }))).reason, "identity_request");
check("…написать резидентке можно (статус остаётся done)", [(await as(ADMIN, () => A.replyToConciergeRequest({ id: q1, status: "done", message: "Если что-то не так — напишите." }))).ok, status(q1)], [true, "done"]);

console.log("── 3. Reject из карточки ──");
r = await as(R1, () => A.requestResidentIdentityChange({ birth_date: "2001-01-01", comment: "", language: "RU" }));
const q2 = r.requestId;
const a2 = audits(R1), t2 = tg();
r = await as(OWNER, () => A.rejectResidentIdentityRequest({ requestId: q2, reason: "Дата не совпадает с паспортом." }));
check("Reject → ok, запрос impossible, уведомление доставлено", [r.ok, status(q2), r.notified, tg() - t2], [true, "impossible", true, 1]);
check("профиль не изменён, журнал не вырос", [sql(`select birth_date from public.profiles where id='${R1}'`), audits(R1) - a2], ["2000-05-01", 0]);
check("переоткрыть отклонённый из общего списка нельзя", (await as(OWNER, () => A.updateConciergeRequest({ id: q2, status: "in_progress" }))).reason, "identity_request");

console.log("── 4. Обычные заявки консьержу работают как раньше ──");
r = await as(R2, () => A.createConciergeRequest({ title: "Трансфер из аэропорта", category: "transport", message: "Нужен трансфер 28.11", tripStage: "before_tour", desiredAt: null, language: "RU" }));
const g1 = r.request.id;
check("обычная заявка: ответ → in_progress", [(await as(M1, () => A.replyToConciergeRequest({ id: g1, message: "Уточняем рейс" }))).ok, status(g1)], [true, "in_progress"]);
check("обычная заявка: менеджер закрывает «Выполнено»", [(await as(M1, () => A.replyToConciergeRequest({ id: g1, status: "done", message: "Трансфер заказан" }))).ok, status(g1)], [true, "done"]);
check("обычная заявка: переоткрыть через статус → ok", [(await as(ADMIN, () => A.updateConciergeRequest({ id: g1, status: "open" }))).ok, status(g1)], [true, "open"]);
check("обычная заявка: «Невозможно» с обратной связью → ok", [(await as(ADMIN, () => A.updateConciergeRequest({ id: g1, status: "impossible", feedback: "Нет мест" }))).ok, status(g1)], [true, "impossible"]);
r = await as(R2, () => A.createConciergeRequest({ title: "[KYC 3] Запись на встречу", category: "documents", message: "Хочу записаться на KYC 3", tripStage: "before_tour", desiredAt: null, language: "RU" }));
check("заявка KYC 3 (не «[Данные KYC]») закрывается как раньше", (await as(ADMIN, () => A.replyToConciergeRequest({ id: r.request.id, status: "done", message: "Записали на 28.11" }))).ok, true);
check("без прав (резидентка) → forbidden, как раньше", (await as(R2, () => A.updateConciergeRequest({ id: g1, status: "done", feedback: "x" }))).reason, "forbidden");
check("статусы и CHECK не менялись", sql(`select pg_get_constraintdef(oid) from pg_constraint where conname='partner_concierge_requests_status_check'`), "CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'done'::text, 'impossible'::text])))");

sql(`delete from public.partner_concierge_requests where resident_id in ('${R1}','${R2}')`);
sql(`update public.profiles set telegram_id=${tgBefore.r1 || "null"} where id='${R1}'`);
sql(`update public.profiles set telegram_id=${tgBefore.r2 || "null"} where id='${R2}'`);
console.log(`ИТОГО: PASS ${pass} · FAIL ${fail}`);
process.exit(fail ? 1 : 0);
