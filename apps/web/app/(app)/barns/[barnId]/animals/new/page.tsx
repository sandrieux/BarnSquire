import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { AnimalForm } from "@/components/animals/AnimalForm";

export default async function NewAnimalPage({ params }: { params: Promise<{ barnId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId } = await params;
  const caller = await createServerCaller();
  const capacityStatus = await caller.location.getCapacityStatus({ barnId });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add animal</h1>
      <AnimalForm barnId={barnId} capacityStatus={capacityStatus} />
    </div>
  );
}
