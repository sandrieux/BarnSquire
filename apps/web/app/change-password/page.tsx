import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TRPCProvider } from "@/lib/trpc/client";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-primary">Set a new password</h1>
          <p className="text-muted-foreground text-sm">
            Choose a new password to finish setting up your account.
          </p>
        </div>
        <TRPCProvider>
          <ChangePasswordForm />
        </TRPCProvider>
      </div>
    </div>
  );
}
