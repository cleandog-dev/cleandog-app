import { prisma } from '@/lib/db';

export type AddonItemSnapshot = {
  serviceId: string;
  name: string;
  priceCents: number;
};

export type PricedBooking = {
  bathCents: number | null;
  trimCents: number | null;
  touchUpCents: number | null;
  addonItems: AddonItemSnapshot[];
  primaryServiceCents: number;
  addonsTotalCents: number;
  /** sum primary + addons (before extras) */
  serviceTotalCents: number;
  /** sum primary + addons durations (minutes) resolved per cell when available */
  totalDurationMin: number;
};

/**
 * Compute price for a booking. New model:
 *  - Primary service (usually the default/bagno) priced via BreedServicePrice or Service.priceCents.
 *  - Each addon service priced same way.
 *  - Returns snapshot ready to store on Booking.
 */
export async function priceBooking(opts: {
  primaryServiceId: string;
  addonServiceIds?: string[];
  breedName: string | null | undefined;
  coatChoice?: 'SHORT' | 'LONG' | null;
  sizeOptionId?: string | null;
}): Promise<PricedBooking> {
  const addonIds = Array.from(new Set(opts.addonServiceIds ?? [])).filter(Boolean);
  const allIds = [opts.primaryServiceId, ...addonIds];

  const services = await prisma.service.findMany({
    where: { id: { in: allIds } },
  });
  const sById = new Map(services.map((s) => [s.id, s]));

  let breed: { id: string; coatType: string | null } | null = null;
  if (opts.breedName) {
    breed = await prisma.breed.findUnique({
      where: { name: opts.breedName },
      select: { id: true, coatType: true },
    });
  }

  // Load all candidate rows (filter by size when present, accept null rows as fallback).
  const prices = breed
    ? await prisma.breedServicePrice.findMany({
        where: { breedId: breed.id, serviceId: { in: allIds } },
      })
    : [];

  // Resolve best matching BreedServicePrice for a given service: prefer exact size+coat,
  // then size-only, then coat-only, then null/null.
  const pickRow = (serviceId: string): typeof prices[number] | null => {
    const rows = prices.filter((r) => r.serviceId === serviceId && r.active !== false);
    if (rows.length === 0) return null;
    const wantSize = opts.sizeOptionId ?? null;
    const wantCoat = opts.coatChoice ?? null;
    const score = (r: typeof prices[number]): number => {
      let s = 0;
      if (r.sizeOptionId && r.sizeOptionId === wantSize) s += 4;
      else if (r.sizeOptionId == null && wantSize == null) s += 1;
      if (r.coat && r.coat === wantCoat) s += 2;
      else if (r.coat == null && wantCoat == null) s += 0.5;
      return s;
    };
    return rows.slice().sort((a, b) => score(b) - score(a))[0] ?? null;
  };

  const pickCents = (serviceId: string): number => {
    const svc = sById.get(serviceId);
    if (!svc) return 0;
    if (svc.pricingMode === 'FIXED') return svc.priceCents ?? 0;
    // PER_BREED
    const bp = pickRow(serviceId);
    if (!bp) return 0;
    // Legacy fallback: row has no `coat` column set but breed is MIXED + customer picked LONG → use priceLongCents
    if (bp.coat == null && breed?.coatType === 'MIXED' && opts.coatChoice === 'LONG' && bp.priceLongCents != null) {
      return bp.priceLongCents;
    }
    return bp.priceCents ?? 0;
  };

  const pickDurationMin = (serviceId: string): number => {
    const svc = sById.get(serviceId);
    if (!svc) return 0;
    if (svc.pricingMode === 'PER_BREED') {
      const bp = pickRow(serviceId);
      if (bp?.durationMin != null && bp.durationMin > 0) return bp.durationMin;
    }
    return svc.durationMin ?? 0;
  };

  // Primary
  const primary = sById.get(opts.primaryServiceId);
  const primaryCents = pickCents(opts.primaryServiceId);
  let totalDurationMin = primary ? pickDurationMin(opts.primaryServiceId) : 0;

  // Addons snapshot
  const addonItems: AddonItemSnapshot[] = [];
  let addonsTotal = 0;
  for (const aid of addonIds) {
    const svc = sById.get(aid);
    if (!svc) continue;
    const c = pickCents(aid);
    addonItems.push({ serviceId: aid, name: svc.name, priceCents: c });
    addonsTotal += c;
    totalDurationMin += pickDurationMin(aid);
  }

  // Back-compat snapshot columns (legacy: bath/trim/touchUp by name match)
  // Primary or any addon whose name matches will populate these.
  const allUsed = [primary, ...addonItems.map((a) => sById.get(a.serviceId))].filter(Boolean) as typeof services;
  const findPriceByRegex = (re: RegExp): number | null => {
    const svc = allUsed.find((s) => re.test(s.name));
    return svc ? pickCents(svc.id) : null;
  };
  const bathCents = findPriceByRegex(/^bagno\b/i) ?? (primary && /^bagno\b/i.test(primary.name) ? primaryCents : null);
  const trimCents = findPriceByRegex(/tosatura/i);
  const touchUpCents = findPriceByRegex(/spuntat/i);

  return {
    bathCents,
    trimCents,
    touchUpCents,
    addonItems,
    primaryServiceCents: primaryCents,
    addonsTotalCents: addonsTotal,
    serviceTotalCents: primaryCents + addonsTotal,
    totalDurationMin,
  };
}
