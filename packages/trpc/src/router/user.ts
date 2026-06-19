import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, protectedProcedure } from "../trpc";

export const userRouter = router({
  // Used by the forced first-login password change and any self-service change.
  changePassword: protectedProcedure
    .input(z.object({ newPassword: z.string().min(8, "Password must be at least 8 characters") }))
    .mutation(async ({ ctx, input }) => {
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { passwordHash, mustChangePassword: false },
      });
      return { ok: true };
    }),
});
