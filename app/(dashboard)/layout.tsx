import Header from "../components/Header"; // умный хедер с именем
import Sidebar from "../components/Sidebar"; // умное меню с разделением ролей

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware защищает сам маршрут; Sidebar сам решает, какое меню
  // показать (admin/resident) по email из сессии Supabase.
  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Sidebar (роль определяется внутри по email) */}
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 md:ml-72">
        {/* Умный хедер с именем */}
        <div className="sticky top-0 z-30 w-full border-b border-zinc-800/80 bg-zinc-950/80 px-6 py-4 backdrop-blur-lg">
          <Header />
        </div>

        <div className="mx-auto max-w-6xl px-6 py-10 md:px-12 md:py-14">
          {children}
        </div>
      </main>
    </div>
  );
}
