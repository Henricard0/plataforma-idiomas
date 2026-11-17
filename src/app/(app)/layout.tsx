import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { PageSkeleton } from "@/components/ui";
import { SidebarNav } from "./sidebar-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <Suspense fallback={<SidebarFallback />}>
        <Sidebar />
      </Suspense>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 md:py-10">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}

async function Sidebar() {
  const [viewer, cookieStore] = await Promise.all([getViewer(), cookies()]);
  if (!viewer) redirect("/entrar");
  // Preferência "menu recolhido" fica num cookie para o servidor já desenhar do jeito certo (sem piscar).
  const collapsed = cookieStore.get("sidebar")?.value === "collapsed";
  return <SidebarNav name={viewer.fullName} isTeacher={viewer.isTeacher} initialCollapsed={collapsed} />;
}

function SidebarFallback() {
  return <div className="hidden h-screen w-64 shrink-0 border-r border-line bg-surface md:block" />;
}
