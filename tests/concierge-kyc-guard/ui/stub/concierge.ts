// Заглушки Server Actions «Консьержа»: список из двух заявок, вызовы записываются.
const w = window as unknown as Record<string, any>;
w.__calls = [];
const now = "2026-11-26T11:20:00Z";
const rows = [
  { id: "aaaaaaaa-1f7b-4555-932f-a4295b27f94f", resident_id: "10000000-0000-4000-8000-000000000011", title: "[Данные KYC] Изменение гражданства / даты рождения", category: "documents", message: "Резидентка просит изменить данные, сверяемые с документами KYC: гражданство.", trip_stage: "before_tour", desired_at: null, preferred_language: "RU", status: "open", admin_feedback: null, created_at: now, updated_at: now, messages: [], resident: { id: "10000000-0000-4000-8000-000000000011", full_name: "Анна", avatar_url: null, telegram_id: null, segment: "elite", level: 1, kyc_level: 3 } },
  { id: "bbbbbbbb-1f7b-4555-932f-a4295b27f94f", resident_id: "10000000-0000-4000-8000-000000000012", title: "Трансфер из аэропорта", category: "transport", message: "Нужен трансфер 28.11", trip_stage: "before_tour", desired_at: null, preferred_language: "RU", status: "open", admin_feedback: null, created_at: now, updated_at: now, messages: [], resident: { id: "10000000-0000-4000-8000-000000000012", full_name: "Мария", avatar_url: null, telegram_id: null, segment: "working", level: 1, kyc_level: 1 } },
];
export type ConciergeStatus = "open" | "in_progress" | "done" | "impossible";
export async function listConciergeRequestsForStaff() { return { ok: true, requests: rows, hasMore: false }; }
export async function replyToConciergeRequest(input: Record<string, unknown>) { w.__calls.push({ fn: "reply", input }); return { ok: true, telegramSent: true }; }
export async function updateConciergeRequest(input: Record<string, unknown>) { w.__calls.push({ fn: "update", input }); return { ok: true }; }
