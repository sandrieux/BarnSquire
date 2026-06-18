import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { FeedingManager } from "@/components/feeding/FeedingManager";
import { Button } from "@/components/ui/button";

export default async function AnimalFeedingPage({
  params,
}: {
  params: Promise<{ barnId: string; animalId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId, animalId } = await params;
  const caller = await createServerCaller();
  const animal = await caller.animal.get({ id: animalId });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/barns/${barnId}/animals/${animalId}`}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            {animal.name}
          </Link>
        </Button>
      </div>
      <FeedingManager animalId={animalId} />
    </div>
  );
}
