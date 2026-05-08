const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  // Fix all complaints wrongly categorized as Roads that are clearly Water issues
  const waterKeywords = ['pipe', 'water', 'leak', 'drain', 'flood', 'sewage', 'burst'];

  const allRoads = await prisma.complaint.findMany({
    where: { category: 'Roads' },
    select: { id: true, title: true, description: true, category: true }
  });

  let fixed = 0;
  for (const c of allRoads) {
    const text = `${c.title} ${c.description}`.toLowerCase();
    if (waterKeywords.some(kw => text.includes(kw))) {
      await prisma.complaint.update({
        where: { id: c.id },
        data: { category: 'Water' }
      });
      console.log(`✅ Fixed: #${c.id} "${c.title}" → Water`);
      fixed++;
    }
  }

  if (fixed === 0) {
    // Fallback: update any complaint with "pipe" in title
    const result = await prisma.complaint.updateMany({
      where: { title: { contains: 'pipe', mode: 'insensitive' } },
      data: { category: 'Water' }
    });
    console.log(`✅ Updated by title: ${result.count} complaint(s) → Water`);
  } else {
    console.log(`\n✅ Done. Fixed ${fixed} complaint(s).`);
  }

  await prisma.$disconnect();
}

fix().catch(e => { console.error(e); process.exit(1); });
