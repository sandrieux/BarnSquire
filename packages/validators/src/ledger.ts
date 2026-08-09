import { z } from "zod";
import { heightUnitEnum, isValidHands, weightUnitEnum } from "./measurements";

// Single source of truth for ledger categories. Previously this list was
// re-declared in six places (Prisma enum, the router's output union, the router's
// inline z.enum, the web badge map + option list, and the mobile union + colour
// map); adding MEASUREMENT was the prompt to centralize it. The Prisma enum still
// has to be kept in sync by hand — it is the one declaration that can't import.
export const LEDGER_CATEGORIES = [
  "FEEDING",
  "MEDICATION",
  "ACTIVITY",
  "OTHER",
  "MEASUREMENT",
] as const;

export const ledgerCategoryEnum = z.enum(LEDGER_CATEGORIES);
export type LedgerCategory = z.infer<typeof ledgerCategoryEnum>;

// APPOINTMENT never exists as a stored LedgerEntry — the router synthesizes it
// when folding TaskCompletion history into the merged feed.
export const LEDGER_CATEGORIES_OUT = [...LEDGER_CATEGORIES, "APPOINTMENT"] as const;
export type LedgerCategoryOut = (typeof LEDGER_CATEGORIES_OUT)[number];

export const ALLOWED_ATTACHMENT_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;

const weightInput = z.object({
  value: z.number().positive().max(5000),
  unit: weightUnitEnum,
});

// Hands are validated here rather than at the DB, because "15.4hh" is not a
// typo the user can see — it looks like a number but means nothing.
const heightInput = z
  .object({
    value: z.number().positive().max(300),
    unit: heightUnitEnum,
  })
  .refine((h) => h.unit !== "HANDS" || isValidHands(h.value), {
    message: "Hands use whole hands plus 0-3 inches, e.g. 15.2 = 15 hands 2 inches",
  });

const ledgerEntryBaseObject = z.object({
  animalId: z.string().cuid(),
  category: ledgerCategoryEnum,
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  occurredAt: z.coerce.date(),
  weight: weightInput.optional(),
  height: heightInput.optional(),
  attachments: z
    .array(
      z.object({
        storageKey: z.string(),
        fileName: z.string().min(1),
        mimeType: z.string().refine((m) => ALLOWED_ATTACHMENT_MIME.includes(m as never)),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .max(10)
    .default([]),
});

const hasMeasurement = (d: { category: string; weight?: unknown; height?: unknown }) =>
  d.category !== "MEASUREMENT" || Boolean(d.weight || d.height);
const hasMeasurementMsg = {
  message: "A measurement entry needs a weight, a height, or both",
  path: ["weight"],
};

export const createLedgerEntrySchema = ledgerEntryBaseObject.refine(
  hasMeasurement,
  hasMeasurementMsg,
);

export type CreateLedgerEntryInput = z.infer<typeof createLedgerEntrySchema>;
