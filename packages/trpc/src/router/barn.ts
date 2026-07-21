import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import {
  createBarnSchema,
  updateBarnSchema,
  addMemberSchema,
  createMemberSchema,
  updateMemberRoleSchema,
  resetMemberPasswordSchema,
} from "@barnsquire/validators";

const ROLE_ORDER = { CARETAKER: 0, BARN_MANAGER: 1, GLOBAL_ADMIN: 2 } as const;

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
  return membership;
}

export const barnRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.barnMembership.findMany({
      where: { userId: ctx.session.user.id },
      include: { barn: true },
      orderBy: { barn: { name: "asc" } },
    });
    return memberships.map((m) => ({ ...m.barn, role: m.role }));
  }),

  get: protectedProcedure
    .input(z.object({ barnId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      const barn = await ctx.db.barn.findUnique({ where: { id: input.barnId } });
      if (!barn) throw new TRPCError({ code: "NOT_FOUND" });
      return barn;
    }),

  create: protectedProcedure
    .input(createBarnSchema)
    .mutation(async ({ ctx, input }) => {
      const barn = await ctx.db.barn.create({ data: input });
      await ctx.db.barnMembership.create({
        data: { userId: ctx.session.user.id, barnId: barn.id, role: "GLOBAL_ADMIN" },
      });
      return barn;
    }),

  update: protectedProcedure
    .input(updateBarnSchema.extend({ barnId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const { barnId, ...data } = input;
      await assertBarnAccess(ctx.db, ctx.session.user.id, barnId, "BARN_MANAGER");
      return ctx.db.barn.update({ where: { id: barnId }, data });
    }),

  delete: adminProcedure
    .input(z.object({ barnId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.barn.delete({ where: { id: input.barnId } });
    }),

  listMembers: protectedProcedure
    .input(z.object({ barnId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "BARN_MANAGER");
      return ctx.db.barnMembership.findMany({
        where: { barnId: input.barnId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { createdAt: "asc" },
      });
    }),

  addMember: protectedProcedure
    .input(addMemberSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "BARN_MANAGER");
      const user = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      const existing = await ctx.db.barnMembership.findUnique({
        where: { userId_barnId: { userId: user.id, barnId: input.barnId } },
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "User is already a member" });
      return ctx.db.barnMembership.create({
        data: { userId: user.id, barnId: input.barnId, role: input.role },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    }),

  // Create a brand-new user account with a temporary password and add them to
  // the barn. The user is forced to change the password on first sign-in.
  createMember: protectedProcedure
    .input(createMemberSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "BARN_MANAGER");
      const existing = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A user with that email already exists" });
      }
      const passwordHash = await bcrypt.hash(input.tempPassword, 12);
      const user = await ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          mustChangePassword: true,
        },
      });
      return ctx.db.barnMembership.create({
        data: { userId: user.id, barnId: input.barnId, role: input.role },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    }),

  updateMemberRole: protectedProcedure
    .input(updateMemberRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "BARN_MANAGER");
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change your own role" });
      }
      const target = await ctx.db.barnMembership.findUnique({
        where: { userId_barnId: { userId: input.userId, barnId: input.barnId } },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Not a member of this barn" });
      // Mirror removeMember/resetMemberPassword: a manager cannot act on a
      // higher-privileged member (e.g. demote the barn's GLOBAL_ADMIN owner),
      // nor grant a role above their own level.
      if (ROLE_ORDER[target.role] > ROLE_ORDER[actor.role]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot change a higher-privileged member" });
      }
      if (ROLE_ORDER[input.role] > ROLE_ORDER[actor.role]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot assign a role above your own" });
      }
      return ctx.db.barnMembership.update({
        where: { userId_barnId: { userId: input.userId, barnId: input.barnId } },
        data: { role: input.role },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ barnId: z.string().cuid(), userId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const actor = await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "BARN_MANAGER");
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove yourself" });
      }
      const target = await ctx.db.barnMembership.findUnique({
        where: { userId_barnId: { userId: input.userId, barnId: input.barnId } },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Not a member of this barn" });
      if (ROLE_ORDER[target.role] > ROLE_ORDER[actor.role]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot remove a higher-privileged member" });
      }
      return ctx.db.barnMembership.delete({
        where: { userId_barnId: { userId: input.userId, barnId: input.barnId } },
      });
    }),

  // Barn manager / admin sets a member's password, optionally forcing them to
  // change it at next sign-in.
  resetMemberPassword: protectedProcedure
    .input(resetMemberPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "BARN_MANAGER");
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use Change Password for your own account",
        });
      }
      const target = await ctx.db.barnMembership.findUnique({
        where: { userId_barnId: { userId: input.userId, barnId: input.barnId } },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Not a member of this barn" });
      if (ROLE_ORDER[target.role] > ROLE_ORDER[actor.role]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot reset a higher-privileged member" });
      }
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.user.update({
        where: { id: input.userId },
        // Bump tokenVersion so the target's outstanding mobile tokens are revoked
        // — this is the action taken to lock out a suspected attacker.
        data: {
          passwordHash,
          mustChangePassword: input.requireChange,
          tokenVersion: { increment: 1 },
        },
      });
      return { ok: true };
    }),
});
