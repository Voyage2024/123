import { redirect } from "next/navigation";

const BOT_USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/;
const INVITE_CODE_RE = /^VYG-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

type JoinPageProps = {
  searchParams: Promise<{ key?: string | string[] }>;
};

/**
 * Registration is Telegram-only. Keep this compatibility route so old invite
 * links (`/join?key=VYG-...`) continue working by forwarding into the bot.
 */
export default async function JoinPage({ searchParams }: JoinPageProps) {
  const params = await searchParams;
  const rawKey = Array.isArray(params.key) ? params.key[0] : params.key;
  const code = typeof rawKey === "string" ? rawKey.trim().toUpperCase() : "";
  const username = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");

  if (!BOT_USERNAME_RE.test(username)) redirect("/");

  const startPayload = INVITE_CODE_RE.test(code) ? `ref_${code}` : "apply";
  redirect(`https://t.me/${username}?start=${encodeURIComponent(startPayload)}`);
}
