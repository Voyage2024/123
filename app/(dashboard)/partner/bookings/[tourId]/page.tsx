"use client";

import { useParams } from "next/navigation";
import { ROUTES } from "@/app/(dashboard)/partner/_lib/routes";
import TourOpsBoard from "@/app/components/tour-ops/TourOpsBoard";

export default function PartnerTourBoardPage() {
  const { tourId } = useParams<{ tourId: string }>();
  return <TourOpsBoard tourId={String(tourId)} backHref={ROUTES.bookings} />;
}
