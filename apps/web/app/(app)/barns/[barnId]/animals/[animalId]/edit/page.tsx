import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { AnimalForm } from "@/components/animals/AnimalForm";

export default async function EditAnimalPage({
  params,
}: {
  params: Promise<{ barnId: string; animalId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId, animalId } = await params;
  const caller = await createServerCaller();
  const [animal, capacityStatus] = await Promise.all([
    caller.animal.get({ id: animalId }),
    caller.location.getCapacityStatus({ barnId }),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit {animal.name}</h1>
      <AnimalForm
        barnId={barnId}
        capacityStatus={capacityStatus}
        defaultValues={{
          id: animal.id,
          name: animal.name,
          species: animal.species,
          breed: animal.breed ?? undefined,
          size: animal.size,
          birthDate: animal.birthDate,
          color: animal.color ?? undefined,
          markings: animal.markings ?? undefined,
          microchipId: animal.microchipId ?? undefined,
          registrationId: animal.registrationId ?? undefined,
          notes: animal.notes ?? undefined,
          homeStallId: animal.homeStallId,
          homePastureId: animal.homePastureId,
        }}
      />
    </div>
  );
}
