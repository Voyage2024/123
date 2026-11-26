// Заглушка next/cache: запоминаем, какие пути action просил обновить.
globalThis.__revalidated = globalThis.__revalidated ?? [];
export function revalidatePath(path) { globalThis.__revalidated.push(path); }
