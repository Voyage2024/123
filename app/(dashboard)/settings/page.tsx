"use client";

import RoleGuard from "@/app/components/RoleGuard";
import AccountSettings, { AccountSettingsHeader } from "@/app/components/AccountSettings";

export default function ResidentSettingsPage() {
  return (
    <RoleGuard allowedRoles={["resident"]}>
      <main className="min-h-screen bg-zinc-950 px-4 py-10 sm:py-16">
        <div className="mx-auto max-w-2xl">
          {/* У резидентов не передаем слово "Admin", будет просто "Настройки профиля" */}
          <AccountSettingsHeader />
          <AccountSettings />
        </div>
      </main>
    </RoleGuard>
  );
}