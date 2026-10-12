"use client";

import RoleGuard from "@/app/components/RoleGuard";
import AccountSettings, { AccountSettingsHeader } from "@/app/components/AccountSettings";

export default function ResidentSettingsPage() {
  return (
    <RoleGuard allowedRoles={["resident"]}>
      <main className="min-h-screen bg-zinc-950 px-4 pb-10 pt-2 sm:pb-16 sm:pt-2">
        <div className="mx-auto max-w-2xl">
          {/* У резидентов не передаем слово "Admin", заголовок будет обычным */}
          <AccountSettingsHeader />
          <AccountSettings />
        </div>
      </main>
    </RoleGuard>
  );
}