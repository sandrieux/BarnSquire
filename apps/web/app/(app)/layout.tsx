import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { TRPCProvider } from "@/lib/trpc/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";

// All authenticated pages depend on the session + live data; render per-request.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user?.mustChangePassword) redirect("/change-password");

  const caller = await createServerCaller();
  const barns = await caller.barn.list();

  // A user with no staff membership but owned animals is a read-only owner →
  // send them to their portal instead of the empty barn shell.
  if (barns.length === 0) {
    const owned = await caller.owner.listAnimals();
    if (owned.length > 0) redirect("/owner");
  }

  return (
    <TRPCProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          barnId={barns[0]?.id}
          isGlobalAdmin={barns.some((b: { role: string }) => b.role === "GLOBAL_ADMIN")}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopNav
            userName={session.user?.name}
            userEmail={session.user?.email}
            barns={barns}
            currentBarnId={barns[0]?.id}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </TRPCProvider>
  );
}
