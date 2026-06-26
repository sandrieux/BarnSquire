import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createFeedingScheduleSchema, updateFeedingScheduleSchema } from "@barnsquire/validators";
import { assertAnimalReadAccess } from "../access";

async function assertAnimalAccess(
  db: import("@barnsquire/db").PrismaClient,
  userId: string,
  animalId: string,
  minRole: "CARETAKER" | "BARN_MANAGER" = "BARN_MANAGER"
) {
  const roleOrder = { CARETAKER: 0, BARN_MANAGER: 1, GLOBAL_ADMIN: 2 } as const;
  const animal = await db.animal.findUnique({ where: { id: animalId } });
  if (!animal) throw new TRPCError({ code: "NOT_FOUND" });
  const membership = await db.barnMembership.findUnique({
    where: { userId_barnId: { userId, barnId: animal.barnId } },
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
  if (roleOrder[membership.role] < roleOrder[minRole]) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return animal;
}

export function expandScheduleForDate(
  schedule: { startDate: Date; endDate: Date | null; repeatDays: number[] },
  date: Date
): boolean {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const start = new Date(schedule.startDate);
  start.setHours(0, 0, 0, 0);
  if (d < start) return false;
  if (schedule.endDate) {
    const end = new Date(schedule.endDate);
    end.setHours(0, 0, 0, 0);
    if (d > end) return false;
  }
  // ISO weekday: 1=Monday ... 7=Sunday
  const isoDay = d.getDay() === 0 ? 7 : d.getDay();
  return schedule.repeatDays.includes(isoDay);
}

export const feedingRouter = router({
  list: protectedProcedure
    .input(z.object({ animalId: z.string().cuid(), activeOnly: z.boolean().default(true) }))
    .query(async ({ ctx, input }) => {
      await assertAnimalReadAccess(ctx.db, ctx.session.user.id, input.animalId);
      return ctx.db.feedingSchedule.findMany({
        where: { animalId: input.animalId, isActive: input.activeOnly ? true : undefined },
        orderBy: [{ slot: "asc" }, { feedType: "asc" }],
      });
    }),

  create: protectedProcedure
    .input(createFeedingScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      await assertAnimalAccess(ctx.db, ctx.session.user.id, input.animalId);
      return ctx.db.feedingSchedule.create({ data: input });
    }),

  update: protectedProcedure
    .input(updateFeedingScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const schedule = await ctx.db.feedingSchedule.findUnique({ where: { id } });
      if (!schedule) throw new TRPCError({ code: "NOT_FOUND" });
      await assertAnimalAccess(ctx.db, ctx.session.user.id, schedule.animalId);
      return ctx.db.feedingSchedule.update({ where: { id }, data });
    }),

  deactivate: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const schedule = await ctx.db.feedingSchedule.findUnique({ where: { id: input.id } });
      if (!schedule) throw new TRPCError({ code: "NOT_FOUND" });
      await assertAnimalAccess(ctx.db, ctx.session.user.id, schedule.animalId);
      return ctx.db.feedingSchedule.update({
        where: { id: input.id },
        data: { isActive: false, endDate: new Date() },
      });
    }),

  getForDate: protectedProcedure
    .input(z.object({ barnId: z.string().cuid(), date: z.string().date() }))
    .query(async ({ ctx, input }) => {
      const membership = await ctx.db.barnMembership.findUnique({
        where: { userId_barnId: { userId: ctx.session.user.id, barnId: input.barnId } },
      });
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      const targetDate = new Date(input.date);
      const schedules = await ctx.db.feedingSchedule.findMany({
        where: {
          isActive: true,
          animal: { barnId: input.barnId, isActive: true },
          startDate: { lte: targetDate },
          OR: [{ endDate: null }, { endDate: { gte: targetDate } }],
        },
        include: { animal: { include: { homeStall: true, homePasture: true } } },
      });

      return schedules.filter((s) =>
        expandScheduleForDate(
          { startDate: s.startDate, endDate: s.endDate, repeatDays: s.repeatDays },
          targetDate
        )
      );
    }),
});
