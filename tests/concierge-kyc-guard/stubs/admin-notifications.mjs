// Заглушка уведомления в рабочий чат (в этих тестах не проверяется): запоминает вызов.
export async function notifyAdminsOfConciergeRequest(input) { globalThis.__adminNotices = [...(globalThis.__adminNotices ?? []), input]; return { ok: true }; }
