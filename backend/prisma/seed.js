const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding demo accounts...\n");

  const demoUsers = [
    {
      name: "Super Admin (Demo)",
      phone: "+910000000001",
      role: "SUPERADMIN",
      email: "superadmin@citifix.demo",
    },
    {
      name: "Sub Admin (Demo)",
      phone: "+910000000002",
      role: "SUBADMIN",
      email: "subadmin@citifix.demo",
      department: "ROADS",
    },
    {
      name: "Citizen (Demo)",
      phone: "+910000000003",
      role: "CITIZEN",
      email: "citizen@citifix.demo",
    },
  ];

  for (const userData of demoUsers) {
    const user = await prisma.user.upsert({
      where: { phone: userData.phone },
      update: {
        name: userData.name,
        role: userData.role,
        department: userData.department || null,
        email: userData.email,
      },
      create: {
        name: userData.name,
        phone: userData.phone,
        role: userData.role,
        email: userData.email,
        department: userData.department || null,
        rewardPoints: 0,
      },
    });

    console.log(`✅ ${userData.role.padEnd(12)} → Phone: ${userData.phone}  |  ID: ${user.id}  |  Name: ${user.name}`);
  }

  console.log("\n🔑 Demo OTP for all accounts: 123456");
  console.log("\n📋 Login Credentials:");
  console.log("─────────────────────────────────────────");
  console.log("  SUPERADMIN  │ Phone: 0000000001  │ OTP: 123456");
  console.log("  SUBADMIN    │ Phone: 0000000002  │ OTP: 123456");
  console.log("  CITIZEN     │ Phone: 0000000003  │ OTP: 123456");
  console.log("─────────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
