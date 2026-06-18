import { z } from "zod";

export const timeSlotEnum = z.enum(["MORNING", "LUNCH", "EVENING", "CUSTOM"]);

const feedingBaseObject = z.object({
  animalId: z.string().cuid(),
  feedType: z.string().min(1).max(100),
  quantity: z.string().min(1).max(50),
  unit: z.string().max(30).optional(),
  slot: timeSlotEnum,
  customTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  instructions: z.string().max(500).optional(),
  isMedication: z.boolean().default(false),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  repeatDays: z.array(z.number().int().min(1).max(7)).min(1).default([1, 2, 3, 4, 5, 6, 7]),
});

const customTimeRequired = (d: { slot?: string | null; customTime?: string | null }) =>
  !d.slot || d.slot !== "CUSTOM" || !!d.customTime;
const customTimeMsg = { message: "customTime is required when slot is CUSTOM" };

export const createFeedingScheduleSchema = feedingBaseObject.refine(customTimeRequired, customTimeMsg);

export const updateFeedingScheduleSchema = feedingBaseObject
  .omit({ animalId: true })
  .extend({ id: z.string().cuid() })
  .partial({ feedType: true, quantity: true, slot: true, startDate: true, repeatDays: true })
  .refine(customTimeRequired, customTimeMsg);

export type CreateFeedingScheduleInput = z.infer<typeof createFeedingScheduleSchema>;
