"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function ChangePasswordForm() {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const changePassword = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      setDone(true);
      // Force a fresh sign-in so the new session no longer requires a change.
      setTimeout(() => signOut({ callbackUrl: "/login" }), 1200);
    },
    onError: (e) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const newPassword = form.get("newPassword") as string;
    const confirm = form.get("confirm") as string;
    if (newPassword.length < 8) return setError("Password must be at least 8 characters");
    if (newPassword !== confirm) return setError("Passwords do not match");
    changePassword.mutate({ newPassword });
  }

  if (done) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Password updated. Redirecting you to sign in…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" name="newPassword" type="password" required placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" name="confirm" type="password" required placeholder="••••••••" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={changePassword.isPending}>
            {changePassword.isPending ? "Saving…" : "Set password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
