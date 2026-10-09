"use client";

import { useEffect, useState } from "react";

type AvatarUser =
  | { name?: string | null; email?: string | null; avatarUrl?: string | null }
  | null
  | undefined;

/** Инициалы: до двух букв из имени, иначе из части email до @ */
export function getInitials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "";
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/**
 * Круглый аватар пользователя.
 * Есть avatarUrl → фото; нет ссылки или фото не загрузилось → инициалы.
 * Размер задаётся через className (например, "h-7 w-7"), размер букв — через textClassName.
 */
export default function UserAvatar({
  user,
  className = "h-8 w-8",
  textClassName = "text-xs",
}: {
  user: AvatarUser;
  className?: string;
  textClassName?: string;
}) {
  const url = user?.avatarUrl ?? null;
  const [failed, setFailed] = useState(false);

  // Новая ссылка (например, после загрузки фото) — пробуем показать её заново
  useEffect(() => {
    setFailed(false);
  }, [url]);

  const showImage = Boolean(url) && !failed;
  const initials = getInitials(user?.name, user?.email);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-200/30 bg-zinc-900 ${className}`}
    >
      {showImage ? (
        // Обычный img: не требует remotePatterns в next.config.
        // alt пустой — рядом всегда выводится имя, иначе скринридер прочтёт его дважды
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url!}
          alt=""
          className="h-full w-full rounded-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden className={`font-medium tracking-wide text-amber-200 ${textClassName}`}>
          {initials || "•"}
        </span>
      )}
    </span>
  );
}
