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
    addonServiceIds: url.searchParams.get('addonServiceIds') ?? undefined,
    date: url.searchParams.get('date'),
    breedName: url.searchParams.get('breedName') ?? undefined,
    sizeOptionId: url.searchParams.get('sizeOptionId') ?? undefined,
    coatChoice: url.searchParams.get('coatChoice') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  const addonIds = parsed.data.addonServiceIds
    ? parsed.data.addonServiceIds.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const slots = await getAvailableSlots({
    serviceId: parsed.data.serviceId,
    addonServiceIds: addonIds,
    date: parsed.data.date,
    breedName: parsed.data.breedName ?? null,
    sizeOptionId: parsed.data.sizeOptionId ?? null,
    coatChoice: parsed.data.coatChoice ?? null,
  });
  return NextResponse.json({ slots });
}
