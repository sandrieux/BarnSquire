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
