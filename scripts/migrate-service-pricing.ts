/**
 * One-shot migration:
 *  1. Mark existing "Bagno — Cane/Gatto" services as isDefault=true + pricingMode=PER_BREED
 *  2. Create standalone "Tosatura — Cane/Gatto" + "Spuntatina — Cane/Gatto" if missing
 *  3. Deactivate composite legacy services (Bagno + Tosatura, Bagno + Spuntatina)
 *  4. Populate BreedServicePrice from Breed legacy columns
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureService(opts: {
  name: string;
  forAnimal: 'DOG' | 'CAT';
  durationMin: number;
  isDefault: boolean;
}) {
  const existing = await prisma.service.findUnique({ where: { name: opts.name } });
  if (existing) {
    return prisma.service.update({
      where: { id: existing.id },
      data: {
        pricingMode: 'PER_BREED',
        breedScope: 'ALL',
        isDefault: opts.isDefault,
        active: true,
      },
    });
  }
  return prisma.service.create({
    data: {
      name: opts.name,
      forAnimal: opts.forAnimal,
      durationMin: opts.durationMin,
      priceCents: 0,
      pricingMode: 'PER_BREED',
      breedScope: 'ALL',
      isDefault: opts.isDefault,
      active: true,
    },
  });
}

async function main() {
  // 1+2. Ensure core services exist with new pricing model
  const bagnoDog   = await ensureService({ name: 'Bagno — Cane',     forAnimal: 'DOG', durationMin: 30, isDefault: true });
  const bagnoCat   = await ensureService({ name: 'Bagno — Gatto',    forAnimal: 'CAT', durationMin: 30, isDefault: true });
  const trimDog    = await ensureService({ name: 'Tosatura — Cane',  forAnimal: 'DOG', durationMin: 45, isDefault: false });
  const trimCat    = await ensureService({ name: 'Tosatura — Gatto', forAnimal: 'CAT', durationMin: 30, isDefault: false });
  const touchDog   = await ensureService({ name: 'Spuntatina — Cane', forAnimal: 'DOG', durationMin: 30, isDefault: false });
  const touchCat   = await ensureService({ name: 'Spuntatina — Gatto', forAnimal: 'CAT', durationMin: 30, isDefault: false });

  console.log('Core services ready:');
  console.log(' ', bagnoDog.name, bagnoCat.name);
  console.log(' ', trimDog.name, trimCat.name);
  console.log(' ', touchDog.name, touchCat.name);

  // 3. Deactivate composite legacy services
  const legacy = await prisma.service.updateMany({
    where: {
      name: {
        in: [
          'Bagno + Tosatura — Cane',
          'Bagno + Tosatura — Gatto',
          'Bagno + Spuntatina — Cane',
          'Bagno + Spuntatina — Gatto',
        ],
      },
      active: true,
    },
    data: { active: false },
  });
  console.log(`Deactivated ${legacy.count} composite legacy services`);

  // 4. Populate BreedServicePrice from legacy Breed columns
  const breeds = await prisma.breed.findMany();
  let created = 0;
  let skipped = 0;
  for (const b of breeds) {
    const bath = b.animalType === 'DOG' ? bagnoDog : bagnoCat;
    const trim = b.animalType === 'DOG' ? trimDog : trimCat;
    const touch = b.animalType === 'DOG' ? touchDog : touchCat;

    // Bagno — from priceMin
    const bathExisting = await prisma.breedServicePrice.findFirst({
      where: { breedId: b.id, serviceId: bath.id, sizeOptionId: null, coat: null },
    });
    if (!bathExisting) {
      await prisma.breedServicePrice.create({
        data: {
          breedId: b.id,
          serviceId: bath.id,
          priceCents: b.priceMin > 0 ? b.priceMin * 100 : null,
          active: true,
        },
      });
      created++;
    } else skipped++;

    // Tosatura — from priceTrim (+ priceTrimLong for MIXED)
    const trimExisting = await prisma.breedServicePrice.findFirst({
      where: { breedId: b.id, serviceId: trim.id, sizeOptionId: null, coat: null },
    });
    if (!trimExisting) {
      await prisma.breedServicePrice.create({
        data: {
          breedId: b.id,
          serviceId: trim.id,
          priceCents: b.priceTrim != null && b.priceTrim > 0 ? b.priceTrim * 100 : null,
          priceLongCents: b.priceTrimLong != null && b.priceTrimLong > 0 ? b.priceTrimLong * 100 : null,
          active: true,
        },
      });
      created++;
    } else skipped++;

    // Spuntatina — from priceTouchUp
    const touchExisting = await prisma.breedServicePrice.findFirst({
      where: { breedId: b.id, serviceId: touch.id, sizeOptionId: null, coat: null },
    });
    if (!touchExisting) {
      await prisma.breedServicePrice.create({
        data: {
          breedId: b.id,
          serviceId: touch.id,
          priceCents: b.priceTouchUp != null && b.priceTouchUp > 0 ? b.priceTouchUp * 100 : null,
          active: true,
        },
      });
      created++;
    } else skipped++;
  }
  console.log(`BreedServicePrice: ${created} created, ${skipped} already existed`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
