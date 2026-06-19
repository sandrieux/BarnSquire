"use client";

import { useState } from "react";
import { KeyRound, Trash2, X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Member = RouterOutputs["barn"]["listMembers"][number];

const ROLE_LABELS: Record<string, string> = {
  GLOBAL_ADMIN: "Global Admin",
  BARN_MANAGER: "Barn Manager",
  CARETAKER: "Caretaker",
};
const ROLE_ORDER: Record<string, number> = { CARETAKER: 0, BARN_MANAGER: 1, GLOBAL_ADMIN: 2 };

export function MembersManager({
  barnId,
  currentUserId,
}: {
  barnId: string;
  currentUserId: string;
}) {
  const utils = trpc.useUtils();
  const { data: members = [] } = trpc.barn.listMembers.useQuery({ barnId });
  const [resetFor, setResetFor] = useState<string | null>(null);

  const myRole = members.find((m) => m.user.id === currentUserId)?.role ?? "CARETAKER";

  const invalidate = () => utils.barn.listMembers.invalidate({ barnId });
  const updateRole = trpc.barn.updateMemberRole.useMutation({ onSuccess: invalidate });
  const remove = trpc.barn.removeMember.useMutation({
    onSuccess: invalidate,
    onError: (e) => window.alert(e.message),
  });

  return (
    <ul className="space-y-3">
      {members.map((m) => {
        const isSelf = m.user.id === currentUserId;
        const isGlobalAdmin = m.role === "GLOBAL_ADMIN";
        // Can only manage members at or below your own privilege, and not yourself.
        const canManage = !isSelf && ROLE_ORDER[m.role]! <= ROLE_ORDER[myRole]!;

        return (
          <li key={m.id} className="space-y-2 border-b last:border-0 pb-3 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{m.user.name ?? m.user.email}</p>
                <p className="text-muted-foreground text-xs truncate">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canManage && !isGlobalAdmin ? (
                  <Select
                    value={m.role}
                    onChange={(e) =>
                      updateRole.mutate({
                        barnId,
                        userId: m.user.id,
                        role: e.target.value as "BARN_MANAGER" | "CARETAKER",
                      })
                    }
                    className="h-8 w-36"
                  >
                    <option value="CARETAKER">Caretaker</option>
                    <option value="BARN_MANAGER">Barn Manager</option>
                  </Select>
                ) : (
                  <Badge variant="secondary">{ROLE_LABELS[m.role] ?? m.role}</Badge>
                )}
                {canManage && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Reset password"
                      onClick={() => setResetFor(resetFor === m.user.id ? null : m.user.id)}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      title="Remove from barn"
                      onClick={() => {
                        if (window.confirm(`Remove ${m.user.name ?? m.user.email} from this barn?`)) {
                          remove.mutate({ barnId, userId: m.user.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {resetFor === m.user.id && (
              <ResetPasswordRow
                barnId={barnId}
                userId={m.user.id}
                onDone={() => setResetFor(null)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ResetPasswordRow({
  barnId,
  userId,
  onDone,
}: {
  barnId: string;
  userId: string;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [requireChange, setRequireChange] = useState(true);

  const reset = trpc.barn.resetMemberPassword.useMutation({
    onSuccess: () => {
      setDone(true);
      setTimeout(onDone, 1500);
    },
    onError: (e) => setError(e.message),
  });

  if (done) {
    return <p className="text-xs text-green-600">Password updated.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        const newPassword = new FormData(e.currentTarget).get("newPassword") as string;
        if (newPassword.length < 8) return setError("Password must be at least 8 characters");
        reset.mutate({ barnId, userId, newPassword, requireChange });
      }}
      className="rounded-md border bg-muted/30 p-3 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Reset password</span>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onDone}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`pw-${userId}`}>New password</Label>
        <Input id={`pw-${userId}`} name="newPassword" type="text" required minLength={8} placeholder="At least 8 characters" />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={requireChange}
          onChange={(e) => setRequireChange(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        Require change at next sign-in
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={reset.isPending}>
        {reset.isPending ? "Saving…" : "Set password"}
      </Button>
    </form>
  );
}
