export type TaskType =
  | "FEEDING"
  | "MEDICATION"
  | "APPOINTMENT"
  | "TURNOUT"
  | "EXERCISE"
  | "SCHEDULED_EVENT";

export interface CompletionKey {
  feedingScheduleId?: string;
  appointmentId?: string;
  turnoutEventId?: string;
  exerciseScheduleId?: string;
  scheduledEventId?: string;
}

// Maps a task's type + schedule/event id to the correct polymorphic FK the
// today.completeTask / skipTask / uncompleteTask procedures expect.
export function completionKeyFor(taskType: TaskType, id: string): CompletionKey {
  switch (taskType) {
    case "FEEDING":
    case "MEDICATION":
      return { feedingScheduleId: id };
    case "APPOINTMENT":
      return { appointmentId: id };
    case "TURNOUT":
      return { turnoutEventId: id };
    case "EXERCISE":
      return { exerciseScheduleId: id };
    case "SCHEDULED_EVENT":
      return { scheduledEventId: id };
  }
}

// --- Today list layout ----------------------------------------------------------

/** The bits of a Today location group splitCompleted needs. */
export interface TaskGroupLike<T> {
  id: string;
  name: string;
  buildingName?: string | null;
  tasks: T[];
}

export interface SplitTasks<T> {
  /** Groups with completed tasks removed; groups left empty are dropped. */
  pending: Array<TaskGroupLike<T>>;
  /** Completed tasks, flattened out of their groups, source order preserved. */
  completed: Array<{ task: T; locationName: string }>;
}

/** The label the group header renders, reused as context on a detached row. */
export function groupLabel(group: { name: string; buildingName?: string | null }): string {
  return group.buildingName ? `${group.buildingName} · ${group.name}` : group.name;
}

/**
 * Splits already-slot-filtered Today groups into outstanding work (still grouped
 * by location) and a flat list of completed tasks for a single trailing section.
 *
 * Pure on purpose: the caller passes its own `isCompleted` predicate, which keeps
 * the optimistic-overlay logic in the screen and makes this unit-testable without
 * a simulator. Note that "completed" deliberately excludes *skipped* tasks — those
 * stay put next to their neighbours.
 */
export function splitCompleted<T>(
  groups: Array<TaskGroupLike<T>>,
  isCompleted: (task: T) => boolean,
): SplitTasks<T> {
  const pending: Array<TaskGroupLike<T>> = [];
  const completed: Array<{ task: T; locationName: string }> = [];

  for (const group of groups) {
    const locationName = groupLabel(group);
    const remaining: T[] = [];
    for (const task of group.tasks) {
      if (isCompleted(task)) completed.push({ task, locationName });
      else remaining.push(task);
    }
    if (remaining.length > 0) pending.push({ ...group, tasks: remaining });
  }

  return { pending, completed };
}
