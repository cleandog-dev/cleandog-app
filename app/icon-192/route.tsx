import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-static';
export const contentType = 'image/png';

export async function GET() {
  const logoData = await readFile(path.join(process.cwd(), 'public', 'logo.png'));
  const isPng = logoData[0] === 0x89 && logoData[1] === 0x50;
  const mime = isPng ? 'image/png' : 'image/jpeg';
  const base64 = `data:${mime};base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: '#ffffff',
          border: '8px solid #3D5A47',
          borderRadius: 43,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={base64} width={136} height={136} style={{ objectFit: 'contain' }} alt="" />
      </div>
    ),
    { width: 192, height: 192 },
  );
}
