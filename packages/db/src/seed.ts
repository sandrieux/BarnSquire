import { db } from "./index";
import bcrypt from "bcryptjs";

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await db.user.upsert({
    where: { email: "admin@barnsquire.com" },
    update: {},
    create: {
      email: "admin@barnsquire.com",
      name: "Admin User",
      passwordHash,
    },
  });

  const barn = await db.barn.upsert({
    where: { id: "seed-barn-1" },
    update: {},
    create: {
      id: "seed-barn-1",
      name: "Maple Ridge Farm",
      address: "123 Barn Lane, Countryside, USA",
      timezone: "America/New_York",
    },
  });

  await db.barnMembership.upsert({
    where: { userId_barnId: { userId: admin.id, barnId: barn.id } },
    update: {},
    create: {
      userId: admin.id,
      barnId: barn.id,
      role: "GLOBAL_ADMIN",
    },
  });

  console.log("Seed complete:", { admin: admin.email, barn: barn.name });
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
