import { z } from "zod";

export const createBuildingSchema = z.object({
  barnId: z.string().cuid(),
  name: z.string().min(1).max(100),
  notes: z.string().max(500).optional(),
});

export const updateBuildingSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const createStallSchema = z.object({
  buildingId: z.string().cuid(),
  name: z.string().min(1).max(100),
  type: z.enum(["STANDARD", "PANIC"]).default("STANDARD"),
  maxCapacity: z.number().int().min(1).max(50).default(1),
  notes: z.string().max(500).optional(),
});

export const updateStallSchema = createStallSchema.omit({ buildingId: true }).partial().extend({
  id: z.string().cuid(),
});

export const createPastureSchema = z.object({
  barnId: z.string().cuid(),
  name: z.string().min(1).max(100),
  maxCapacity: z.number().int().min(1).max(500).default(10),
  acreage: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

export const updatePastureSchema = createPastureSchema.omit({ barnId: true }).partial().extend({
  id: z.string().cuid(),
});

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type CreateStallInput = z.infer<typeof createStallSchema>;
export type CreatePastureInput = z.infer<typeof createPastureSchema>;
