import { router, adminProcedure } from "../trpc";

export const adminRouter = router({
  listAllUsers: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      select: { id: true, name: true, email: true, createdAt: true, barnMemberships: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  listAllBarns: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.barn.findMany({
      include: { memberships: { include: { user: { select: { id: true, name: true, email: true } } } } },
      orderBy: { name: "asc" },
    });
  }),
});
