import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { StallForm } from "@/components/locations/LocationForms";

export default async function EditStallPage({
  params,
}: {
  params: Promise<{ barnId: string; stallId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId, stallId } = await params;
  const caller = await createServerCaller();
  const capacity = await caller.location.getCapacityStatus({ barnId });
  const stall = capacity.buildings.flatMap((b) => b.stalls).find((s) => s.id === stallId);
  if (!stall) notFound();

  return (
    <StallForm
      barnId={barnId}
      editing={{
        id: stall.id,
        name: stall.name,
        type: stall.type,
        maxCapacity: stall.maxCapacity,
        notes: stall.notes,
      }}
    />
  );
}
