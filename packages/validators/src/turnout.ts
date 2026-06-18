import { z } from "zod";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");

const turnoutBaseObject = z.object({
  animalId: z.string().cuid(),
  fromStallId: z.string().cuid().optional(),
  fromPastureId: z.string().cuid().optional(),
  toStallId: z.string().cuid().optional(),
  toPastureId: z.string().cuid().optional(),
  startTime: hhmm,
  endTime: hhmm,
  repeatDays: z.array(z.number().int().min(1).max(7)).min(1),
  notes: z.string().max(500).optional(),
});

const oneFrom = (d: { fromStallId?: string; fromPastureId?: string }) =>
  !(d.fromStallId && d.fromPastureId);
const oneTo = (d: { toStallId?: string; toPastureId?: string }) =>
  !(d.toStallId && d.toPastureId);
const endAfterStart = (d: { startTime?: string; endTime?: string }) =>
  !d.startTime || !d.endTime || d.endTime > d.startTime;

export const createTurnoutEventSchema = turnoutBaseObject
  .refine(oneFrom, { message: "Can only have one 'from' location" })
  .refine(oneTo, { message: "Can only have one 'to' location" })
  .refine(endAfterStart, { message: "End time must be after start time" });

export const updateTurnoutEventSchema = turnoutBaseObject
  .omit({ animalId: true })
  .extend({ id: z.string().cuid() })
  .partial()
  .refine(oneFrom, { message: "Can only have one 'from' location" })
  .refine(oneTo, { message: "Can only have one 'to' location" })
  .refine(endAfterStart, { message: "End time must be after start time" });

export type CreateTurnoutEventInput = z.infer<typeof createTurnoutEventSchema>;
