import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

async function assertBarnAccess(
  db: import("@barnsquire/db").PrismaClient,
  userId: string,
  barnId: string,
  minRole: "CARETAKER" | "BARN_MANAGER" | "GLOBAL_ADMIN" = "CARETAKER"
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

export const tagRouter = router({
  // Every taggable entity in a barn, in one call, for the QR-tag generator.
  // Read-only, CARETAKER+. Stalls reach their barn via building.barnId; pastures
  // and arenas have barnId directly; animals are the active ones only.
  listTargets: protectedProcedure
    .input(z.object({ barnId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "CARETAKER");

      const [barn, buildings, pastures, arenas, animals] = await Promise.all([
        ctx.db.barn.findUnique({
          where: { id: input.barnId },
          select: { id: true, name: true },
        }),
        ctx.db.building.findMany({
          where: { barnId: input.barnId },
          select: {
            id: true,
            name: true,
            stalls: { select: { id: true, name: true }, orderBy: { name: "asc" } },
          },
          orderBy: { name: "asc" },
        }),
        ctx.db.pasture.findMany({
          where: { barnId: input.barnId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        ctx.db.arena.findMany({
          where: { barnId: input.barnId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        ctx.db.animal.findMany({
          where: { barnId: input.barnId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
      ]);

      if (!barn) throw new TRPCError({ code: "NOT_FOUND" });

      const stalls = buildings.flatMap((b) =>
        b.stalls.map((s) => ({ id: s.id, name: s.name, buildingName: b.name }))
      );

      return {
        barn,
        buildings: buildings.map((b) => ({ id: b.id, name: b.name })),
        stalls,
        pastures,
        arenas,
        animals,
      };
    }),
});
