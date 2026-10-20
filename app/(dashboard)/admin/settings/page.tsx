"use client";

import RoleGuard from "@/app/components/RoleGuard";
import AccountSettings, { AccountSettingsHeader } from "@/app/components/AccountSettings";
import AdminTelegramNotificationSettings from "@/app/components/admin/AdminTelegramNotificationSettings";
import NotificationPreferences from "@/app/components/NotificationPreferences";
import { useAuth } from "@/app/context/AuthContext";

export default function AdminSettingsPage() {
  const { role } = useAuth();
  return (
    <RoleGuard allowedRoles={["owner", "admin", "manager"]}>
      <main className="min-h-screen bg-zinc-950 px-4 pt-2 pb-10 sm:pt-2 sm:pb-16">
        <div className="mx-auto max-w-2xl">
          <AccountSettingsHeader eyebrow={role === "manager" ? "Partner" : "Admin"} />
          <AccountSettings />
          {/* Менеджер, админ, владелец: рабочие Telegram-оповещения кабинета */}
          <NotificationPreferences variant="manager" />
          <AdminTelegramNotificationSettings />
        </div>
      </main>
    </RoleGuard>
  );
}