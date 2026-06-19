import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { ArenaForm } from "@/components/locations/LocationForms";

export default async function NewArenaPage({ params }: { params: Promise<{ barnId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId } = await params;
  const caller = await createServerCaller();
  const capacity = await caller.location.getCapacityStatus({ barnId });
  const buildings = capacity.buildings.map((b) => ({ id: b.id, name: b.name }));

  return <ArenaForm barnId={barnId} buildings={buildings} />;
}
