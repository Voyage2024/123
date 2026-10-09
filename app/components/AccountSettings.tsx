"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth, isRole, type Role } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";

// ---------------------------------------------------------------------------
// Словарь переводов
// ---------------------------------------------------------------------------
const translations = {
  EN: {
    titleMain: "Profile",
    titleAccent: "settings",
    memberSince: "Member since",
    roles: { owner: "Owner", admin: "Administrator", manager: "Manager", resident: "Resident" },
    changePhoto: "Change photo",
    uploadPhoto: "Upload photo",
    avatarUploading: "Uploading…",
    avatarSaved: "Photo updated",
    avatarHint: "JPG, PNG or WebP, up to 10 MB",
    profileSection: "Profile",
    profileHint: "How your name appears across the club",
    nameLabel: "Name",
    namePlaceholder: "Your name",
    saveName: "Save name",
    saving: "Saving…",
    nameSaved: "Name updated",
    securitySection: "Security",
    securityHint: "Change the password you use to sign in",
    newPasswordLabel: "New password",
    newPasswordPlaceholder: "At least 8 characters",
    confirmPasswordLabel: "Confirm password",
    confirmPasswordPlaceholder: "Repeat the password",
    show: "Show",
    hide: "Hide",
    charsLeft: (n: number) => `${n} more character${n === 1 ? "" : "s"}`,
    updatePassword: "Update password",
    passwordSaved: "Password updated successfully",
    errors: {
      nameEmpty: "Name cannot be empty",
      nameTooLong: "Name must be 60 characters or fewer",
      nameUnchanged: "This is already your current name",
      noPermission: "You don't have permission to change this profile",
      passwordTooShort: "Password must be at least 8 characters",
      passwordMismatch: "Passwords do not match",
      samePassword: "New password must differ from the current one",
      reauth: "Please sign in again, then change your password",
      avatarNotImage: "Please choose an image file",
      avatarTooLarge: "The image is too large (max 10 MB)",
      avatarUnsupported: "This image format isn't supported. Try JPG or PNG.",
      avatarUploadFailed: "Upload failed. Please try again.",
      syncFailed: "Saved, but your session didn't refresh. Sign out and back in to see the change everywhere.",
      network: "Connection error. Check your internet and try again.",
      generic: "Something went wrong. Please try again.",
    },
  },
  RU: {
    titleMain: "Настройки",
    titleAccent: "профиля",
    memberSince: "В клубе с",
    roles: { owner: "Владелец", admin: "Администратор", manager: "Менеджер", resident: "Резидент" },
    changePhoto: "Сменить фото",
    uploadPhoto: "Загрузить фото",
    avatarUploading: "Загрузка…",
    avatarSaved: "Фото обновлено",
    avatarHint: "JPG, PNG или WebP, до 10 МБ",
    profileSection: "Профиль",
    profileHint: "Как ваше имя отображается в клубе",
    nameLabel: "Имя",
    namePlaceholder: "Ваше имя",
    saveName: "Сохранить имя",
    saving: "Сохранение…",
    nameSaved: "Имя обновлено",
    securitySection: "Безопасность",
    securityHint: "Смена пароля для входа в кабинет",
    newPasswordLabel: "Новый пароль",
    newPasswordPlaceholder: "Минимум 8 символов",
    confirmPasswordLabel: "Подтвердите пароль",
    confirmPasswordPlaceholder: "Повторите пароль",
    show: "Показать",
    hide: "Скрыть",
    charsLeft: (n: number) => `Ещё ${n} симв.`,
    updatePassword: "Обновить пароль",
    passwordSaved: "Пароль успешно обновлён",
    errors: {
      nameEmpty: "Имя не может быть пустым",
      nameTooLong: "Имя должно быть не длиннее 60 символов",
      nameUnchanged: "Это уже ваше текущее имя",
      noPermission: "Нет прав на изменение этого профиля",
      passwordTooShort: "Пароль должен быть не короче 8 символов",
      passwordMismatch: "Пароли не совпадают",
      samePassword: "Новый пароль должен отличаться от текущего",
      reauth: "Войдите в аккаунт заново и повторите смену пароля",
      avatarNotImage: "Выберите файл изображения",
      avatarTooLarge: "Файл слишком большой (максимум 10 МБ)",
      avatarUnsupported: "Этот формат не поддерживается. Попробуйте JPG или PNG.",
      avatarUploadFailed: "Ошибка загрузки. Попробуйте ещё раз.",
      syncFailed: "Сохранено, но сессия не обновилась. Перезайдите, чтобы изменения появились везде.",
      network: "Ошибка соединения. Проверьте интернет и попробуйте снова.",
      generic: "Что-то пошло не так. Попробуйте ещё раз.",
    },
  },
  ES: {
    titleMain: "Ajustes del",
    titleAccent: "perfil",
    memberSince: "Miembro desde",
    roles: { owner: "Propietario", admin: "Administrador", manager: "Gestor", resident: "Residente" },
    changePhoto: "Cambiar foto",
    uploadPhoto: "Subir foto",
    avatarUploading: "Subiendo…",
    avatarSaved: "Foto actualizada",
    avatarHint: "JPG, PNG o WebP, hasta 10 MB",
    profileSection: "Perfil",
    profileHint: "Cómo aparece tu nombre en el club",
    nameLabel: "Nombre",
    namePlaceholder: "Tu nombre",
    saveName: "Guardar nombre",
    saving: "Guardando…",
    nameSaved: "Nombre actualizado",
    securitySection: "Seguridad",
    securityHint: "Cambia la contraseña con la que inicias sesión",
    newPasswordLabel: "Nueva contraseña",
    newPasswordPlaceholder: "Mínimo 8 caracteres",
    confirmPasswordLabel: "Confirma la contraseña",
    confirmPasswordPlaceholder: "Repite la contraseña",
    show: "Mostrar",
    hide: "Ocultar",
    charsLeft: (n: number) => `Faltan ${n} caracteres`,
    updatePassword: "Actualizar contraseña",
    passwordSaved: "Contraseña actualizada correctamente",
    errors: {
      nameEmpty: "El nombre no puede estar vacío",
      nameTooLong: "El nombre debe tener 60 caracteres como máximo",
      nameUnchanged: "Este ya es tu nombre actual",
      noPermission: "No tienes permiso para cambiar este perfil",
      passwordTooShort: "La contraseña debe tener al menos 8 caracteres",
      passwordMismatch: "Las contraseñas no coinciden",
      samePassword: "La nueva contraseña debe ser distinta de la actual",
      reauth: "Vuelve a iniciar sesión y cambia la contraseña de nuevo",
      avatarNotImage: "Elige un archivo de imagen",
      avatarTooLarge: "La imagen es demasiado grande (máx. 10 MB)",
      avatarUnsupported: "Este formato no es compatible. Prueba con JPG o PNG.",
      avatarUploadFailed: "Error al subir la foto. Inténtalo de nuevo.",
      syncFailed: "Guardado, pero la sesión no se actualizó. Cierra sesión y vuelve a entrar para ver el cambio.",
      network: "Error de conexión. Revisa tu internet e inténtalo de nuevo.",
      generic: "Algo salió mal. Inténtalo de nuevo.",
    },
  },
  PT: {
    titleMain: "Configurações do",
    titleAccent: "perfil",
    memberSince: "Membro desde",
    roles: { owner: "Proprietário", admin: "Administrador", manager: "Gerente", resident: "Residente" },
    changePhoto: "Alterar foto",
    uploadPhoto: "Enviar foto",
    avatarUploading: "Enviando…",
    avatarSaved: "Foto atualizada",
    avatarHint: "JPG, PNG ou WebP, até 10 MB",
    profileSection: "Perfil",
    profileHint: "Como seu nome aparece no clube",
    nameLabel: "Nome",
    namePlaceholder: "Seu nome",
    saveName: "Salvar nome",
    saving: "Salvando…",
    nameSaved: "Nome atualizado",
    securitySection: "Segurança",
    securityHint: "Altere a senha que você usa para entrar",
    newPasswordLabel: "Nova senha",
    newPasswordPlaceholder: "Mínimo de 8 caracteres",
    confirmPasswordLabel: "Confirme a senha",
    confirmPasswordPlaceholder: "Repita a senha",
    show: "Mostrar",
    hide: "Ocultar",
    charsLeft: (n: number) => `Faltam ${n} caracteres`,
    updatePassword: "Atualizar senha",
    passwordSaved: "Senha atualizada com sucesso",
    errors: {
      nameEmpty: "O nome não pode ficar vazio",
      nameTooLong: "O nome deve ter no máximo 60 caracteres",
      nameUnchanged: "Este já é o seu nome atual",
      noPermission: "Você não tem permissão para alterar este perfil",
      passwordTooShort: "A senha deve ter pelo menos 8 caracteres",
      passwordMismatch: "As senhas não coinciden",
      samePassword: "A nova senha deve ser diferente da atual",
      reauth: "Entre novamente na conta e altere a senha outra vez",
      avatarNotImage: "Escolha um arquivo de imagem",
      avatarTooLarge: "A imagem é grande demais (máx. 10 MB)",
      avatarUnsupported: "Este formato não é suportado. Tente JPG ou PNG.",
      avatarUploadFailed: "Falha no envio. Tente novamente.",
      syncFailed: "Salvo, mas a sessão não foi atualizada. Saia e entre novamente para ver a alteração.",
      network: "Erro de conexão. Verifique sua internet e tente novamente.",
      generic: "Algo deu errado. Tente novamente.",
    },
  },
} as const;

type LangKey = keyof typeof translations;
type Dict = (typeof translations)[LangKey];
type ErrorKey = keyof Dict["errors"];

const DATE_LOCALES: Record<LangKey, string> = {
  EN: "en-US",
  RU: "ru-RU",
  ES: "es-ES",
  PT: "pt-BR",
};

const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 60;

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const AVATAR_SIZE = 512;
const AVATAR_QUALITY = 0.85;

type Profile = {
  id: string;
  email: string;
  name: string | null;
  role: Role | null;
  avatarUrl: string | null;
  createdAt: string | null;
};

type Status = { type: "success"; message: string } | { type: "error"; key: ErrorKey } | null;

function useT() {
  const { lang } = useLanguage();
  const key: LangKey = (lang as LangKey) in translations ? (lang as LangKey) : "EN";
  return { t: translations[key], langKey: key };
}

function mapPasswordError(message: string, status?: number): ErrorKey {
  const msg = message.toLowerCase();
  if (msg.includes("different from the old") || msg.includes("same_password")) return "samePassword";
  if (msg.includes("reauthenticat") || msg.includes("session") || status === 401) return "reauth";
  if (isNetworkError(msg)) return "network";
  return "generic";
}

function isNetworkError(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes("fetch") || msg.includes("network");
}

function getInitials(profile: Profile | null): string {
  if (!profile) return "";
  const source = profile.name?.trim() || profile.email.split("@")[0];
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// ---------------------------------------------------------------------------
// Синхронизация метаданных сессии
// ---------------------------------------------------------------------------

async function syncAuthMetadata(patch: { name?: string; avatarUrl?: string }) {
  const data: Record<string, string> = {};
  if (patch.name !== undefined) {
    data.full_name = patch.name;
    data.name = patch.name;
  }
  if (patch.avatarUrl !== undefined) data.avatar_url = patch.avatarUrl;

  const { error } = await supabase.auth.updateUser({ data });
  if (error) console.error("Failed to sync user_metadata:", error);
  return error;
}

// ---------------------------------------------------------------------------
// Утилиты для аватара
// ---------------------------------------------------------------------------

async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    const out = Math.min(AVATAR_SIZE, side);

    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, out, out);
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        AVATAR_QUALITY,
      ),
    );
  } finally {
    bitmap.close();
  }
}

function getStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length).split("?")[0]);
}

// ---------------------------------------------------------------------------
// Общие стили
// ---------------------------------------------------------------------------
const labelClass = "mb-2 block text-[10px] uppercase tracking-[0.2em] text-zinc-500";
const cardClass = "rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8";
const buttonClass =
  "w-full rounded-lg bg-amber-200 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8";

function inputClass(state: "idle" | "error" | "success") {
  const base =
    "w-full rounded-lg border bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:ring-1 disabled:opacity-60";
  if (state === "error") return `${base} border-red-500/60 focus:border-red-500 focus:ring-red-500/30`;
  if (state === "success")
    return `${base} border-emerald-500/60 focus:border-emerald-500 focus:ring-emerald-500/30`;
  return `${base} border-zinc-800 focus:border-amber-200/60 focus:ring-amber-200/30`;
}

function Spinner({ className = "h-4 w-4 border-zinc-950/30 border-t-zinc-950" }: { className?: string }) {
  return <span className={`animate-spin rounded-full border-2 ${className}`} />;
}

function StatusBanner({ status, t }: { status: Status; t: Dict }) {
  if (!status) return null;
  const ok = status.type === "success";
  return (
    <div
      role="status"
      className={
        ok
          ? "flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
          : "flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
      }
    >
      <span aria-hidden>{ok ? "✓" : "!"}</span>
      {ok ? status.message : t.errors[status.key]}
    </div>
  );
}

export function AccountSettingsHeader({ eyebrow }: { eyebrow?: string }) {
  const { t } = useT();
  return (
    <header className="mb-8">
      {eyebrow && <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{eyebrow}</p>}
      <h1 className="mt-1 text-3xl font-light text-zinc-100">
        {t.titleMain} <span className="text-amber-200">{t.titleAccent}</span>
      </h1>
    </header>
  );
}

function ProfileCard({
  profile,
  isLoading,
  onAvatarSaved,
}: {
  profile: Profile | null;
  isLoading: boolean;
  onAvatarSaved: (url: string) => void;
}) {
  const { t, langKey } = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [profile?.avatarUrl]);

  const showImage = Boolean(profile?.avatarUrl) && !imgFailed;
  const canUpload = Boolean(profile) && !isLoading && !isUploading;

  function openPicker() {
    if (canUpload) fileInputRef.current?.click();
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile || isUploading) return;

    setStatus(null);
    if (!file.type.startsWith("image/")) return setStatus({ type: "error", key: "avatarNotImage" });
    if (file.size > MAX_AVATAR_BYTES) return setStatus({ type: "error", key: "avatarTooLarge" });

    setIsUploading(true);
    try {
      let blob: Blob;
      try {
        blob = await toSquareJpeg(file);
      } catch {
        setStatus({ type: "error", key: "avatarUnsupported" });
        return;
      }

      const path = `users/${profile.id}/${crypto.randomUUID()}.jpg`;
      const bucket = supabase.storage.from(AVATAR_BUCKET);

      const { error: uploadError } = await bucket.upload(path, blob, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) {
        setStatus({
          type: "error",
          key: isNetworkError(uploadError.message) ? "network" : "avatarUploadFailed",
        });
        return;
      }

      const {
        data: { publicUrl },
      } = bucket.getPublicUrl(path);

      const { data, error: tableError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id)
        .select("avatar_url");

      if (tableError || !data || data.length === 0) {
        await bucket.remove([path]);
        if (tableError) {
          setStatus({
            type: "error",
            key: isNetworkError(tableError.message) ? "network" : "avatarUploadFailed",
          });
        } else {
          setStatus({ type: "error", key: "noPermission" });
        }
        return;
      }

      const authError = await syncAuthMetadata({ avatarUrl: publicUrl });
      const previousUrl = profile.avatarUrl;
      onAvatarSaved(publicUrl);

      const oldPath = previousUrl ? getStoragePath(previousUrl) : null;
      if (oldPath && oldPath !== path && oldPath.startsWith(`users/${profile.id}/`)) {
        bucket.remove([oldPath]).catch(() => {});
      }

      setStatus(authError ? { type: "error", key: "syncFailed" } : { type: "success", message: t.avatarSaved });
    } catch {
      setStatus({ type: "error", key: "network" });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900/80 to-zinc-950 p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-200/10 blur-3xl" />

      <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <button
            type="button"
            onClick={openPicker}
            disabled={!canUpload}
            aria-label={profile?.avatarUrl ? t.changePhoto : t.uploadPhoto}
            aria-busy={isUploading}
            className="group relative h-20 w-20 overflow-hidden rounded-full border border-amber-200/40 bg-zinc-950 ring-4 ring-amber-200/5 transition focus:outline-none focus-visible:ring-amber-200/40 enabled:cursor-pointer enabled:hover:border-amber-200/80 disabled:cursor-default"
          >
            {isLoading ? (
              <span className="absolute inset-0 m-auto h-6 w-6 animate-pulse rounded-full bg-zinc-800" />
            ) : showImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile!.avatarUrl!}
                alt={profile?.name || profile?.email || ""}
                className="h-full w-full rounded-full object-cover"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-light tracking-wide text-amber-200">
                {getInitials(profile) || "—"}
              </span>
            )}

            {canUpload && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-zinc-950/70 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 text-amber-200" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
              </span>
            )}

            {isUploading && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-zinc-950/75">
                <Spinner className="h-6 w-6 border-amber-200/30 border-t-amber-200" />
              </span>
            )}
          </button>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          {!isLoading && profile && (
            <button
              type="button"
              onClick={openPicker}
              disabled={!canUpload}
              className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 transition hover:text-amber-200 disabled:cursor-default disabled:hover:text-zinc-500"
            >
              {isUploading ? t.avatarUploading : profile.avatarUrl ? t.changePhoto : t.uploadPhoto}
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="space-y-2">
              <div className="mx-auto h-5 w-40 animate-pulse rounded bg-zinc-800 sm:mx-0" />
              <div className="mx-auto h-4 w-56 animate-pulse rounded bg-zinc-800/70 sm:mx-0" />
            </div>
          ) : (
            <>
              <h2 className="truncate text-xl font-medium text-zinc-100">
                {profile?.name || profile?.email.split("@")[0]}
              </h2>
              <p className="truncate text-sm text-zinc-500">{profile?.email}</p>
              {profile?.createdAt && (
                <p className="mt-1 text-xs text-zinc-600">
                  {t.memberSince}{" "}
                  {new Date(profile.createdAt).toLocaleDateString(DATE_LOCALES[langKey], {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              {profile && <p className="mt-1 text-xs text-zinc-700">{t.avatarHint}</p>}
            </>
          )}
        </div>

        {!isLoading && profile?.role && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/40 bg-amber-200/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-200" />
            {t.roles[profile.role] ?? profile.role}
          </span>
        )}
      </div>

      {status && (
        <div className="relative mt-5">
          <StatusBanner status={status} t={t} />
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Форма изменения имени (с подробным логированием tableError)
// ---------------------------------------------------------------------------
function NameForm({
  profile,
  onSaved,
}: {
  profile: Profile | null;
  onSaved: (name: string) => void;
}) {
  const { t } = useT();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    if (profile) setName(profile.name ?? "");
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = name.trim();
  const unchanged = trimmed === (profile?.name ?? "").trim();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLoading || !profile) return;
    setStatus(null);

    if (!trimmed) return setStatus({ type: "error", key: "nameEmpty" });
    if (trimmed.length > MAX_NAME_LENGTH) return setStatus({ type: "error", key: "nameTooLong" });
    if (unchanged) return setStatus({ type: "error", key: "nameUnchanged" });

    setIsLoading(true);
    try {
      // id берём из актуальной сессии — гарантированно совпадает с auth.uid() в RLS
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setStatus({ type: "error", key: "reauth" });
        return;
      }

      const { data, error: tableError } = await supabase
        .from("profiles")
        .update({ full_name: trimmed })
        .eq("id", user.id)
        .select("full_name");

      if (tableError) {
        console.error("profiles.update failed:", {
          code: tableError.code,
          message: tableError.message,
          details: tableError.details,
          hint: tableError.hint,
        });
        const key: ErrorKey =
          tableError.code === "42501" ? "noPermission"
          : isNetworkError(tableError.message) ? "network"
          : "generic";
        setStatus({ type: "error", key });
        return;
      }

      if (!data || data.length === 0) {
        setStatus({ type: "error", key: "noPermission" });
        return;
      }

      const authError = await syncAuthMetadata({ name: trimmed });

      setName(trimmed);
      onSaved(trimmed);

      setStatus(authError ? { type: "error", key: "syncFailed" } : { type: "success", message: t.nameSaved });
    } catch {
      setStatus({ type: "error", key: "network" });
    } finally {
      setIsLoading(false);
    }
  }

  const fieldState = status?.type === "error" ? "error" : status?.type === "success" ? "success" : "idle";

  return (
    <section className={cardClass}>
      <h3 className="text-sm uppercase tracking-[0.2em] text-amber-200">{t.profileSection}</h3>
      <p className="mt-1 text-sm text-zinc-500">{t.profileHint}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label htmlFor="profile-name" className={labelClass}>
            {t.nameLabel}
          </label>
          <input
            id="profile-name"
            type="text"
            autoComplete="name"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setStatus(null);
            }}
            placeholder={t.namePlaceholder}
            disabled={!profile || isLoading}
            className={inputClass(fieldState)}
          />
        </div>

        <StatusBanner status={status} t={t} />

        <button type="submit" disabled={!profile || isLoading || !trimmed || unchanged} className={buttonClass}>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              {t.saving}
            </span>
          ) : (
            t.saveName
          )}
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Форма смены пароля
// ---------------------------------------------------------------------------
function PasswordForm() {
  const { t } = useT();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;

  function fieldState(hasError: boolean) {
    if (hasError || status?.type === "error") return "error" as const;
    if (status?.type === "success") return "success" as const;
    return "idle" as const;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLoading) return;
    setStatus(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) return setStatus({ type: "error", key: "passwordTooShort" });
    if (newPassword !== confirmPassword) return setStatus({ type: "error", key: "passwordMismatch" });

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setStatus({ type: "error", key: mapPasswordError(error.message, error.status) });
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      setStatus({ type: "success", message: t.passwordSaved });
    } catch {
      setStatus({ type: "error", key: "network" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className={cardClass}>
      <h3 className="text-sm uppercase tracking-[0.2em] text-amber-200">{t.securitySection}</h3>
      <p className="mt-1 text-sm text-zinc-500">{t.securityHint}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label htmlFor="new-password" className={labelClass}>
            {t.newPasswordLabel}
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setStatus(null);
              }}
              placeholder={t.newPasswordPlaceholder}
              disabled={isLoading}
              className={`${inputClass(fieldState(tooShort))} pr-24`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.15em] text-zinc-500 transition hover:text-amber-200"
            >
              {showPassword ? t.hide : t.show}
            </button>
          </div>
          {tooShort && (
            <p className="mt-2 text-xs text-red-400">
              {t.charsLeft(MIN_PASSWORD_LENGTH - newPassword.length)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="confirm-password" className={labelClass}>
            {t.confirmPasswordLabel}
          </label>
          <input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setStatus(null);
            }}
            placeholder={t.confirmPasswordPlaceholder}
            disabled={isLoading}
            className={inputClass(fieldState(mismatch))}
          />
          {mismatch && <p className="mt-2 text-xs text-red-400">{t.errors.passwordMismatch}</p>}
        </div>

        <StatusBanner status={status} t={t} />

        <button
          type="submit"
          disabled={isLoading || !newPassword || !confirmPassword || mismatch || tooShort}
          className={buttonClass}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              {t.saving}
            </span>
          ) : (
            t.updatePassword
          )}
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Главный компонент
// ---------------------------------------------------------------------------
export default function AccountSettings() {
  const { updateProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) return;

        const { data: row, error } = await supabase
          .from("profiles")
          .select("full_name, role, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (error) console.error("Failed to load profile:", error.message);
        if (cancelled) return;

        const rawRole = row?.role ?? user.app_metadata?.role;
        setProfile({
          id: user.id,
          email: user.email ?? "",
          name: row?.full_name ?? null,
          role: isRole(rawRole) ? rawRole : null,
          avatarUrl: row?.avatar_url ?? null,
          createdAt: user.created_at ?? null,
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleNameSaved(name: string) {
    setProfile((p) => (p ? { ...p, name } : p));
    updateProfile({ fullName: name });
  }

  function handleAvatarSaved(avatarUrl: string) {
    setProfile((p) => (p ? { ...p, avatarUrl } : p));
    updateProfile({ avatarUrl });
  }

  return (
    <div className="space-y-6">
      <ProfileCard profile={profile} isLoading={isLoading} onAvatarSaved={handleAvatarSaved} />
      <NameForm profile={profile} onSaved={handleNameSaved} />
      <PasswordForm />
    </div>
  );
}