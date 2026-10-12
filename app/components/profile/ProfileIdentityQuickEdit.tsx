"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Check, Loader2, Pencil, X } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { supabase } from "@/lib/supabase";

type Copy = {
  edit: string; title: string; name: string; photo: string; choosePhoto: string;
  save: string; cancel: string; required: string; unsupported: string;
  tooLarge: string; saveFailed: string; saved: string; settingsHint: string;
};

const T: Record<Lang, Copy> = {
  EN: {
    edit: "Edit name & photo", title: "Identity settings", name: "Full name",
    photo: "Profile photo", choosePhoto: "Choose photo", save: "Save changes", cancel: "Cancel",
    required: "Please enter your full name.", unsupported: "Use a JPG, PNG or WebP image.",
    tooLarge: "The image must be 5 MB or smaller.", saveFailed: "Changes could not be saved. Please try again.",
    saved: "Profile identity updated.", settingsHint: "You can change your name and photo here or in Settings.",
  },
  RU: {
    edit: "Изменить имя и фото", title: "Настройки данных", name: "Имя и фамилия",
    photo: "Фото профиля", choosePhoto: "Выбрать фото", save: "Сохранить изменения", cancel: "Отмена",
    required: "Укажите имя и фамилию.", unsupported: "Используйте JPG, PNG или WebP.",
    tooLarge: "Размер изображения не должен превышать 5 МБ.", saveFailed: "Не удалось сохранить изменения. Попробуйте ещё раз.",
    saved: "Данные профиля обновлены.", settingsHint: "Имя и фото можно изменить здесь или в настройках.",
  },
  ES: {
    edit: "Editar nombre y foto", title: "Datos de identidad", name: "Nombre completo",
    photo: "Foto de perfil", choosePhoto: "Elegir foto", save: "Guardar cambios", cancel: "Cancelar",
    required: "Escribe tu nombre completo.", unsupported: "Usa una imagen JPG, PNG o WebP.",
    tooLarge: "La imagen debe pesar 5 MB o menos.", saveFailed: "No se pudieron guardar los cambios. Inténtalo de nuevo.",
    saved: "Se actualizaron los datos del perfil.", settingsHint: "Puedes cambiar tu nombre y foto aquí o en Ajustes.",
  },
  PT: {
    edit: "Editar nome e foto", title: "Dados de identidade", name: "Nome completo",
    photo: "Foto do perfil", choosePhoto: "Escolher foto", save: "Salvar alterações", cancel: "Cancelar",
    required: "Informe seu nome completo.", unsupported: "Use uma imagem JPG, PNG ou WebP.",
    tooLarge: "A imagem deve ter no máximo 5 MB.", saveFailed: "Não foi possível salvar. Tente novamente.",
    saved: "Os dados do perfil foram atualizados.", settingsHint: "Você pode alterar seu nome e foto aqui ou em Configurações.",
  },
};

const MAX_BYTES = 5 * 1024 * 1024;
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

export default function ProfileIdentityQuickEdit({
  currentName,
  onSaved,
  showHint = true,
}: {
  currentName: string;
  onSaved?: (fullName: string, avatarPath: string | null) => void;
  showHint?: boolean;
}) {
  const { user, updateProfile, refreshRole } = useAuth();
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setFile(null);
    setError("");
    setSuccess(false);
  };

  const save = () => {
    if (!user) return;
    const normalizedName = name.trim().replace(/\s+/g, " ");
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setError(t.required);
      return;
    }
    if (file && !MIME_TO_EXT[file.type]) {
      setError(t.unsupported);
      return;
    }
    if (file && file.size > MAX_BYTES) {
      setError(t.tooLarge);
      return;
    }

    setError("");
    setSuccess(false);
    startTransition(async () => {
      let avatarPath: string | null = null;
      let signedAvatar: string | null = user.avatarUrl;
      try {
        if (file) {
          const extension = MIME_TO_EXT[file.type];
          avatarPath = `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from("user-uploads")
            .upload(avatarPath, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
          if (uploadError) throw uploadError;
          const { data: signed, error: signedError } = await supabase.storage
            .from("user-uploads")
            .createSignedUrl(avatarPath, 60 * 60);
          if (signedError || !signed?.signedUrl) throw signedError ?? new Error("signed_url_failed");
          signedAvatar = signed.signedUrl;
        }

        const patch: Record<string, unknown> = { full_name: normalizedName, name: normalizedName };
        if (avatarPath) patch.avatar_url = avatarPath;
        const { error: profileError } = await supabase.from("profiles").update(patch).eq("id", user.id);
        if (profileError) throw profileError;

        const { error: authError } = await supabase.auth.updateUser({
          data: { full_name: normalizedName, name: normalizedName },
        });
        if (authError) console.error("[profile-identity] auth metadata sync failed", authError.code);

        updateProfile({ fullName: normalizedName, avatarUrl: signedAvatar });
        await refreshRole();
        onSaved?.(normalizedName, avatarPath);
        setSuccess(true);
        setFile(null);
      } catch (caught) {
        // Log technical detail on the server console, but display only localized guidance.
        console.error("[profile-identity] save failed", caught instanceof Error ? caught.name : "unknown");
        setError(t.saveFailed);
      }
    });
  };

  return (
    <>
      <div className="mt-2 flex flex-col items-start gap-1">
        {showHint && <p className="max-w-[240px] text-[10px] leading-4 text-zinc-500">{t.settingsHint}</p>}
        <button
          type="button"
          onClick={() => { setName(currentName); setOpen(true); }}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/15 bg-amber-200/[0.04] px-3 py-1.5 text-[11px] text-amber-100/80 transition hover:border-amber-200/35 hover:bg-amber-200/[0.08]"
        >
          <Pencil size={12} /> {t.edit}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="profile-identity-title" className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-zinc-950/95 p-5 shadow-2xl shadow-black/50 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-amber-200/60">VOYAGE</p>
                <h2 id="profile-identity-title" className="mt-1 text-xl text-zinc-100">{t.title}</h2>
              </div>
              <button type="button" onClick={close} aria-label={t.cancel} className="rounded-full p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"><X size={16} /></button>
            </div>
            <label className="mb-2 block text-xs text-zinc-400" htmlFor="identity-full-name">{t.name}</label>
            <input id="identity-full-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="name" className="mb-5 w-full rounded-xl border border-zinc-700/50 bg-zinc-900/60 px-3.5 py-3 text-sm text-zinc-100 outline-none focus:border-amber-200/40" />
            <p className="mb-2 text-xs text-zinc-400">{t.photo}</p>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => inputRef.current?.click()} className="mb-5 flex w-full items-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/45 px-3.5 py-3 text-left text-sm text-zinc-300 transition hover:border-amber-200/25">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-amber-200/80"><Camera size={15} /></span>
              <span className="min-w-0 flex-1 truncate">{file?.name ?? t.choosePhoto}</span>
            </button>
            {error && <p role="alert" className="mb-3 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200/90">{error}</p>}
            {success && <p role="status" className="mb-3 flex items-center gap-2 text-xs text-emerald-200"><Check size={14} />{t.saved}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} disabled={busy} className="rounded-xl border border-zinc-700/60 px-4 py-2.5 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50">{t.cancel}</button>
              <button type="button" onClick={save} disabled={busy || !user} className="inline-flex items-center gap-2 rounded-xl border border-amber-200/30 bg-amber-200/[0.08] px-4 py-2.5 text-xs text-amber-100 transition hover:bg-amber-200/[0.13] disabled:opacity-50">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {t.save}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
