import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createTurnoutEventSchema, updateTurnoutEventSchema } from "@barnsquire/validators";

async function assertAnimalBarnAccess(
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

async function checkTurnoutCapacity(
  db: import("@barnsquire/db").PrismaClient,
  toStallId: string | undefined,
  toPastureId: string | undefined,
  startTime: Date,
  endTime: Date,
  excludeEventId?: string
) {
  if (toStallId) {
    const stall = await db.stall.findUnique({ where: { id: toStallId } });
    if (!stall) throw new TRPCError({ code: "NOT_FOUND", message: "Target stall not found" });
    const overlapping = await db.turnoutEvent.count({
      where: {
        toStallId,
        isActive: true,
        id: excludeEventId ? { not: excludeEventId } : undefined,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    const homeCount = await db.animal.count({ where: { homeStallId: toStallId } });
    if (homeCount + overlapping >= stall.maxCapacity) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Stall "${stall.name}" will be at capacity during that time`,
      });
    }
  }
  if (toPastureId) {
    const pasture = await db.pasture.findUnique({ where: { id: toPastureId } });
    if (!pasture) throw new TRPCError({ code: "NOT_FOUND", message: "Target pasture not found" });
    const overlapping = await db.turnoutEvent.count({
      where: {
        toPastureId,
        isActive: true,
        id: excludeEventId ? { not: excludeEventId } : undefined,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    const homeCount = await db.animal.count({ where: { homePastureId: toPastureId } });
    if (homeCount + overlapping >= pasture.maxCapacity) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Pasture "${pasture.name}" will be at capacity during that time`,
      });
    }
  }
}

export const turnoutRouter = router({
  list: protectedProcedure
    .input(z.object({
      animalId: z.string().cuid().optional(),
      barnId: z.string().cuid().optional(),
      date: z.string().date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (input.barnId) {
        const membership = await ctx.db.barnMembership.findUnique({
          where: { userId_barnId: { userId: ctx.session.user.id, barnId: input.barnId } },
        });
        if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
      } else if (input.animalId) {
        await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, input.animalId, "CARETAKER");
      }

      let dateFilter = {};
      if (input.date) {
        const start = new Date(input.date);
        const end = new Date(input.date);
        end.setDate(end.getDate() + 1);
        dateFilter = { startTime: { gte: start, lt: end } };
      }

      return ctx.db.turnoutEvent.findMany({
        where: {
          animalId: input.animalId,
          isActive: true,
          ...(input.barnId ? { animal: { barnId: input.barnId } } : {}),
          ...dateFilter,
        },
        include: {
          animal: { select: { id: true, name: true } },
          fromStall: true,
          toStall: true,
          fromPasture: true,
          toPasture: true,
        },
        orderBy: { startTime: "asc" },
      });
    }),

  create: protectedProcedure
    .input(createTurnoutEventSchema)
    .mutation(async ({ ctx, input }) => {
      await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, input.animalId);
      await checkTurnoutCapacity(ctx.db, input.toStallId, input.toPastureId, input.startTime, input.endTime);
      return ctx.db.turnoutEvent.create({ data: input });
    }),

  update: protectedProcedure
    .input(updateTurnoutEventSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const event = await ctx.db.turnoutEvent.findUnique({ where: { id } });
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, event.animalId);
      if (data.toStallId || data.toPastureId) {
        await checkTurnoutCapacity(
          ctx.db,
          data.toStallId ?? undefined,
          data.toPastureId ?? undefined,
          data.startTime ?? event.startTime,
          data.endTime ?? event.endTime,
          id
        );
      }
      return ctx.db.turnoutEvent.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.turnoutEvent.findUnique({ where: { id: input.id } });
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, event.animalId);
      return ctx.db.turnoutEvent.update({ where: { id: input.id }, data: { isActive: false } });
    }),

  getConflicts: protectedProcedure
    .input(z.object({
      toStallId: z.string().cuid().optional(),
      toPastureId: z.string().cuid().optional(),
      startTime: z.coerce.date(),
      endTime: z.coerce.date(),
      excludeEventId: z.string().cuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conflicts: string[] = [];
      if (input.toStallId) {
        const stall = await ctx.db.stall.findUnique({
          where: { id: input.toStallId },
          include: { homeAnimals: true },
        });
        if (stall) {
          const overlapping = await ctx.db.turnoutEvent.count({
            where: {
              toStallId: input.toStallId,
              isActive: true,
              id: input.excludeEventId ? { not: input.excludeEventId } : undefined,
              startTime: { lt: input.endTime },
              endTime: { gt: input.startTime },
            },
          });
          const used = stall.homeAnimals.length + overlapping;
          if (used >= stall.maxCapacity) {
            conflicts.push(`Stall "${stall.name}" will be at capacity (${stall.maxCapacity})`);
          }
        }
      }
      if (input.toPastureId) {
        const pasture = await ctx.db.pasture.findUnique({
          where: { id: input.toPastureId },
          include: { homeAnimals: true },
        });
        if (pasture) {
          const overlapping = await ctx.db.turnoutEvent.count({
            where: {
              toPastureId: input.toPastureId,
              isActive: true,
              id: input.excludeEventId ? { not: input.excludeEventId } : undefined,
              startTime: { lt: input.endTime },
              endTime: { gt: input.startTime },
            },
          });
          const used = pasture.homeAnimals.length + overlapping;
          if (used >= pasture.maxCapacity) {
            conflicts.push(`Pasture "${pasture.name}" will be at capacity (${pasture.maxCapacity})`);
          }
        }
      }
      return { conflicts, hasConflicts: conflicts.length > 0 };
    }),
});
