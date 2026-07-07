"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Field = "full_name" | "location" | "citizenship";

interface ProfileFormProps {
  userId: string;
  initialData: Record<Field, string | null>;
}

const FIELDS: { key: Field; label: string; placeholder: string }[] = [
  { key: "full_name", label: "Full Name", placeholder: "Jean Duval" },
  { key: "location", label: "Current Location", placeholder: "Monaco" },
  { key: "citizenship", label: "Citizenship", placeholder: "France" },
];

export function ProfileForm({ userId, initialData }: ProfileFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [values, setValues] = useState<Record<Field, string>>({
    full_name: initialData.full_name ?? "",
    location: initialData.location ?? "",
    citizenship: initialData.citizenship ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const handleChange = (key: Field, val: string) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: values.full_name,
        location: values.location,
        citizenship: values.citizenship,
      })
      .eq("id", userId);

    setIsSaving(false);

    if (error) {
      setFeedback({ ok: false, text: "Не удалось сохранить. Попробуйте ещё раз." });
      return;
    }

    setFeedback({ ok: true, text: "Изменения сохранены." });
    // Обновляем серверные данные, чтобы имя на VIP-карте тоже подтянулось
    router.refresh();
  };

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 backdrop-blur-xl">
      <h2 className="font-cormorant text-2xl text-white">Личные данные</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Эти сведения видны только вам и службе консьержа.
      </p>

      <div className="mt-6 space-y-5">
        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-2">
            <label
              htmlFor={key}
              className="block text-xs uppercase tracking-[0.2em] text-zinc-500"
            >
              {label}
            </label>
            <input
              id={key}
              type="text"
              value={values[key]}
              placeholder={placeholder}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3 text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-6 py-3 text-sm font-medium text-zinc-950 transition hover:from-amber-300 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>

        {feedback && (
          <span
            className={`text-sm ${feedback.ok ? "text-amber-400" : "text-red-400"}`}
          >
            {feedback.text}
          </span>
        )}
      </div>
    </section>
  );
}
