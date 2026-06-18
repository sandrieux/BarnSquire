import { z } from "zod";

export const animalSizeEnum = z.enum(["MINI", "SMALL", "MEDIUM", "LARGE", "DRAFT"]);

const animalBaseObject = z.object({
  barnId: z.string().cuid(),
  name: z.string().min(1).max(100),
  species: z.string().default("horse"),
  breed: z.string().max(100).optional(),
  size: animalSizeEnum.default("MEDIUM"),
  birthDate: z.coerce.date().optional(),
  color: z.string().max(100).optional(),
  markings: z.string().max(500).optional(),
  microchipId: z.string().max(50).optional(),
  registrationId: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  homeStallId: z.string().cuid().optional(),
  homePastureId: z.string().cuid().optional(),
});

const singleHomeLocation = (d: { homeStallId?: string; homePastureId?: string }) =>
  !(d.homeStallId && d.homePastureId);
const singleHomeMsg = { message: "An animal can only have one home location" };

export const createAnimalSchema = animalBaseObject.refine(singleHomeLocation, singleHomeMsg);

export const updateAnimalSchema = animalBaseObject
  .omit({ barnId: true })
  .extend({ id: z.string().cuid() })
  .partial({ name: true, species: true, size: true })
  .refine(singleHomeLocation, singleHomeMsg);

export const setHomeLocationSchema = z
  .object({
    animalId: z.string().cuid(),
    homeStallId: z.string().cuid().optional(),
    homePastureId: z.string().cuid().optional(),
  })
  .refine(singleHomeLocation, singleHomeMsg);

export type CreateAnimalInput = z.infer<typeof createAnimalSchema>;
export type UpdateAnimalInput = z.infer<typeof updateAnimalSchema>;
export type SetHomeLocationInput = z.infer<typeof setHomeLocationSchema>;
