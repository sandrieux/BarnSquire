"use client";

import { useState } from "react";
import { Plus, X, Trash2, Pencil, CalendarClock } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ScheduledEvent = RouterOutputs["scheduledEvent"]["list"][number];

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

export function ScheduledEventManager({ barnId }: { barnId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ScheduledEvent | null>(null);
  const utils = trpc.useUtils();
  const { data: events = [], isLoading } = trpc.scheduledEvent.list.useQuery({ barnId });

  const deactivate = trpc.scheduledEvent.deactivate.useMutation({
    onSuccess: () => utils.scheduledEvent.list.invalidate({ barnId }),
  });

  function startEdit(ev: ScheduledEvent) {
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
        <h2 className="text-lg font-semibold">Scheduled events</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add event
          </Button>
        )}
      </div>

      {showForm && <EventForm barnId={barnId} editing={editing} onDone={closeForm} />}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          No barn-level events yet. Add chores like stall cleaning or arena dragging.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Days</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b last:border-0 align-top">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium">{ev.title}</span>
                    </div>
                    {ev.notes && <p className="text-xs text-muted-foreground mt-1">{ev.notes}</p>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {ev.startTime}
                    {ev.endTime ? ` – ${ev.endTime}` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{daysLabel(ev.repeatDays)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => startEdit(ev)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="Remove event"
                        onClick={() => deactivate.mutate({ id: ev.id })}
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

function EventForm({
  barnId,
  editing,
  onDone,
}: {
  barnId: string;
  editing: ScheduledEvent | null;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const [error, setError] = useState("");
  const [startTime, setStartTime] = useState(editing?.startTime ?? "06:00");
  const [endTime, setEndTime] = useState(editing?.endTime ?? "");
  const [repeatDays, setRepeatDays] = useState<number[]>(editing?.repeatDays ?? ALL_DAYS);

  const onSuccess = () => {
    utils.scheduledEvent.list.invalidate({ barnId });
    onDone();
  };
  const create = trpc.scheduledEvent.create.useMutation({ onSuccess, onError: (e) => setError(e.message) });
  const update = trpc.scheduledEvent.update.useMutation({ onSuccess, onError: (e) => setError(e.message) });
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
    const title = (form.get("title") as string)?.trim();
    if (!title) return setError("Title is required");
    const base = {
      title,
      startTime,
      endTime: endTime || undefined,
      repeatDays,
      notes: (form.get("notes") as string) || undefined,
    };
    if (editing) update.mutate({ id: editing.id, ...base });
    else create.mutate({ barnId, ...base });
  }

  return (
    <Card className="border-primary">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editing ? "Edit event" : "New event"}</h3>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDone}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" required defaultValue={editing?.title ?? ""} placeholder="Stall cleaning" />
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
            <Textarea id="notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} placeholder="Muck out all stalls, fresh bedding" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save changes" : "Add event"}
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
