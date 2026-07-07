"use client";

import { Map } from "lucide-react";
import AdminPlaceholder from "@/app/components/AdminPlaceholder";

export default function EventsPage() {
  return (
    <AdminPlaceholder
      eyebrow="Мероприятия"
      title="Туры и тусовки"
      subtitle="Расписание закрытых поездок и вечеринок клуба"
      icon={Map}
      emptyTitle="Расписание пока пустое"
      emptyText="Создайте первый тур или тусовку — они появятся здесь, в дашборде админа и у резидентов."
      actionLabel="Создать тусовку"
    />
  );
}
