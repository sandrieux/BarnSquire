import { z } from "zod";

export const appointmentTypeEnum = z.enum([
  "VET", "FARRIER", "DENTAL", "CHIRO", "GROOMING", "OTHER",
]);

export const createAppointmentSchema = z.object({
  barnId: z.string().cuid(),
  animalId: z.string().cuid(),
  type: appointmentTypeEnum,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  scheduledAt: z.coerce.date(),
  durationMins: z.number().int().min(5).max(480).optional(),
  providerName: z.string().max(100).optional(),
  cost: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
});

export const updateAppointmentSchema = createAppointmentSchema
  .omit({ barnId: true, animalId: true })
  .partial()
  .extend({ id: z.string().cuid() });

export const createReminderSchema = z.object({
  animalId: z.string().cuid().optional(),
  barnId: z.string().cuid(),
  type: appointmentTypeEnum,
  title: z.string().min(1).max(200),
  repeatWeeks: z.number().int().min(1).max(52),
  nextRemindAt: z.coerce.date(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
