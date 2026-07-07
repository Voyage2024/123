"use client";

import { GlassWater } from "lucide-react";
import ResidentPlaceholder from "@/app/components/ResidentPlaceholder";

export default function PartiesPage() {
  return (
    <ResidentPlaceholder
      icon={GlassWater}
      title="Тусовки"
      subtitle="Здесь будут закрытые image-party и эксклюзивные локальные ивенты только для резидентов клуба. Афиша, гостевые списки и лимиты приглашений появятся совсем скоро."
      buttonText="Смотреть афишу"
    />
  );
}
