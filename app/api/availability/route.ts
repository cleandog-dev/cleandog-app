import { NextResponse } from 'next/server';
import { SlotQuerySchema } from '@/lib/schema';
import { getAvailableSlots } from '@/lib/availability';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = rateLimit({ key: `avail:${ip}`, limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  const url = new URL(req.url);
  const parsed = SlotQuerySchema.safeParse({
    serviceId: url.searchParams.get('serviceId'),
    date: url.searchParams.get('date'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  const slots = await getAvailableSlots(parsed.data);
  return NextResponse.json({ slots });
}
