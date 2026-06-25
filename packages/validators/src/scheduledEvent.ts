import { z } from "zod";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");

const scheduledEventBaseObject = z.object({
  barnId: z.string().cuid(),
  title: z.string().min(1).max(200),
  startTime: hhmm,
  endTime: hhmm.optional(),
  repeatDays: z.array(z.number().int().min(1).max(7)).min(1),
  notes: z.string().max(500).optional(),
});

const endAfterStart = (d: { startTime?: string; endTime?: string }) =>
  !d.startTime || !d.endTime || d.endTime > d.startTime;

export const createScheduledEventSchema = scheduledEventBaseObject.refine(endAfterStart, {
  message: "End time must be after start time",
});

export const updateScheduledEventSchema = scheduledEventBaseObject
  .omit({ barnId: true })
  .extend({ id: z.string().cuid() })
  .partial()
  .refine(endAfterStart, { message: "End time must be after start time" });

export type CreateScheduledEventInput = z.infer<typeof createScheduledEventSchema>;
