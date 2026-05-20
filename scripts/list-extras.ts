import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const list = await prisma.extra.findMany();
  console.log(JSON.stringify(list, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
