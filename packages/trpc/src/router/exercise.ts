import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createExerciseSchema, updateExerciseSchema } from "@barnsquire/validators";
import { assertAnimalReadAccess } from "../access";

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

// Reject an arena/pasture that lives in a different barn than the animal
// (cross-tenant reference: capacity/name leak). Only validates the ids present
// in `refs`; undefined ids are left unchanged.
async function assertExerciseLocationsInBarn(
  db: import("@barnsquire/db").PrismaClient,
  barnId: string,
  refs: { locationArenaId?: string | null; locationPastureId?: string | null }
) {
  if (refs.locationArenaId) {
    const arena = await db.arena.findUnique({ where: { id: refs.locationArenaId } });
    if (!arena || arena.barnId !== barnId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Arena not found" });
    }
  }
  if (refs.locationPastureId) {
    const pasture = await db.pasture.findUnique({ where: { id: refs.locationPastureId } });
    if (!pasture || pasture.barnId !== barnId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Pasture not found" });
    }
  }
}

export const exerciseRouter = router({
  list: protectedProcedure
    .input(z.object({ animalId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertAnimalReadAccess(ctx.db, ctx.session.user.id, input.animalId);
      return ctx.db.exerciseSchedule.findMany({
        where: { animalId: input.animalId, isActive: true },
        include: {
          locationArena: { select: { id: true, name: true } },
          locationPasture: { select: { id: true, name: true } },
        },
        orderBy: { startTime: "asc" },
      });
    }),

  create: protectedProcedure
    .input(createExerciseSchema)
    .mutation(async ({ ctx, input }) => {
      const animal = await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, input.animalId);
      await assertExerciseLocationsInBarn(ctx.db, animal.barnId, input);
      return ctx.db.exerciseSchedule.create({ data: input });
    }),

  update: protectedProcedure
    .input(updateExerciseSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.exerciseSchedule.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const animal = await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, existing.animalId);
      await assertExerciseLocationsInBarn(ctx.db, animal.barnId, data);
      return ctx.db.exerciseSchedule.update({ where: { id }, data });
    }),

  deactivate: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.exerciseSchedule.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, existing.animalId);
      return ctx.db.exerciseSchedule.update({ where: { id: input.id }, data: { isActive: false } });
    }),
});
