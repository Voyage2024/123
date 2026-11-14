"use client";

import { useParams } from "next/navigation";
import ResidentTourRoom from "@/app/components/tour-ops/ResidentTourRoom";

export default function TourRoomPage() {
  const { id } = useParams<{ id: string }>();
  return <ResidentTourRoom tourId={String(id)} />;
}
