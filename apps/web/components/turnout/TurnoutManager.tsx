"use client";

import { useState } from "react";
import { Plus, X, Trash2, Pencil, ArrowRight, AlertTriangle, MoveRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TurnoutEvent = RouterOutputs["turnout"]["list"][number];

// Minimal shape needed for the location dropdowns — kept structural so the
// server caller's richer result (with Date fields) is assignable.
type CapacityStatus = {
  buildings: Array<{
    id: string;
    name: string;
    stalls: Array<{ id: string; name: string }>;
  }>;
  pastures: Array<{ id: string; name: string }>;
};

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

// Encode a location selection as "stall:<id>" or "pasture:<id>"
function parseLocation(value: string): { stallId?: string; pastureId?: string } {
  if (!value) return {};
  const [kind, id] = value.split(":");
  return kind === "stall" ? { stallId: id } : { pastureId: id };
}

function locationValue(ev: TurnoutEvent, which: "from" | "to"): string {
  if (which === "from") {
    if (ev.fromStallId) return `stall:${ev.fromStallId}`;
    if (ev.fromPastureId) return `pasture:${ev.fromPastureId}`;
    return "";
  }
  if (ev.toStallId) return `stall:${ev.toStallId}`;
  if (ev.toPastureId) return `pasture:${ev.toPastureId}`;
  return "";
}

function LocationOptions({ capacity }: { capacity: CapacityStatus }) {
  return (
    <>
      {capacity.buildings.map((b) =>
        b.stalls.map((s) => (
          <option key={s.id} value={`stall:${s.id}`}>
            {b.name} / {s.name} (stall)
          </option>
        ))
      )}
      {capacity.pastures.map((p) => (
        <option key={p.id} value={`pasture:${p.id}`}>
          {p.name} (pasture)
        </option>
      ))}
    </>
  );
}

function locationName(ev: TurnoutEvent, which: "from" | "to") {
  if (which === "from") return ev.fromStall?.name ?? ev.fromPasture?.name ?? "Home";
  return ev.toStall?.name ?? ev.toPasture?.name ?? "?";
}

function daysLabel(days: number[]) {
  if (days.length === 7) return "Daily";
  return days.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join(", ");
}

export function TurnoutManager({
  animalId,
  capacity,
}: {
  animalId: string;
  capacity: CapacityStatus;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TurnoutEvent | null>(null);
  const utils = trpc.useUtils();
  const { data: events = [], isLoading } = trpc.turnout.list.useQuery({ animalId });

  const del = trpc.turnout.delete.useMutation({
    onSuccess: () => utils.turnout.list.invalidate({ animalId }),
  });

  function startEdit(ev: TurnoutEvent) {
    setEditing(ev);
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Turnout schedule</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule turnout
          </Button>
        )}
      </div>

      {showForm && (
        <TurnoutForm animalId={animalId} capacity={capacity} editing={editing} onDone={closeForm} />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          No turnout scheduled. e.g. move to a pasture between 12:00–14:00.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <Card key={ev.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="rounded-full p-2 bg-purple-100 text-purple-700 shrink-0">
                  <MoveRight className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-medium">{locationName(ev, "from")}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{locationName(ev, "to")}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {ev.startTime} – {ev.endTime} · {daysLabel(ev.repeatDays)}
                  </div>
                  {ev.notes && <p className="text-xs text-muted-foreground mt-1">{ev.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => startEdit(ev)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    title="Cancel turnout"
                    onClick={() => del.mutate({ id: ev.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TurnoutForm({
  animalId,
  capacity,
  editing,
  onDone,
}: {
  animalId: string;
  capacity: CapacityStatus;
  editing: TurnoutEvent | null;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const [error, setError] = useState("");
  const [fromValue, setFromValue] = useState(editing ? locationValue(editing, "from") : "");
  const [toValue, setToValue] = useState(editing ? locationValue(editing, "to") : "");
  const [startTime, setStartTime] = useState(editing?.startTime ?? "07:00");
  const [endTime, setEndTime] = useState(editing?.endTime ?? "16:00");
  const [repeatDays, setRepeatDays] = useState<number[]>(editing?.repeatDays ?? ALL_DAYS);

  const toLoc = parseLocation(toValue);
  const validTimes = !!startTime && !!endTime && endTime > startTime;
  const conflictReady = !!toValue && validTimes && repeatDays.length > 0;

  const { data: conflictResult } = trpc.turnout.getConflicts.useQuery(
    {
      toStallId: toLoc.stallId,
      toPastureId: toLoc.pastureId,
      startTime,
      endTime,
      repeatDays,
      excludeEventId: editing?.id,
    },
    { enabled: conflictReady }
  );

  const onSuccess = () => {
    utils.turnout.list.invalidate({ animalId });
    onDone();
  };
  const create = trpc.turnout.create.useMutation({ onSuccess, onError: (e) => setError(e.message) });
  const update = trpc.turnout.update.useMutation({ onSuccess, onError: (e) => setError(e.message) });
  const isPending = create.isPending || update.isPending;

  function toggleDay(day: number) {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (repeatDays.length === 0) return setError("Pick at least one day");
    if (!validTimes) return setError("End time must be after start time");
    const form = new FormData(e.currentTarget);
    const fromLoc = parseLocation(fromValue);
    const base = {
      fromStallId: fromLoc.stallId,
      fromPastureId: fromLoc.pastureId,
      toStallId: toLoc.stallId,
      toPastureId: toLoc.pastureId,
      startTime,
      endTime,
      repeatDays,
      notes: (form.get("notes") as string) || undefined,
    };
    if (editing) update.mutate({ id: editing.id, ...base });
    else create.mutate({ animalId, ...base });
  }

  const hasConflicts = conflictReady && conflictResult?.hasConflicts;

  return (
    <Card className="border-primary">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editing ? "Edit turnout" : "New turnout"}</h3>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDone}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="from">From (optional)</Label>
              <Select id="from" value={fromValue} onChange={(e) => setFromValue(e.target.value)}>
                <option value="">— Home location —</option>
                <LocationOptions capacity={capacity} />
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To *</Label>
              <Select id="to" required value={toValue} onChange={(e) => setToValue(e.target.value)}>
                <option value="">— Select destination —</option>
                <LocationOptions capacity={capacity} />
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start time *</Label>
              <Input id="startTime" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End time *</Label>
              <Input id="endTime" type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {hasConflicts && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Capacity conflict
              </div>
              {conflictResult?.conflicts.map((c, i) => (
                <p key={i} className="text-xs text-destructive/90">{c}</p>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Repeats on</Label>
            <div className="flex gap-1 flex-wrap">
              {WEEKDAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    "h-9 w-12 rounded-md border text-sm font-medium transition-colors",
                    repeatDays.includes(day.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending || hasConflicts}>
              {isPending ? "Saving…" : editing ? "Save changes" : "Schedule turnout"}
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
