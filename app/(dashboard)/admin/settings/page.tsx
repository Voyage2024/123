"use client";

import RoleGuard from "@/app/components/RoleGuard";
import AccountSettings, { AccountSettingsHeader } from "@/app/components/AccountSettings";

export default function AdminSettingsPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "manager"]}>
      <main className="min-h-screen bg-zinc-950 px-4 py-10 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <AccountSettingsHeader eyebrow="Admin" />
          <AccountSettings />
        </div>
      </main>
    </RoleGuard>
  );
}