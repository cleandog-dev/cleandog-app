// Import a db-export JSON snapshot into the DB pointed to by DATABASE_URL.
// Used to load Neon data into Supabase. Run with the TARGET DATABASE_URL set:
//   DATABASE_URL='<supabase>' node scripts/db-import.mjs [path-to-export.json]
import { PrismaClient } from '@prisma/client';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// FK-safe insert order: parents before children.
const ORDER = [
  'user',
  'service',
  'breed',
  'breedSizeOption', // → breed
  'breedServicePrice', // → breed, service, breedSizeOption
  'setting',
  'openingHour',
  'closure',
  'extra',
  'booking', // → service, breedSizeOption
  'pushSubscription', // → user
  'notificationLog', // → booking, pushSubscription
];

async function latestBackup() {
  const dir = path.join(process.cwd(), 'backup');
  const files = (await readdir(dir)).filter((f) => f.startsWith('db-export-') && f.endsWith('.json'));
  files.sort();
  return path.join(dir, files[files.length - 1]);
}

async function main() {
  const file = process.argv[2] || (await latestBackup());
  console.log(`Importing from: ${file}\n`);
  const data = JSON.parse(await readFile(file, 'utf8'));

  for (const model of ORDER) {
    const rows = data[model] ?? [];
    if (rows.length === 0) {
      console.log(`  ${model}: 0 (skip)`);
      continue;
    }
    const res = await prisma[model].createMany({ data: rows, skipDuplicates: true });
    console.log(`  ${model}: ${res.count}/${rows.length}`);
  }
  console.log('\nIMPORT_DONE');
}

main()
  .catch((e) => {
    console.error('IMPORT_FAIL', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
