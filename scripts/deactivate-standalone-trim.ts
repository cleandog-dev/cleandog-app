import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targets = ['Tosatura — Cane', 'Tosatura — Gatto'];
  for (const name of targets) {
    const res = await prisma.service.updateMany({
      where: { name, active: true },
      data: { active: false },
    });
    console.log(`${name}: ${res.count > 0 ? 'DEACTIVATED' : 'noop'}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
