"use client";

import { ConciergeBell } from "lucide-react";
import ResidentPlaceholder from "@/app/components/ResidentPlaceholder";

export default function ConciergePage() {
  return (
    <ResidentPlaceholder
      icon={ConciergeBell}
      title="Консьерж"
      subtitle="Здесь можно будет запросить +1 гостя на мероприятие или забронировать VIP-стол. Персональный консьерж клуба скоро выйдет на связь."
      buttonText="Оставить запрос"
    />
  );
}
