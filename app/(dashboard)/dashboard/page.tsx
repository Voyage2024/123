"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  CheckCircle2,
  Clock,
  Lock,
  Shield,
  Eye,
  EyeOff,
  CreditCard,
  User,
  MapPin,
  Flag,
  Calendar,
  Ruler,
  Weight,
  Activity,
  Cigarette,
  Wine,
  AlignLeft,
  ChevronRight,
  UserCheck,
  Video,
  Phone,
  Crown,
  Sparkles,
  Gem,
  PartyPopper,
  Camera,
  Image as ImageIcon,
  Plus,
  Loader2,
  Check,
  X,
} from "lucide-react";

import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { VoyageIdCard } from "@/app/components/VoyageIdCard";

/* ──────────────────────────────────────────────────────────────────────
 * ПРИМЕЧАНИЯ ПО АРХИТЕКТУРЕ
 *
 * 1. Бакет `user-uploads` приватный, поэтому в колонке `photo_urls` мы
 *    храним ПУТИ к файлам (`${user.id}/${file.name}`), а для показа
 *    генерируем временные signed URL через createSignedUrls(). Если в
 *    массиве уже лежат полные http-ссылки — они используются как есть.
 *
 * 2. `height` / `weight` сохраняются как «сырые» значения из инпута.
 *    Если в БД это int — вводите только числа (PostgREST сам приведёт "172"
 *    к числу). Единицы (cm / kg) показываются отдельно и НЕ пишутся в БД.
 *
 * 3. Страница загружает профиль текущего пользователя (id = user.id).
 *    Админ редактирует Status / Achievements / KYC на профиле, который
 *    открыт. Чтобы дать админу проверять чужие анкеты — передавайте
 *    profileId через props/searchParams и замените user.id ниже.
 *
 * 4. Для записи нужны корректные RLS-политики на таблице `profiles`
 *    и на бакете `user-uploads` (insert/update/select для владельца,
 *    update status/kyc_level/achievements — для админа).
 * ──────────────────────────────────────────────────────────────────── */

const ADMIN_EMAIL = "fridelltubaugh129@gmail.com";

// ─── Types ──────────────────────────────────────────────────────────
type KycStatus = "completed" | "pending" | "locked";

interface Profile {
  id: string;
  full_name: string | null;
  location: string | null;
  citizenship: string | null;
  birth_date: string | null;
  height: string | number | null;
  weight: string | number | null;
  measurements: string | null;
  smoking: boolean;
  alcohol: boolean;
  about: string | null;
  status: string | null;
  kyc_level: number;
  achievements: string[] | null;
  photo_urls: string[] | null;
}

function emptyProfile(id: string): Profile {
  return {
    id,
    full_name: null,
    location: null,
    citizenship: null,
    birth_date: null,
    height: null,
    weight: null,
    measurements: null,
    smoking: false,
    alcohol: false,
    about: null,
    status: null,
    kyc_level: 1,
    achievements: [],
    photo_urls: [],
  };
}

// ─── Static meta ─────────────────────────────────────────────────────
const KYC_META: {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 1,
    title: "Identity",
    description: "International passport upload",
    icon: <Shield className="w-5 h-5" />,
  },
  {
    id: 2,
    title: "Club Loyalty",
    description: "Video mention of the club",
    icon: <Video className="w-5 h-5" />,
  },
  {
    id: 3,
    title: "Trust",
    description: "Video call verification",
    icon: <Phone className="w-5 h-5" />,
  },
];

const ACHIEVEMENTS: {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "disco_queen", label: "Disco Queen", Icon: Sparkles },
  { key: "gem", label: "Gem", Icon: Gem },
  { key: "party", label: "Party", Icon: PartyPopper },
];

const statusForLevel = (id: number, kycLevel: number): KycStatus =>
  id <= kycLevel ? "completed" : id === kycLevel + 1 ? "pending" : "locked";

const isFilled = (v: unknown) =>
  v !== null && v !== undefined && String(v).trim() !== "";

// helper: ISO date (1998-03-15) → 15.03.1998 for display only
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

// ─── Small UI primitives ─────────────────────────────────────────────

function ProfileCompletionBar({ percentage }: { percentage: number }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs tracking-[0.2em] uppercase text-zinc-500 font-medium">
          Profile Completion
        </span>
        <span className="text-xs tracking-[0.15em] text-amber-200/80 font-medium">
          {percentage}%
        </span>
      </div>
      <div className="relative h-[3px] w-full bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percentage}%`,
            background:
              "linear-gradient(90deg, #d4a853 0%, #f0d78c 50%, #d4a853 100%)",
            boxShadow: "0 0 12px rgba(212,168,83,0.3)",
          }}
        />
      </div>
    </div>
  );
}

function KYCStatusBadge({ status }: { status: KycStatus }) {
  const config = {
    completed: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      text: "Completed",
      className: "bg-emerald-950/40 text-emerald-400/90 border-emerald-800/30",
    },
    pending: {
      icon: <Clock className="w-3.5 h-3.5" />,
      text: "Pending",
      className: "bg-amber-950/30 text-amber-300/80 border-amber-800/20",
    },
    locked: {
      icon: <Lock className="w-3.5 h-3.5" />,
      text: "Locked",
      className: "bg-zinc-900/60 text-zinc-500 border-zinc-800/40",
    },
  } as const;

  const c = config[status];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] tracking-[0.12em] uppercase font-semibold border ${c.className}`}
    >
      {c.icon}
      {c.text}
    </div>
  );
}

function KYCCard({
  meta,
  status,
  isAdmin,
  onConfirm,
  onRevoke,
}: {
  meta: (typeof KYC_META)[number];
  status: KycStatus;
  isAdmin: boolean;
  onConfirm: () => void;
  onRevoke: () => void;
}) {
  const isLocked = status === "locked";
  const isCompleted = status === "completed";

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border transition-all duration-500 ${
        isLocked
          ? "bg-zinc-900/20 border-zinc-800/30 opacity-60"
          : isCompleted
          ? "bg-zinc-900/40 border-zinc-800/40 hover:border-emerald-900/40"
          : "bg-zinc-900/40 border-zinc-800/40 hover:border-amber-900/30"
      }`}
    >
      <div
        className={`absolute top-0 left-0 right-0 h-[1px] ${
          isCompleted
            ? "bg-emerald-500/20"
            : isLocked
            ? "bg-zinc-700/20"
            : "bg-amber-500/15"
        }`}
      />

      <div className="p-5 flex items-start gap-4">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border transition-colors duration-500 ${
            isCompleted
              ? "bg-emerald-950/30 border-emerald-800/30 text-emerald-400"
              : isLocked
              ? "bg-zinc-900/50 border-zinc-800/40 text-zinc-600"
              : "bg-amber-950/20 border-amber-800/20 text-amber-300/70"
          }`}
        >
          {meta.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                Level {meta.id}
              </span>
              <KYCStatusBadge status={status} />
            </div>
          </div>
          <h4
            className={`text-sm font-medium tracking-wide ${
              isLocked ? "text-zinc-500" : "text-zinc-200"
            }`}
          >
            {meta.title}
          </h4>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
            {meta.description}
          </p>
        </div>

        {/* Admin controls / resident read-only chevron */}
        {isAdmin ? (
          <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
            {status === "pending" && (
              <button
                onClick={onConfirm}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-[10px] tracking-[0.12em] uppercase font-semibold hover:border-emerald-600/50 hover:bg-emerald-900/40 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                Confirm
              </button>
            )}
            {status === "completed" && (
              <button
                onClick={onRevoke}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-zinc-500 text-[10px] tracking-[0.12em] uppercase font-medium hover:text-amber-300/80 transition-colors"
              >
                <X className="w-3 h-3" />
                Revoke
              </button>
            )}
            {status === "locked" && (
              <span className="text-[10px] text-zinc-600 tracking-wide">
                Complete L{meta.id - 1}
              </span>
            )}
          </div>
        ) : (
          !isLocked && (
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors mt-1" />
          )
        )}
      </div>
    </div>
  );
}

function VaultRow() {
  const [revealed, setRevealed] = useState(false);
  const walletShort = "T8x...7mK2";
  const walletFull =
    "T8x9aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890AbCdEfGhIjKlMnOpQrStUvWxYz7mK2";

  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500">
          <CreditCard className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium">
            USDT Wallet
          </p>
          <p className="text-sm text-zinc-300 mt-0.5 font-mono tracking-wide">
            {revealed ? walletFull : walletShort}
          </p>
        </div>
      </div>
      <button
        onClick={() => setRevealed(!revealed)}
        className="p-1.5 rounded-md hover:bg-zinc-800/50 text-zinc-600 hover:text-zinc-400 transition-all"
      >
        {revealed ? (
          <EyeOff className="w-3.5 h-3.5" />
        ) : (
          <Eye className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function ToggleSwitch({
  label,
  icon,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500">
          {icon}
        </div>
        <span className="text-sm text-zinc-300">{label}</span>
      </div>
      <button
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-all duration-300 border ${
          checked
            ? "bg-amber-500/20 border-amber-500/40"
            : "bg-zinc-800/60 border-zinc-700/40"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div
          className={`absolute top-[2px] w-4 h-4 rounded-full transition-all duration-300 ${
            checked
              ? "left-[22px] bg-amber-400 shadow-[0_0_8px_rgba(212,168,83,0.4)]"
              : "left-[2px] bg-zinc-500"
          }`}
        />
      </button>
    </div>
  );
}

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

/**
 * Инлайн-редактируемое текстовое поле.
 * Клик → инпут → сохранение по blur / Enter (Esc отменяет).
 */
function EditableText({
  value,
  onSave,
  editable = false,
  placeholder = "—",
  type = "text",
  multiline = false,
  mono = false,
  format,
}: {
  value: string | number | null | undefined;
  onSave: (v: string) => void;
  editable?: boolean;
  placeholder?: string;
  type?: "text" | "date" | "number";
  multiline?: boolean;
  mono?: boolean;
  format?: (v: string) => string;
}) {
  const raw = value === null || value === undefined ? "" : String(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(raw);

  useEffect(() => {
    setDraft(raw);
  }, [raw]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== raw) onSave(trimmed);
  };

  if (editable && editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          rows={6}
          className="w-full bg-zinc-950/60 border border-amber-500/30 rounded-lg p-3 text-xs text-zinc-200 leading-[1.8] outline-none focus:border-amber-500/50 resize-none"
        />
      );
    }
    return (
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(raw);
            setEditing(false);
          }
        }}
        className={`w-full max-w-[180px] bg-zinc-950/60 border border-amber-500/30 rounded-md px-2 py-1 text-sm text-zinc-100 outline-none focus:border-amber-500/50 ${
          mono ? "font-mono" : ""
        }`}
      />
    );
  }

  const hasValue = isFilled(raw);
  const display = hasValue ? (format ? format(raw) : raw) : placeholder;

  return (
    <span
      onClick={() => editable && setEditing(true)}
      title={editable ? "Нажмите, чтобы изменить" : undefined}
      className={`text-sm tracking-wide ${
        hasValue ? "text-zinc-200" : "text-zinc-600"
      } ${mono ? "font-mono" : ""} ${
        editable
          ? "cursor-text border-b border-dashed border-transparent hover:border-amber-500/30 hover:text-amber-200/90 transition-colors"
          : ""
      }`}
    >
      {multiline ? (
        <span className="whitespace-pre-line leading-[1.8]">{display}</span>
      ) : (
        display
      )}
    </span>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function ResidentProfilePage() {
  // Единственный вызов хука useAuth в компоненте
  const { user, setUser } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photoSrcs, setPhotoSrcs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEditOwn = !!user; // владелец редактирует свою базовую анкету

  // ── Генерация signed URL для приватного бакета ──────────────────────
  const resolvePhotos = useCallback(async (entries: string[]) => {
    if (!entries || entries.length === 0) {
      setPhotoSrcs([]);
      return;
    }
    const direct: string[] = [];
    const paths: string[] = [];
    entries.forEach((e) =>
      /^https?:\/\//.test(e) ? direct.push(e) : paths.push(e)
    );

    let signed: string[] = [];
    if (paths.length) {
      const { data, error } = await supabase.storage
        .from("user-uploads")
        .createSignedUrls(paths, 60 * 60); // 1 час
      if (error) console.error("createSignedUrls error:", error.message);
      signed = (data ?? [])
        .map((d) => d.signedUrl)
        .filter(Boolean) as string[];
    }
    setPhotoSrcs([...direct, ...signed]);
  }, []);

  // ── Загрузка профиля при монтировании ───────────────────────────────
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq('user_id', user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Не удалось загрузить профиль:", error.message);
      }

      const base: Profile = data
        ? {
            ...emptyProfile(user.id),
            ...data,
            smoking: !!data.smoking,
            alcohol: !!data.alcohol,
            kyc_level: data.kyc_level ?? 1,
            achievements: data.achievements ?? [],
            photo_urls: data.photo_urls ?? [],
          }
        : emptyProfile(user.id);

      setProfile(base);
      await resolvePhotos(base.photo_urls ?? []);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user, resolvePhotos]);

  // ── Универсальное сохранение (optimistic + upsert) ──────────────────
  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!user) return;
      
      // 2. Обновляем локальный стейт
      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
      
      // 3. ЕСЛИ меняется имя — обновляем «мозг» (AuthContext)
      if (patch.full_name) {
        setUser({ ...user, name: patch.full_name });
      }

      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...patch }, { onConflict: "id" });
      setSaving(false);
      
      if (error) console.error("Ошибка сохранения:", error.message);
    },
    [user, setUser] // Добавили setUser в зависимости
  );
  // ── Загрузка фото в Storage ─────────────────────────────────────────
// ── Загрузка фото в Storage (С защитой от кэша!) ────────────────────
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || !user || !profile) return;
      setUploading(true);

      const existing = profile.photo_urls ?? [];
      const added: string[] = [];

      for (const file of Array.from(files)) {
        // 1. Убираем пробелы и русские буквы из названия файла на всякий случай
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        // 2. Добавляем уникальную метку времени!
        const uniqueFileName = `${Date.now()}_${safeName}`;
        const path = `${user.id}/${uniqueFileName}`; 
        
        const { error } = await supabase.storage
          .from("user-uploads")
          .upload(path, file, { upsert: true, cacheControl: "3600" });
          
        if (error) {
          console.error("Загрузка не удалась:", error.message);
          alert("Ошибка при загрузке фото. Проверь консоль (F12).");
          continue;
        }
        
        if (!existing.includes(path) && !added.includes(path)) {
          added.push(path);
        }
      }

      if (added.length) {
        const next = [...existing, ...added];
        await updateProfile({ photo_urls: next });
        await resolvePhotos(next);
      }
      setUploading(false);
    },
    [user, profile, updateProfile, resolvePhotos]
  );
  // ── Удаление фото (владелец) ────────────────────────────────────────
  const removePhoto = useCallback(
    async (index: number) => {
      if (!profile || !user) return;
      const entries = profile.photo_urls ?? [];
      const target = entries[index];
      const next = entries.filter((_, i) => i !== index);

      // если это путь (а не внешний URL) — удаляем из бакета
      if (target && !/^https?:\/\//.test(target)) {
        await supabase.storage.from("user-uploads").remove([target]);
      }
      await updateProfile({ photo_urls: next });
      await resolvePhotos(next);
    },
    [profile, user, updateProfile, resolvePhotos]
  );

  const openFilePicker = () => fileInputRef.current?.click();

  // ── Ачивки (только админ) ───────────────────────────────────────────
  const toggleAchievement = (key: string) => {
    if (!profile || !isAdmin) return;
    const cur = profile.achievements ?? [];
    const next = cur.includes(key)
      ? cur.filter((k) => k !== key)
      : [...cur, key];
    updateProfile({ achievements: next });
  };

  // ── KYC (только админ) ──────────────────────────────────────────────
  const setKyc = (n: number) =>
    updateProfile({ kyc_level: Math.max(0, Math.min(3, n)) });

  // ── Прогресс заполнения ─────────────────────────────────────────────
  // 100% только если: все текстовые поля заполнены, ≥3 фото и kyc_level === 3
  const completion = useMemo(() => {
    if (!profile) return 0;
    const textFields = [
      profile.full_name,
      profile.location,
      profile.citizenship,
      profile.birth_date,
      profile.height,
      profile.weight,
      profile.measurements,
      profile.about,
    ];
    let done = textFields.filter(isFilled).length; // до 8
    done += Math.min((profile.photo_urls ?? []).length, 3); // до 3
    done += profile.kyc_level >= 3 ? 1 : 0; // до 1
    return Math.round((done / 12) * 100);
  }, [profile]);

  // ── Состояния загрузки / отсутствия пользователя ────────────────────
  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        <p className="text-sm tracking-wide">
          Пожалуйста, войдите, чтобы открыть личный кабинет.
        </p>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-300/70" />
      </div>
    );
  }

  const activeAchievements = profile.achievements ?? [];

  // ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* hidden file input для загрузки фото */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = ""; // позволяет выбрать тот же файл повторно
        }}
      />

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

      {/* индикатор сохранения */}
      {(saving || uploading) && (
        <div className="fixed top-4 right-4 z-50 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-md">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300/80" />
          <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-400">
            {uploading ? "Загрузка" : "Сохранение"}
          </span>
        </div>
      )}

      <div className="relative max-w-3xl mx-auto px-6 py-12 md:py-16">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <Crown className="w-5 h-5 text-amber-200/60" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-600 font-semibold">
              Voyage Private Club
            </span>
            {isAdmin && (
              <span className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-300/80 font-semibold">
                Admin
              </span>
            )}
          </div>
          <h1
            className="text-4xl md:text-5xl text-zinc-100 mb-6"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Resident Profile
          </h1>
          <ProfileCompletionBar percentage={completion} />

          {/* ── Digital VIP Card — read-only статус для всех ────── */}
          <div className="mt-6">
            <VoyageIdCard
              fullName={profile.full_name}
              status={profile.status}
              kycLevel={profile.kyc_level}
            />
          </div>
          {/* ── Achievements ───────────────────────────────────── */}
          <div
            className="mt-6 relative rounded-xl overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(212,168,83,0.02) 0%, rgba(24,24,24,0.4) 50%, rgba(212,168,83,0.015) 100%)",
            }}
          >
            <div className="absolute inset-0 rounded-xl border border-amber-500/15 pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-amber-500/20" />
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-amber-500/8" />

            <div className="p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Label */}
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-200/50" />
                <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 font-semibold">
                  Achievements
                </p>
              </div>

              {/* Achievements — админ переключает, резидент видит только выданные */}
              <div className="flex items-center gap-3">
                {ACHIEVEMENTS.map(({ key, label, Icon }) => {
                  const active = activeAchievements.includes(key);
                  if (!isAdmin && !active) return null; // резидент видит только выданные
                  return (
                    <button
                      key={key}
                      title={label}
                      onClick={() => toggleAchievement(key)}
                      disabled={!isAdmin}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border ${
                        active
                          ? "bg-amber-950/40 border-amber-500/30 text-amber-400 hover:shadow-[0_0_15px_rgba(253,230,138,0.2)] hover:border-amber-500/50"
                          : "bg-zinc-900/40 border-zinc-700/40 text-zinc-600 hover:border-amber-500/30 hover:text-amber-300/60"
                      } ${isAdmin ? "hover:scale-110 cursor-pointer" : "cursor-default"}`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
                {!isAdmin && activeAchievements.length === 0 && (
                  <span className="text-[10px] text-zinc-600 tracking-wide">
                    Нет наград
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Personal Portfolio ─────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
              Personal Portfolio
            </h2>
            <span className="text-[10px] text-zinc-600 ml-1">
              — Verified Data
            </span>
          </div>

          <div className="space-y-3">
            {/* Identity */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    Identity
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {/* Avatar (первое фото) */}
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 rounded-full bg-zinc-800/50 border border-amber-500/30 flex items-center justify-center overflow-hidden">
                      {photoSrcs[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoSrcs[0]}
                          alt="avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-9 h-9 text-zinc-500" />
                      )}
                    </div>
                    {canEditOwn && (
                      <button
                        onClick={openFilePicker}
                        className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-zinc-900 border border-amber-500/40 flex items-center justify-center text-amber-400 hover:text-amber-300 hover:border-amber-500/60 transition-all shadow-lg"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                    <div>
                      <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                        Full Name
                      </p>
                      <EditableText
                        value={profile.full_name}
                        editable={canEditOwn}
                        placeholder="Укажите имя"
                        onSave={(v) =>
                          updateProfile({ full_name: v || null })
                        }
                      />
                    </div>
                    <div>
                      <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                        Current Location
                      </p>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                        <EditableText
                          value={profile.location}
                          editable={canEditOwn}
                          placeholder="Город"
                          onSave={(v) =>
                            updateProfile({ location: v || null })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Citizenship */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Flag className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    Citizenship
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                      Nationality
                    </p>
                    <EditableText
                      value={profile.citizenship}
                      editable={canEditOwn}
                      placeholder="Гражданство"
                      onSave={(v) =>
                        updateProfile({ citizenship: v || null })
                      }
                    />
                  </div>
                  <div>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-1">
                      Date of Birth
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                      <EditableText
                        value={profile.birth_date}
                        editable={canEditOwn}
                        type="date"
                        mono
                        placeholder="дд.мм.гггг"
                        format={formatDate}
                        onSave={(v) =>
                          updateProfile({ birth_date: v || null })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Physical Parameters */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    Physical Parameters
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 mb-2">
                      <Ruler className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-0.5">
                      Height
                    </p>
                    <p className="text-sm text-zinc-200 font-mono tracking-wide flex items-center justify-center gap-1">
                      <EditableText
                        value={profile.height}
                        editable={canEditOwn}
                        type="number"
                        mono
                        placeholder="—"
                        onSave={(v) => updateProfile({ height: v || null })}
                      />
                      {isFilled(profile.height) && (
                        <span className="text-zinc-500 text-xs">cm</span>
                      )}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 mb-2">
                      <Weight className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-0.5">
                      Weight
                    </p>
                    <p className="text-sm text-zinc-200 font-mono tracking-wide flex items-center justify-center gap-1">
                      <EditableText
                        value={profile.weight}
                        editable={canEditOwn}
                        type="number"
                        mono
                        placeholder="—"
                        onSave={(v) => updateProfile({ weight: v || null })}
                      />
                      {isFilled(profile.weight) && (
                        <span className="text-zinc-500 text-xs">kg</span>
                      )}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500 mb-2">
                      <Activity className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-zinc-500 font-medium mb-0.5">
                      Measurements
                    </p>
                    <p className="text-sm text-zinc-200 font-mono tracking-wide">
                      <EditableText
                        value={profile.measurements}
                        editable={canEditOwn}
                        mono
                        placeholder="90 / 60 / 90"
                        onSave={(v) =>
                          updateProfile({ measurements: v || null })
                        }
                      />
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Lifestyle Habits */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Cigarette className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    Lifestyle Habits
                  </span>
                </div>
                <div className="divide-y divide-zinc-800/30">
                  <ToggleSwitch
                    label="Smoking Status"
                    icon={<Cigarette className="w-4 h-4" />}
                    checked={profile.smoking}
                    disabled={!canEditOwn}
                    onChange={(v) => updateProfile({ smoking: v })}
                  />
                  <ToggleSwitch
                    label="Alcohol Consumption"
                    icon={<Wine className="w-4 h-4" />}
                    checked={profile.alcohol}
                    disabled={!canEditOwn}
                    onChange={(v) => updateProfile({ alcohol: v })}
                  />
                </div>
              </div>
            </GlassCard>

            {/* About & Preferences */}
            <GlassCard>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <AlignLeft className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-semibold">
                    About & Preferences
                  </span>
                </div>
                <div className="bg-zinc-950/40 rounded-lg border border-zinc-800/30 p-4 text-xs text-zinc-400">
                  <EditableText
                    value={profile.about}
                    editable={canEditOwn}
                    multiline
                    placeholder="Расскажите о себе, своих предпочтениях в путешествиях…"
                    onSave={(v) => updateProfile({ about: v || null })}
                  />
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* ── Visual Portfolio ───────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Camera className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
              Visual Portfolio
            </h2>
            <span className="text-[10px] text-zinc-600 ml-1">
              — Polaroids &amp; Digitals
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photoSrcs.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="relative aspect-[3/4] rounded-xl bg-zinc-900/50 border border-zinc-800/40 overflow-hidden group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Photo ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0 opacity-30 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(212,168,83,0.06) 0%, transparent 50%, rgba(20,20,20,0.4) 100%)",
                  }}
                />
                <div className="absolute top-2 left-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400/80" />
                  </div>
                </div>
                {canEditOwn && (
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-zinc-950/70 border border-zinc-700/50 flex items-center justify-center text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:border-red-500/40 transition-all"
                    title="Удалить фото"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-zinc-950/80 to-transparent">
                  <p className="text-[10px] tracking-[0.15em] uppercase text-zinc-300 font-medium">
                    Photo {String(i + 1).padStart(2, "0")}
                  </p>
                </div>
              </div>
            ))}

            {/* placeholder, если фото нет */}
            {photoSrcs.length === 0 && (
              <div className="relative aspect-[3/4] rounded-xl bg-zinc-900/50 border border-zinc-800/40 overflow-hidden flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-zinc-700" />
              </div>
            )}

            {/* Upload Button */}
            {canEditOwn && (
              <button
                onClick={openFilePicker}
                disabled={uploading}
                className="relative aspect-[3/4] rounded-xl bg-transparent border border-dashed border-zinc-700 hover:border-amber-500/50 transition-all duration-300 flex flex-col items-center justify-center gap-2 group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-zinc-900/60 border border-zinc-700/40 group-hover:border-amber-500/30 group-hover:bg-amber-950/20 flex items-center justify-center transition-all duration-300">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                  )}
                </div>
                <span className="text-[11px] tracking-[0.12em] uppercase text-zinc-500 group-hover:text-amber-300/80 transition-colors font-medium">
                  {uploading ? "Uploading…" : "Add Photo"}
                </span>
              </button>
            )}
          </div>
        </section>

        {/* ── KYC Verification ───────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <UserCheck className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
              KYC Verification
            </h2>
            <span className="text-[10px] text-zinc-600 ml-1">— Trust Tiers</span>
          </div>

          <div className="space-y-3">
            {KYC_META.map((meta) => (
              <KYCCard
                key={meta.id}
                meta={meta}
                status={statusForLevel(meta.id, profile.kyc_level)}
                isAdmin={isAdmin}
                onConfirm={() => setKyc(meta.id)}
                onRevoke={() => setKyc(meta.id - 1)}
              />
            ))}
          </div>
        </section>

        {/* ── Personal Vault ─────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[11px] tracking-[0.25em] uppercase text-zinc-400 font-semibold">
              Personal Vault
            </h2>
            <span className="text-[10px] text-zinc-600 ml-1">— Encrypted</span>
          </div>

          <div className="bg-zinc-900/40 backdrop-blur-md rounded-xl border border-zinc-800/40 p-5">
            <VaultRow />
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="text-center pt-6 border-t border-zinc-900">
          <p className="text-[10px] tracking-[0.2em] text-zinc-700 uppercase">
            Voyage Private Club — Confidential
          </p>
          <p className="text-[10px] text-zinc-800 mt-1">
            All data is encrypted and stored under strict NDA
          </p>
        </footer>
      </div>
    </div>
  );
}
