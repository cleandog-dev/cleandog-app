import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const services = await prisma.service.findMany({
    where: { name: { in: ['Tosatura — Cane', 'Tosatura — Gatto'] } },
    select: { id: true, name: true, _count: { select: { bookings: true } } },
  });
  console.log(JSON.stringify(services, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
