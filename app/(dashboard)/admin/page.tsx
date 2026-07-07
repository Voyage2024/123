"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import {
  Crown,
  Search,
  Filter,
  Users,
  MapPin,
  Flag,
  Lock,
  Check,
  BadgeCheck,
  Loader2,
  User,
  ChevronDown,
  Plus,
  Pencil,
  X,
} from "lucide-react";

import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN CONSOLE — /admin
 *
 * 1. Доступ только для ADMIN_EMAIL (то же сравнение user.email, что и в
 *    dashboard). Не-админам показываем экран «Access Denied».
 *
 * 2. Тянем ВСЕ профили из таблицы `profiles`. Поиск по full_name и фильтр
 *    по status выполняются на клиенте (быстро и scannable для клубного
 *    объёма резидентов). Если база разрастётся — поиск/фильтр легко
 *    перенести в сам .select() через .ilike() / .eq().
 *
 * 3. KYC Actions: если kyc_level < 3 — кнопка «Approve». Клик переводит
 *    резидента на максимальный уровень доверия (kyc_level = 3) —
 *    оптимистично в локальном стейте + upsert в Supabase, как в dashboard.
 *
 *    ⚠️ Примечание: в требовании сказано «статус обновляется на 3».
 *    В схеме `status` — это ТЕКСТОВОЕ поле (Disco Queen и т.п.), а число
 *    1–3 хранится в `kyc_level`. Колонка называется «KYC Actions» и условие
 *    завязано на kyc_level, поэтому Approve пишет именно kyc_level = 3.
 *    Если нужно трогать другое поле — поменяйте patch в approveKyc().
 *
 * 4. Аватар берём из первого элемента photo_urls. Бакет `user-uploads`
 *    приватный, поэтому пути пакетно превращаем в signed URL (как в
 *    dashboard через createSignedUrls). Внешние http-ссылки идут как есть.
 * ──────────────────────────────────────────────────────────────────── */

const ADMIN_EMAIL = "fridelltubaugh129@gmail.com";

// ─── Types ──────────────────────────────────────────────────────────
interface Resident {
  id: string;
  full_name: string | null;
  location: string | null;
  citizenship: string | null;
  status: string | null;
  kyc_level: number;
  photo_urls: string[] | null;
}

const NO_STATUS = "__none__";

const isFilled = (v: unknown) =>
  v !== null && v !== undefined && String(v).trim() !== "";

// ─── Small UI primitives (в стиле dashboard) ────────────────────────
function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative bg-zinc-900/40 backdrop-blur-md rounded-xl border border-zinc-800/40 overflow-hidden ${className}`}
    >
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-zinc-700/20" />
      {children}
    </div>
  );
}

// KYC — это 3 самостоятельные ступени доверия. Каждая достигнутая ступень
// горит ЗЕЛЁНЫМ (это пройденная верификация), а не жёлтым «в процессе».
// Недостигнутые ступени — приглушённый zinc.
function KycBadge({ level }: { level: number }) {
  return (
    <div className="inline-flex items-center gap-1" title={`KYC Level ${level} / 3`}>
      {[1, 2, 3].map((n) => {
        const reached = level >= n;
        return (
          <span
            key={n}
            className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-semibold border transition-colors ${
              reached
                ? "bg-emerald-950/40 text-emerald-400/90 border-emerald-800/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                : "bg-zinc-900/50 text-zinc-600 border-zinc-800/40"
            }`}
          >
            {reached ? <Check className="w-3.5 h-3.5" /> : n}
          </span>
        );
      })}
    </div>
  );
}

// ─── Draft для формы создания/редактирования ────────────────────────
interface ResidentDraft {
  id: string | null; // null → новый пользователь (создаётся через серверный роут)
  full_name: string;
  location: string;
  citizenship: string;
  status: string;
  kyc_level: number;
  // Только для создания нового пользователя (при редактировании не используются):
  email: string;
  password: string;
}

// Мелкий враппер поля формы (label + input) — чтобы разметка была чистой.
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

// Общие классы инпутов — в фирменном стиле (Zinc/Amber, как в тулбаре).
const INPUT_CLS =
  "w-full bg-zinc-950/60 border border-zinc-800/50 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 transition-colors";

// Уровни KYC — 3 самостоятельные ступени доверия (как KYC_META в dashboard).
// Каждая — пройденная верификация (зелёная), а не промежуточный этап.
const KYC_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Level 1 — Identity (паспорт)" },
  { value: 2, label: "Level 2 — Club Loyalty (видео)" },
  { value: 3, label: "Level 3 — Trust (видеозвонок)" },
];

/**
 * Модальное окно создания/редактирования резидента.
 * initial === null → режим «Add» (новый пользователь, через серверный роут).
 * initial !== null → режим «Edit».
 * Форма держит своё локальное состояние; наружу отдаёт готовый draft
 * через onSubmit, который возвращает true при успешном сохранении.
 *
 * Важно: компонент рендерится с key={id|"new"}, поэтому при каждом открытии
 * монтируется заново и стейт формы гарантированно свежий.
 */
function ResidentModal({
  initial,
  statusOptions,
  saving,
  onClose,
  onSubmit,
}: {
  initial: Resident | null;
  statusOptions: string[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (draft: ResidentDraft) => Promise<boolean>;
}) {
  const isNew = !initial;
  const CUSTOM = "__custom__";

  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [citizenship, setCitizenship] = useState(initial?.citizenship ?? "");

  // Учётные данные — только при создании нового пользователя.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Список статусов = уникальные из таблицы + текущий статус резидента
  // (чтобы при редактировании его собственный статус точно был в списке).
  const initialStatus = initial?.status ?? "";
  const knownStatuses = useMemo(() => {
    const set = new Set(statusOptions);
    if (isFilled(initialStatus)) set.add(initialStatus);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [statusOptions, initialStatus]);

  const [statusChoice, setStatusChoice] = useState(initialStatus); // "" | value | CUSTOM
  const [customStatus, setCustomStatus] = useState("");
  const status = statusChoice === CUSTOM ? customStatus : statusChoice;

  // Уровень KYC: при редактировании подтягиваем текущий, для новых — 1.
  const [kycLevel, setKycLevel] = useState<number>(initial?.kyc_level ?? 1);

  // Esc закрывает окно (если не идёт сохранение).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const handleSubmit = async () => {
    // При создании нового пользователя email и пароль обязательны.
    if (isNew) {
      if (!email.trim()) {
        alert("Укажите email нового пользователя.");
        return;
      }
      if (!password) {
        alert("Укажите пароль нового пользователя.");
        return;
      }
    }

    const ok = await onSubmit({
      id: initial?.id ?? null,
      full_name: fullName,
      location,
      citizenship,
      status,
      kyc_level: kycLevel,
      email,
      password,
    });
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm"
      onClick={() => !saving && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/60 rounded-2xl overflow-hidden shadow-2xl shadow-black/50"
      >
        {/* верхняя amber-линия, как у GlassCard/статус-карточки */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-amber-500/25" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-zinc-800/40">
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-600 font-semibold mb-1">
              {isNew ? "New Guest" : "Editing"}
            </p>
            <h3
              className="text-2xl text-zinc-100"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              {isNew ? "Add Resident" : "Edit Resident"}
            </h3>
          </div>
          <button
            onClick={() => !saving && onClose()}
            className="flex-shrink-0 w-8 h-8 rounded-md border border-zinc-800/50 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700/60 flex items-center justify-center transition-all"
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Учётные данные — показываем только при создании нового пользователя.
              При редактировании логин/пароль меняются в другом месте. */}
          {isNew && (
            <>
              <Field label="Email">
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="resident@example.com"
                  className={INPUT_CLS}
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Пароль для входа"
                  className={INPUT_CLS}
                />
              </Field>

              {/* тонкий разделитель между учёткой и анкетой */}
              <div className="h-px bg-zinc-800/40" />
            </>
          )}

          <Field label="Full Name">
            <input
              autoFocus={!isNew}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Имя резидента"
              className={INPUT_CLS}
            />
          </Field>

          <Field label="Current Location">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Город"
              className={INPUT_CLS}
            />
          </Field>

          <Field label="Citizenship">
            <input
              value={citizenship}
              onChange={(e) => setCitizenship(e.target.value)}
              placeholder="Гражданство"
              className={INPUT_CLS}
            />
          </Field>

          <Field label="Status">
            <div className="relative">
              <select
                value={statusChoice}
                onChange={(e) => setStatusChoice(e.target.value)}
                className={`${INPUT_CLS} appearance-none pr-9 cursor-pointer`}
              >
                <option value="">— Без статуса —</option>
                {knownStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value={CUSTOM}>＋ Новый статус…</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
            </div>
            {statusChoice === CUSTOM && (
              <input
                autoFocus
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                placeholder="Введите новый статус"
                className={`${INPUT_CLS} mt-2`}
              />
            )}
          </Field>

          <Field label="KYC Level">
            <div className="relative">
              <select
                value={String(kycLevel)}
                onChange={(e) => setKycLevel(Number(e.target.value))}
                className={`${INPUT_CLS} appearance-none pr-9 cursor-pointer`}
              >
                {KYC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800/40 flex items-center justify-end gap-3">
          <button
            onClick={() => !saving && onClose()}
            className="px-4 py-2 rounded-md text-zinc-400 text-[11px] tracking-[0.12em] uppercase font-medium hover:text-zinc-200 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[11px] tracking-[0.12em] uppercase font-semibold hover:bg-amber-500/25 hover:border-amber-500/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function AdminConsolePage() {
  // Единственный вызов useAuth.
  // ВАЖНО: берём из контекста флаг загрузки сессии (authLoading).
  // Пока authLoading === true — сессия ещё проверяется, и user закономерно
  // равен null. В этот момент НЕЛЬЗЯ принимать решение о доступе.
  // (Если в AuthContext этого поля ещё нет — добавьте его, см. примечание
  //  в конце файла. Без него страница не «висит», но защита от гонки слабее.)
  const { user, loading: authLoading } = useAuth();

  // Сравнение email — регистронезависимое и без крайних пробелов,
  // чтобы «Fridell@…» и «fridell@…» считались одним и тем же админом.
  const isAdmin =
    !!user?.email &&
    user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();

  const [residents, setResidents] = useState<Resident[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  // dataLoading — это загрузка ТАБЛИЦЫ профилей, не путать с authLoading.
  const [dataLoading, setDataLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ── Стейт модалки создания/редактирования ─────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Resident | null>(null); // null → Add
  const [saving, setSaving] = useState(false);

  // ── Пакетная генерация signed URL для аватаров ────────────────────
  const resolveAvatars = useCallback(async (rows: Resident[]) => {
    const pathByResident: Record<string, string> = {}; // id → path (для бакета)
    const directByResident: Record<string, string> = {}; // id → http URL
    const paths: string[] = [];

    rows.forEach((r) => {
      const first = (r.photo_urls ?? [])[0];
      if (!first) return;
      if (/^https?:\/\//.test(first)) {
        directByResident[r.id] = first;
      } else {
        pathByResident[r.id] = first;
        paths.push(first);
      }
    });

    const map: Record<string, string> = { ...directByResident };

    if (paths.length) {
      const { data, error } = await supabase.storage
        .from("user-uploads")
        .createSignedUrls(paths, 60 * 60); // 1 час
      if (error) console.error("createSignedUrls error:", error.message);

      const urlByPath: Record<string, string> = {};
      (data ?? []).forEach((d) => {
        if (d.path && d.signedUrl) urlByPath[d.path] = d.signedUrl;
      });

      Object.entries(pathByResident).forEach(([id, path]) => {
        if (urlByPath[path]) map[id] = urlByPath[path];
      });
    }

    setAvatars(map);
  }, []);

  // ── Загрузка всех профилей ────────────────────────────────────────
  useEffect(() => {
    // 1. Пока сессия не проверена — ничего не делаем и НЕ трогаем dataLoading.
    if (authLoading) return;

    // 2. Сессия проверена. Если пользователя нет или он не админ —
    //    грузить профили незачем, просто завершаем загрузку таблицы.
    if (!user || !isAdmin) {
      setDataLoading(false);
      return;
    }

    let active = true;

    (async () => {
      setDataLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, location, citizenship, status, kyc_level, photo_urls"
        )
        .order("full_name", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("Не удалось загрузить профили:", error.message);
        setResidents([]);
        setDataLoading(false);
        return;
      }

      const rows: Resident[] = (data ?? []).map((d) => ({
        id: d.id,
        full_name: d.full_name ?? null,
        location: d.location ?? null,
        citizenship: d.citizenship ?? null,
        status: d.status ?? null,
        kyc_level: d.kyc_level ?? 1,
        photo_urls: d.photo_urls ?? [],
      }));

      setResidents(rows);
      setDataLoading(false);
      // аватары подгружаем не блокируя таблицу
      resolveAvatars(rows);
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user, isAdmin, resolveAvatars]);

  // ── Approve KYC → kyc_level = 3 (оптимистично + upsert) ───────────
  const approveKyc = useCallback(async (id: string) => {
    setApprovingId(id);

    // 1. оптимистично обновляем локальный стейт
    setResidents((prev) =>
      prev.map((r) => (r.id === id ? { ...r, kyc_level: 3 } : r))
    );

    // 2. пишем в Supabase (тот же паттерн upsert/onConflict, что и в dashboard)
    const { error } = await supabase
      .from("profiles")
      .upsert({ id, kyc_level: 3 }, { onConflict: "id" });

    if (error) {
      console.error("Ошибка подтверждения KYC:", error.message);
      // откат при ошибке — перечитывать не нужно, просто вернём флаг
      // (в проде здесь можно перезагрузить строку из БД)
    }
    setApprovingId(null);
  }, []);

  // ── Открытие модалки ──────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null); // режим создания
    setModalOpen(true);
  };
  const openEdit = (r: Resident) => {
    setEditing(r); // режим редактирования
    setModalOpen(true);
  };
  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  // ── Сохранение резидента ──────────────────────────────────────────
  // Создание нового: идём через серверный роут /api/admin/create-user
  //   (там создаётся реальный аккаунт в Supabase Auth + профиль).
  // Редактирование: прямой upsert в profiles (у админа уже есть права).
  const handleSave = useCallback(async (draft: ResidentDraft): Promise<boolean> => {
    const isNew = !draft.id;

    // Нормализуем строки анкеты в null (как в схеме profiles).
    const fullName = draft.full_name.trim() || null;
    const location = draft.location.trim() || null;
    const citizenship = draft.citizenship.trim() || null;
    const status = draft.status.trim() || null;
    const kycLevel = Number(draft.kyc_level);

    setSaving(true);

    // ── Ветка СОЗДАНИЯ: POST на серверный роут ──────────────────────
    if (isNew) {
      try {
        // Берём текущую сессию — серверный роут по этому токену проверит,
        // что запрос делает залогиненный админ.
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const res = await fetch("/admin/create-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: draft.email.trim(),
            password: draft.password,
            full_name: fullName,
            location,
            citizenship,
            status,
            kyc_level: kycLevel,
          }),
        });

        // Пытаемся распарсить JSON даже при ошибке (там лежит текст ошибки).
        const data = await res.json().catch(() => ({} as Record<string, unknown>));

        if (!res.ok) {
          console.error("create-user failed:", data);
          const msg =
            (data as { error?: string; message?: string }).error ||
            (data as { message?: string }).message ||
            `Не удалось создать пользователя (HTTP ${res.status}).`;
          alert(msg);
          return false;
        }

        // Сервер возвращает userId созданного пользователя (= profiles.id).
        // Запасные формы ответа оставлены на случай иной структуры.
        const created = (data as {
          userId?: string;
          user?: { id?: string };
          profile?: { id?: string };
          id?: string;
        }) ?? {};
        const newId =
          created.userId ??
          created.user?.id ??
          created.profile?.id ??
          created.id;
        if (!newId) {
          console.warn(
            "create-user: ответ без userId — роут должен вернуть { userId } созданного пользователя."
          );
        }

        // Добавляем нового пользователя в локальный стейт (сверху списка),
        // чтобы его сразу можно было редактировать по этому же id.
        const newResident: Resident = {
          id: newId ?? crypto.randomUUID(),
          full_name: fullName,
          location,
          citizenship,
          status,
          kyc_level: kycLevel,
          photo_urls: [],
        };
        setResidents((prev) => [newResident, ...prev]);
        return true;
      } catch (e) {
        console.error("Сетевая ошибка при создании пользователя:", e);
        alert("Сетевая ошибка при создании пользователя. Проверьте консоль (F12).");
        return false;
      } finally {
        setSaving(false);
      }
    }

    // ── Ветка РЕДАКТИРОВАНИЯ: прямой upsert (как раньше) ────────────
    const id = draft.id as string;
    const payload = {
      id,
      full_name: fullName,
      location,
      citizenship,
      status,
      kyc_level: kycLevel,
    };

    // Оптимистично патчим строку в списке.
    setResidents((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...payload } : r))
    );

    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    setSaving(false);

    if (error) {
      console.error("Ошибка сохранения резидента:", error.message);
      alert("Не удалось сохранить резидента. Проверьте консоль (F12).");
      return false;
    }
    return true;
  }, []);

  // ── Уникальные статусы для выпадающего фильтра ────────────────────
  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    residents.forEach((r) => {
      if (isFilled(r.status)) set.add(r.status as string);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [residents]);

  // ── Применяем поиск + фильтр ──────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return residents.filter((r) => {
      const matchesSearch =
        !q || (r.full_name ?? "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === NO_STATUS
          ? !isFilled(r.status)
          : r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [residents, search, statusFilter]);
  // ── Guard 1: сессия ещё проверяется ───────────────────────────────
  // Самый первый и самый важный guard. Пока authLoading === true, мы НЕ
  // знаем, кто пользователь, поэтому решение о доступе НЕ принимаем —
  // просто показываем Loader2. Это и убирает ложный «Access Denied».
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-300/70" />
      </div>
    );
  }

  // ── Guard 2: сессия проверена, пользователя нет ───────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        <p className="text-sm tracking-wide">
          Пожалуйста, войдите, чтобы открыть консоль.
        </p>
      </div>
    );
  }

  // ── Guard 3: пользователь есть, но это НЕ админ ───────────────────
  // Сюда попадаем только после того, как сессия точно загрузилась,
  // поэтому email уже настоящий, а не временный null.
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
        <GlassCard className="max-w-sm w-full">
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-950/30 border border-amber-800/30 flex items-center justify-center text-amber-300/70 mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-600 font-semibold mb-1">
              Access Denied
            </p>
            <h1
              className="text-2xl text-zinc-100 mb-2"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Admins Only
            </h1>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Эта область доступна только администраторам клуба.
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ── Guard 4: админ подтверждён, грузится таблица ──────────────────
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-300/70" />
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Subtle ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-[0.03]"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.4) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full opacity-[0.02]"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.3) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* индикатор сохранения (KYC approve или сохранение из модалки) */}
      {(approvingId || saving) && (
        <div className="fixed top-4 right-4 z-50 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-md">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300/80" />
          <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-400">
            Сохранение
          </span>
        </div>
      )}

      <div className="relative max-w-6xl mx-auto px-6 py-12 md:py-16">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <Crown className="w-5 h-5 text-amber-200/60" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-600 font-semibold">
              Voyage Private Club
            </span>
            <span className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-300/80 font-semibold">
              Admin
            </span>
          </div>
          <h1
            className="text-4xl md:text-5xl text-zinc-100 mb-2"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Resident Directory
          </h1>
          <p className="text-xs text-zinc-500 tracking-wide">
            Управление резидентами и подтверждение KYC
          </p>
        </header>

        {/* ── Toolbar: search + filter + count ───────────────────── */}
        <section className="mb-6">
          <GlassCard>
            <div className="p-4 flex flex-col md:flex-row md:items-center gap-3">
              {/* Search by full_name */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по имени…"
                  className="w-full bg-zinc-950/60 border border-zinc-800/50 rounded-md pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 transition-colors"
                />
              </div>

              {/* Status filter */}
              <div className="relative md:w-56">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full appearance-none bg-zinc-950/60 border border-zinc-800/50 rounded-md pl-9 pr-9 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500/40 transition-colors cursor-pointer"
                >
                  <option value="all">Все статусы</option>
                  <option value={NO_STATUS}>— Без статуса —</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
              </div>

              {/* Right cluster: count + Add Resident */}
              <div className="flex items-center gap-3 md:ml-auto">
                {/* Count */}
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-zinc-950/40 border border-zinc-800/40 text-zinc-500">
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-[11px] tracking-[0.12em] uppercase font-medium">
                    {filtered.length} / {residents.length}
                  </span>
                </div>

                {/* + Add Resident */}
                <button
                  onClick={openAdd}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-amber-950/40 border border-amber-500/30 text-amber-300/90 text-[11px] tracking-[0.12em] uppercase font-semibold hover:border-amber-500/50 hover:bg-amber-900/30 transition-all whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Resident
                </button>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* ── Residents Table ────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
              Residents
            </h2>
            <span className="text-[10px] text-zinc-600 ml-1">— Directory</span>
          </div>

          <GlassCard>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                {/* Head */}
                <thead>
                  <tr className="border-b border-zinc-800/40">
                    {[
                      "Resident",
                      "Location",
                      "Citizenship",
                      "Status",
                      "KYC",
                      "KYC Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold ${
                          h === "KYC Actions" ? "text-right" : ""
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Body */}
                <tbody className="divide-y divide-zinc-800/30">
                  {filtered.map((r) => {
                    const avatar = avatars[r.id];
                    const verified = r.kyc_level >= 3;
                    const isApproving = approvingId === r.id;

                    return (
                      <tr
                        key={r.id}
                        className="group hover:bg-zinc-900/30 transition-colors"
                      >
                        {/* Resident: avatar + name */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0 w-9 h-9 rounded-full bg-zinc-800/50 border border-zinc-700/40 flex items-center justify-center overflow-hidden">
                              {avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={avatar}
                                  alt={r.full_name ?? "resident"}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-4 h-4 text-zinc-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p
                                className={`text-sm tracking-wide truncate ${
                                  isFilled(r.full_name)
                                    ? "text-zinc-200"
                                    : "text-zinc-600"
                                }`}
                              >
                                {isFilled(r.full_name)
                                  ? r.full_name
                                  : "Без имени"}
                              </p>
                              <p className="text-[10px] text-zinc-700 font-mono truncate">
                                {r.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-5 py-3.5">
                          {isFilled(r.location) ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-zinc-300">
                              <MapPin className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                              {r.location}
                            </span>
                          ) : (
                            <span className="text-sm text-zinc-600">—</span>
                          )}
                        </td>

                        {/* Citizenship */}
                        <td className="px-5 py-3.5">
                          {isFilled(r.citizenship) ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-zinc-300">
                              <Flag className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                              {r.citizenship}
                            </span>
                          ) : (
                            <span className="text-sm text-zinc-600">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          {isFilled(r.status) ? (
                            <span
                              className="text-sm text-amber-200/90 tracking-wide"
                              style={{
                                fontFamily: "'Cormorant Garamond', serif",
                              }}
                            >
                              {r.status}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-600 tracking-wide">
                              не назначен
                            </span>
                          )}
                        </td>

                        {/* KYC level badge */}
                        <td className="px-5 py-3.5">
                          <KycBadge level={r.kyc_level} />
                        </td>

                        {/* KYC Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {verified ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] tracking-[0.12em] uppercase font-semibold border bg-emerald-950/40 text-emerald-400/90 border-emerald-800/30">
                                <BadgeCheck className="w-3.5 h-3.5" />
                                Verified
                              </span>
                            ) : (
                              <button
                                onClick={() => approveKyc(r.id)}
                                disabled={isApproving}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-[10px] tracking-[0.12em] uppercase font-semibold hover:border-emerald-600/50 hover:bg-emerald-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isApproving ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                Approve
                              </button>
                            )}

                            {/* Edit (карандаш) */}
                            <button
                              onClick={() => openEdit(r)}
                              title="Редактировать резидента"
                              className="flex-shrink-0 w-8 h-8 rounded-md border border-zinc-800/50 text-zinc-500 hover:text-amber-300/80 hover:border-amber-500/30 flex items-center justify-center transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Empty state */}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-16">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 rounded-xl bg-zinc-900/60 border border-zinc-800/40 flex items-center justify-center text-zinc-600 mb-3">
                            <Search className="w-5 h-5" />
                          </div>
                          <p className="text-sm text-zinc-500">
                            Резиденты не найдены
                          </p>
                          <p className="text-[11px] text-zinc-700 mt-1">
                            Попробуйте изменить поиск или фильтр
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </section>

        {/* ── Модалка создания/редактирования ────────────────────── */}
        {modalOpen && (
          <ResidentModal
            key={editing?.id ?? "new"}
            initial={editing}
            statusOptions={statusOptions}
            saving={saving}
            onClose={closeModal}
            onSubmit={handleSave}
          />
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="text-center pt-6 border-t border-zinc-900">
          <p className="text-[10px] tracking-[0.2em] text-zinc-700 uppercase">
            Voyage Private Club — Admin Console
          </p>
          <p className="text-[10px] text-zinc-800 mt-1">
            All data is encrypted and stored under strict NDA
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * ПРИМЕЧАНИЕ: флаг загрузки сессии в AuthContext
 *
 * Эта страница ждёт `loading` из useAuth(). Если в вашем AuthContext такого
 * поля ещё нет — добавьте его, иначе гонка (user === null на первом рендере)
 * вернётся. Минимальный каркас:
 *
 *   const [user, setUser] = useState<User | null>(null);
 *   const [loading, setLoading] = useState(true); // true, пока не проверим сессию
 *
 *   useEffect(() => {
 *     // 1. первичная проверка существующей сессии
 *     supabase.auth.getSession().then(({ data }) => {
 *       setUser(data.session?.user ?? null);
 *       setLoading(false);            // ← вот этот момент мы и ждём на /admin
 *     });
 *     // 2. подписка на дальнейшие изменения (login / logout)
 *     const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
 *       setUser(session?.user ?? null);
 *       setLoading(false);
 *     });
 *     return () => sub.subscription.unsubscribe();
 *   }, []);
 *
 *   return (
 *     <AuthContext.Provider value={{ user, setUser, loading }}>
 *       {children}
 *     </AuthContext.Provider>
 *   );
 *
 * И не забудьте добавить `loading: boolean` в тип значения контекста.
 * ──────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────────
 * ПРИМЕЧАНИЕ: контракт серверного роута /api/admin/create-user
 *
 * Создание нового пользователя теперь идёт НЕ напрямую из браузера, а через
 * серверный роут — там на service-role ключе создаётся реальный аккаунт в
 * Supabase Auth и профиль в `profiles`. Клиент шлёт POST с заголовком
 * `Authorization: Bearer <access_token>` (токен текущей сессии админа) и JSON:
 *
 *   { email, password, full_name, location, citizenship, status, kyc_level }
 *
 * Ожидаемый ответ:
 *   • успех  → 200/201 и JSON вида { userId: "<uuid>" } — этот userId
 *              используется как profiles.id в локальном стейте, чтобы нового
 *              резидента сразу можно было редактировать/подтверждать по нему.
 *   • ошибка → любой не-2xx статус и JSON вида { error: "текст" }
 *              (или { message: "…" }) — текст показывается в alert.
 *
 * На сервере роут должен: проверить Bearer-токен и что вызывающий — админ;
 * создать юзера через supabase.auth.admin.createUser(...); записать профиль;
 * вернуть { userId }. Редактирование существующих по-прежнему идёт прямым
 * upsert из клиента (нужна RLS-политика на UPDATE profiles для админа).
 * ──────────────────────────────────────────────────────────────────── */
