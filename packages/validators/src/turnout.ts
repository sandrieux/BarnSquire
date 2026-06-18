import { z } from "zod";

const turnoutBaseObject = z.object({
  animalId: z.string().cuid(),
  fromStallId: z.string().cuid().optional(),
  fromPastureId: z.string().cuid().optional(),
  toStallId: z.string().cuid().optional(),
  toPastureId: z.string().cuid().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  isRecurring: z.boolean().default(false),
  repeatDays: z.array(z.number().int().min(1).max(7)).default([]),
  notes: z.string().max(500).optional(),
});

export const createTurnoutEventSchema = turnoutBaseObject
  .refine(
    (d) => !(d.fromStallId && d.fromPastureId),
    { message: "Can only have one 'from' location" }
  )
  .refine(
    (d) => !(d.toStallId && d.toPastureId),
    { message: "Can only have one 'to' location" }
  )
  .refine(
    (d) => d.endTime > d.startTime,
    { message: "endTime must be after startTime" }
  );

export const updateTurnoutEventSchema = turnoutBaseObject
  .omit({ animalId: true })
  .extend({ id: z.string().cuid() })
  .partial()
  .refine(
    (d) => !(d.fromStallId && d.fromPastureId),
    { message: "Can only have one 'from' location" }
  )
  .refine(
    (d) => !(d.toStallId && d.toPastureId),
    { message: "Can only have one 'to' location" }
  );

export type CreateTurnoutEventInput = z.infer<typeof createTurnoutEventSchema>;
