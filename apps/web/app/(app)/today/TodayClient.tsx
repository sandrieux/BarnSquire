"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ChevronLeft, ChevronRight, Bell, Package } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";
import { TaskDetailDialog } from "./TaskDetailDialog";

type Group = RouterOutputs["today"]["getDailyView"][number];
type Task = Group["tasks"][number];
type DueReminder = RouterOutputs["appointment"]["getDueReminders"][number];

const TASK_COLORS: Record<string, string> = {
  FEEDING: "bg-green-50 border-green-200",
  MEDICATION: "bg-orange-50 border-orange-200",
  APPOINTMENT: "bg-blue-50 border-blue-200",
  TURNOUT: "bg-purple-50 border-purple-200",
  EXERCISE: "bg-amber-50 border-amber-200",
  SCHEDULED_EVENT: "bg-slate-50 border-slate-200",
};

const TASK_BADGE_VARIANT: Record<string, "default" | "secondary" | "warning" | "success"> = {
  FEEDING: "success",
  MEDICATION: "warning",
  APPOINTMENT: "default",
  TURNOUT: "secondary",
  EXERCISE: "default",
  SCHEDULED_EVENT: "secondary",
};

const SLOTS = ["ALL", "MORNING", "LUNCH", "AFTERNOON", "EVENING"] as const;
type SlotFilter = (typeof SLOTS)[number];

// Current time-of-day slot from the browser clock — mirrors the server's
// timeToSlot windows (Morning 06–12, Lunch 12–13, Afternoon 13–18, else Evening).
function currentSlot(): SlotFilter {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins >= 360 && mins < 720) return "MORNING";
  if (mins >= 720 && mins < 780) return "LUNCH";
  if (mins >= 780 && mins < 1080) return "AFTERNOON";
  return "EVENING";
}

export function TodayClient({
  barnId,
  barns,
  date,
}: {
  barnId: string;
  barns: Array<{ id: string; name: string }>;
  date: string;
}) {
  const router = useRouter();
  const t = useTranslations("today");
  const locale = useLocale();
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("ALL");
  const [optimisticDone, setOptimisticDone] = useState<Set<string>>(new Set());

  // On load, default the filter to the current time-of-day slot (browser time)
  // when viewing today, so caretakers land on what's due now. Computed client-side
  // post-mount to avoid an SSR/browser-timezone hydration mismatch.
  useEffect(() => {
    if (date === new Date().toISOString().slice(0, 10)) {
      setSlotFilter(currentSlot());
    }
    // Mount only: don't override the user's manual choice on later re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [detail, setDetail] = useState<{ task: Task; location: string } | null>(null);

  const utils = trpc.useUtils();
  const { data: groups = [] } = trpc.today.getDailyView.useQuery({ barnId, date });

  const completeTask = trpc.today.completeTask.useMutation({
    onMutate: ({ feedingScheduleId, appointmentId, turnoutEventId, exerciseScheduleId, scheduledEventId }) => {
      const key = feedingScheduleId ?? appointmentId ?? turnoutEventId ?? exerciseScheduleId ?? scheduledEventId ?? "";
      setOptimisticDone((prev) => new Set([...prev, key]));
    },
    onSuccess: () => utils.today.getDailyView.invalidate(),
  });

  const { data: dueReminders = [] } = trpc.appointment.getDueReminders.useQuery({ barnId });
  const snoozeReminder = trpc.appointment.snoozeReminder.useMutation({
    onSuccess: () => utils.appointment.getDueReminders.invalidate(),
  });

  const { data: refillsDue = [] } = trpc.feedStock.getRefillsDue.useQuery({ barnId });

  function navigateDate(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    router.push(`/today?barnId=${barnId}&date=${d.toISOString().slice(0, 10)}`);
  }

  function handleComplete(task: Task) {
    completeTask.mutate({
      barnId,
      date,
      taskType: task.taskType,
      animalId: task.animalId || undefined,
      feedingScheduleId: task.taskType === "FEEDING" || task.taskType === "MEDICATION" ? task.id : undefined,
      appointmentId: task.taskType === "APPOINTMENT" ? task.id : undefined,
      turnoutEventId: task.taskType === "TURNOUT" ? task.id : undefined,
      exerciseScheduleId: task.taskType === "EXERCISE" ? task.id : undefined,
      scheduledEventId: task.taskType === "SCHEDULED_EVENT" ? task.id : undefined,
    });
  }

  const isToday = date === new Date().toISOString().slice(0, 10);

  const filteredGroups = groups.map((group) => ({
    ...group,
    tasks: slotFilter === "ALL"
      ? group.tasks
      : group.tasks.filter((t) => t.slot === slotFilter),
  })).filter((g) => g.tasks.length > 0);

  const totalTasks = groups.flatMap((g) => g.tasks).length;
  const doneTasks = groups.flatMap((g) => g.tasks).filter(
    (t) => optimisticDone.has(t.id) || t.completion?.completedAt
  ).length;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isToday ? t("title") : formatDate(date, locale)}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("tasksCompleted", { done: doneTasks, total: totalTasks })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/today?barnId=${barnId}`)}>
              {t("title")}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Due reminders */}
      {dueReminders.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-800">
              <Bell className="h-4 w-4" />
              {t("remindersDue", { count: dueReminders.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueReminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span>{r.title}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => snoozeReminder.mutate({ id: r.id })}
                >
                  {t("snooze")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Feed refill reminders */}
      {refillsDue.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
              <Package className="h-4 w-4" />
              {t("feedsLow", { count: refillsDue.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {refillsDue.map((r) => (
              <div key={r.feedType} className="flex items-center justify-between text-sm">
                <span>
                  <span className="font-medium">{r.feedType}</span>
                  <span className="text-muted-foreground"> — {t("feedDaysLeft", { days: Math.round(r.daysLeft) })}</span>
                </span>
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                  <Link href={`/barns/${barnId}/stock`}>{t("addStock")}</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Slot filter */}
      <div className="flex gap-2 flex-wrap">
        {SLOTS.map((slot) => (
          <Button
            key={slot}
            variant={slotFilter === slot ? "default" : "outline"}
            size="sm"
            onClick={() => setSlotFilter(slot)}
          >
            {t(`slots.${slot}`)}
          </Button>
        ))}
      </div>

      {/* Location groups */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("noTasks")}
        </div>
      ) : (
        filteredGroups.map((group) => (
          <Card key={group.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-normal uppercase tracking-wider">
                  {t(`locationTypes.${group.type}`)}
                </span>
                {group.buildingName && (
                  <>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-xs text-muted-foreground font-normal">{group.buildingName}</span>
                  </>
                )}
                {group.type !== "barn" && <span className="font-semibold">{group.name}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Group by animal */}
              {Array.from(
                group.tasks.reduce((map, task) => {
                  if (!map.has(task.animalName)) map.set(task.animalName, []);
                  map.get(task.animalName)!.push(task);
                  return map;
                }, new Map<string, Task[]>())
              ).map(([animalName, tasks]) => (
                <div key={animalName} className="space-y-1">
                  {animalName && <p className="text-sm font-medium text-muted-foreground">{animalName}</p>}
                  {tasks.map((task) => {
                    const isDone = optimisticDone.has(task.id) || !!task.completion?.completedAt;
                    const isSkipped = task.completion?.skipped && !task.completion?.completedAt;
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-center gap-3 rounded-md border px-3 py-2 text-sm",
                          TASK_COLORS[task.taskType],
                          isDone && "opacity-60"
                        )}
                      >
                        <button
                          className={cn(
                            "h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors",
                            isDone
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground"
                          )}
                          onClick={() => !isDone && handleComplete(task)}
                          disabled={isDone}
                        >
                          {isDone && (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left hover:underline cursor-pointer"
                          title={t("viewDetails")}
                          onClick={() =>
                            setDetail({
                              task,
                              location:
                                group.type === "barn" || group.type === "unassigned"
                                  ? t(`locationTypes.${group.type}`)
                                  : [t(`locationTypes.${group.type}`), group.buildingName, group.name]
                                      .filter(Boolean)
                                      .join(" · "),
                            })
                          }
                        >
                          <span className={cn(isDone && "line-through")}>{task.label}</span>
                          <span className="text-muted-foreground ml-2">{task.detail}</span>
                        </button>
                        <Badge variant={TASK_BADGE_VARIANT[task.taskType]} className="shrink-0 text-xs">
                          {isSkipped ? t("skipped") : t(`taskTypes.${task.taskType}`)}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {detail && (
        <TaskDetailDialog
          task={detail.task}
          location={detail.location}
          barnId={barnId}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
