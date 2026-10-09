import Sidebar from "../components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar />

      <main className="flex-1 md:ml-72">
        <div className="mx-auto max-w-6xl px-6 py-10 md:px-12 md:py-14">
          {children}
        </div>
      </main>
    </div>
  );
}