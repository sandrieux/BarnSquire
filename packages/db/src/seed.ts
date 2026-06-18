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

  // Find an existing seeded barn by name (ids are auto-generated cuids so they
  // pass the routers' cuid validation), otherwise create one.
  let barn = await db.barn.findFirst({ where: { name: "Maple Ridge Farm" } });
  if (!barn) {
    barn = await db.barn.create({
      data: {
        name: "Maple Ridge Farm",
        address: "123 Barn Lane, Countryside, USA",
        timezone: "America/New_York",
      },
    });
  }

  await db.barnMembership.upsert({
    where: { userId_barnId: { userId: admin.id, barnId: barn.id } },
    update: {},
    create: {
      userId: admin.id,
      barnId: barn.id,
      role: "GLOBAL_ADMIN",
    },
  });

  console.log("Seed complete:", { admin: admin.email, barn: barn.name, barnId: barn.id });
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
