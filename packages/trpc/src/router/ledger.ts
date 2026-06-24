import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { getPresignedUploadUrl, getPresignedViewUrl, deleteObject } from "../storage";

async function assertAnimalBarnAccess(
  db: import("@barnsquire/db").PrismaClient,
  userId: string,
  animalId: string,
  minRole: "CARETAKER" | "BARN_MANAGER" = "CARETAKER"
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

// pdf / jpg / png only, per the attachment requirement.
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];

type LedgerCategoryOut = "FEEDING" | "MEDICATION" | "ACTIVITY" | "OTHER" | "APPOINTMENT";

type LedgerItem = {
  id: string;
  source: "custom" | "history";
  category: LedgerCategoryOut;
  title: string;
  detail: string | null;
  notes: string | null;
  date: Date;
  status: "done" | "skipped" | null;
  attachments: Array<{ id: string; fileName: string; mimeType: string; url: string }>;
};

export const ledgerRouter = router({
  // Merged view: manual ledger entries + the Today completion history,
  // sorted most-recent first.
  getEntries: protectedProcedure
    .input(z.object({ animalId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, input.animalId, "CARETAKER");

      const [entries, completions] = await Promise.all([
        ctx.db.ledgerEntry.findMany({
          where: { animalId: input.animalId },
          include: { attachments: true },
          orderBy: { occurredAt: "desc" },
        }),
        ctx.db.taskCompletion.findMany({
          where: { animalId: input.animalId },
          include: {
            feedingSchedule: true,
            appointment: true,
            turnoutEvent: true,
            exerciseSchedule: true,
          },
          orderBy: { scheduledDate: "desc" },
          take: 250,
        }),
      ]);

      const customItems: LedgerItem[] = await Promise.all(
        entries.map(async (e) => ({
          id: e.id,
          source: "custom" as const,
          category: e.category as LedgerCategoryOut,
          title: e.title,
          detail: null,
          notes: e.notes,
          date: e.occurredAt,
          status: null,
          attachments: await Promise.all(
            e.attachments.map(async (a) => ({
              id: a.id,
              fileName: a.fileName,
              mimeType: a.mimeType,
              url: await getPresignedViewUrl(a.storageKey),
            }))
          ),
        }))
      );

      const historyItems: LedgerItem[] = completions.map((c) => {
        let category: LedgerCategoryOut = "ACTIVITY";
        let title = "Activity";
        let detail: string | null = null;

        if (c.feedingSchedule) {
          const f = c.feedingSchedule;
          category = f.isMedication ? "MEDICATION" : "FEEDING";
          title = `${f.slot}: ${f.feedType}`;
          detail = `${f.quantity}${f.unit ? " " + f.unit : ""}`;
        } else if (c.appointment) {
          category = "APPOINTMENT";
          title = `${c.appointment.type}: ${c.appointment.title}`;
          detail = c.appointment.providerName ?? null;
        } else if (c.turnoutEvent) {
          category = "ACTIVITY";
          title = "Turnout";
          detail = `${c.turnoutEvent.startTime}–${c.turnoutEvent.endTime}`;
        } else if (c.exerciseSchedule) {
          category = "ACTIVITY";
          title = c.exerciseSchedule.type;
          detail = c.exerciseSchedule.trainer ?? null;
        }

        return {
          id: c.id,
          source: "history" as const,
          category,
          title,
          detail,
          notes: c.notes,
          date: c.scheduledDate,
          status: c.skipped ? "skipped" : c.completedAt ? "done" : null,
          attachments: [],
        };
      });

      return [...customItems, ...historyItems].sort((a, b) => {
        const d = b.date.getTime() - a.date.getTime();
        return d !== 0 ? d : a.title.localeCompare(b.title);
      });
    }),

  // Presigned PUT URL for a single attachment; the browser uploads directly.
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        animalId: z.string().cuid(),
        fileName: z.string().min(1),
        mimeType: z.string().refine((m) => ALLOWED_MIME.includes(m), "Only PDF, JPG, or PNG"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, input.animalId, "CARETAKER");
      const ext = input.fileName.includes(".") ? input.fileName.split(".").pop() : "bin";
      const storageKey = `ledger/${input.animalId}/${crypto.randomUUID()}.${ext}`;
      const uploadUrl = await getPresignedUploadUrl(storageKey, input.mimeType);
      return { uploadUrl, storageKey };
    }),

  createEntry: protectedProcedure
    .input(
      z.object({
        animalId: z.string().cuid(),
        category: z.enum(["FEEDING", "MEDICATION", "ACTIVITY", "OTHER"]),
        title: z.string().min(1).max(200),
        notes: z.string().max(2000).optional(),
        occurredAt: z.coerce.date(),
        attachments: z
          .array(
            z.object({
              storageKey: z.string(),
              fileName: z.string().min(1),
              mimeType: z.string().refine((m) => ALLOWED_MIME.includes(m)),
              sizeBytes: z.number().int().positive(),
            })
          )
          .max(10)
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, input.animalId, "CARETAKER");
      return ctx.db.ledgerEntry.create({
        data: {
          animalId: input.animalId,
          category: input.category,
          title: input.title,
          notes: input.notes,
          occurredAt: input.occurredAt,
          createdByUserId: ctx.session.user.id,
          attachments: { create: input.attachments },
        },
      });
    }),

  deleteEntry: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.ledgerEntry.findUnique({
        where: { id: input.id },
        include: { attachments: true },
      });
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });
      await assertAnimalBarnAccess(ctx.db, ctx.session.user.id, entry.animalId, "BARN_MANAGER");
      // Best-effort cleanup of stored objects before removing the rows.
      await Promise.all(entry.attachments.map((a) => deleteObject(a.storageKey).catch(() => {})));
      await ctx.db.ledgerEntry.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
