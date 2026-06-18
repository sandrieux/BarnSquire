"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CapacityStatus = {
  buildings: Array<{
    id: string;
    name: string;
    stalls: Array<{ id: string; name: string; maxCapacity: number; occupancy: number; isFull: boolean }>;
  }>;
  pastures: Array<{ id: string; name: string; maxCapacity: number; occupancy: number; isFull: boolean }>;
};

interface AnimalFormProps {
  barnId: string;
  capacityStatus: CapacityStatus;
  defaultValues?: {
    id?: string;
    name?: string;
    species?: string;
    breed?: string;
    size?: string;
    birthDate?: Date | null;
    color?: string;
    markings?: string;
    microchipId?: string;
    registrationId?: string;
    notes?: string;
    homeStallId?: string | null;
    homePastureId?: string | null;
  };
}

export function AnimalForm({ barnId, capacityStatus, defaultValues }: AnimalFormProps) {
  const router = useRouter();
  const isEdit = !!defaultValues?.id;
  const [error, setError] = useState("");

  const createAnimal = trpc.animal.create.useMutation({
    onSuccess: (a) => router.push(`/barns/${barnId}/animals/${a.id}`),
    onError: (e) => setError(e.message),
  });

  const updateAnimal = trpc.animal.update.useMutation({
    onSuccess: () => router.push(`/barns/${barnId}/animals/${defaultValues?.id}`),
    onError: (e) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);

    const homeStallId = (form.get("homeStallId") as string) || undefined;
    const homePastureId = homeStallId ? undefined : (form.get("homePastureId") as string) || undefined;
    const birthDateStr = form.get("birthDate") as string;

    const base = {
      name: form.get("name") as string,
      species: (form.get("species") as string) || "horse",
      breed: (form.get("breed") as string) || undefined,
      size: (form.get("size") as "MINI" | "SMALL" | "MEDIUM" | "LARGE" | "DRAFT") || "MEDIUM",
      birthDate: birthDateStr ? new Date(birthDateStr) : undefined,
      color: (form.get("color") as string) || undefined,
      markings: (form.get("markings") as string) || undefined,
      microchipId: (form.get("microchipId") as string) || undefined,
      registrationId: (form.get("registrationId") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
      homeStallId,
      homePastureId,
    };

    if (isEdit && defaultValues?.id) {
      updateAnimal.mutate({ id: defaultValues.id, ...base });
    } else {
      createAnimal.mutate({ barnId, ...base });
    }
  }

  const isPending = createAnimal.isPending || updateAnimal.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold">Basic information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required defaultValue={defaultValues?.name} placeholder="Bella" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="species">Species</Label>
              <Input id="species" name="species" defaultValue={defaultValues?.species ?? "horse"} placeholder="horse" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="breed">Breed</Label>
              <Input id="breed" name="breed" defaultValue={defaultValues?.breed ?? ""} placeholder="Morgan" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Size</Label>
              <Select id="size" name="size" defaultValue={defaultValues?.size ?? "MEDIUM"}>
                <option value="MINI">Mini</option>
                <option value="SMALL">Small</option>
                <option value="MEDIUM">Medium</option>
                <option value="LARGE">Large</option>
                <option value="DRAFT">Draft</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate">Birth date</Label>
              <Input
                id="birthDate"
                name="birthDate"
                type="date"
                defaultValue={defaultValues?.birthDate
                  ? new Date(defaultValues.birthDate).toISOString().slice(0, 10)
                  : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input id="color" name="color" defaultValue={defaultValues?.color ?? ""} placeholder="Bay" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="markings">Markings</Label>
            <Input id="markings" name="markings" defaultValue={defaultValues?.markings ?? ""} placeholder="White blaze, 3 stockings" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="microchipId">Microchip ID</Label>
              <Input id="microchipId" name="microchipId" defaultValue={defaultValues?.microchipId ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationId">Registration ID</Label>
              <Input id="registrationId" name="registrationId" defaultValue={defaultValues?.registrationId ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={defaultValues?.notes ?? ""} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold">Home location</h2>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="homeStallId">Stall</Label>
              <Select id="homeStallId" name="homeStallId" defaultValue={defaultValues?.homeStallId ?? ""}>
                <option value="">— No stall —</option>
                {capacityStatus.buildings.map((building) =>
                  building.stalls.map((stall) => (
                    <option key={stall.id} value={stall.id} disabled={stall.isFull && stall.id !== defaultValues?.homeStallId}>
                      {building.name} / {stall.name} ({stall.occupancy}/{stall.maxCapacity}){stall.isFull ? " FULL" : ""}
                    </option>
                  ))
                )}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="homePastureId">
                Pasture{" "}
                <span className="text-muted-foreground font-normal">(if no stall selected)</span>
              </Label>
              <Select id="homePastureId" name="homePastureId" defaultValue={defaultValues?.homePastureId ?? ""}>
                <option value="">— No pasture —</option>
                {capacityStatus.pastures.map((pasture) => (
                  <option key={pasture.id} value={pasture.id} disabled={pasture.isFull && pasture.id !== defaultValues?.homePastureId}>
                    {pasture.name} ({pasture.occupancy}/{pasture.maxCapacity}){pasture.isFull ? " FULL" : ""}
                  </option>
                ))}
              </Select>
            </div>
            {capacityStatus.buildings.length === 0 && capacityStatus.pastures.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No locations yet.{" "}
                <a href="locations" className="text-primary underline">Add locations</a> first.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add animal"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
