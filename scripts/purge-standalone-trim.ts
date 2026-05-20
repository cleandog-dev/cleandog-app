import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const oldDog = await prisma.service.findUnique({ where: { name: 'Tosatura — Cane' } });
  const oldCat = await prisma.service.findUnique({ where: { name: 'Tosatura — Gatto' } });
  const newDog = await prisma.service.findUnique({ where: { name: 'Bagno + Tosatura — Cane' } });
  const newCat = await prisma.service.findUnique({ where: { name: 'Bagno + Tosatura — Gatto' } });

  if (oldDog && newDog) {
    const r = await prisma.booking.updateMany({
      where: { serviceId: oldDog.id },
      data: { serviceId: newDog.id },
    });
    console.log(`Reassigned ${r.count} dog bookings to "Bagno + Tosatura — Cane"`);
    await prisma.service.delete({ where: { id: oldDog.id } });
    console.log('Deleted: Tosatura — Cane');
  }

  if (oldCat) {
    await prisma.service.delete({ where: { id: oldCat.id } });
    console.log('Deleted: Tosatura — Gatto');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
