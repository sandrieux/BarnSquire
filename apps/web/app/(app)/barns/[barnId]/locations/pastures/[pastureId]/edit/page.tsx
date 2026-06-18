import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { PastureForm } from "@/components/locations/LocationForms";

export default async function EditPasturePage({
  params,
}: {
  params: Promise<{ barnId: string; pastureId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId, pastureId } = await params;
  const caller = await createServerCaller();
  const capacity = await caller.location.getCapacityStatus({ barnId });
  const pasture = capacity.pastures.find((p) => p.id === pastureId);
  if (!pasture) notFound();

  return (
    <PastureForm
      barnId={barnId}
      editing={{
        id: pasture.id,
        name: pasture.name,
        maxCapacity: pasture.maxCapacity,
        acreage: pasture.acreage,
        notes: pasture.notes,
      }}
    />
  );
}
