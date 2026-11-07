"use client";

/* Вкладки раздела «Локации карты»: локации | лист ожидания локации */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe2, ListChecks } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";

type Lang = "EN" | "RU" | "ES" | "PT";

const COPY: Record<Lang, { locations: string; waiting: string }> = {
  RU: { locations: "Локации", waiting: "Лист ожидания локации" },
  EN: { locations: "Locations", waiting: "Location waiting list" },
  ES: { locations: "Ubicaciones", waiting: "Lista de espera" },
  PT: { locations: "Localizações", waiting: "Lista de espera" },
};

export default function MapLocationsTabs() {
  const { lang: raw } = useLanguage();
  const lang = (["EN", "RU", "ES", "PT"].includes(String(raw).toUpperCase()) ? String(raw).toUpperCase() : "EN") as Lang;
  const pathname = usePathname() ?? "";
  const tabs = [
    { href: "/admin/map-locations", label: COPY[lang].locations, icon: Globe2, active: !pathname.startsWith("/admin/map-locations/waiting-list") },
    { href: "/admin/map-locations/waiting-list", label: COPY[lang].waiting, icon: ListChecks, active: pathname.startsWith("/admin/map-locations/waiting-list") },
  ];
  return (
    <nav aria-label="Map locations" className="mb-6 flex flex-wrap gap-2">
      {tabs.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
            active
              ? "border-amber-200/30 bg-amber-200/10 text-amber-200"
              : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
