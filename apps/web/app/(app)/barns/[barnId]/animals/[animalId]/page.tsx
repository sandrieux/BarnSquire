import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { AnimalProfile } from "@/components/animals/AnimalProfile";
import { OwnersManager } from "@/components/animals/OwnersManager";

export default async function AnimalProfilePage({
  params,
}: {
  params: Promise<{ barnId: string; animalId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId, animalId } = await params;
  const caller = await createServerCaller();
  const [animal, capacity, barns] = await Promise.all([
    caller.animal.get({ id: animalId }),
    caller.location.getCapacityStatus({ barnId }),
    caller.barn.list(),
  ]);

  const role = barns.find((b: { id: string; role: string }) => b.id === barnId)?.role;
  const canManage = role === "BARN_MANAGER" || role === "GLOBAL_ADMIN";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/barns/${barnId}/animals`}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          All animals
        </Link>
      </Button>

      <AnimalProfile animal={animal} barnId={barnId} capacity={capacity} />

      {canManage && <OwnersManager animalId={animalId} />}
    </div>
  );
}
