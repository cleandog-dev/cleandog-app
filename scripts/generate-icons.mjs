// Generate PWA icons from public/logo.png
// Usage: npm i -D sharp && node scripts/generate-icons.mjs
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve('public/logo.png');
if (!existsSync(src)) {
  console.error('Missing public/logo.png. Save your logo there first.');
  process.exit(1);
}

const targets = [
  { out: 'public/icon-192.png', size: 192 },
  { out: 'public/icon-512.png', size: 512 },
  { out: 'public/apple-icon.png', size: 180 },
];

for (const t of targets) {
  await sharp(src)
    .resize(t.size, t.size, { fit: 'cover', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(t.out);
  console.log('✓', t.out);
}

// favicon.ico (32x32 PNG works in all modern browsers, named .ico)
await sharp(src).resize(32, 32).png().toFile('public/favicon.ico');
console.log('✓ public/favicon.ico');
