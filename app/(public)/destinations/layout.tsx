import type { ReactNode } from "react";
import ManagerMapGate from "@/app/components/ManagerMapGate";

/** Региональные карты: менеджер видит заглушку со ссылкой в Штаб, остальные — карту */
export default function DestinationsLayout({ children }: { children: ReactNode }) {
  return <ManagerMapGate>{children}</ManagerMapGate>;
}
