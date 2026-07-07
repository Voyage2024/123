"use client";

import { Settings } from "lucide-react";
import AdminPlaceholder from "@/app/components/AdminPlaceholder";

export default function SettingsPage() {
  return (
    <AdminPlaceholder
      eyebrow="Настройки"
      title="Settings"
      subtitle="Параметры клуба, ролей и интеграций"
      icon={Settings}
      emptyTitle="Раздел в разработке"
      emptyText="Скоро здесь появятся настройки клуба, управление ролями администраторов и подключение интеграций."
      actionLabel="Изменить настройки"
    />
  );
}
