import { z } from "zod";

export const createBarnSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(255).optional(),
  timezone: z.string().default("America/New_York"),
});

export const updateBarnSchema = createBarnSchema.partial();

export const addMemberSchema = z.object({
  barnId: z.string().cuid(),
  email: z.string().email(),
  role: z.enum(["BARN_MANAGER", "CARETAKER"]),
});

export const createMemberSchema = z.object({
  barnId: z.string().cuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  tempPassword: z.string().min(8, "Temporary password must be at least 8 characters"),
  role: z.enum(["BARN_MANAGER", "CARETAKER"]),
});

export const updateMemberRoleSchema = z.object({
  barnId: z.string().cuid(),
  userId: z.string().cuid(),
  role: z.enum(["BARN_MANAGER", "CARETAKER"]),
});

export const resetMemberPasswordSchema = z.object({
  barnId: z.string().cuid(),
  userId: z.string().cuid(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  requireChange: z.boolean().default(true),
});

export type CreateBarnInput = z.infer<typeof createBarnSchema>;
export type UpdateBarnInput = z.infer<typeof updateBarnSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
