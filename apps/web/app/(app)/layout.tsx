import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { TRPCProvider } from "@/lib/trpc/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const caller = await createServerCaller();
  const barns = await caller.barn.list();

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
            barns={barns}
            currentBarnId={barns[0]?.id}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </TRPCProvider>
  );
}
