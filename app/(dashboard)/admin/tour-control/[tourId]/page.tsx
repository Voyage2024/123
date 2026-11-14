"use client";

import { useParams } from "next/navigation";
import TourOpsBoard from "@/app/components/tour-ops/TourOpsBoard";

export default function OwnerTourBoardPage() {
  const { tourId } = useParams<{ tourId: string }>();
  return <TourOpsBoard tourId={String(tourId)} backHref="/admin/tour-control" ownerView />;
}
