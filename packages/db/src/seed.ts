import { db } from "./index";
import bcrypt from "bcryptjs";

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];
const START = new Date("2024-01-01"); // schedules active well before "today"

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await db.user.upsert({
    where: { email: "admin@barnsquire.com" },
    update: {},
    create: {
      email: "admin@barnsquire.com",
      name: "Admin User",
      passwordHash,
      // Force a password change on first login so the well-known default
      // ("password123") can't persist in a real deployment.
      mustChangePassword: true,
      // The only system-wide superuser. Per-barn GLOBAL_ADMIN memberships no
      // longer confer this — it must be granted explicitly on the User row.
      isSystemAdmin: true,
    },
  });

  // Find an existing seeded barn by name (ids are auto-generated cuids so they
  // pass the routers' cuid validation), otherwise create one.
  let barn = await db.barn.findFirst({ where: { name: "Horse Kingdom" } });
  if (!barn) {
    barn = await db.barn.create({
      data: {
        name: "Horse Kingdom",
        address: "123 Barn Lane, Countryside, USA",
        timezone: "America/New_York",
      },
    });
  }

  await db.barnMembership.upsert({
    where: { userId_barnId: { userId: admin.id, barnId: barn.id } },
    update: {},
    create: { userId: admin.id, barnId: barn.id, role: "GLOBAL_ADMIN" },
  });

  await seedTestData(barn.id, admin.id);

  console.log("Seed complete:", { admin: admin.email, barn: barn.name, barnId: barn.id });
}

// Idempotent sample data: locations, animals, feeding/medication schedules across
// all slots, a couple of barn chores, feed stock (one item low), and a ledger or
// two. Named lookups make re-seeding safe (no duplicates).
async function seedTestData(barnId: string, userId: string) {
  const building =
    (await db.building.findFirst({ where: { barnId, name: "Main Barn" } })) ??
    (await db.building.create({ data: { barnId, name: "Main Barn" } }));

  async function ensureStall(name: string) {
    return (
      (await db.stall.findFirst({ where: { buildingId: building.id, name } })) ??
      (await db.stall.create({ data: { buildingId: building.id, name } }))
    );
  }
  const stall1 = await ensureStall("Stall 1");
  const stall2 = await ensureStall("Stall 2");
  const stall3 = await ensureStall("Stall 3");

  const pasture =
    (await db.pasture.findFirst({ where: { barnId, name: "North Pasture" } })) ??
    (await db.pasture.create({ data: { barnId, name: "North Pasture", acreage: 4 } }));

  async function ensureAnimal(data: {
    name: string;
    species: string;
    breed: string;
    size: "MINI" | "SMALL" | "MEDIUM" | "LARGE" | "DRAFT";
    homeStallId?: string;
    homePastureId?: string;
  }) {
    const existing = await db.animal.findFirst({ where: { barnId, name: data.name } });
    if (existing) return existing;
    return db.animal.create({ data: { barnId, ...data } });
  }

  const thunder = await ensureAnimal({
    name: "Thunder", species: "Horse", breed: "Quarter Horse", size: "LARGE", homeStallId: stall1.id,
  });
  const bella = await ensureAnimal({
    name: "Bella", species: "Horse", breed: "Arabian", size: "MEDIUM", homeStallId: stall2.id,
  });
  const cocoa = await ensureAnimal({
    name: "Cocoa", species: "Pony", breed: "Shetland", size: "SMALL", homeStallId: stall3.id,
  });
  const willow = await ensureAnimal({
    name: "Willow", species: "Horse", breed: "Thoroughbred", size: "LARGE", homePastureId: pasture.id,
  });

  // Feeding + medication schedules. slot is MORNING/LUNCH/EVENING; an "afternoon"
  // task comes from a CUSTOM time in the 13:00–18:00 window (see timeToSlot).
  type Feed = {
    feedType: string; quantity: string; unit?: string;
    slot: "MORNING" | "LUNCH" | "EVENING" | "CUSTOM";
    customTime?: string; isMedication?: boolean; instructions?: string;
  };
  async function ensureFeeding(animalId: string, feeds: Feed[]) {
    if ((await db.feedingSchedule.count({ where: { animalId } })) > 0) return;
    await db.feedingSchedule.createMany({
      data: feeds.map((f) => ({
        animalId, feedType: f.feedType, quantity: f.quantity, unit: f.unit ?? null,
        slot: f.slot, customTime: f.customTime ?? null, instructions: f.instructions ?? null,
        isMedication: f.isMedication ?? false, startDate: START, repeatDays: EVERY_DAY,
      })),
    });
  }

  await ensureFeeding(thunder.id, [
    { feedType: "Timothy Hay", quantity: "2", unit: "flakes", slot: "MORNING" },
    { feedType: "Bute", quantity: "1", unit: "tab", slot: "MORNING", isMedication: true, instructions: "With morning feed" },
    { feedType: "Grain", quantity: "1", unit: "scoop", slot: "EVENING" },
  ]);
  await ensureFeeding(bella.id, [
    { feedType: "Timothy Hay", quantity: "1.5", unit: "flakes", slot: "MORNING" },
    { feedType: "Alfalfa", quantity: "1", unit: "flake", slot: "LUNCH" },
    { feedType: "Grain", quantity: "0.5", unit: "scoop", slot: "EVENING" },
  ]);
  await ensureFeeding(cocoa.id, [
    { feedType: "Timothy Hay", quantity: "1", unit: "flake", slot: "MORNING" },
    { feedType: "Pony Pellets", quantity: "1", unit: "cup", slot: "EVENING" },
  ]);
  await ensureFeeding(willow.id, [
    { feedType: "Beet Pulp", quantity: "2", unit: "lbs", slot: "MORNING", instructions: "Soak 20 min first" },
    { feedType: "Grain", quantity: "1", unit: "scoop", slot: "CUSTOM", customTime: "14:00" },
    { feedType: "Timothy Hay", quantity: "2", unit: "flakes", slot: "EVENING" },
  ]);

  // Barn chores (surface on Today's "Barn" group + the Schedule tab).
  async function ensureEvent(title: string, startTime: string, endTime?: string) {
    const existing = await db.scheduledEvent.findFirst({ where: { barnId, title } });
    if (existing) return;
    await db.scheduledEvent.create({
      data: { barnId, title, startTime, endTime: endTime ?? null, repeatDays: EVERY_DAY },
    });
  }
  await ensureEvent("Muck stalls", "07:00", "08:00");
  await ensureEvent("Refill water troughs", "16:00");

  // Feed stock. Grain is intentionally low (≈2 days vs 3-day threshold) so the
  // low-feed banner and Today refill reminder show.
  const stock: Array<{ feedType: string; unit: string; servingsRemaining: number }> = [
    { feedType: "Timothy Hay", unit: "flakes", servingsRemaining: 60 },
    { feedType: "Grain", unit: "scoop", servingsRemaining: 5 },
    { feedType: "Alfalfa", unit: "flake", servingsRemaining: 20 },
    { feedType: "Beet Pulp", unit: "lbs", servingsRemaining: 24 },
    { feedType: "Pony Pellets", unit: "cup", servingsRemaining: 15 },
  ];
  for (const s of stock) {
    await db.feedStock.upsert({
      where: { barnId_feedType: { barnId, feedType: s.feedType } },
      update: {},
      create: { barnId, feedType: s.feedType, unit: s.unit, servingsRemaining: s.servingsRemaining, asOfDate: new Date() },
    });
  }

  // A couple of ledger entries for Thunder.
  if ((await db.ledgerEntry.count({ where: { animalId: thunder.id } })) === 0) {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
    await db.ledgerEntry.createMany({
      data: [
        { animalId: thunder.id, category: "MEDICATION", title: "Dewormed (ivermectin)", notes: "Routine spring deworming.", occurredAt: daysAgo(5), createdByUserId: userId },
        { animalId: thunder.id, category: "ACTIVITY", title: "Farrier visit", notes: "New shoes all around; feet in good shape.", occurredAt: daysAgo(2), createdByUserId: userId },
      ],
    });
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
