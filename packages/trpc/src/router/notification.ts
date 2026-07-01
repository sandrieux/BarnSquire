import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

// Device (Expo push) token registration for the mobile app.
export const notificationRouter = router({
  registerDevice: protectedProcedure
    .input(z.object({ token: z.string().min(1), platform: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Token is globally unique; re-registering re-points it at the current user.
      await ctx.db.deviceToken.upsert({
        where: { token: input.token },
        create: { token: input.token, platform: input.platform, userId: ctx.session.user.id },
        update: { userId: ctx.session.user.id, platform: input.platform },
      });
      return { ok: true };
    }),

  unregisterDevice: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.deviceToken.deleteMany({
        where: { token: input.token, userId: ctx.session.user.id },
      });
      return { ok: true };
    }),
});
