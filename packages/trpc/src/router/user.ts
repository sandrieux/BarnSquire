import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, protectedProcedure } from "../trpc";

const SUPPORTED_LOCALES = ["en", "fr-CA", "fr-FR"] as const;

export const userRouter = router({
  setLocale: protectedProcedure
    .input(z.object({ locale: z.enum(SUPPORTED_LOCALES) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { locale: input.locale },
      });
      return { ok: true };
    }),

  // Used by the forced first-login password change and any self-service change.
  changePassword: protectedProcedure
    .input(z.object({ newPassword: z.string().min(8, "Password must be at least 8 characters") }))
    .mutation(async ({ ctx, input }) => {
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        // Bump tokenVersion so any outstanding mobile tokens are invalidated.
        data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
      });
      return { ok: true };
    }),
});
