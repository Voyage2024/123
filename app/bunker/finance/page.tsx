import type { Metadata } from "next";

import FinanceClient from "@/app/bunker/finance/FinanceClient";

export const metadata: Metadata = { title: "Финансы" };

export default function Page() {
  return <FinanceClient />;
}
