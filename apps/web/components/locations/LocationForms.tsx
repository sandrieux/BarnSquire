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

export function BuildingForm({ barnId }: { barnId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const create = trpc.location.createBuilding.useMutation({
    onSuccess: () => router.push(`/barns/${barnId}/locations`),
    onError: (e) => setError(e.message),
  });

  return (
    <FormShell
      title="Add building"
      pending={create.isPending}
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        create.mutate({
          barnId,
          name: form.get("name") as string,
          notes: (form.get("notes") as string) || undefined,
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Building name *</Label>
        <Input id="name" name="name" required placeholder="Main Barn" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
    </FormShell>
  );
}

export function StallForm({ barnId, buildingId }: { barnId: string; buildingId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const create = trpc.location.createStall.useMutation({
    onSuccess: () => router.push(`/barns/${barnId}/locations`),
    onError: (e) => setError(e.message),
  });

  return (
    <FormShell
      title="Add stall"
      pending={create.isPending}
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        create.mutate({
          buildingId,
          name: form.get("name") as string,
          type: form.get("type") as "STANDARD" | "PANIC",
          maxCapacity: Number(form.get("maxCapacity")),
          notes: (form.get("notes") as string) || undefined,
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Stall name *</Label>
        <Input id="name" name="name" required placeholder="Stall 1" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select id="type" name="type" defaultValue="STANDARD">
          <option value="STANDARD">Standard</option>
          <option value="PANIC">Panic (quarantine/isolation)</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="maxCapacity">Max capacity</Label>
        <Input id="maxCapacity" name="maxCapacity" type="number" min={1} defaultValue={1} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
    </FormShell>
  );
}

export function PastureForm({ barnId }: { barnId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const create = trpc.location.createPasture.useMutation({
    onSuccess: () => router.push(`/barns/${barnId}/locations`),
    onError: (e) => setError(e.message),
  });

  return (
    <FormShell
      title="Add pasture"
      pending={create.isPending}
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const acreageStr = form.get("acreage") as string;
        create.mutate({
          barnId,
          name: form.get("name") as string,
          maxCapacity: Number(form.get("maxCapacity")),
          acreage: acreageStr ? Number(acreageStr) : undefined,
          notes: (form.get("notes") as string) || undefined,
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Pasture name *</Label>
        <Input id="name" name="name" required placeholder="North Field" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="maxCapacity">Max capacity</Label>
        <Input id="maxCapacity" name="maxCapacity" type="number" min={1} defaultValue={10} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="acreage">Acreage</Label>
        <Input id="acreage" name="acreage" type="number" step="0.1" min={0} placeholder="5.0" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
    </FormShell>
  );
}
