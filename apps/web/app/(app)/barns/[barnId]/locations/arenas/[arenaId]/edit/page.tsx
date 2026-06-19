import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { ArenaForm } from "@/components/locations/LocationForms";

export default async function EditArenaPage({
  params,
}: {
  params: Promise<{ barnId: string; arenaId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId, arenaId } = await params;
  const caller = await createServerCaller();
  const capacity = await caller.location.getCapacityStatus({ barnId });
  const arena = capacity.arenas.find((a) => a.id === arenaId);
  if (!arena) notFound();

  const buildings = capacity.buildings.map((b) => ({ id: b.id, name: b.name }));

  return (
    <ArenaForm
      barnId={barnId}
      buildings={buildings}
      editing={{
        id: arena.id,
        name: arena.name,
        buildingId: arena.buildingId,
        surface: arena.surface,
        notes: arena.notes,
      }}
    />
  );
}
