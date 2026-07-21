import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MembersManager } from "@/components/barn/MembersManager";
import { BarnSettingsForm } from "@/components/barn/BarnSettingsForm";
import Link from "next/link";

export default async function BarnSettingsPage({ params }: { params: Promise<{ barnId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId } = await params;
  const caller = await createServerCaller();
  const [barn, barns] = await Promise.all([caller.barn.get({ barnId }), caller.barn.list()]);
  const t = await getTranslations("settings");

  const role = barns.find((b: { id: string; role: string }) => b.id === barnId)?.role;
  const canManage = role === "BARN_MANAGER" || role === "GLOBAL_ADMIN";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("details")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {canManage ? (
            <BarnSettingsForm
              barnId={barnId}
              barn={{ name: barn.name, address: barn.address, timezone: barn.timezone }}
            />
          ) : (
            <>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24">{t("name")}</span>
                <span>{barn.name}</span>
              </div>
              {barn.address && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24">{t("address")}</span>
                  <span>{barn.address}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24">{t("timezone")}</span>
                <span>{barn.timezone}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("teamMembers")}</CardTitle>
          <Button size="sm" asChild>
            <Link href={`/barns/${barnId}/settings/invite`}>{t("inviteMember")}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <MembersManager barnId={barnId} currentUserId={session.user.id} />
        </CardContent>
      </Card>
    </div>
  );
}
