/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · именной водяной знак (этап 2, решение D3)
 * app/components/media/WatermarkLayer.tsx
 *
 * Кладётся поверх фото и видео в каталоге. Текст — код менеджера и дата
 * от базы (voyage_rcat_viewer). Это средство отследить утечку скриншота,
 * а не защита от копирования. Без хуков: подходит и для серверных частей.
 * ──────────────────────────────────────────────────────────────────── */

export function WatermarkLayer({ text, dense = false }: { text: string | null | undefined; dense?: boolean }) {
  if (!text) return null;
  const rows = dense ? 9 : 6;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[3] select-none overflow-hidden" data-voyage-watermark="">
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-col justify-around">
        {Array.from({ length: rows }, (_, i) => (
          <p
            key={i}
            className="whitespace-nowrap text-center font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-white/[0.16] [text-shadow:0_0_2px_rgba(0,0,0,0.35)]"
            style={{ transform: `translateX(${i % 2 ? -12 : 8}%)` }}
          >
            {`${text}   ·   ${text}   ·   ${text}`}
          </p>
        ))}
      </div>
    </div>
  );
}

export default WatermarkLayer;
