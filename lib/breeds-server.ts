import 'server-only';
import { prisma } from './db';
import type { BreedEntry, AnimalType, SizeCategory, CoatType } from './breeds';

function toEntry(b: {
  id: string;
  name: string;
  animalType: string;
  size: string | null;
  coatType: string | null;
  priceMin: number;
  priceMax: number;
  priceTrim: number | null;
  priceTrimLong: number | null;
  priceTouchUp: number | null;
}): BreedEntry {
  return {
    id: b.id,
    name: b.name,
    animalType: b.animalType as AnimalType,
    size: (b.size as SizeCategory | null) ?? null,
    coatType: (b.coatType as CoatType | null) ?? null,
    priceMin: b.priceMin,
    priceMax: b.priceMax,
    priceTrim: b.priceTrim,
    priceTrimLong: b.priceTrimLong,
    priceTouchUp: b.priceTouchUp,
  };
}

export async function getDogBreeds(): Promise<BreedEntry[]> {
  const rows = await prisma.breed.findMany({
    where: { animalType: 'DOG', active: true },
    orderBy: [{ name: 'asc' }],
  });
  return rows.map(toEntry);
}

export async function getCatBreeds(): Promise<BreedEntry[]> {
  const rows = await prisma.breed.findMany({
    where: { animalType: 'CAT', active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toEntry);
}

// Kept for back-compat — returns first cat breed
export async function getCatBreed(): Promise<BreedEntry | null> {
  const list = await getCatBreeds();
  return list[0] ?? null;
}

export async function findBreedByName(name: string): Promise<BreedEntry | null> {
  const row = await prisma.breed.findUnique({ where: { name } });
  return row ? toEntry(row) : null;
}

export async function getAllBreedsAdmin(): Promise<BreedEntry[]> {
  const rows = await prisma.breed.findMany({
    orderBy: [{ animalType: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toEntry);
}

// ── Missing prices: per-breed (which services lack prices) + per-service (how many breeds) ─
// "Missing" for (breed, service) if:
//   - no row exists, OR
//   - rows exist with at least one active AND no active row has a price (priceCents > 0)
// Opt-out (all rows for that breed×service are inactive) is NOT counted as missing.
export type BreedMissingService = { serviceId: string; serviceName: string };
export type BreedMissingMap = Record<string, BreedMissingService[]>;
export type ServiceMissingMap = Record<string, number>; // serviceId → distinct breed count

export async function getPricingGaps(): Promise<{
  byBreed: BreedMissingMap;
  byService: ServiceMissingMap;
}> {
  const [breeds, services] = await Promise.all([
    prisma.breed.findMany({ where: { active: true }, select: { id: true, animalType: true } }),
    prisma.service.findMany({
      where: { deletedAt: null, active: true, pricingMode: 'PER_BREED' },
      select: { id: true, name: true, displayName: true, forAnimal: true, breedScope: true },
    }),
  ]);
  if (!breeds.length || !services.length) return { byBreed: {}, byService: {} };
  const rows = await prisma.breedServicePrice.findMany({
    where: {
      breedId: { in: breeds.map((b) => b.id) },
      serviceId: { in: services.map((s) => s.id) },
    },
    select: { breedId: true, serviceId: true, active: true, priceCents: true },
  });
  const idx = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.breedId}::${r.serviceId}`;
    const arr = idx.get(k) ?? [];
    arr.push(r);
    idx.set(k, arr);
  }
  const byBreed: BreedMissingMap = {};
  const byService: ServiceMissingMap = {};
  for (const b of breeds) {
    for (const s of services) {
      if (s.forAnimal && s.forAnimal !== b.animalType) continue;
      const arr = idx.get(`${b.id}::${s.id}`);
      // Scope rules:
      //   ALL      → service applies to every breed; missing price is always a gap.
      //   SELECTED → opt-in only; only flag when at least one active row exists.
      const hasActive = !!arr && arr.some((r) => r.active);
      if (s.breedScope === 'SELECTED' && !hasActive) continue;
      const hasValid = !!arr && arr.some((r) => r.priceCents != null && r.priceCents > 0);
      if (!hasValid) {
        const name = s.displayName?.trim() || s.name;
        (byBreed[b.id] ??= []).push({ serviceId: s.id, serviceName: name });
        byService[s.id] = (byService[s.id] ?? 0) + 1;
      }
    }
  }
  return { byBreed, byService };
}

// Back-compat: kept signature for existing callers.
export async function getBreedsMissingPrices(): Promise<BreedMissingMap> {
  const { byBreed } = await getPricingGaps();
  return byBreed;
}

// ── Breed × Service pricing (new model) ─────────────────────────────

export type BreedSizeOptionDTO = {
  id: string;
  label: string;
  sortOrder: number;
  active: boolean;
};

export type BreedServicePriceRow = {
  // PriceCells indexed by (sizeOptionId|'none') and (coatKey: 'SHORT'|'LONG'|'NONE').
  serviceId: string;
  serviceName: string;
  serviceDisplayName: string | null;
  isDefault: boolean;
  breedScope: string; // 'ALL' | 'SELECTED'
  active: boolean;    // whether this service applies to this breed at all (opt-in/out)
  // Cells: key = `${sizeOptionId ?? 'none'}::${coatKey}` → { priceCents, priceLongCents, durationMin }
  cells: Record<string, { priceCents: number | null; priceLongCents: number | null; durationMin: number | null }>;
  /** Service default duration (minutes) — shown as placeholder when cell has no override */
  defaultDurationMin: number;
};

export function cellKey(sizeOptionId: string | null, coat: 'SHORT' | 'LONG' | null): string {
  return `${sizeOptionId ?? 'none'}::${coat ?? 'NONE'}`;
}

/** Editor data for one breed: sizes + all PER_BREED services + current cells. */
export async function getBreedWithServicePrices(breedId: string): Promise<{
  breed: BreedEntry & { coatType: 'SHORT' | 'LONG' | 'MIXED' | null };
  sizes: BreedSizeOptionDTO[];
  rows: BreedServicePriceRow[];
} | null> {
  const breed = await prisma.breed.findUnique({ where: { id: breedId } });
  if (!breed) return null;
  const services = await prisma.service.findMany({
    where: {
      deletedAt: null,
      active: true,
      pricingMode: 'PER_BREED',
      OR: [{ forAnimal: breed.animalType }, { forAnimal: null }],
    },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  const [existing, sizeOptions] = await Promise.all([
    prisma.breedServicePrice.findMany({
      where: { breedId, serviceId: { in: services.map((s) => s.id) } },
    }),
    prisma.breedSizeOption.findMany({
      where: { breedId },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    }),
  ]);
  const rows: BreedServicePriceRow[] = services.map((s) => {
    const svcRows = existing.filter((r) => r.serviceId === s.id);
    const cells: Record<string, { priceCents: number | null; priceLongCents: number | null; durationMin: number | null }> = {};
    for (const r of svcRows) {
      cells[cellKey(r.sizeOptionId, (r.coat as 'SHORT' | 'LONG' | null) ?? null)] = {
        priceCents: r.priceCents,
        priceLongCents: r.priceLongCents,
        durationMin: r.durationMin,
      };
    }
    // anyActive = any row is active OR (no rows and breedScope=ALL)
    const anyActive = svcRows.length === 0 ? s.breedScope === 'ALL' : svcRows.some((r) => r.active);
    return {
      serviceId: s.id,
      serviceName: s.name,
      serviceDisplayName: s.displayName ?? null,
      isDefault: s.isDefault,
      breedScope: s.breedScope,
      active: anyActive,
      cells,
      defaultDurationMin: s.durationMin,
    };
  });
  return {
    breed: toEntry(breed) as BreedEntry & { coatType: 'SHORT' | 'LONG' | 'MIXED' | null },
    sizes: sizeOptions.map((o) => ({ id: o.id, label: o.label, sortOrder: o.sortOrder, active: o.active })),
    rows,
  };
}

/** Map breedId → serviceId → cellKey → cell. Plus sizes per breed. */
export type PerAnimalPayload = {
  pricesByBreed: Record<string, Record<string, Record<string, { priceCents: number | null; priceLongCents: number | null; active: boolean }>>>;
  sizesByBreed: Record<string, BreedSizeOptionDTO[]>;
};

export async function getPricesMapForAnimal(animalType: 'DOG' | 'CAT'): Promise<PerAnimalPayload> {
  const breeds = await prisma.breed.findMany({
    where: { animalType, active: true },
    select: { id: true },
  });
  const breedIds = breeds.map((b) => b.id);
  if (!breedIds.length) return { pricesByBreed: {}, sizesByBreed: {} };
  const [rows, sizes] = await Promise.all([
    prisma.breedServicePrice.findMany({ where: { breedId: { in: breedIds } } }),
    prisma.breedSizeOption.findMany({
      where: { breedId: { in: breedIds }, active: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    }),
  ]);
  const pricesByBreed: PerAnimalPayload['pricesByBreed'] = {};
  for (const r of rows) {
    const breedBucket = pricesByBreed[r.breedId] ?? (pricesByBreed[r.breedId] = {});
    const svcBucket = breedBucket[r.serviceId] ?? (breedBucket[r.serviceId] = {});
    svcBucket[cellKey(r.sizeOptionId, (r.coat as 'SHORT' | 'LONG' | null) ?? null)] = {
      priceCents: r.priceCents,
      priceLongCents: r.priceLongCents,
      active: r.active,
    };
  }
  const sizesByBreed: PerAnimalPayload['sizesByBreed'] = {};
  for (const o of sizes) {
    const arr = sizesByBreed[o.breedId] ?? (sizesByBreed[o.breedId] = []);
    arr.push({ id: o.id, label: o.label, sortOrder: o.sortOrder, active: o.active });
  }
  return { pricesByBreed, sizesByBreed };
}
