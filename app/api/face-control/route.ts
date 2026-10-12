import { NextRequest, NextResponse } from "next/server";
import { approveProfile } from "@/app/actions/approve-profile";
import { declineApplication } from "@/app/(dashboard)/admin/face-control/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Payload = { id?: unknown; action?: unknown };

/**
 * Backwards-compatible same-origin endpoint.
 * New UI calls Server Actions directly; this route delegates to the same
 * role-checked actions to avoid a second password/KYC/Telegram implementation.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 400 });
    }
  }

  const payload = (await request.json().catch(() => null)) as Payload | null;
  const id = typeof payload?.id === "string" ? payload.id : "";
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid profile ID." }, { status: 400 });
  }

  if (payload?.action === "approve") {
    const result = await approveProfile(id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(result.warning ? { warning: result.warning } : {}) });
  }

  if (payload?.action === "decline") {
    const result = await declineApplication(id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action must be approve or decline." }, { status: 400 });
}
