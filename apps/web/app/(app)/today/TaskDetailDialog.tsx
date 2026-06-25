"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
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
  SCHEDULED_EVENT: "secondary",
};

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
  const t = useTranslations("today");
  const locale = useLocale();

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
    ? t("detail.completed", {
        datetime: new Date(completedAt).toLocaleString(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      })
    : skipped
      ? t("detail.skipped")
      : t("detail.notDone");

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
            <Badge variant={TASK_BADGE_VARIANT[task.taskType]}>{t(`taskTypes.${task.taskType}`)}</Badge>
            <h2 className="font-semibold">{task.animalName || t("locationTypes.barn")}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t("detail.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="space-y-3 p-4 text-sm">
          <Row label={t("detail.task")} value={task.label} />
          {task.detail && <Row label={t("detail.details")} value={task.detail} />}
          <Row label={t("detail.location")} value={location} />
          <Row
            label={t("detail.status")}
            value={status}
            valueClassName={cn(
              completedAt && "text-green-700",
              skipped && "text-muted-foreground"
            )}
          />
          {task.completion?.notes && <Row label={t("detail.notes")} value={task.completion.notes} />}
        </dl>

        {task.animalId && (
          <div className="border-t p-4">
            <Link
              href={`/barns/${barnId}/animals/${task.animalId}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t("detail.view", { name: task.animalName })}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
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
