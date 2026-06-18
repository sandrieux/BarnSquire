import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createServerCaller } from "@/lib/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function LocationsPage({ params }: { params: Promise<{ barnId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { barnId } = await params;
  const caller = await createServerCaller();
  const capacity = await caller.location.getCapacityStatus({ barnId });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Locations</h1>
        <Button asChild size="sm">
          <Link href={`/barns/${barnId}/locations/new-building`}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add building
          </Link>
        </Button>
      </div>

      {/* Buildings & Stalls */}
      {capacity.buildings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Buildings</h2>
          {capacity.buildings.map((building: typeof capacity.buildings[number]) => (
            <Card key={building.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{building.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {building.stalls.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stalls yet.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {building.stalls.map((stall: typeof building.stalls[number]) => (
                      <div
                        key={stall.id}
                        className={cn(
                          "rounded-md border p-3 space-y-1",
                          stall.isFull ? "border-destructive/40 bg-destructive/5" : "bg-card"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{stall.name}</span>
                          <Badge variant={stall.isFull ? "destructive" : "outline"} className="text-xs">
                            {stall.occupancy}/{stall.maxCapacity}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {stall.homeAnimals.map((a: { id: string; name: string }) => a.name).join(", ") || "Empty"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/barns/${barnId}/locations/buildings/${building.id}/new-stall`}>
                      Add stall
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pastures */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pastures</h2>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/barns/${barnId}/locations/new-pasture`}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Add pasture
            </Link>
          </Button>
        </div>
        {capacity.pastures.length === 0 ? (
          <p className="text-muted-foreground text-sm">No pastures yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capacity.pastures.map((pasture: typeof capacity.pastures[number]) => (
              <Card key={pasture.id} className={cn(pasture.isFull && "border-destructive/40")}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{pasture.name}</span>
                    <Badge variant={pasture.isFull ? "destructive" : "outline"}>
                      {pasture.occupancy}/{pasture.maxCapacity}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {pasture.homeAnimals.map((a: { id: string; name: string }) => a.name).join(", ") || "Empty"}
                  </div>
                  {pasture.acreage && (
                    <div className="text-xs text-muted-foreground">{pasture.acreage} acres</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {capacity.buildings.length === 0 && capacity.pastures.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No locations yet. Add a building or pasture to organize your animals.
        </div>
      )}
    </div>
  );
}
