"use client";

import { useState } from "react";
import { Plus, Pill, Wheat, X, Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate, todayDateString } from "@/lib/utils";

type Schedule = RouterOutputs["feeding"]["list"][number];

const SLOTS = ["MORNING", "LUNCH", "EVENING", "CUSTOM"] as const;
const SLOT_LABELS: Record<string, string> = {
  MORNING: "Morning",
  LUNCH: "Lunch",
  EVENING: "Evening",
  CUSTOM: "Custom time",
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

export function FeedingManager({ animalId }: { animalId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);

  const utils = trpc.useUtils();
  const { data: schedules = [], isLoading } = trpc.feeding.list.useQuery({ animalId });

  const deactivate = trpc.feeding.deactivate.useMutation({
    onSuccess: () => utils.feeding.list.invalidate({ animalId }),
  });

  function startEdit(schedule: Schedule) {
    setEditing(schedule);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Feeding & medication</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add schedule
          </Button>
        )}
      </div>

      {showForm && (
        <FeedingForm
          animalId={animalId}
          editing={editing}
          onDone={closeForm}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : schedules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          No feeding schedules yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Slot</th>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Quantity</th>
                <th className="px-3 py-2 font-medium">Schedule</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...schedules]
                .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot))
                .map((schedule) => (
                  <tr key={schedule.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {SLOT_LABELS[schedule.slot]}
                      {schedule.slot === "CUSTOM" && schedule.customTime && (
                        <span className="text-muted-foreground"> {schedule.customTime}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {schedule.isMedication ? (
                          <Pill className="h-4 w-4 text-orange-600 shrink-0" />
                        ) : (
                          <Wheat className="h-4 w-4 text-green-600 shrink-0" />
                        )}
                        <span className="font-medium">{schedule.feedType}</span>
                        {schedule.isMedication && <Badge variant="warning">Med</Badge>}
                      </div>
                      {schedule.instructions && (
                        <p className="text-xs text-muted-foreground mt-1">{schedule.instructions}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {schedule.quantity}{schedule.unit ? ` ${schedule.unit}` : ""}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {schedule.repeatDays.length === 7
                        ? "Daily"
                        : schedule.repeatDays
                            .map((d) => WEEKDAYS.find((w) => w.value === d)?.label)
                            .join(", ")}
                      <br />
                      from {formatDate(schedule.startDate)}
                      {schedule.endDate ? ` until ${formatDate(schedule.endDate)}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => startEdit(schedule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          title="End schedule"
                          onClick={() => deactivate.mutate({ id: schedule.id })}
                        >
                          <X className="h-4 w-4" />
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

function FeedingForm({
  animalId,
  editing,
  onDone,
}: {
  animalId: string;
  editing: Schedule | null;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const [error, setError] = useState("");
  const [slot, setSlot] = useState<string>(editing?.slot ?? "MORNING");
  const [isMedication, setIsMedication] = useState(editing?.isMedication ?? false);
  const [repeatDays, setRepeatDays] = useState<number[]>(
    editing?.repeatDays ?? [1, 2, 3, 4, 5, 6, 7]
  );

  const onSuccess = () => {
    utils.feeding.list.invalidate({ animalId });
    onDone();
  };
  const create = trpc.feeding.create.useMutation({ onSuccess, onError: (e) => setError(e.message) });
  const update = trpc.feeding.update.useMutation({ onSuccess, onError: (e) => setError(e.message) });

  function toggleDay(day: number) {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (repeatDays.length === 0) {
      setError("Select at least one day");
      return;
    }
    const form = new FormData(e.currentTarget);
    const endDateStr = form.get("endDate") as string;
    const customTime = form.get("customTime") as string;

    const base = {
      feedType: form.get("feedType") as string,
      quantity: form.get("quantity") as string,
      unit: (form.get("unit") as string) || undefined,
      slot: slot as "MORNING" | "LUNCH" | "EVENING" | "CUSTOM",
      customTime: slot === "CUSTOM" ? customTime : undefined,
      instructions: (form.get("instructions") as string) || undefined,
      isMedication,
      startDate: new Date(form.get("startDate") as string),
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      repeatDays,
    };

    if (editing) {
      update.mutate({ id: editing.id, ...base });
    } else {
      create.mutate({ animalId, ...base });
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Card className="border-primary">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editing ? "Edit schedule" : "New schedule"}</h3>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDone}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isMedication"
              checked={isMedication}
              onChange={(e) => setIsMedication(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="isMedication" className="cursor-pointer">
              This is a medication (usually has an end date)
            </Label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="feedType">{isMedication ? "Medication name" : "Feed type"} *</Label>
              <Input
                id="feedType"
                name="feedType"
                required
                defaultValue={editing?.feedType}
                placeholder={isMedication ? "Bute" : "Orchard Grass Hay"}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input id="quantity" name="quantity" required defaultValue={editing?.quantity} placeholder="2" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" name="unit" defaultValue={editing?.unit ?? ""} placeholder="flakes" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="slot">Time slot</Label>
              <Select id="slot" name="slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
                {SLOTS.map((s) => (
                  <option key={s} value={s}>{SLOT_LABELS[s]}</option>
                ))}
              </Select>
            </div>
            {slot === "CUSTOM" && (
              <div className="space-y-2">
                <Label htmlFor="customTime">Time (HH:MM) *</Label>
                <Input
                  id="customTime"
                  name="customTime"
                  type="time"
                  required
                  defaultValue={editing?.customTime ?? "14:00"}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Repeat on</Label>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date *</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                required
                defaultValue={
                  editing?.startDate
                    ? new Date(editing.startDate).toISOString().slice(0, 10)
                    : todayDateString()
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End date {isMedication ? "" : "(optional)"}</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={
                  editing?.endDate ? new Date(editing.endDate).toISOString().slice(0, 10) : ""
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              name="instructions"
              rows={2}
              defaultValue={editing?.instructions ?? ""}
              placeholder="Soak for 20 minutes before feeding"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save changes" : "Add schedule"}
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
