import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { BuildingForm } from "@/components/locations/LocationForms";

export default async function EditBuildingPage({
  params,
}: {
  params: Promise<{ barnId: string; buildingId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId, buildingId } = await params;
  const caller = await createServerCaller();
  const capacity = await caller.location.getCapacityStatus({ barnId });
  const building = capacity.buildings.find((b) => b.id === buildingId);
  if (!building) notFound();

  return (
    <BuildingForm
      barnId={barnId}
      editing={{ id: building.id, name: building.name, notes: building.notes }}
    />
  );
}
