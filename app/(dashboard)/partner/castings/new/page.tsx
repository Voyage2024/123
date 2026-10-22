
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Plus,
  ShieldAlert,
} from "lucide-react";

import {
  CastingBriefFields,
  EMPTY_BRIEF,
  briefErrors,
  createCasting,
  type BriefErrorKey,
  type BriefValues,
} from "@/app/(dashboard)/partner/_components/CastingBriefFields";
import OrganizerSelect from "@/app/components/organizer/OrganizerSelect";
import { useAuth } from "@/app/context/AuthContext";
import { ROUTES } from "@/app/(dashboard)/partner/_lib/routes";
import { VOYAGE_MANAGEMENT_ID } from "@/lib/organizer";

export default function NewCastingPage() {
  const router = useRouter();
  const { role } = useAuth();
  // owner/admin публикуют от имени клуба (по умолчанию) или выбранного партнёра.
  const canChooseOrganizer = role === "owner" || role === "admin";
  const [organizerId, setOrganizerId] = useState<string>(VOYAGE_MANAGEMENT_ID);

  const [values, setValues] = useState<BriefValues>(EMPTY_BRIEF);
  const [errors, setErrors] = useState<BriefErrorKey[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) return;

    setNotice(null);

    // 1. Проверяем форму до обращения к базе.
    const validationErrors = briefErrors(values);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setNotice({
        type: "error",
        message: "Проверьте поля формы: есть ошибки или не заполнены обязательные данные.",
      });
      return;
    }

    setErrors([]);
    setIsSubmitting(true);

    try {
      // 2. Создаём кастинг через готовую функцию компонента.
      const result = await createCasting(values, canChooseOrganizer ? organizerId : null);

      if (!result.ok) {
        const messages: Record<typeof result.reason, string> = {
          invalid: "Данные кастинга не прошли проверку. Проверьте поля формы.",
          forbidden:
            "Недостаточно прав для создания кастинга. Обратитесь к администратору.",
          network:
            "Не удалось создать кастинг. Проверьте соединение и попробуйте ещё раз.",
        };

        if (result.reason === "invalid") {
          setErrors(briefErrors(values));
        }

        setNotice({
          type: "error",
          message: messages[result.reason],
        });

        return;
      }

      // 3. Кастинг создан — открываем его доску: там создаётся тур и идут отклики.
      setNotice({
        type: "success",
        message: "Кастинг опубликован. Открываем доску откликов...",
      });

      router.push(ROUTES.casting(result.id));
      router.refresh();
    } catch (error) {
      console.error("[NewCastingPage] Failed to create casting:", error);

      setNotice({
        type: "error",
        message:
          "Произошла непредвиденная ошибка при создании кастинга. Попробуйте ещё раз.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-full bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Навигация */}
        <button
          type="button"
          onClick={() => router.push("/partner/castings")}
          disabled={isSubmitting}
          className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к кастингам
        </button>

        {/* Заголовок */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-200/20 bg-amber-200/10 text-amber-200">
              <Plus className="h-4 w-4" />
            </span>

            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/80">
              Partner workspace
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Создание кастинга
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Заполните условия проекта, укажите сроки и гонорар.
            После публикации кастинг появится в ленте резидентов.
          </p>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} noValidate>
          <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-4 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-6 lg:p-8">
            <div className="mb-7 flex items-start justify-between gap-4 border-b border-zinc-800/70 pb-5">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Параметры проекта
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Условия, которые увидят резиденты перед откликом.
                </p>
              </div>

              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
            </div>

            {canChooseOrganizer && (
              <div className="mb-7 rounded-xl border border-amber-200/15 bg-amber-200/[0.03] p-4">
                <OrganizerSelect
                  id="casting-organizer"
                  value={organizerId}
                  onChange={setOrganizerId}
                  lang="ru"
                  disabled={isSubmitting}
                />
              </div>
            )}

            <CastingBriefFields
              value={values}
              onChange={(nextValues) => {
                setValues(nextValues);

                // Скрываем общее уведомление об ошибке при редактировании.
                if (notice?.type === "error") {
                  setNotice(null);
                }
              }}
              errors={errors}
            />

            {/* Уведомление о результате */}
            {notice && (
              <div
                role={notice.type === "error" ? "alert" : "status"}
                aria-live="polite"
                className={`mt-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${
                  notice.type === "error"
                    ? "border-rose-400/20 bg-rose-400/5 text-rose-200"
                    : "border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
                }`}
              >
                {notice.type === "error" ? (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                )}

                <p className="leading-5">{notice.message}</p>
              </div>
            )}

            {/* Действия */}
            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-zinc-800/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-sm text-xs leading-5 text-zinc-500">
                Перед созданием проверьте даты, гонорар и условия участия.
              </p>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.push("/partner/castings")}
                  disabled={isSubmitting}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-800 px-5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Отмена
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-200/40 bg-amber-200 px-5 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-950/10 transition hover:border-amber-100 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Создание...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Опубликовать кастинг
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}
