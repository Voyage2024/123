import HubClient from "@/app/bunker/HubClient";
import { getBunkerViewer } from "@/lib/bunker/access";

export default async function BunkerHubPage() {
  // Доступ уже проверил layout; здесь берём только имя для приветствия.
  const viewer = await getBunkerViewer();
  return <HubClient name={viewer?.name ?? null} />;
}
