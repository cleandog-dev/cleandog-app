// Virtual "Client" aggregation over Booking rows.
// No DB schema change: clients are derived by grouping bookings by normalized phone.
// Read-only — safe to use on live MVP data.

import type { Booking, Service } from '@prisma/client';

export type BookingLite = Pick<
  Booking,
  | 'customerName'
  | 'customerEmail'
  | 'customerPhone'
  | 'dogName'
  | 'dogBreed'
  | 'dogSize'
  | 'sizeOptionId'
  | 'coatChoice'
  | 'status'
  | 'startsAt'
  | 'priceCents'
>;

export type BookingWithService = Booking & { service: Service };

export type ClientSummary = {
  phoneKey: string;
  phone: string;
  name: string;
  email: string | null;
  totalBookings: number;
  activeBookings: number;
  totalSpentCents: number;
  firstVisit: Date;
  lastVisit: Date;
  avgGapDays: number | null;
  animalsCount: number;
};

export type ClientAnimal = {
  key: string;
  dogName: string;
  dogBreed: string | null;
  dogSize: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE' | null;
  sizeOptionId: string | null;
  coatChoice: 'SHORT' | 'LONG' | null;
  visitsCount: number;
  lastVisit: Date;
};

export type ClientDetail = ClientSummary & {
  animals: ClientAnimal[];
  bookings: BookingWithService[];
};

// Last-9-digit normalization. Mirrors regex used in lookupBookingsByPhoneAction
// to avoid touching that action (zero-risk change for /cancella).
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = String(raw).replace(/[^\d]/g, '');
  return digits.length > 9 ? digits.slice(-9) : digits;
}

function animalKey(b: { dogName: string | null; dogBreed: string | null }): string {
  const n = (b.dogName ?? '').trim().toLowerCase();
  const r = (b.dogBreed ?? '').trim().toLowerCase();
  return `${n}::${r}`;
}

const ACTIVE_STATUSES = new Set(['PENDING', 'CONFIRMED']);
// Conta come spesa effettiva solo gli appuntamenti veramente eseguiti.
const PAID_STATUSES = new Set(['COMPLETED']);

export function aggregateClients(bookings: BookingLite[]): ClientSummary[] {
  const groups = new Map<string, BookingLite[]>();
  for (const b of bookings) {
    const key = normalizePhone(b.customerPhone);
    if (!key) continue;
    const arr = groups.get(key);
    if (arr) arr.push(b);
    else groups.set(key, [b]);
  }

  const now = new Date();
  const summaries: ClientSummary[] = [];
  for (const [phoneKey, list] of groups.entries()) {
    const sorted = list.slice().sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const latest = sorted[sorted.length - 1]!;
    const earliest = sorted[0]!;

    const totalSpentCents = sorted
      .filter((b) => PAID_STATUSES.has(b.status))
      .reduce((s, b) => s + (b.priceCents ?? 0), 0);

    const activeBookings = sorted.filter(
      (b) => ACTIVE_STATUSES.has(b.status) && b.startsAt >= now,
    ).length;

    const animalKeys = new Set<string>();
    for (const b of sorted) animalKeys.add(animalKey(b));

    const firstVisit = earliest.startsAt;
    const lastVisit = latest.startsAt;
    const gapMs = lastVisit.getTime() - firstVisit.getTime();
    const avgGapDays = sorted.length > 1 ? gapMs / (sorted.length - 1) / 86_400_000 : null;

    summaries.push({
      phoneKey,
      phone: latest.customerPhone,
      name: latest.customerName,
      email: sorted.map((b) => b.customerEmail).reverse().find((e) => !!e?.trim()) ?? null,
      totalBookings: sorted.length,
      activeBookings,
      totalSpentCents,
      firstVisit,
      lastVisit,
      avgGapDays,
      animalsCount: animalKeys.size,
    });
  }

  summaries.sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime());
  return summaries;
}

export function aggregateClientDetail(bookings: BookingWithService[]): ClientDetail | null {
  if (bookings.length === 0) return null;
  const summaries = aggregateClients(bookings);
  if (summaries.length === 0) return null;
  // All bookings share same phoneKey when filtered upstream, but be defensive: pick first summary.
  const summary = summaries[0]!;

  const animalsMap = new Map<string, ClientAnimal>();
  for (const b of bookings) {
    const k = animalKey(b);
    const existing = animalsMap.get(k);
    if (existing) {
      existing.visitsCount += 1;
      if (b.startsAt > existing.lastVisit) {
        existing.lastVisit = b.startsAt;
        if (b.sizeOptionId) existing.sizeOptionId = b.sizeOptionId;
        if (b.coatChoice) existing.coatChoice = b.coatChoice as 'SHORT' | 'LONG';
        if (b.dogSize) existing.dogSize = b.dogSize as ClientAnimal['dogSize'];
      }
    } else {
      animalsMap.set(k, {
        key: k,
        dogName: b.dogName ?? '',
        dogBreed: b.dogBreed,
        dogSize: b.dogSize as ClientAnimal['dogSize'],
        sizeOptionId: b.sizeOptionId,
        coatChoice: b.coatChoice as 'SHORT' | 'LONG' | null,
        visitsCount: 1,
        lastVisit: b.startsAt,
      });
    }
  }
  const animals = Array.from(animalsMap.values()).sort(
    (a, b) => b.lastVisit.getTime() - a.lastVisit.getTime(),
  );

  const sortedBookings = bookings.slice().sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

  return { ...summary, animals, bookings: sortedBookings };
}
