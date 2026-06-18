import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle, MapPin } from "lucide-react";

export default async function AnimalsPage({ params }: { params: Promise<{ barnId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId } = await params;
  const caller = await createServerCaller();
  const animals = await caller.animal.list({ barnId });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Animals</h1>
        <Button asChild>
          <Link href={`/barns/${barnId}/animals/new`}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add animal
          </Link>
        </Button>
      </div>
      {animals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No animals yet. Add your first animal to get started.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {animals.map((animal: typeof animals[number]) => (
            <Link key={animal.id} href={`/barns/${barnId}/animals/${animal.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{animal.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {animal.breed ?? animal.species}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {animal.size}
                    </Badge>
                  </div>
                  {(animal.homeStall ?? animal.homePasture) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {animal.homeStall
                        ? `${animal.homeStall.building?.name} / ${animal.homeStall.name}`
                        : animal.homePasture?.name}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
