import { z } from "zod";

export const EXERCISE_TYPES = [
  "RIDING",
  "LUNGEING",
  "GROUNDWORK",
  "TURNOUT_EXERCISE",
  "HAND_WALKING",
  "TREADMILL",
  "SWIMMING",
  "OTHER",
] as const;

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");

const exerciseBaseObject = z.object({
  animalId: z.string().cuid(),
  type: z.enum(EXERCISE_TYPES),
  trainer: z.string().max(100).optional(),
  locationArenaId: z.string().cuid().optional(),
  locationPastureId: z.string().cuid().optional(),
  startTime: hhmm,
  endTime: hhmm.optional(),
  repeatDays: z.array(z.number().int().min(1).max(7)).min(1),
  notes: z.string().max(500).optional(),
});

const oneLocation = (d: { locationArenaId?: string; locationPastureId?: string }) =>
  !(d.locationArenaId && d.locationPastureId);

const endAfterStart = (d: { startTime?: string; endTime?: string }) =>
  !d.startTime || !d.endTime || d.endTime > d.startTime;

export const createExerciseSchema = exerciseBaseObject
  .refine(endAfterStart, { message: "End time must be after start time" })
  .refine(oneLocation, { message: "Pick a single location" });

export const updateExerciseSchema = exerciseBaseObject
  .omit({ animalId: true })
  .extend({ id: z.string().cuid() })
  .partial()
  .refine(endAfterStart, { message: "End time must be after start time" })
  .refine(oneLocation, { message: "Pick a single location" });

export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
