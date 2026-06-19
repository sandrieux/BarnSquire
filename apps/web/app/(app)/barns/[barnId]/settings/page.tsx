import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MembersManager } from "@/components/barn/MembersManager";
import Link from "next/link";

export default async function BarnSettingsPage({ params }: { params: Promise<{ barnId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId } = await params;
  const caller = await createServerCaller();
  const barn = await caller.barn.get({ barnId });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Barn settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-24">Name</span>
            <span>{barn.name}</span>
          </div>
          {barn.address && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-24">Address</span>
              <span>{barn.address}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-muted-foreground w-24">Timezone</span>
            <span>{barn.timezone}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Team members</CardTitle>
          <Button size="sm" asChild>
            <Link href={`/barns/${barnId}/settings/invite`}>Invite member</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <MembersManager barnId={barnId} currentUserId={session.user.id} />
        </CardContent>
      </Card>
    </div>
  );
}
