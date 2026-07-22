import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, protectedProcedure } from "../trpc";
import { createAnimalSchema, updateAnimalSchema, setHomeLocationSchema } from "@barnsquire/validators";
import { getPresignedViewUrl } from "../storage";
import { assertAnimalReadAccess } from "../access";

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

// `barnId` is the barn the animal belongs to; every referenced location must
// live in that same barn. Without this check a manager could point their
// animal's home location at another barn's stall/pasture (cross-tenant capacity
// DoS + name leak). A stall's barn is its building's barnId.
async function checkLocationCapacity(
  db: import("@barnsquire/db").PrismaClient,
  barnId: string,
  stallId: string | undefined,
  pastureId: string | undefined,
  excludeAnimalId?: string
) {
  if (stallId) {
    const stall = await db.stall.findUnique({
      where: { id: stallId },
      include: {
        building: { select: { barnId: true } },
        homeAnimals: { where: { id: { not: excludeAnimalId } } },
      },
    });
    if (!stall || stall.building.barnId !== barnId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Stall not found" });
    }
    if (stall.homeAnimals.length >= stall.maxCapacity) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Stall "${stall.name}" is at full capacity (${stall.maxCapacity})`,
      });
    }
  }
  if (pastureId) {
    const pasture = await db.pasture.findUnique({
      where: { id: pastureId },
      include: { homeAnimals: { where: { id: { not: excludeAnimalId } } } },
    });
    if (!pasture || pasture.barnId !== barnId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Pasture not found" });
    }
    if (pasture.homeAnimals.length >= pasture.maxCapacity) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Pasture "${pasture.name}" is at full capacity (${pasture.maxCapacity})`,
      });
    }
  }
}

export const animalRouter = router({
  list: protectedProcedure
    .input(z.object({
      barnId: z.string().cuid(),
      stallId: z.string().cuid().optional(),
      pastureId: z.string().cuid().optional(),
      activeOnly: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId, "CARETAKER");
      const animals = await ctx.db.animal.findMany({
        where: {
          barnId: input.barnId,
          isActive: input.activeOnly ? true : undefined,
          homeStallId: input.stallId,
          homePastureId: input.pastureId,
        },
        include: {
          homeStall: { include: { building: { select: { name: true } } } },
          homePasture: true,
        },
        orderBy: { name: "asc" },
      });

      // Resolve presigned thumbnail URLs for animals that have a profile photo.
      const photoIds = animals
        .map((a) => a.profilePhotoId)
        .filter((id): id is string => !!id);
      const photos = photoIds.length
        ? await ctx.db.mediaFile.findMany({ where: { id: { in: photoIds } } })
        : [];
      const keyById = new Map(photos.map((p) => [p.id, p.storageKey]));
      return Promise.all(
        animals.map(async (a) => ({
          ...a,
          profilePhotoUrl:
            a.profilePhotoId && keyById.has(a.profilePhotoId)
              ? await getPresignedViewUrl(keyById.get(a.profilePhotoId)!)
              : null,
        }))
      );
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const animal = await ctx.db.animal.findUnique({
        where: { id: input.id },
        include: {
          homeStall: { include: { building: { select: { id: true, name: true } } } },
          homePasture: true,
          mediaFiles: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      });
      if (!animal) throw new TRPCError({ code: "NOT_FOUND" });
      // Staff (CARETAKER+) or a read-only owner of this animal.
      await assertAnimalReadAccess(ctx.db, ctx.session.user.id, animal.id);
      const profilePhoto = animal.profilePhotoId
        ? animal.mediaFiles.find((m) => m.id === animal.profilePhotoId)
        : undefined;
      const profilePhotoUrl = profilePhoto
        ? await getPresignedViewUrl(profilePhoto.storageKey)
        : null;
      return { ...animal, profilePhotoUrl };
    }),

  create: protectedProcedure
    .input(createAnimalSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBarnAccess(ctx.db, ctx.session.user.id, input.barnId);
      await checkLocationCapacity(ctx.db, input.barnId, input.homeStallId, input.homePastureId);
      return ctx.db.animal.create({ data: input });
    }),

  update: protectedProcedure
    .input(updateAnimalSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const animal = await ctx.db.animal.findUnique({ where: { id } });
      if (!animal) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, animal.barnId);
      return ctx.db.animal.update({ where: { id }, data });
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const animal = await ctx.db.animal.findUnique({ where: { id: input.id } });
      if (!animal) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, animal.barnId);
      return ctx.db.animal.update({
        where: { id: input.id },
        data: { isActive: false, homeStallId: null, homePastureId: null },
      });
    }),

  setHomeLocation: protectedProcedure
    .input(setHomeLocationSchema)
    .mutation(async ({ ctx, input }) => {
      const animal = await ctx.db.animal.findUnique({ where: { id: input.animalId } });
      if (!animal) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, animal.barnId);
      await checkLocationCapacity(
        ctx.db,
        animal.barnId,
        input.homeStallId,
        input.homePastureId,
        animal.id
      );
      return ctx.db.animal.update({
        where: { id: input.animalId },
        data: {
          homeStallId: input.homeStallId ?? null,
          homePastureId: input.homePastureId ?? null,
        },
      });
    }),

  setProfilePhoto: protectedProcedure
    .input(z.object({ animalId: z.string().cuid(), mediaFileId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const animal = await ctx.db.animal.findUnique({ where: { id: input.animalId } });
      if (!animal) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, animal.barnId);
      return ctx.db.animal.update({
        where: { id: input.animalId },
        data: { profilePhotoId: input.mediaFileId },
      });
    }),

  // ─── Owners (read-only viewers assigned to a specific animal) ───────────────

  listOwners: protectedProcedure
    .input(z.object({ animalId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const animal = await ctx.db.animal.findUnique({ where: { id: input.animalId } });
      if (!animal) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, animal.barnId, "BARN_MANAGER");
      const owners = await ctx.db.animalOwner.findMany({
        where: { animalId: input.animalId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      });
      return owners.map((o) => o.user);
    }),

  addOwner: protectedProcedure
    .input(
      z.object({
        animalId: z.string().cuid(),
        email: z.string().email(),
        name: z.string().min(1).max(100).optional(),
        tempPassword: z.string().min(8).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const animal = await ctx.db.animal.findUnique({ where: { id: input.animalId } });
      if (!animal) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, animal.barnId, "BARN_MANAGER");

      let user = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (!user) {
        if (!input.name || !input.tempPassword) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "New owner needs a name and a temporary password",
          });
        }
        user = await ctx.db.user.create({
          data: {
            name: input.name,
            email: input.email,
            passwordHash: await bcrypt.hash(input.tempPassword, 12),
            mustChangePassword: true,
          },
        });
      }

      await ctx.db.animalOwner.upsert({
        where: { userId_animalId: { userId: user.id, animalId: input.animalId } },
        create: { userId: user.id, animalId: input.animalId },
        update: {},
      });
      return { id: user.id, name: user.name, email: user.email };
    }),

  removeOwner: protectedProcedure
    .input(z.object({ animalId: z.string().cuid(), userId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const animal = await ctx.db.animal.findUnique({ where: { id: input.animalId } });
      if (!animal) throw new TRPCError({ code: "NOT_FOUND" });
      await assertBarnAccess(ctx.db, ctx.session.user.id, animal.barnId, "BARN_MANAGER");
      await ctx.db.animalOwner.deleteMany({
        where: { animalId: input.animalId, userId: input.userId },
      });
      return { ok: true };
    }),
});
