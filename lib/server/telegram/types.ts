export type TelegramLang = "EN" | "RU" | "ES" | "PT";

export type RegistrationStage =
  | "email"
  | "full_name"
  | "birth_date"
  | "location"
  | "measurements"
  | "photos"
  | "submitting"
  // Партнёрская анкета (/start partner, /partner)
  | "partner_name"
  | "partner_regions"
  | "partner_contact"
  | "partner_email"
  | "partner_submitting"
  // Анкета оператора (/start operator, /operator, op_VYO-…)
  | "operator_name"
  | "operator_username"
  | "operator_phone"
  | "operator_timezone"
  | "operator_manager"
  | "operator_experience"
  | "operator_submitting"
  // Анкета скаута (/scout, /start scout, sc_VYS-…)
  | "scout_name"
  | "scout_phone"
  | "scout_about"
  | "scout_submitting";

export interface RegistrationAnswers {
  email?: string;
  full_name?: string;
  birth_date?: string;
  location?: string;
  measurements?: string;
  partner_name?: string;
  partner_regions?: string;
  partner_contact?: string;
  partner_email?: string;
  operator_name?: string;
  operator_username?: string;
  operator_username_confirmed?: string;
  operator_phone?: string;
  operator_timezone?: string;
  operator_manager_id?: string;
  operator_manager_name?: string;
  operator_invite?: string;
  operator_experience?: string;
  scout_name?: string;
  scout_phone?: string;
  scout_about?: string;
  scout_invite?: string;
  scout_invite_issuer?: string;
}

export interface TelegramConversationState {
  telegram_id: string;
  telegram_username: string | null;
  telegram_language: TelegramLang;
  stage: RegistrationStage;
  answers: RegistrationAnswers;
  photo_urls: string[];
  /** Резидентки — код VYG-… приглашения; партнёры — код VYP-… инвайта владельца. */
  referral_code?: string | null;
  updated_at?: string;
  expires_at: string;
}

export function isTelegramLang(value: string): value is TelegramLang {
  return value === "EN" || value === "RU" || value === "ES" || value === "PT";
}

export function languageFromTelegram(code?: string | null): TelegramLang {
  const value = (code ?? "").toLowerCase();
  if (value.startsWith("es")) return "ES";
  if (value.startsWith("pt")) return "PT";
  if (value.startsWith("en")) return "EN";
  return "RU";
}
