"use client";

import { useParams } from "next/navigation";
import { OwnerOperatorCard } from "@/app/components/tour-ops/OwnerTourControl";

export default function OwnerOperatorPage() {
  const { id } = useParams<{ id: string }>();
  return <OwnerOperatorCard operatorId={String(id)} />;
}
