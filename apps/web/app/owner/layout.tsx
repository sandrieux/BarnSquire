import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { TRPCProvider } from "@/lib/trpc/client";
import { UserMenu } from "@/components/layout/UserMenu";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user?.mustChangePassword) redirect("/change-password");

  return (
    <TRPCProvider>
      <div className="flex min-h-screen flex-col">
        <header className="h-14 border-b bg-card flex items-center px-4 gap-4 sticky top-0 z-10">
          <Link href="/owner" className="text-xl font-bold text-primary flex-1">
            BarnSquire
          </Link>
          <UserMenu userName={session.user?.name} userEmail={session.user?.email} />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </TRPCProvider>
  );
}
