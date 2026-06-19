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

function FormShell({
  title,
  children,
  onSubmit,
  pending,
  error,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  error: string;
}) {
  const router = useRouter();
  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardContent className="p-6 space-y-4">
          <h1 className="text-xl font-bold">{title}</h1>
          <form onSubmit={onSubmit} className="space-y-4">
            {children}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function BuildingForm({
  barnId,
  editing,
}: {
  barnId: string;
  editing?: { id: string; name: string; notes: string | null };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const back = () => router.push(`/barns/${barnId}/locations`);
  const create = trpc.location.createBuilding.useMutation({ onSuccess: back, onError: (e) => setError(e.message) });
  const update = trpc.location.updateBuilding.useMutation({ onSuccess: back, onError: (e) => setError(e.message) });
  const isPending = create.isPending || update.isPending;

  return (
    <FormShell
      title={editing ? "Edit building" : "Add building"}
      pending={isPending}
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const name = form.get("name") as string;
        const notes = (form.get("notes") as string) || undefined;
        if (editing) update.mutate({ id: editing.id, name, notes });
        else create.mutate({ barnId, name, notes });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Building name *</Label>
        <Input id="name" name="name" required defaultValue={editing?.name} placeholder="Main Barn" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
      </div>
    </FormShell>
  );
}

export function StallForm({
  barnId,
  buildingId,
  editing,
}: {
  barnId: string;
  buildingId?: string;
  editing?: { id: string; name: string; type: "STANDARD" | "QUARANTINE"; maxCapacity: number; notes: string | null };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const back = () => router.push(`/barns/${barnId}/locations`);
  const create = trpc.location.createStall.useMutation({ onSuccess: back, onError: (e) => setError(e.message) });
  const update = trpc.location.updateStall.useMutation({ onSuccess: back, onError: (e) => setError(e.message) });
  const isPending = create.isPending || update.isPending;

  return (
    <FormShell
      title={editing ? "Edit stall" : "Add stall"}
      pending={isPending}
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const base = {
          name: form.get("name") as string,
          type: form.get("type") as "STANDARD" | "QUARANTINE",
          maxCapacity: Number(form.get("maxCapacity")),
          notes: (form.get("notes") as string) || undefined,
        };
        if (editing) update.mutate({ id: editing.id, ...base });
        else create.mutate({ buildingId: buildingId!, ...base });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Stall name *</Label>
        <Input id="name" name="name" required defaultValue={editing?.name} placeholder="Stall 1" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select id="type" name="type" defaultValue={editing?.type ?? "STANDARD"}>
          <option value="STANDARD">Standard</option>
          <option value="QUARANTINE">Quarantine (isolation)</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="maxCapacity">Max capacity</Label>
        <Input
          id="maxCapacity"
          name="maxCapacity"
          type="number"
          min={1}
          defaultValue={editing?.maxCapacity ?? 1}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
      </div>
    </FormShell>
  );
}

export function PastureForm({
  barnId,
  editing,
}: {
  barnId: string;
  editing?: { id: string; name: string; maxCapacity: number; acreage: number | null; notes: string | null };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const back = () => router.push(`/barns/${barnId}/locations`);
  const create = trpc.location.createPasture.useMutation({ onSuccess: back, onError: (e) => setError(e.message) });
  const update = trpc.location.updatePasture.useMutation({ onSuccess: back, onError: (e) => setError(e.message) });
  const isPending = create.isPending || update.isPending;

  return (
    <FormShell
      title={editing ? "Edit pasture" : "Add pasture"}
      pending={isPending}
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const acreageStr = form.get("acreage") as string;
        const base = {
          name: form.get("name") as string,
          maxCapacity: Number(form.get("maxCapacity")),
          acreage: acreageStr ? Number(acreageStr) : undefined,
          notes: (form.get("notes") as string) || undefined,
        };
        if (editing) update.mutate({ id: editing.id, ...base });
        else create.mutate({ barnId, ...base });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Pasture name *</Label>
        <Input id="name" name="name" required defaultValue={editing?.name} placeholder="North Field" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="maxCapacity">Max capacity</Label>
        <Input
          id="maxCapacity"
          name="maxCapacity"
          type="number"
          min={1}
          defaultValue={editing?.maxCapacity ?? 10}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="acreage">Acreage</Label>
        <Input
          id="acreage"
          name="acreage"
          type="number"
          step="0.1"
          min={0}
          defaultValue={editing?.acreage ?? ""}
          placeholder="5.0"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
      </div>
    </FormShell>
  );
}

export function ArenaForm({
  barnId,
  buildings,
  editing,
}: {
  barnId: string;
  buildings: Array<{ id: string; name: string }>;
  editing?: {
    id: string;
    name: string;
    buildingId: string | null;
    surface: string | null;
    notes: string | null;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const back = () => router.push(`/barns/${barnId}/locations`);
  const create = trpc.location.createArena.useMutation({ onSuccess: back, onError: (e) => setError(e.message) });
  const update = trpc.location.updateArena.useMutation({ onSuccess: back, onError: (e) => setError(e.message) });
  const isPending = create.isPending || update.isPending;

  return (
    <FormShell
      title={editing ? "Edit arena" : "Add arena"}
      pending={isPending}
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const buildingId = (form.get("buildingId") as string) || undefined;
        const base = {
          name: form.get("name") as string,
          buildingId,
          surface: (form.get("surface") as string) || undefined,
          notes: (form.get("notes") as string) || undefined,
        };
        if (editing) update.mutate({ id: editing.id, ...base });
        else create.mutate({ barnId, ...base });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Arena name *</Label>
        <Input id="name" name="name" required defaultValue={editing?.name} placeholder="Indoor Arena" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="buildingId">Building (optional)</Label>
        <Select id="buildingId" name="buildingId" defaultValue={editing?.buildingId ?? ""}>
          <option value="">— Standalone (not in a building) —</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="surface">Surface</Label>
        <Input id="surface" name="surface" defaultValue={editing?.surface ?? ""} placeholder="Sand, Grass, Rubber…" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
      </div>
    </FormShell>
  );
}
