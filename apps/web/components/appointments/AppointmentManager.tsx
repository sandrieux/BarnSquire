"use client";

import { useState } from "react";
import { Plus, X, Check, Trash2, Pencil, Bell } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate, formatTime } from "@/lib/utils";

type Appointment = RouterOutputs["appointment"]["list"][number];

const APPT_TYPES = ["VET", "FARRIER", "DENTAL", "CHIRO", "GROOMING", "OTHER"] as const;
const TYPE_LABELS: Record<string, string> = {
  VET: "Veterinary",
  FARRIER: "Farrier",
  DENTAL: "Dental",
  CHIRO: "Chiropractic",
  GROOMING: "Grooming",
  OTHER: "Other",
};

function toLocalInput(d: Date | string) {
  const date = new Date(d);
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function AppointmentManager({
  barnId,
  animalId,
  readOnly = false,
}: {
  barnId: string;
  animalId: string;
  readOnly?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const utils = trpc.useUtils();
  const { data: appointments = [], isLoading } = trpc.appointment.list.useQuery({ barnId, animalId });

  const complete = trpc.appointment.complete.useMutation({
    onSuccess: () => utils.appointment.list.invalidate({ barnId, animalId }),
  });
  const del = trpc.appointment.delete.useMutation({
    onSuccess: () => utils.appointment.list.invalidate({ barnId, animalId }),
  });

  const now = Date.now();
  const upcoming = appointments.filter((a) => !a.isCompleted && new Date(a.scheduledAt).getTime() >= now);
  const past = appointments.filter((a) => a.isCompleted || new Date(a.scheduledAt).getTime() < now);

  function startEdit(a: Appointment) {
    setEditing(a);
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Appointments</h2>
        {!showForm && !readOnly && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        )}
      </div>

      {showForm && !readOnly && (
        <AppointmentForm barnId={barnId} animalId={animalId} editing={editing} onDone={closeForm} />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : appointments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          No appointments yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Provider</th>
                {!readOnly && <th className="px-3 py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {[...upcoming, ...past].map((appt) => (
                <tr
                  key={appt.id}
                  className={cn("border-b last:border-0 align-top", appt.isCompleted && "opacity-60")}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Badge variant="secondary">{TYPE_LABELS[appt.type]}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{appt.title}</span>
                      {appt.isCompleted && <Badge variant="success">Done</Badge>}
                    </div>
                    {appt.description && (
                      <p className="text-xs text-muted-foreground mt-1">{appt.description}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(appt.scheduledAt)}
                    <br />
                    {formatTime(appt.scheduledAt)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {appt.providerName ?? "—"}
                    {appt.cost != null ? (
                      <>
                        <br />${Number(appt.cost).toFixed(2)}
                      </>
                    ) : null}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        {!appt.isCompleted && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600"
                            title="Mark complete"
                            onClick={() => complete.mutate({ id: appt.id })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => startEdit(appt)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          title="Delete"
                          onClick={() => del.mutate({ id: appt.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && <ReminderSection barnId={barnId} animalId={animalId} />}
    </div>
  );
}

function AppointmentForm({
  barnId,
  animalId,
  editing,
  onDone,
}: {
  barnId: string;
  animalId: string;
  editing: Appointment | null;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const [error, setError] = useState("");
  const onSuccess = () => {
    utils.appointment.list.invalidate({ barnId, animalId });
    onDone();
  };
  const create = trpc.appointment.create.useMutation({ onSuccess, onError: (e) => setError(e.message) });
  const update = trpc.appointment.update.useMutation({ onSuccess, onError: (e) => setError(e.message) });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const costStr = form.get("cost") as string;
    const durationStr = form.get("durationMins") as string;
    const base = {
      type: form.get("type") as (typeof APPT_TYPES)[number],
      title: form.get("title") as string,
      description: (form.get("description") as string) || undefined,
      scheduledAt: new Date(form.get("scheduledAt") as string),
      durationMins: durationStr ? Number(durationStr) : undefined,
      providerName: (form.get("providerName") as string) || undefined,
      cost: costStr ? Number(costStr) : undefined,
      notes: (form.get("notes") as string) || undefined,
    };
    if (editing) {
      update.mutate({ id: editing.id, ...base });
    } else {
      create.mutate({ barnId, animalId, ...base });
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Card className="border-primary">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editing ? "Edit appointment" : "New appointment"}</h3>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDone}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select id="type" name="type" defaultValue={editing?.type ?? "VET"}>
                {APPT_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required defaultValue={editing?.title} placeholder="Spring vaccinations" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Date & time *</Label>
              <Input
                id="scheduledAt"
                name="scheduledAt"
                type="datetime-local"
                required
                defaultValue={editing ? toLocalInput(editing.scheduledAt) : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMins">Duration (mins)</Label>
              <Input id="durationMins" name="durationMins" type="number" min={5} step={5} defaultValue={editing?.durationMins ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="providerName">Provider</Label>
              <Input id="providerName" name="providerName" defaultValue={editing?.providerName ?? ""} placeholder="Dr. Smith" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost ($)</Label>
              <Input id="cost" name="cost" type="number" min={0} step="0.01" defaultValue={editing?.cost != null ? String(editing.cost) : ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} defaultValue={editing?.description ?? ""} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save changes" : "Schedule"}
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ReminderSection({ barnId, animalId }: { barnId: string; animalId: string }) {
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();
  const { data: reminders = [] } = trpc.appointment.listReminders.useQuery({ barnId });
  const animalReminders = reminders.filter((r) => r.animalId === animalId);

  const del = trpc.appointment.deleteReminder.useMutation({
    onSuccess: () => utils.appointment.listReminders.invalidate({ barnId }),
  });

  return (
    <div className="space-y-2 pt-4 border-t">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Bell className="h-4 w-4" /> Recurring reminders
        </h3>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        )}
      </div>

      {showForm && (
        <ReminderForm barnId={barnId} animalId={animalId} onDone={() => setShowForm(false)} />
      )}

      {animalReminders.length === 0 ? (
        !showForm && (
          <p className="text-sm text-muted-foreground">
            No reminders. E.g. &ldquo;Schedule farrier every 6 weeks&rdquo;.
          </p>
        )
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Reminder</th>
                <th className="px-3 py-2 font-medium">Every</th>
                <th className="px-3 py-2 font-medium">Next</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {animalReminders.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Badge variant="secondary">{TYPE_LABELS[r.type]}</Badge>
                  </td>
                  <td className="px-3 py-2 font-medium">{r.title}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.repeatWeeks} wks</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(r.nextRemindAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="Delete reminder"
                        onClick={() => del.mutate({ id: r.id })}
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

function ReminderForm({ barnId, animalId, onDone }: { barnId: string; animalId: string; onDone: () => void }) {
  const utils = trpc.useUtils();
  const [error, setError] = useState("");
  const create = trpc.appointment.createReminder.useMutation({
    onSuccess: () => {
      utils.appointment.listReminders.invalidate({ barnId });
      onDone();
    },
    onError: (e) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    create.mutate({
      barnId,
      animalId,
      type: form.get("type") as (typeof APPT_TYPES)[number],
      title: form.get("title") as string,
      repeatWeeks: Number(form.get("repeatWeeks")),
      nextRemindAt: new Date(form.get("nextRemindAt") as string),
    });
  }

  return (
    <Card className="border-primary">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rtype">Type</Label>
              <Select id="rtype" name="type" defaultValue="FARRIER">
                {APPT_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rtitle">Reminder title *</Label>
              <Input id="rtitle" name="title" required placeholder="Schedule farrier" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repeatWeeks">Every (weeks) *</Label>
              <Input id="repeatWeeks" name="repeatWeeks" type="number" min={1} max={52} required defaultValue={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextRemindAt">First reminder *</Label>
              <Input id="nextRemindAt" name="nextRemindAt" type="date" required />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Add reminder"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDone}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
