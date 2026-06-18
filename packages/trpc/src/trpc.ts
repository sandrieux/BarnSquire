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

const enforceAuth = t.middleware(({ ctx, next }) => {
  const userId = ctx.session?.user?.id;
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
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

const enforceGlobalAdmin = t.middleware(({ ctx, next }) => {
  const userId = ctx.session?.user?.id;
  if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!ctx.isGlobalAdmin) throw new TRPCError({ code: "FORBIDDEN" });
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
