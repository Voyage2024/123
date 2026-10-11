"use server";

import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";

type ActionResult = { error: string | null };

function errorResult(error: unknown): ActionResult {
  if (error instanceof AuthorizationError) return { error: error.message };
  console.error("[face-control action] failed:", error);
  return { error: "Не удалось выполнить действие." };
}

export async function approveApplication(id: string): Promise<ActionResult> {
  try {
    await requireRole(["owner", "admin"]);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return { error: "Некорректный ID анкеты." };
    }
    const supabase = await createClient();
    const { data, error, count } = await supabase
      .from("profiles")
      .update({ kyc_level: 1, status: "approved" }, { count: "exact" })
      .eq("id", id)
      .select("id");
    if (error) return { error: error.message };
    if (!data?.length || count === 0) return { error: "Заявка не найдена, уже обработана или нет прав." };
    return { error: null };
  } catch (error) {
    return errorResult(error);
  }
}

export async function declineApplication(id: string): Promise<ActionResult> {
  try {
    await requireRole(["owner", "admin"]);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return { error: "Некорректный ID анкеты." };
    }
    const supabase = await createClient();
    // Soft rejection preserves the audit trail; never delete the profile or set KYC to -1.
    const { data, error, count } = await supabase
      .from("profiles")
      .update({ status: "rejected" }, { count: "exact" })
      .eq("id", id)
      .neq("status", "approved")
      .select("id");
    if (error) return { error: error.message };
    if (!data?.length || count === 0) return { error: "Заявка не найдена, уже обработана или нет прав." };
    return { error: null };
  } catch (error) {
    return errorResult(error);
  }
}
