import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const list = await prisma.service.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, forAnimal: true, active: true, durationMin: true },
  });
  console.log(JSON.stringify(list, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
