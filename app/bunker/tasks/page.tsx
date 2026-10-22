import type { Metadata } from "next";

import TasksClient from "@/app/bunker/tasks/TasksClient";

export const metadata: Metadata = { title: "Задачи" };

export default function Page() {
  return <TasksClient />;
}
