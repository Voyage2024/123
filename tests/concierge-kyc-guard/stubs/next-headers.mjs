// Заглушка next/headers: IP и User-Agent для журнала аудита.
export async function headers() {
  const h = new Map([["x-forwarded-for", "203.0.113.7"], ["user-agent", "voyage-stand-test"]]);
  return { get: (k) => h.get(k.toLowerCase()) ?? null };
}
