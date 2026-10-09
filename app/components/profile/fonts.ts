import { Cormorant_Garamond } from "next/font/google";

/** Строгий сериф профиля — тот же набор, что в GamificationClient (next/font дедуплицирует) */
export const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});
