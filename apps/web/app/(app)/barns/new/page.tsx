"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewBarnPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const createBarn = trpc.barn.create.useMutation({
    onSuccess: (barn) => router.push(`/barns/${barn.id}/animals`),
    onError: (e) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createBarn.mutate({
      name: form.get("name") as string,
      address: (form.get("address") as string) || undefined,
      timezone: (form.get("timezone") as string) || "America/New_York",
    });
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create a new barn</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Barn name</Label>
              <Input id="name" name="name" required placeholder="Maple Ridge Farm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address (optional)</Label>
              <Input id="address" name="address" placeholder="123 Barn Lane" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" name="timezone" placeholder="America/New_York" defaultValue="America/New_York" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={createBarn.isPending}>
                {createBarn.isPending ? "Creating…" : "Create barn"}
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
