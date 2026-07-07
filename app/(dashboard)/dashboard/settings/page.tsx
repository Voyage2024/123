"use client";

import { Settings } from "lucide-react";
import ResidentPlaceholder from "@/app/components/ResidentPlaceholder";

export default function SettingsPage() {
  return (
    <ResidentPlaceholder
      icon={Settings}
      title="Настройки"
      subtitle="Управление профилем, приватностью и уведомлениями. Персональные настройки аккаунта появятся здесь в ближайшем обновлении."
      buttonText="Открыть настройки"
    />
  );
}
