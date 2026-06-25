import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createScheduledEventSchema, updateScheduledEventSchema } from "@barnsquire/validators";

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

export const scheduledEventRouter = router({
  list: protectedProcedure
    .input(z.object({ barnId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "CARETAKER");
      return ctx.db.scheduledEvent.findMany({
        where: { barnId: input.barnId, isActive: true },
        orderBy: { startTime: "asc" },
      });
    }),

  create: protectedProcedure
    .input(createScheduledEventSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      return ctx.db.scheduledEvent.create({ data: input });
    }),

  update: protectedProcedure
    .input(updateScheduledEventSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.scheduledEvent.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, existing.barnId);
      return ctx.db.scheduledEvent.update({ where: { id }, data });
    }),

  deactivate: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.scheduledEvent.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, existing.barnId);
      return ctx.db.scheduledEvent.update({ where: { id: input.id }, data: { isActive: false } });
    }),
});
