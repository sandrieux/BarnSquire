"use client";

import { useState } from "react";
import { Plus, X, Trash2, Pencil, Dumbbell } from "lucide-react";
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

type Exercise = RouterOutputs["exercise"]["list"][number];

const EXERCISE_TYPES = [
  "RIDING",
  "LUNGEING",
  "GROUNDWORK",
  "TURNOUT_EXERCISE",
  "HAND_WALKING",
  "TREADMILL",
  "SWIMMING",
  "OTHER",
] as const;

const TYPE_LABELS: Record<string, string> = {
  RIDING: "Riding",
  LUNGEING: "Lungeing",
  GROUNDWORK: "Groundwork",
  TURNOUT_EXERCISE: "Turnout exercise",
  HAND_WALKING: "Hand walking",
  TREADMILL: "Treadmill",
  SWIMMING: "Swimming",
  OTHER: "Other",
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

function daysLabel(days: number[]) {
  if (days.length === 7) return "Daily";
  return days.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join(", ");
}

export function ExerciseManager({ animalId }: { animalId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const utils = trpc.useUtils();
  const { data: exercises = [], isLoading } = trpc.exercise.list.useQuery({ animalId });

  const deactivate = trpc.exercise.deactivate.useMutation({
    onSuccess: () => utils.exercise.list.invalidate({ animalId }),
  });

  function startEdit(ex: Exercise) {
    setEditing(ex);
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Exercise</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add exercise
          </Button>
        )}
      </div>

      {showForm && <ExerciseForm animalId={animalId} editing={editing} onDone={closeForm} />}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : exercises.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          No exercise scheduled.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Trainer</th>
                <th className="px-3 py-2 font-medium">Days</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((ex) => (
                <tr key={ex.id} className="border-b last:border-0 align-top">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Dumbbell className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="font-medium">{TYPE_LABELS[ex.type] ?? ex.type}</span>
                    </div>
                    {ex.notes && <p className="text-xs text-muted-foreground mt-1">{ex.notes}</p>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {ex.startTime}
                    {ex.endTime ? ` – ${ex.endTime}` : ""}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{ex.location ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{ex.trainer ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{daysLabel(ex.repeatDays)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => startEdit(ex)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="Remove exercise"
                        onClick={() => deactivate.mutate({ id: ex.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExerciseForm({
  animalId,
  editing,
  onDone,
}: {
  animalId: string;
  editing: Exercise | null;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const [error, setError] = useState("");
  const [startTime, setStartTime] = useState(editing?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(editing?.endTime ?? "");
  const [repeatDays, setRepeatDays] = useState<number[]>(editing?.repeatDays ?? ALL_DAYS);

  const onSuccess = () => {
    utils.exercise.list.invalidate({ animalId });
    onDone();
  };
  const create = trpc.exercise.create.useMutation({ onSuccess, onError: (e) => setError(e.message) });
  const update = trpc.exercise.update.useMutation({ onSuccess, onError: (e) => setError(e.message) });
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
    if (endTime && endTime <= startTime) return setError("End time must be after start time");
    const form = new FormData(e.currentTarget);
    const base = {
      type: form.get("type") as (typeof EXERCISE_TYPES)[number],
      trainer: (form.get("trainer") as string) || undefined,
      location: (form.get("location") as string) || undefined,
      startTime,
      endTime: endTime || undefined,
      repeatDays,
      notes: (form.get("notes") as string) || undefined,
    };
    if (editing) update.mutate({ id: editing.id, ...base });
    else create.mutate({ animalId, ...base });
  }

  return (
    <Card className="border-primary">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editing ? "Edit exercise" : "New exercise"}</h3>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDone}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select id="type" name="type" defaultValue={editing?.type ?? "RIDING"}>
                {EXERCISE_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trainer">Trainer</Label>
              <Input id="trainer" name="trainer" defaultValue={editing?.trainer ?? ""} placeholder="Pat Parelli" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" defaultValue={editing?.location ?? ""} placeholder="Indoor Arena" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start *</Label>
                <Input id="startTime" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End</Label>
                <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          </div>

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
            <Textarea id="notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} placeholder="20 min trot sets, focus on left bend" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save changes" : "Add exercise"}
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
