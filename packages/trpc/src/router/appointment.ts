import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createAppointmentSchema, updateAppointmentSchema, createReminderSchema } from "@barnsquire/validators";
import { assertAnimalReadAccess } from "../access";

async function assertBarnAccess(
  db: import("@barnsquire/db").PrismaClient,
  userId: string,
  barnId: string,
  minRole: "CARETAKER" | "BARN_MANAGER" = "BARN_MANAGER"
) {
  const roleOrder = { CARETAKER: 0, BARN_MANAGER: 1, GLOBAL_ADMIN: 2 } as const;
  const membership = await db.barnMembership.findUnique({
    where: { userId_barnId: { userId, barnId } },
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
  if (roleOrder[membership.role] < roleOrder[minRole]) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

export const appointmentRouter = router({
  list: protectedProcedure
    .input(z.object({
      barnId: z.string().cuid(),
      animalId: z.string().cuid().optional(),
      upcoming: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Per-animal listing is owner-readable; the barn-wide listing is staff-only.
      if (input.animalId) {
        await assertAnimalReadAccess(ctx.db, ctx.session.user.id, input.animalId);
      } else {
        await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "CARETAKER");
      }
      return ctx.db.appointment.findMany({
        where: {
          barnId: input.barnId,
          animalId: input.animalId,
          scheduledAt: input.upcoming ? { gte: new Date() } : undefined,
        },
        include: { animal: { select: { id: true, name: true } } },
        orderBy: { scheduledAt: "asc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const appt = await ctx.db.appointment.findUnique({
        where: { id: input.id },
        include: { animal: true, reminders: true },
      });
      if (!appt) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, appt.barnId, "CARETAKER");
      return appt;
    }),

  create: protectedProcedure
    .input(createAppointmentSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      const { cost, ...rest } = input;
      return ctx.db.appointment.create({
        data: { ...rest, cost: cost !== undefined ? cost.toString() : undefined },
      });
    }),

  update: protectedProcedure
    .input(updateAppointmentSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, cost, ...data } = input;
      const appt = await ctx.db.appointment.findUnique({ where: { id } });
      if (!appt) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, appt.barnId);
      return ctx.db.appointment.update({
        where: { id },
        data: { ...data, cost: cost !== undefined ? cost.toString() : undefined },
      });
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string().cuid(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const appt = await ctx.db.appointment.findUnique({ where: { id: input.id } });
      if (!appt) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, appt.barnId, "CARETAKER");
      return ctx.db.appointment.update({
        where: { id: input.id },
        data: { isCompleted: true, completedAt: new Date(), notes: input.notes },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const appt = await ctx.db.appointment.findUnique({ where: { id: input.id } });
      if (!appt) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, appt.barnId);
      return ctx.db.appointment.delete({ where: { id: input.id } });
    }),

  // Recurring reminders
  createReminder: protectedProcedure
    .input(createReminderSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      return ctx.db.appointmentReminder.create({ data: input });
    }),

  listReminders: protectedProcedure
    .input(z.object({ barnId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "CARETAKER");
      return ctx.db.appointmentReminder.findMany({
        where: { barnId: input.barnId, isActive: true },
        orderBy: { nextRemindAt: "asc" },
      });
    }),

  getDueReminders: protectedProcedure
    .input(z.object({ barnId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "CARETAKER");
      return ctx.db.appointmentReminder.findMany({
        where: {
          barnId: input.barnId,
          isActive: true,
          nextRemindAt: { lte: new Date() },
        },
        orderBy: { nextRemindAt: "asc" },
      });
    }),

  snoozeReminder: protectedProcedure
    .input(z.object({ id: z.string().cuid(), weeksToAdd: z.number().int().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const reminder = await ctx.db.appointmentReminder.findUnique({ where: { id: input.id } });
      if (!reminder) throw new TRPCError({ code: "NOT_FOUND" });
      if (reminder.barnId) {
        await assertBarnAccess(ctx.db, ctx.session.user.id, reminder.barnId);
      }
      const weeksToAdd = input.weeksToAdd ?? reminder.repeatWeeks;
      const nextRemindAt = new Date(reminder.nextRemindAt);
      nextRemindAt.setDate(nextRemindAt.getDate() + weeksToAdd * 7);
      return ctx.db.appointmentReminder.update({
        where: { id: input.id },
        data: { lastRemindedAt: new Date(), nextRemindAt },
      });
    }),

  deleteReminder: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const reminder = await ctx.db.appointmentReminder.findUnique({ where: { id: input.id } });
      if (!reminder) throw new TRPCError({ code: "NOT_FOUND" });
      if (reminder.barnId) {
        await assertBarnAccess(ctx.db, ctx.session.user.id, reminder.barnId);
      }
      return ctx.db.appointmentReminder.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),
});
