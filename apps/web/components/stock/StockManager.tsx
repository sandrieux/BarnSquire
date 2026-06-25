"use client";

import { useState } from "react";
import { Plus, X, AlertTriangle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StockRow = RouterOutputs["feedStock"]["list"][number];

function round(n: number, dp = 0) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function StockManager({ barnId }: { barnId: string }) {
  const [restockFor, setRestockFor] = useState<string | null>(null);
  const [showAddType, setShowAddType] = useState(false);

  const utils = trpc.useUtils();
  const { data: rows = [], isLoading } = trpc.feedStock.list.useQuery({ barnId });

  const invalidate = () => {
    utils.feedStock.list.invalidate({ barnId });
    utils.feedStock.getRefillsDue.invalidate({ barnId });
  };
  const upsertFeedType = trpc.feedStock.upsertFeedType.useMutation({ onSuccess: invalidate });

  function commitThreshold(row: StockRow, raw: string) {
    const next = parseInt(raw, 10);
    if (!Number.isFinite(next) || next < 0 || next === row.thresholdDays) return;
    upsertFeedType.mutate({ barnId, feedType: row.feedType, thresholdDays: next });
  }

  function commitUnit(row: StockRow, raw: string) {
    const next = raw.trim();
    if (next === (row.unit ?? "")) return;
    upsertFeedType.mutate({ barnId, feedType: row.feedType, unit: next });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Feed types</h2>
        {!showAddType && (
          <Button size="sm" onClick={() => setShowAddType(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add feed type
          </Button>
        )}
      </div>

      {showAddType && (
        <AddFeedTypeForm
          barnId={barnId}
          existingUnits={uniqueUnits(rows)}
          onDone={() => {
            invalidate();
            setShowAddType(false);
          }}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          No feed types yet. Add one above, or add feeding schedules to your animals.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Feed</th>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 font-medium">Days left</th>
                <th className="px-3 py-2 font-medium">On hand</th>
                <th className="px-3 py-2 font-medium">Use / day</th>
                <th className="px-3 py-2 font-medium">Refill at</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const unit = row.unit ? ` ${row.unit}` : "";
                return (
                  <FragmentRow
                    key={row.feedType}
                    row={row}
                    unit={unit}
                    isAdding={restockFor === row.feedType}
                    onToggleAdd={() => setRestockFor((f) => (f === row.feedType ? null : row.feedType))}
                    onThresholdBlur={(raw) => commitThreshold(row, raw)}
                    onUnitBlur={(raw) => commitUnit(row, raw)}
                    onRestocked={() => {
                      invalidate();
                      setRestockFor(null);
                    }}
                    barnId={barnId}
                    roundedDaysLeft={row.daysLeft === null ? null : round(row.daysLeft)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function uniqueUnits(rows: StockRow[]): string[] {
  return [...new Set(rows.map((r) => r.unit).filter((u): u is string => !!u))].sort();
}

function FragmentRow({
  row,
  unit,
  isAdding,
  onToggleAdd,
  onThresholdBlur,
  onUnitBlur,
  onRestocked,
  barnId,
  roundedDaysLeft,
}: {
  row: StockRow;
  unit: string;
  isAdding: boolean;
  onToggleAdd: () => void;
  onThresholdBlur: (raw: string) => void;
  onUnitBlur: (raw: string) => void;
  onRestocked: () => void;
  barnId: string;
  roundedDaysLeft: number | null;
}) {
  return (
    <>
      <tr className="border-b last:border-0 align-top">
        <td className="px-3 py-2 font-medium">{row.feedType}</td>
        <td className="px-3 py-2">
          <Input
            defaultValue={row.unit ?? ""}
            onBlur={(e) => onUnitBlur(e.target.value)}
            className="h-8 w-24"
            placeholder="unit"
            aria-label={`Serving unit for ${row.feedType}`}
          />
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          {roundedDaysLeft === null ? (
            <span className="text-muted-foreground">—</span>
          ) : row.needsRefill ? (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" />~{roundedDaysLeft}d
            </Badge>
          ) : (
            <span>~{roundedDaysLeft}d</span>
          )}
        </td>
        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
          {row.tracked ? `${round(row.servingsRemaining, 1)}${unit}` : "—"}
        </td>
        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
          {row.ratePerDay > 0 ? `${round(row.ratePerDay, 2)}${unit}` : "—"}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              defaultValue={row.thresholdDays}
              onBlur={(e) => onThresholdBlur(e.target.value)}
              className="h-8 w-16"
              aria-label={`Refill threshold for ${row.feedType}`}
            />
            <span className="text-xs text-muted-foreground">d</span>
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex justify-end">
            <Button variant={isAdding ? "secondary" : "outline"} size="sm" onClick={onToggleAdd}>
              {isAdding ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              {isAdding ? "Close" : "Add stock"}
            </Button>
          </div>
        </td>
      </tr>
      {isAdding && (
        <tr className="border-b last:border-0 bg-muted/30">
          <td colSpan={7} className="px-3 py-3">
            <RestockForm
              barnId={barnId}
              feedType={row.feedType}
              unit={row.unit}
              defaultServingsPerContainer={row.servingsPerContainer}
              onDone={onRestocked}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function RestockForm({
  barnId,
  feedType,
  unit,
  defaultServingsPerContainer,
  onDone,
}: {
  barnId: string;
  feedType: string;
  unit: string | null;
  defaultServingsPerContainer: number | null;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const restock = trpc.feedStock.restock.useMutation({
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const containers = parseFloat(form.get("containers") as string);
    const servingsPerContainer = parseFloat(form.get("servingsPerContainer") as string);
    const dateRaw = (form.get("date") as string) || "";
    if (!(containers > 0)) return setError("Enter how many containers");
    if (!(servingsPerContainer > 0)) return setError("Enter servings per container");
    restock.mutate({
      barnId,
      feedType,
      containers,
      servingsPerContainer,
      date: dateRaw ? new Date(dateRaw) : undefined,
    });
  }

  return (
    <Card className="border-primary">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="containers">Containers</Label>
              <Input id="containers" name="containers" type="number" step="any" min="0" defaultValue="1" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="servingsPerContainer">Servings / container{unit ? ` (${unit})` : ""}</Label>
              <Input
                id="servingsPerContainer"
                name="servingsPerContainer"
                type="number"
                step="any"
                min="0"
                defaultValue={defaultServingsPerContainer ?? ""}
                placeholder="e.g. 60"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="date">Purchased</Label>
              <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="sm" disabled={restock.isPending}>
            {restock.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {restock.isPending ? "Saving…" : "Add to stock"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AddFeedTypeForm({
  barnId,
  existingUnits,
  onDone,
}: {
  barnId: string;
  existingUnits: string[];
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const upsert = trpc.feedStock.upsertFeedType.useMutation({
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const feedType = (form.get("feedType") as string)?.trim();
    const unit = (form.get("unit") as string)?.trim();
    const thresholdDays = parseInt(form.get("thresholdDays") as string, 10);
    if (!feedType) return setError("Feed name is required");
    upsert.mutate({
      barnId,
      feedType,
      unit: unit || undefined,
      thresholdDays: Number.isFinite(thresholdDays) ? thresholdDays : 3,
    });
  }

  return (
    <Card className="border-primary">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="newFeedType">Feed name</Label>
              <Input id="newFeedType" name="feedType" required placeholder="Orchard Grass Hay" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newUnit">Serving unit</Label>
              <Input id="newUnit" name="unit" placeholder="flakes" list="stock-units" />
              <datalist id="stock-units">
                {existingUnits.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label htmlFor="newThreshold">Refill at (days)</Label>
              <Input id="newThreshold" name="thresholdDays" type="number" min="0" defaultValue="3" />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : "Add feed type"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
