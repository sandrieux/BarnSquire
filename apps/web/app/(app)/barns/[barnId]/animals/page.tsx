import Link from "next/link";
import Image from "next/image";
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
                    <div className="flex items-center gap-3 min-w-0">
                      {animal.profilePhotoUrl ? (
                        <div className="relative h-12 w-12 rounded-full overflow-hidden border shrink-0">
                          <Image
                            src={animal.profilePhotoUrl}
                            alt={animal.name}
                            fill
                            sizes="48px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground shrink-0">
                          {animal.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{animal.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {animal.breed ?? animal.species}
                        </p>
                      </div>
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
