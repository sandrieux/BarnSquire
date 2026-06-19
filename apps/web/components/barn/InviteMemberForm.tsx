"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Mode = "existing" | "new";

export function InviteMemberForm({ barnId }: { barnId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("existing");
  const [error, setError] = useState("");

  const back = () => router.push(`/barns/${barnId}/settings`);
  const addMember = trpc.barn.addMember.useMutation({
    onSuccess: back,
    onError: (e) => setError(e.message),
  });
  const createMember = trpc.barn.createMember.useMutation({
    onSuccess: back,
    onError: (e) => setError(e.message),
  });

  const isPending = addMember.isPending || createMember.isPending;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const role = form.get("role") as "BARN_MANAGER" | "CARETAKER";
    if (mode === "existing") {
      addMember.mutate({ barnId, email: form.get("email") as string, role });
    } else {
      createMember.mutate({
        barnId,
        name: form.get("name") as string,
        email: form.get("email") as string,
        tempPassword: form.get("tempPassword") as string,
        role,
      });
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardContent className="p-6 space-y-4">
          <h1 className="text-xl font-bold">Add team member</h1>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setMode("existing"); setError(""); }}
              className={cn(
                "rounded-md border p-3 text-left text-sm transition-colors",
                mode === "existing" ? "border-primary bg-primary/5" : "hover:bg-accent"
              )}
            >
              <span className="font-medium">Existing user</span>
              <span className="block text-xs text-muted-foreground">Add by email</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode("new"); setError(""); }}
              className={cn(
                "rounded-md border p-3 text-left text-sm transition-colors",
                mode === "new" ? "border-primary bg-primary/5" : "hover:bg-accent"
              )}
            >
              <span className="font-medium">New user</span>
              <span className="block text-xs text-muted-foreground">Create with temp password</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "new" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name *</Label>
                <Input id="name" name="name" required placeholder="Jane Doe" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required placeholder="jane@example.com" />
            </div>

            {mode === "new" && (
              <div className="space-y-2">
                <Label htmlFor="tempPassword">Temporary password *</Label>
                <Input
                  id="tempPassword"
                  name="tempPassword"
                  type="text"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                />
                <p className="text-xs text-muted-foreground">
                  The user must change this password the first time they sign in.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select id="role" name="role" defaultValue="CARETAKER">
                <option value="CARETAKER">Caretaker</option>
                <option value="BARN_MANAGER">Barn Manager</option>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : mode === "new" ? "Create & add" : "Add member"}
              </Button>
              <Button type="button" variant="outline" onClick={back}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
