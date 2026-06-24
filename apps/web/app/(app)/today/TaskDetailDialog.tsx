"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Task = RouterOutputs["today"]["getDailyView"][number]["tasks"][number];

const TASK_BADGE_VARIANT: Record<string, "default" | "secondary" | "warning" | "success"> = {
  FEEDING: "success",
  MEDICATION: "warning",
  APPOINTMENT: "default",
  TURNOUT: "secondary",
  EXERCISE: "default",
};

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function TaskDetailDialog({
  task,
  location,
  barnId,
  onClose,
}: {
  task: Task;
  location: string;
  barnId: string;
  onClose: () => void;
}) {
  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const completedAt = task.completion?.completedAt;
  const skipped = task.completion?.skipped && !completedAt;
  const status = completedAt
    ? `Completed ${new Date(completedAt).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })}`
    : skipped
      ? "Skipped"
      : "Not done yet";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-lg border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <Badge variant={TASK_BADGE_VARIANT[task.taskType]}>{titleCase(task.taskType)}</Badge>
            <h2 className="font-semibold">{task.animalName}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="space-y-3 p-4 text-sm">
          <Row label="Task" value={task.label} />
          {task.detail && <Row label="Details" value={task.detail} />}
          <Row label="Location" value={location} />
          <Row
            label="Status"
            value={status}
            valueClassName={cn(
              completedAt && "text-green-700",
              skipped && "text-muted-foreground"
            )}
          />
          {task.completion?.notes && <Row label="Notes" value={task.completion.notes} />}
        </dl>

        <div className="border-t p-4">
          <Link
            href={`/barns/${barnId}/animals/${task.animalId}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View {task.animalName}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium break-words", valueClassName)}>{value}</dd>
    </div>
  );
}
