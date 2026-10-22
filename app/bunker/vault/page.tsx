import type { Metadata } from "next";

import VaultClient from "@/app/bunker/vault/VaultClient";

export const metadata: Metadata = { title: "Сейф" };

export default function Page() {
  return <VaultClient />;
}
