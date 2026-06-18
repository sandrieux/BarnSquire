import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  createBuildingSchema,
  updateBuildingSchema,
  createStallSchema,
  updateStallSchema,
  createPastureSchema,
  updatePastureSchema,
} from "@barnsquire/validators";

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

export const locationRouter = router({
  // Buildings
  listBuildings: protectedProcedure
    .input(z.object({ barnId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "CARETAKER");
      return ctx.db.building.findMany({
        where: { barnId: input.barnId },
        include: {
          stalls: {
            include: {
              homeAnimals: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  createBuilding: protectedProcedure
    .input(createBuildingSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      return ctx.db.building.create({ data: input });
    }),

  updateBuilding: protectedProcedure
    .input(updateBuildingSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const building = await ctx.db.building.findUnique({ where: { id } });
      if (!building) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, building.barnId);
      return ctx.db.building.update({ where: { id }, data });
    }),

  deleteBuilding: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const building = await ctx.db.building.findUnique({
        where: { id: input.id },
        include: { stalls: { include: { homeAnimals: true } } },
      });
      if (!building) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, building.barnId);
      const hasAnimals = building.stalls.some((s) => s.homeAnimals.length > 0);
      if (hasAnimals) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Move all animals out first" });
      }
      return ctx.db.building.delete({ where: { id: input.id } });
    }),

  // Stalls
  listStalls: protectedProcedure
    .input(z.object({ buildingId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const building = await ctx.db.building.findUnique({ where: { id: input.buildingId } });
      if (!building) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, building.barnId, "CARETAKER");
      return ctx.db.stall.findMany({
        where: { buildingId: input.buildingId },
        include: { homeAnimals: { select: { id: true, name: true, profilePhotoId: true } } },
        orderBy: { name: "asc" },
      });
    }),

  createStall: protectedProcedure
    .input(createStallSchema)
    .mutation(async ({ ctx, input }) => {
      const building = await ctx.db.building.findUnique({ where: { id: input.buildingId } });
      if (!building) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, building.barnId);
      return ctx.db.stall.create({ data: input });
    }),

  updateStall: protectedProcedure
    .input(updateStallSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const stall = await ctx.db.stall.findUnique({
        where: { id },
        include: { building: true },
      });
      if (!stall) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, stall.building.barnId);
      return ctx.db.stall.update({ where: { id }, data });
    }),

  deleteStall: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const stall = await ctx.db.stall.findUnique({
        where: { id: input.id },
        include: { building: true, homeAnimals: true },
      });
      if (!stall) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, stall.building.barnId);
      if (stall.homeAnimals.length > 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Move all animals out first" });
      }
      return ctx.db.stall.delete({ where: { id: input.id } });
    }),

  // Pastures
  listPastures: protectedProcedure
    .input(z.object({ barnId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "CARETAKER");
      return ctx.db.pasture.findMany({
        where: { barnId: input.barnId },
        include: { homeAnimals: { select: { id: true, name: true, profilePhotoId: true } } },
        orderBy: { name: "asc" },
      });
    }),

  createPasture: protectedProcedure
    .input(createPastureSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      return ctx.db.pasture.create({ data: input });
    }),

  updatePasture: protectedProcedure
    .input(updatePastureSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const pasture = await ctx.db.pasture.findUnique({ where: { id } });
      if (!pasture) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, pasture.barnId);
      return ctx.db.pasture.update({ where: { id }, data });
    }),

  deletePasture: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const pasture = await ctx.db.pasture.findUnique({
        where: { id: input.id },
        include: { homeAnimals: true },
      });
      if (!pasture) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, pasture.barnId);
      if (pasture.homeAnimals.length > 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Move all animals out first" });
      }
      return ctx.db.pasture.delete({ where: { id: input.id } });
    }),

  // Capacity overview for a barn
  getCapacityStatus: protectedProcedure
    .input(z.object({ barnId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "CARETAKER");
      const [buildings, pastures] = await Promise.all([
        ctx.db.building.findMany({
          where: { barnId: input.barnId },
          include: {
            stalls: {
              include: { homeAnimals: { select: { id: true, name: true } } },
            },
          },
        }),
        ctx.db.pasture.findMany({
          where: { barnId: input.barnId },
          include: { homeAnimals: { select: { id: true, name: true } } },
        }),
      ]);

      return {
        buildings: buildings.map((b) => ({
          ...b,
          stalls: b.stalls.map((s) => ({
            ...s,
            occupancy: s.homeAnimals.length,
            isFull: s.homeAnimals.length >= s.maxCapacity,
          })),
        })),
        pastures: pastures.map((p) => ({
          ...p,
          occupancy: p.homeAnimals.length,
          isFull: p.homeAnimals.length >= p.maxCapacity,
        })),
      };
    }),
});
