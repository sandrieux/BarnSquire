import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { getPresignedUploadUrl, getPresignedViewUrl, deleteObject, headObject, MAX_UPLOAD_BYTES } from "../storage";

async function assertAnimalBarnAccess(
  db: import("@barnsquire/db").PrismaClient,
  userId: string,
  animalId: string,
  minRole: "CARETAKER" | "BARN_MANAGER" = "BARN_MANAGER"
) {
  const roleOrder = { CARETAKER: 0, BARN_MANAGER: 1, GLOBAL_ADMIN: 2 } as const;
  const animal = await db.animal.findUnique({ where: { id: animalId } });
  if (!animal) throw new TRPCError({ code: "NOT_FOUND" });
  const membership = await db.barnMembership.findUnique({
    where: { userId_barnId: { userId, barnId: animal.barnId } },
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
  if (roleOrder[membership.role] < roleOrder[minRole]) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return animal;
}

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];

export const mediaRouter = router({
  list: protectedProcedure
    .input(z.object({ animalId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, input.animalId, "CARETAKER");
      const files = await ctx.db.mediaFile.findMany({
        where: { animalId: input.animalId },
        orderBy: { createdAt: "desc" },
      });
      return Promise.all(
        files.map(async (f) => ({ ...f, url: await getPresignedViewUrl(f.storageKey) }))
      );
    }),

  // Step 1: client requests a presigned PUT URL and uploads the file directly.
  getUploadUrl: protectedProcedure
    .input(z.object({
      animalId: z.string().cuid(),
      fileName: z.string().min(1),
      mimeType: z.string().refine((m) => ALLOWED_MIME.includes(m), "Unsupported image type"),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, input.animalId);
      const ext = input.fileName.includes(".") ? input.fileName.split(".").pop() : "bin";
      const storageKey = `animals/${input.animalId}/${crypto.randomUUID()}.${ext}`;
      const uploadUrl = await getPresignedUploadUrl(storageKey, input.mimeType);
      return { uploadUrl, storageKey };
    }),

  // Step 2: client confirms the upload completed; we persist the record.
  // storageKey / mimeType / sizeBytes are NOT trusted from the client — the key
  // must match this animal's prefix, and the real size/type come from the object.
  confirmUpload: protectedProcedure
    .input(z.object({
      animalId: z.string().cuid(),
      storageKey: z.string(),
      caption: z.string().optional(),
      takenAt: z.coerce.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, input.animalId);
      // L4: only accept a key this animal's getUploadUrl could have issued —
      // otherwise a caller could register (and later read) another barn's object.
      if (!input.storageKey.startsWith(`animals/${input.animalId}/`)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid storage key" });
      }
      // L5: verify the actual object; reject oversize / wrong-type uploads.
      const head = await headObject(input.storageKey);
      if (!head) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload not found" });
      if (head.contentLength > MAX_UPLOAD_BYTES) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "File exceeds the size limit" });
      }
      if (!head.contentType || !ALLOWED_MIME.includes(head.contentType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported image type" });
      }
      return ctx.db.mediaFile.create({
        data: {
          animalId: input.animalId,
          storageKey: input.storageKey,
          mimeType: head.contentType,
          sizeBytes: head.contentLength,
          caption: input.caption,
          takenAt: input.takenAt,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.db.mediaFile.findUnique({ where: { id: input.id } });
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });
      await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, file.animalId);
      // Clear profile photo reference if it pointed here.
      await ctx.db.animal.updateMany({
        where: { id: file.animalId, profilePhotoId: file.id },
        data: { profilePhotoId: null },
      });
      await deleteObject(file.storageKey).catch(() => undefined);
      return ctx.db.mediaFile.delete({ where: { id: input.id } });
    }),
});
