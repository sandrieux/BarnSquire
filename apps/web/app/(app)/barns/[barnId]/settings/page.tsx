import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const ROLE_LABELS: Record<string, string> = {
  GLOBAL_ADMIN: "Global Admin",
  BARN_MANAGER: "Barn Manager",
  CARETAKER: "Caretaker",
};

export default async function BarnSettingsPage({ params }: { params: Promise<{ barnId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId } = await params;
  const caller = await createServerCaller();
  const [barn, members] = await Promise.all([
    caller.barn.get({ barnId }),
    caller.barn.listMembers({ barnId }),
  ]);

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
          <ul className="space-y-3">
            {members.map((m: typeof members[number]) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{m.user.name ?? m.user.email}</p>
                  <p className="text-muted-foreground text-xs">{m.user.email}</p>
                </div>
                <Badge variant="secondary">{ROLE_LABELS[m.role] ?? m.role}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
