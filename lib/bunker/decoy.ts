/* ──────────────────────────────────────────────────────────────────────
 * Камуфляж для Duress PIN: скучная, но «живая» жизнь обычного человека.
 * Никаких VOYAGE, STATUS, капитала и настоящих паролей.
 *
 * Собирается в браузере владельца при установке Duress PIN: сейф
 * камуфляжа шифруется ключом из Duress PIN, поэтому под принуждением
 * он честно открывается и расшифровывается. Даты сдвинуты в прошлое,
 * чтобы записи не выглядели только что созданными.
 * ──────────────────────────────────────────────────────────────────── */

import { createVaultKeyMaterial, encryptSecret } from "@/lib/bunker/crypto";
import { addDays, isoDay, uid } from "@/lib/bunker/format";
import type { VaultCategory, VaultSecret } from "@/lib/bunker/types";

const daysAgo = (d: number, hour = 10 + Math.floor(Math.random() * 9)) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
  return t.toISOString();
};

export async function buildDecoySeed(duressPin: string, pepper: string | null) {
  const today = isoDay();

  const projects = [
    { slug: "home", name: "Дом", emoji: "🏠", color: "#6ee7b7" },
    { slug: "shopping", name: "Покупки", emoji: "🛒", color: "#fcd34d" },
    { slug: "car", name: "Машина", emoji: "🚗", color: "#93c5fd" },
    { slug: "health", name: "Здоровье", emoji: "💪", color: "#fda4af" },
  ].map((p, i) => ({ id: uid(), ...p, sort: i, created_at: daysAgo(64 - i) }));

  const task = (title: string, extra: Record<string, unknown> = {}, age = 3) => ({
    id: uid(),
    title,
    description: null,
    status: "open",
    priority: 3,
    category: null,
    subtasks: [],
    due_date: null,
    is_pinned: false,
    completed_at: null,
    created_at: daysAgo(age),
    updated_at: daysAgo(Math.max(0, age - 1)),
    ...extra,
  });

  const tasks = [
    task("Купить продукты", {
      category: "shopping",
      due_date: today,
      subtasks: [
        { id: uid(), title: "Молоко", done: false },
        { id: uid(), title: "Яйца", done: true },
        { id: uid(), title: "Хлеб", done: false },
        { id: uid(), title: "Сыр", done: false },
      ],
    }, 1),
    task("Заехать на автомойку", { category: "car", due_date: today, priority: 2 }, 4),
    task("Забрать посылку", { category: "home", due_date: addDays(today, 1) }, 2),
    task("Оплатить интернет", { category: "home", due_date: addDays(today, 3), priority: 2 }, 9),
    task("Записаться к стоматологу", { category: "health", due_date: addDays(today, 6) }, 12),
    task("Купить батарейки для пульта", { category: "shopping" }, 6),
    task("Позвонить маме в воскресенье", {}, 5),
    task("Поменять масло", { category: "car", due_date: addDays(today, 14) }, 20),
    task("Вернуть книгу в библиотеку", { category: "home", status: "done", completed_at: daysAgo(2), due_date: addDays(today, -2) }, 15),
    task("Продлить абонемент в зал", { category: "health", status: "done", completed_at: daysAgo(8) }, 18),
  ];

  const debts = [
    {
      id: uid(),
      title: "Рассрочка за наушники",
      counterparty: "Магазин электроники",
      total_amount: 12000,
      paid_amount: 8000,
      currency: "RUB",
      due_date: addDays(today, 50),
      monthly_payment: 2000,
      status: "active",
      history: [4, 3, 2, 1].map((m) => ({ id: uid(), amount: 2000, date: addDays(today, -30 * m + 3), note: null })),
      notes: null,
      created_at: daysAgo(125),
      updated_at: daysAgo(27),
    },
  ];

  const investments = [
    {
      id: uid(),
      title: "Накопительный счёт",
      category: "funds",
      initial_amount: 45000,
      current_value: 46380,
      currency: "RUB",
      expected_roi: 12,
      notes: "Откладываю понемногу с зарплаты.",
      created_at: daysAgo(150),
      updated_at: daysAgo(11),
    },
    {
      id: uid(),
      title: "Копилка на отпуск",
      category: "other",
      initial_amount: 18000,
      current_value: 18000,
      currency: "RUB",
      expected_roi: null,
      notes: null,
      created_at: daysAgo(80),
      updated_at: daysAgo(16),
    },
  ];

  const note = (title: string, content: string, age: number, extra: Record<string, unknown> = {}) => ({
    id: uid(),
    title,
    content,
    category: null,
    is_pinned: false,
    created_at: daysAgo(age),
    updated_at: daysAgo(Math.max(0, age - 2)),
    ...extra,
  });

  const notes = [
    note("Список покупок", "- [ ] Порошок\n- [x] Губки\n- [ ] Корм коту\n- [ ] Лампочка в ванную", 3, { category: "shopping", is_pinned: true }),
    note("Сырники", "## Ингредиенты\n- творог 400 г\n- 1 яйцо\n- 2 ст. л. муки\n- сахар по вкусу\n\nЖарить на среднем огне по 3 минуты.", 33, { category: "home" }),
    note("Посмотреть", "1. Интерстеллар (пересмотреть)\n2. Шерлок, 4 сезон\n3. Что-нибудь из Миядзаки", 21),
    note("Размеры", "Обувь — 43\nРубашка — L\nКольцо маме — 17,5", 47),
  ];

  const { key, row } = await createVaultKeyMaterial(duressPin, pepper);
  const secrets: Array<{ category: VaultCategory; secret: VaultSecret; age: number }> = [
    { category: "note", secret: { title: "Wi-Fi в кофейне", notes: "Сеть: Coffee_Guest\nПароль: latte2024" }, age: 19 },
    { category: "login", secret: { title: "Wi-Fi дома", username: "TP-Link_5G", password: "kotik-1987" }, age: 58 },
    { category: "note", secret: { title: "Домофон", notes: "Код: 27В4590\nКонсьерж: 8 (900) 000-00-00" }, age: 40 },
  ];
  const vault = [];
  for (const s of secrets) {
    const enc = await encryptSecret(key, s.category, s.secret);
    vault.push({ id: uid(), title: null, category: s.category, ...enc, version: 1, created_at: daysAgo(s.age), updated_at: daysAgo(s.age) });
  }

  return {
    projects,
    tasks,
    debts,
    investments,
    notes,
    vault,
    vault_keys: { ...row, created_at: daysAgo(64), updated_at: daysAgo(64) },
  };
}
