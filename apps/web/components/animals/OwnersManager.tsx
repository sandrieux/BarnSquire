"use client";

import { useState } from "react";
import { UserPlus, X, Loader2, Users } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OwnersManager({ animalId }: { animalId: string }) {
  const utils = trpc.useUtils();
  const { data: owners = [], isLoading } = trpc.animal.listOwners.useQuery({ animalId });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const invalidate = () => utils.animal.listOwners.invalidate({ animalId });
  const addOwner = trpc.animal.addOwner.useMutation({
    onSuccess: () => {
      invalidate();
      setShowForm(false);
    },
    onError: (e) => setError(e.message),
  });
  const removeOwner = trpc.animal.removeOwner.useMutation({ onSuccess: invalidate });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string)?.trim();
    const name = (form.get("name") as string)?.trim();
    const tempPassword = (form.get("tempPassword") as string)?.trim();
    if (!email) return setError("Email is required");
    addOwner.mutate({
      animalId,
      email,
      name: name || undefined,
      tempPassword: tempPassword || undefined,
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Owners
        </CardTitle>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add owner
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <Label htmlFor="owner-email">Owner email</Label>
              <Input id="owner-email" name="email" type="email" required placeholder="owner@example.com" />
            </div>
            <p className="text-xs text-muted-foreground">
              For a new account, also provide a name and temporary password (they'll change it on first login).
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="owner-name">Name (new account)</Label>
                <Input id="owner-name" name="name" placeholder="Jane Owner" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="owner-pw">Temp password</Label>
                <Input id="owner-pw" name="tempPassword" type="text" placeholder="Min. 8 characters" />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={addOwner.isPending}>
                {addOwner.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Add owner
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setError(""); }}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : owners.length === 0 ? (
          <p className="text-muted-foreground">No owners. Owners get read-only access to this animal.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {owners.map((o) => (
              <span key={o.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
                <span>{o.name ?? o.email}</span>
                <span className="text-xs text-muted-foreground">{o.email}</span>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  title="Remove owner"
                  onClick={() => removeOwner.mutate({ animalId, userId: o.id })}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
