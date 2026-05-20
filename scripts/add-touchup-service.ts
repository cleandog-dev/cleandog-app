import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const items = [
    { name: 'Bagno + Spuntatina — Cane', forAnimal: 'DOG', durationMin: 75 },
    { name: 'Bagno + Spuntatina — Gatto', forAnimal: 'CAT', durationMin: 60 },
  ];
  for (const it of items) {
    const existing = await prisma.service.findUnique({ where: { name: it.name } });
    if (existing) {
      console.log(`SKIP (existe): ${it.name}`);
      continue;
    }
    await prisma.service.create({
      data: {
        name: it.name,
        description: 'Bagno + rifinitura leggera',
        durationMin: it.durationMin,
        priceCents: 0,
        forAnimal: it.forAnimal,
        active: true,
      },
    });
    console.log(`CREATED: ${it.name}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
