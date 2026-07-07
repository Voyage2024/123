"use client";

import { Plane } from "lucide-react";
import ResidentPlaceholder from "@/app/components/ResidentPlaceholder";

export default function ToursPage() {
  return (
    <ResidentPlaceholder
      icon={Plane}
      title="Туры"
      subtitle="Скоро здесь появятся анонсы закрытых экспедиций в Юго-Восточную Азию и выездов в Дубай — с приватными маршрутами и местами по приглашению."
      buttonText="Изучить направления"
    />
  );
}
