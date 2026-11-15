"use client";

/* Скауты и бонусы — только owner (гард в ../layout.tsx, proxy.ts и в RPC). */

import OwnerScoutControl from "@/app/components/scouting/OwnerScoutControl";

export default function TourControlScoutsPage() {
  return <OwnerScoutControl />;
}
