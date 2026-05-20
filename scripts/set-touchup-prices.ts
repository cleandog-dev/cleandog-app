import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const small = await prisma.breed.updateMany({
    where: { size: 'SMALL' },
    data: { priceTouchUp: 5 },
  });
  const medium = await prisma.breed.updateMany({
    where: { size: 'MEDIUM' },
    data: { priceTouchUp: 10 },
  });
  const large = await prisma.breed.updateMany({
    where: { size: 'LARGE' },
    data: { priceTouchUp: 15 },
  });
  console.log(`SMALL: ${small.count}, MEDIUM: ${medium.count}, LARGE: ${large.count}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
