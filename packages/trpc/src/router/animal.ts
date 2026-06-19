import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createAnimalSchema, updateAnimalSchema, setHomeLocationSchema } from "@barnsquire/validators";
import { getPresignedViewUrl } from "../storage";

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

async function checkLocationCapacity(
  db: import("@barnsquire/db").PrismaClient,
  stallId: string | undefined,
  pastureId: string | undefined,
  excludeAnimalId?: string
) {
  if (stallId) {
    const stall = await db.stall.findUnique({
      where: { id: stallId },
      include: { homeAnimals: { where: { id: { not: excludeAnimalId } } } },
    });
    if (!stall) throw new TRPCError({ code: "NOT_FOUND", message: "Stall not found" });
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
    if (!pasture) throw new TRPCError({ code: "NOT_FOUND", message: "Pasture not found" });
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
      await assertBarnAccess(ctx.db, ctx.session.user.id, animal.barnId, "CARETAKER");
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
      await checkLocationCapacity(ctx.db, input.homeStallId, input.homePastureId);
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
});
