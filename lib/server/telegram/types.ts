export type TelegramLang = "EN" | "RU" | "ES" | "PT";

export type RegistrationStage =
  | "email"
  | "full_name"
  | "birth_date"
  | "location"
  | "measurements"
  | "photos"
  | "submitting";

export interface RegistrationAnswers {
  email?: string;
  full_name?: string;
  birth_date?: string;
  location?: string;
  measurements?: string;
}

export interface TelegramConversationState {
  telegram_id: string;
  telegram_username: string | null;
  telegram_language: TelegramLang;
  stage: RegistrationStage;
  answers: RegistrationAnswers;
  photo_urls: string[];
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
