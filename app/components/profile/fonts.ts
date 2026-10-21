/**
 * Строгий сериф Cormorant Garamond.
 * Раньше шёл через next/font/google, но Turbopack на Vercel падал на
 * "@vercel/turbopack-next/internal/font/google/font". Теперь шрифт грузится
 * через @import Google Fonts в app/globals.css, а здесь — объект с той же
 * формой, что отдавал next/font, чтобы `cormorant.className` работал без правок JSX.
 */
export const cormorant = {
  /** Класс объявлен в globals.css: .voyage-cormorant { font-family: var(--font-cormorant) } */
  className: "voyage-cormorant",
  /** Переменная --font-cormorant объявлена на :root в globals.css, отдельный класс не нужен */
  variable: "",
  style: { fontFamily: "var(--font-cormorant)" },
} as const;
