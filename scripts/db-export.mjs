// Full DB export via Prisma → single JSON snapshot.
// Used to migrate Neon → Supabase (and as a plain safety backup).
// Run: node scripts/db-export.mjs
import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// Export order is irrelevant; import order (see db-import.mjs) respects FKs.
const MODELS = [
  'user',
  'service',
  'breed',
  'breedSizeOption',
  'breedServicePrice',
  'setting',
  'openingHour',
  'closure',
  'extra',
  'booking',
  'pushSubscription',
  'notificationLog',
];

async function main() {
  const data = {};
  for (const m of MODELS) {
    data[m] = await prisma[m].findMany();
    console.log(`  ${m}: ${data[m].length}`);
  }

  const dir = path.join(process.cwd(), 'backup');
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `db-export-${stamp}.json`);
  // Date objects serialize to ISO strings; import parses them back.
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nSaved → ${file}`);
}

main()
  .catch((e) => {
    console.error('EXPORT_FAIL', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
