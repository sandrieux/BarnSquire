import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { TRPCProvider } from "@/lib/trpc/client";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const t = await getTranslations("auth");

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-primary">{t("setNewPasswordTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("setNewPasswordDesc")}
          </p>
        </div>
        <TRPCProvider>
          <ChangePasswordForm />
        </TRPCProvider>
      </div>
    </div>
  );
}
