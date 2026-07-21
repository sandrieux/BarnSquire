import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import type { Context, AuthenticatedContext } from "./context";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// A user flagged mustChangePassword may only read and change their own
// password until it is cleared. Enforced here (not just via the web redirect)
// so direct tRPC/mobile calls can't operate the app with a temporary password.
function assertPasswordChanged(
  ctx: Context,
  type: "query" | "mutation" | "subscription",
  path: string,
) {
  if (ctx.mustChangePassword && type === "mutation" && path !== "user.changePassword") {
    throw new TRPCError({ code: "FORBIDDEN", message: "PASSWORD_CHANGE_REQUIRED" });
  }
}

const enforceAuth = t.middleware(({ ctx, next, type, path }) => {
  const userId = ctx.session?.user?.id;
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  assertPasswordChanged(ctx, type, path);
  return next({
    ctx: {
      ...ctx,
      session: {
        user: {
          id: userId,
          name: ctx.session?.user?.name,
          email: ctx.session?.user?.email,
        },
      },
    } satisfies AuthenticatedContext,
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

const enforceGlobalAdmin = t.middleware(({ ctx, next, type, path }) => {
  const userId = ctx.session?.user?.id;
  if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!ctx.isGlobalAdmin) throw new TRPCError({ code: "FORBIDDEN" });
  assertPasswordChanged(ctx, type, path);
  return next({
    ctx: {
      ...ctx,
      session: {
        user: {
          id: userId,
          name: ctx.session?.user?.name,
          email: ctx.session?.user?.email,
        },
      },
    } satisfies AuthenticatedContext,
  });
});

export const adminProcedure = t.procedure.use(enforceGlobalAdmin);
