"use client";

/* VOYAGE · Partner — правка кастинга
 * Те же поля, что при создании, плюс статус. owner/admin могут сменить
 * организатора (VOYAGE Management ↔ партнёр), пока по кастингу нет тура.
 * Права проверяет RLS partner_castings и триггер partner_castings_check_organizer.
 */

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, LoaderCircle, Save, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  CastingBriefFields,
  EMPTY_BRIEF,
  editErrors,
  rowToBrief,
  updateCasting,
  type BriefErrorKey,
  type BriefValues,
  type CastingStatus,
} from "@/app/(dashboard)/partner/_components/CastingBriefFields";
import OrganizerSelect from "@/app/components/organizer/OrganizerSelect";
import { ROUTES } from "@/app/(dashboard)/partner/_lib/routes";
import { useAuth } from "@/app/context/AuthContext";

const STATUS_OPTIONS: { value: CastingStatus; label: string }[] = [
  { value: "open", label: "Открыт — принимает отклики" },
  { value: "shortlist", label: "Шорт-лист — отбор идёт" },
  { value: "closed", label: "Закрыт — набор завершён" },
  { value: "cancelled", label: "Отменён" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function EditCastingPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const router = useRouter();
  const { role } = useAuth();
  const canChooseOrganizer = role === "owner" || role === "admin";

  const [values, setValues] = useState<BriefValues>(EMPTY_BRIEF);
  const [status, setStatus] = useState<CastingStatus>("open");
  const [organizerId, setOrganizerId] = useState("");
  const [initialOrganizer, setInitialOrganizer] = useState("");
  const [hasTour, setHasTour] = useState(false);
  const [errors, setErrors] = useState<BriefErrorKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; message: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!UUID_RE.test(id)) {
        setNotice({ type: "error", message: "Некорректный идентификатор кастинга." });
        setLoading(false);
        return;
      }
      const [{ data, error }, { count }] = await Promise.all([
        supabase.from("partner_castings").select("*").eq("id", id).maybeSingle(),
        supabase.from("partner_tours").select("id", { count: "exact", head: true }).eq("casting_id", id),
      ]);
      if (!alive) return;
      if (error || !data) {
        setNotice({ type: "error", message: "Кастинг не найден или недоступен текущей роли." });
        setLoading(false);
        return;
      }
      const row = data as Record<string, unknown>;
      setValues(rowToBrief(row));
      const current = STATUS_OPTIONS.find((option) => option.value === row.status)?.value ?? "open";
      setStatus(current);
      setOrganizerId(String(row.manager_id ?? ""));
      setInitialOrganizer(String(row.manager_id ?? ""));
      setHasTour((count ?? 0) > 0);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const validation = editErrors(values, status);
    if (validation.length) {
      setErrors(validation);
      setNotice({ type: "error", message: "Проверьте поля формы: есть ошибки или не заполнены обязательные данные." });
      return;
    }
    setErrors([]);
    setSaving(true);
    setNotice(null);
    const organizerChanged = canChooseOrganizer && organizerId && organizerId !== initialOrganizer;
    const result = await updateCasting(id, values, { status, organizerId: organizerChanged ? organizerId : null });
    setSaving(false);
    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        invalid: "Данные кастинга не прошли проверку.",
        forbidden: "Недостаточно прав для правки этого кастинга.",
        has_tour: "По кастингу уже создан тур — организатора сменить нельзя.",
        network: "Не удалось сохранить изменения. Попробуйте ещё раз.",
      };
      setNotice({ type: "error", message: messages[result.reason] });
      return;
    }
    setNotice({ type: "success", message: "Изменения сохранены." });
    router.push(ROUTES.casting(id));
    router.refresh();
  };

  return (
    <main className="min-h-full px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href={UUID_RE.test(id) ? ROUTES.casting(id) : ROUTES.castings} className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-amber-200">
          <ArrowLeft className="h-4 w-4" />
          Назад к кастингу
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Правка кастинга</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Резидентки увидят обновлённые условия сразу. Уже отправленные отклики сохраняются.
        </p>

        {loading ? (
          <div className="mt-8 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 text-sm text-zinc-500">Загружаем кастинг…</div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-8">
            <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-6 lg:p-8">
              <div className="mb-7 grid gap-5 border-b border-zinc-800/70 pb-6 md:grid-cols-2">
                <div>
                  <label htmlFor="casting-status" className="mb-1.5 block text-xs font-medium text-zinc-300">Статус кастинга</label>
                  <select
                    id="casting-status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as CastingStatus)}
                    disabled={saving}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-200/40"
                  >
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                {canChooseOrganizer && (
                  <div>
                    <OrganizerSelect id="casting-organizer" value={organizerId} onChange={setOrganizerId} lang="ru" disabled={saving || hasTour} />
                    {hasTour && <p className="mt-1 text-[11px] text-zinc-500">По кастингу уже создан тур — организатор закреплён.</p>}
                  </div>
                )}
              </div>

              <CastingBriefFields
                value={values}
                onChange={(next) => {
                  setValues(next);
                  if (notice?.type === "error") setNotice(null);
                }}
                errors={errors}
              />

              {notice && (
                <div
                  role={notice.type === "error" ? "alert" : "status"}
                  className={`mt-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${
                    notice.type === "error" ? "border-rose-400/20 bg-rose-400/5 text-rose-200" : "border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
                  }`}
                >
                  {notice.type === "error" ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                  <p className="leading-5">{notice.message}</p>
                </div>
              )}

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-zinc-800/70 pt-6 sm:flex-row sm:justify-end">
                <Link href={ROUTES.casting(id)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-800 px-5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white">
                  Отмена
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-200/40 bg-amber-200 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-100 disabled:opacity-60"
                >
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Сохраняем..." : "Сохранить изменения"}
                </button>
              </div>
            </section>
          </form>
        )}
      </div>
    </main>
  );
}
