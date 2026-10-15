import ResidentProfileDashboard from "./ResidentProfileDashboard";

// This page is the resident's profile/cardholder home, never the casting feed.
// Disable static output and route caching for this authenticated dashboard.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ResidentDashboardPage() {
  return <ResidentProfileDashboard />;
}
