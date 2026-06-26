import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { AnimalProfile } from "@/components/animals/AnimalProfile";

export const dynamic = "force-dynamic";

const EMPTY_CAPACITY = { buildings: [], pastures: [], arenas: [] };

export default async function OwnerAnimalPage({
  params,
}: {
  params: Promise<{ animalId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { animalId } = await params;
  const caller = await createServerCaller();
  const t = await getTranslations("owner");

  // animal.get enforces ownership (assertAnimalReadAccess) — a non-owned id throws.
  const animal = await caller.animal.get({ id: animalId }).catch(() => null);
  if (!animal) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/owner">
          <ChevronLeft className="h-4 w-4 mr-1" />
          {t("myAnimals")}
        </Link>
      </Button>

      <AnimalProfile animal={animal} barnId={animal.barnId} capacity={EMPTY_CAPACITY} readOnly />
    </div>
  );
}
