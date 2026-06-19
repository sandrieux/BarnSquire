"use client";

import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Kind = "building" | "stall" | "pasture" | "arena";

export function DeleteLocationButton({
  kind,
  id,
  name,
  size = "default",
}: {
  kind: Kind;
  id: string;
  name: string;
  size?: "default" | "sm";
}) {
  const router = useRouter();

  const onSuccess = () => router.refresh();
  const onError = (e: { message: string }) => window.alert(e.message);

  const deleteBuilding = trpc.location.deleteBuilding.useMutation({ onSuccess, onError });
  const deleteStall = trpc.location.deleteStall.useMutation({ onSuccess, onError });
  const deletePasture = trpc.location.deletePasture.useMutation({ onSuccess, onError });
  const deleteArena = trpc.location.deleteArena.useMutation({ onSuccess, onError });

  const pending =
    deleteBuilding.isPending ||
    deleteStall.isPending ||
    deletePasture.isPending ||
    deleteArena.isPending;

  function handleClick() {
    const noun = kind === "building" ? "building (and all its stalls)" : kind;
    if (!window.confirm(`Delete ${noun} "${name}"? This cannot be undone.`)) return;
    if (kind === "building") deleteBuilding.mutate({ id });
    else if (kind === "stall") deleteStall.mutate({ id });
    else if (kind === "pasture") deletePasture.mutate({ id });
    else deleteArena.mutate({ id });
  }

  const iconCls = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const btnCls = size === "sm" ? "h-6 w-6" : "h-8 w-8";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(btnCls, "text-destructive")}
      title={`Delete ${kind}`}
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? <Loader2 className={cn(iconCls, "animate-spin")} /> : <Trash2 className={iconCls} />}
    </Button>
  );
}
