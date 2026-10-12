"use client";

import RoleGuard from "@/app/components/RoleGuard";
import AccountSettings, { AccountSettingsHeader } from "@/app/components/AccountSettings";
import AdminTelegramNotificationSettings from "@/app/components/admin/AdminTelegramNotificationSettings";

export default function AdminSettingsPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "manager"]}>
      <main className="min-h-screen bg-zinc-950 px-4 pt-2 pb-10 sm:pt-2 sm:pb-16">
        <div className="mx-auto max-w-2xl">
          <AccountSettingsHeader eyebrow="Admin" />
          <AccountSettings />
          <AdminTelegramNotificationSettings />
        </div>
      </main>
    </RoleGuard>
  );
}