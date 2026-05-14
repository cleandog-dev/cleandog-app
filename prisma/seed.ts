import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DOG_BREEDS_SEED, CAT_PRICE_SEED } from '../lib/breed-seed';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@cleandog.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'change-me-strong';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: passwordHash },
    create: {
      email: adminEmail,
      password: passwordHash,
      name: 'Admin',
      role: 'ADMIN',
    },
  });
  console.warn(`✓ Admin user ready: ${adminEmail}`);

  const services = [
    // ── Cane ──
    {
      name: 'Bagno — Cane',
      description: 'Bagno completo e asciugatura.',
      durationMin: 60,
      bufferMin: 0,
      priceCents: 0,
      size: null,
      forAnimal: 'DOG',
    },
    {
      name: 'Tosatura — Cane',
      description: 'Tosatura del pelo con macchinetta o forbici. Prezzo concordato in negozio.',
      durationMin: 45,
      bufferMin: 0,
      priceCents: 1000,
      priceCoatShortMinCents: 1000,
      priceCoatShortMaxCents: 2000,
      priceCoatLongMinCents: 1500,
      priceCoatLongMaxCents: 3000,
      size: null,
      forAnimal: 'DOG',
    },
    {
      name: 'Bagno + Tosatura — Cane',
      description: 'Bagno completo, asciugatura e tosatura. Prezzo finale concordato in negozio.',
      durationMin: 90,
      bufferMin: 0,
      priceCents: 0,
      priceCoatShortMinCents: 1000,
      priceCoatShortMaxCents: 2000,
      priceCoatLongMinCents: 1500,
      priceCoatLongMaxCents: 3000,
      size: null,
      forAnimal: 'DOG',
    },
    // ── Gatto ──
    {
      name: 'Bagno — Gatto',
      description: 'Bagno delicato e asciugatura.',
      durationMin: 45,
      bufferMin: 0,
      priceCents: 3000,
      size: null,
      forAnimal: 'CAT',
    },
    {
      name: 'Tosatura — Gatto',
      description: 'Tosatura igienica con macchinetta. A partire da 10 €.',
      durationMin: 30,
      bufferMin: 0,
      priceCents: 1000,
      size: null,
      forAnimal: 'CAT',
    },
    {
      name: 'Bagno + Tosatura — Gatto',
      description: 'Bagno delicato, asciugatura e tosatura.',
      durationMin: 60,
      bufferMin: 0,
      priceCents: 3000,
      size: null,
      forAnimal: 'CAT',
    },
  ];

  // Fix legacy mojibake names (one-shot cleanup from a botched PowerShell -replace)
  const renames: Array<[string, string]> = [
    ['Bagno â€" Cane', 'Bagno — Cane'],
    ['Tosatura â€" Cane', 'Tosatura — Cane'],
    ['Bagno + Tosatura â€" Cane', 'Bagno + Tosatura — Cane'],
    ['Bagno â€" Gatto', 'Bagno — Gatto'],
    ['Tosatura â€" Gatto', 'Tosatura — Gatto'],
    ['Bagno + Tosatura â€" Gatto', 'Bagno + Tosatura — Gatto'],
  ];
  for (const [oldName, newName] of renames) {
    const existing = await prisma.service.findUnique({ where: { name: oldName } });
    if (existing) {
      // If a clean record already exists, delete the corrupted one (its bookings move to the clean one)
      const clean = await prisma.service.findUnique({ where: { name: newName } });
      if (clean) {
        await prisma.booking.updateMany({
          where: { serviceId: existing.id },
          data: { serviceId: clean.id },
        });
        await prisma.service.delete({ where: { id: existing.id } });
      } else {
        await prisma.service.update({
          where: { id: existing.id },
          data: { name: newName },
        });
      }
      console.warn(`✓ Renamed/merged "${oldName}" → "${newName}"`);
    }
  }

  // Rimuovi servizi obsoleti (e relative prenotazioni test)
  const currentNames = services.map((s) => s.name);
  const oldServices = await prisma.service.findMany({
    where: { name: { notIn: currentNames } },
    select: { id: true },
  });
  if (oldServices.length > 0) {
    const oldIds = oldServices.map((s) => s.id);
    await prisma.booking.deleteMany({ where: { serviceId: { in: oldIds } } });
    const deleted = await prisma.service.deleteMany({ where: { id: { in: oldIds } } });
    console.warn(`✓ Rimossi ${deleted.count} servizi obsoleti`);
  }

  for (const s of services) {
    await prisma.service.upsert({
      where: { name: s.name },
      update: s,
      create: s,
    });
  }
  console.warn(`✓ ${services.length} services seeded`);

  // Mon–Fri 09:00–18:00, Sat 09:00–13:00, closed Sun
  const hours = [
    { dayOfWeek: 1, openMinute: 9 * 60, closeMinute: 18 * 60 },
    { dayOfWeek: 2, openMinute: 9 * 60, closeMinute: 18 * 60 },
    { dayOfWeek: 3, openMinute: 9 * 60, closeMinute: 18 * 60 },
    { dayOfWeek: 4, openMinute: 9 * 60, closeMinute: 18 * 60 },
    { dayOfWeek: 5, openMinute: 9 * 60, closeMinute: 18 * 60 },
    { dayOfWeek: 6, openMinute: 9 * 60, closeMinute: 13 * 60 },
  ];

  await prisma.openingHour.deleteMany();
  await prisma.openingHour.createMany({ data: hours });
  console.warn(`✓ Opening hours seeded`);

  // Breeds: seed if empty; if already present, only backfill coatType where NULL
  const breedCount = await prisma.breed.count();
  if (breedCount === 0) {
    const dogRows = DOG_BREEDS_SEED.map((b, i) => ({
      name: b.name,
      animalType: 'DOG',
      size: b.size,
      coatType: b.coatType ?? 'SHORT',
      priceMin: b.priceMin,
      priceMax: b.priceMax,
      sortOrder: i,
    }));
    await prisma.breed.createMany({ data: dogRows });
    await prisma.breed.create({
      data: {
        name: 'Gatto',
        animalType: 'CAT',
        size: null,
        priceMin: CAT_PRICE_SEED.min,
        priceMax: CAT_PRICE_SEED.max,
        sortOrder: 0,
      },
    });
    console.warn(`✓ ${dogRows.length + 1} breeds seeded`);
  } else {
    let backfilled = 0;
    for (const b of DOG_BREEDS_SEED) {
      const existing = await prisma.breed.findUnique({ where: { name: b.name } });
      if (existing && existing.coatType == null) {
        await prisma.breed.update({
          where: { id: existing.id },
          data: { coatType: b.coatType ?? 'SHORT' },
        });
        backfilled++;
      }
    }
    console.warn(`✓ Breeds present (${breedCount}); backfilled coatType on ${backfilled}`);
  }

  // Extras: seed only if empty (preserve admin edits)
  const extraCount = await prisma.extra.count();
  if (extraCount === 0) {
    await prisma.extra.createMany({
      data: [
        { name: 'Maschera',          priceCents: 200, dogOnly: false, sortOrder: 0 },
        { name: 'Cane aggressivo',   priceCents: 500, dogOnly: true,  sortOrder: 1 },
        { name: 'Extra sporco',      priceCents: 300, dogOnly: false, sortOrder: 2 },
      ],
    });
    console.warn(`✓ 3 extras seeded`);
  } else {
    console.warn(`✓ Extras already present (${extraCount}) — skipping`);
  }

  console.warn('\nSeed complete. Login: ' + adminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
