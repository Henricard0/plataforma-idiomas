import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { PageSkeleton } from "@/components/ui";
import { SidebarNav } from "./sidebar-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <Suspense fallback={<SidebarFallback />}>
        <Sidebar />
      </Suspense>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-10">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}

async function Sidebar() {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  return <SidebarNav name={viewer.fullName} isTeacher={viewer.isTeacher} />;
}

function SidebarFallback() {
  return <div className="hidden w-64 shrink-0 border-r border-line bg-surface lg:block" />;
}
