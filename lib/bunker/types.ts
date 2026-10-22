/* ──────────────────────────────────────────────────────────────────────
 * Личный бункер — типы строк и справочники.
 * Совпадают с supabase/migrations/20261022120000_personal_bunker.sql.
 * ──────────────────────────────────────────────────────────────────── */

export type BunkerProject = {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  color: string | null;
  sort: number;
};

/** Встроенные проекты: в базе не хранятся, slug пишется в category. */
export const BUILTIN_PROJECTS: BunkerProject[] = [
  { id: "builtin-personal", slug: "personal", name: "Личное", emoji: "🏠", color: "#6ee7b7", sort: 0 },
  { id: "builtin-voyage", slug: "voyage", name: "VOYAGE", emoji: "✈️", color: "#c9a961", sort: 1 },
  { id: "builtin-status", slug: "status", name: "STATUS INTERNATIONAL", emoji: "👑", color: "#c4b5fd", sort: 2 },
  { id: "builtin-russia", slug: "russia", name: "Дела в России", emoji: "🇷🇺", color: "#93c5fd", sort: 3 },
];

export const BUILTIN_PROJECT_HINTS: Record<string, string> = {
  personal: "Дананг, спорт, здоровье, покупки, семья",
  voyage: "Клуб, бот, туры, резидентки, консьерж",
  status: "Модели, скаутинг, контракты, SMM, клиенты",
  russia: "Недвижимость, документы, юр. вопросы, поручения",
};

export type Subtask = { id: string; title: string; done: boolean };

export type TaskStatus = "open" | "done" | "archived";
export type TaskPriority = 1 | 2 | 3;

export type BunkerTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: string | null;
  subtasks: Subtask[];
  due_date: string | null; // YYYY-MM-DD
  is_pinned: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const PRIORITY_META: Record<TaskPriority, { label: string; short: string; color: string }> = {
  1: { label: "Высокий", short: "P1", color: "#f87171" },
  2: { label: "Средний", short: "P2", color: "#c9a961" },
  3: { label: "Низкий", short: "P3", color: "#71717a" },
};

export type DebtPayment = { id: string; amount: number; date: string; note: string | null; created_at?: string };
export type DebtStatus = "active" | "paid" | "paused";

export type BunkerDebt = {
  id: string;
  title: string;
  counterparty: string | null;
  total_amount: number;
  paid_amount: number;
  currency: string;
  due_date: string | null;
  monthly_payment: number | null;
  status: DebtStatus;
  history: DebtPayment[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InvestmentCategory = "crypto" | "real_estate" | "funds" | "loans" | "business" | "other";

export const INVESTMENT_CATEGORIES: Record<InvestmentCategory, { label: string; emoji: string; color: string }> = {
  crypto: { label: "Крипта", emoji: "₿", color: "#f59e0b" },
  real_estate: { label: "Недвижимость", emoji: "🏢", color: "#93c5fd" },
  funds: { label: "Фонды", emoji: "📊", color: "#6ee7b7" },
  loans: { label: "Займы", emoji: "🤝", color: "#fda4af" },
  business: { label: "Доли в бизнесе", emoji: "💼", color: "#c9a961" },
  other: { label: "Другое", emoji: "◆", color: "#a1a1aa" },
};

export type BunkerInvestment = {
  id: string;
  title: string;
  category: InvestmentCategory;
  initial_amount: number;
  current_value: number;
  currency: string;
  expected_roi: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BunkerNote = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type VaultCategory = "login" | "api_key" | "card" | "note";

export const VAULT_CATEGORIES: Record<VaultCategory, { label: string; plural: string }> = {
  login: { label: "Логин", plural: "Логины и пароли" },
  api_key: { label: "API-ключ", plural: "API-ключи" },
  card: { label: "Карта", plural: "Банковские карты" },
  note: { label: "Заметка", plural: "Приватные заметки" },
};

/** Строка таблицы bunker_vault: всё ценное — внутри ciphertext. */
export type BunkerVaultRow = {
  id: string;
  category: VaultCategory;
  ciphertext: string;
  iv: string;
  version: number;
  created_at: string;
  updated_at: string;
};

/** Расшифрованное содержимое записи сейфа (живёт только в памяти вкладки). */
export type VaultSecret = {
  title: string;
  username?: string;
  password?: string;
  url?: string;
  apiKey?: string;
  cardholder?: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
  pin?: string;
  notes?: string;
};

export type BunkerVaultKeys = {
  user_id: string;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  check_ciphertext: string;
  check_iv: string;
  uses_pepper: boolean;
};

export const CURRENCIES = ["USD", "EUR", "RUB", "VND", "USDT", "AED", "THB"] as const;
