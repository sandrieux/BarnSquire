import { TRPCError } from "@trpc/server";

type Db = import("@barnsquire/db").PrismaClient;

const roleOrder = { CARETAKER: 0, BARN_MANAGER: 1, GLOBAL_ADMIN: 2 } as const;

// Read access to a single animal: any staff membership (CARETAKER+) on the
// animal's barn, OR an AnimalOwner link (read-only owner). Returns the animal.
export async function assertAnimalReadAccess(db: Db, userId: string, animalId: string) {
  const animal = await db.animal.findUnique({ where: { id: animalId } });
  if (!animal) throw new TRPCError({ code: "NOT_FOUND" });

  const membership = await db.barnMembership.findUnique({
    where: { userId_barnId: { userId, barnId: animal.barnId } },
  });
  if (membership && roleOrder[membership.role] >= roleOrder.CARETAKER) return animal;

  const owner = await db.animalOwner.findUnique({
    where: { userId_animalId: { userId, animalId } },
  });
  if (owner) return animal;

  throw new TRPCError({ code: "FORBIDDEN" });
}
