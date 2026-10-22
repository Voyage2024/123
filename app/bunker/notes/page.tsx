import type { Metadata } from "next";

import NotesClient from "@/app/bunker/notes/NotesClient";

export const metadata: Metadata = { title: "Заметки" };

export default function Page() {
  return <NotesClient />;
}
