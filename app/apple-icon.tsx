import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

export default async function AppleIcon() {
  const logoData = await readFile(path.join(process.cwd(), 'public', 'logo.png'));
  const isPng = logoData[0] === 0x89 && logoData[1] === 0x50;
  const mime = isPng ? 'image/png' : 'image/jpeg';
  const base64 = `data:${mime};base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#3D5A47',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={base64} width={120} height={120} style={{ objectFit: 'contain' }} alt="" />
      </div>
    ),
    { width: 180, height: 180 },
  );
}
