import { prisma } from '@/lib/db';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { addMinutes, format, startOfDay, endOfDay } from 'date-fns';
import { APP_TIMEZONE } from '@/lib/utils';
import { getSlotStepMin, getMaxConcurrentBookings } from '@/lib/settings';

export interface Slot {
  startISO: string; // UTC ISO
  label: string;    // HH:mm in Europe/Rome
}

/**
 * Compute available slots for a service on a given local date.
 * - Respects opening hours (weekly recurring) in Europe/Rome
 * - Respects closures
 * - Respects existing CONFIRMED/PENDING bookings (with buffer)
 * - Filters past slots (in Europe/Rome "now")
 */
export async function getAvailableSlots(params: {
  serviceId: string;
  addonServiceIds?: string[];
  date: string; // YYYY-MM-DD (local Rome date)
  breedName?: string | null;
  sizeOptionId?: string | null;
  coatChoice?: 'SHORT' | 'LONG' | null;
}): Promise<Slot[]> {
  const addonIds = Array.from(new Set(params.addonServiceIds ?? [])).filter(Boolean);

  // Parallel: primary service + (optional) addons + (optional) breed lookup.
  const [service, addonServices, breed] = await Promise.all([
    prisma.service.findUnique({ where: { id: params.serviceId } }),
    addonIds.length
      ? prisma.service.findMany({ where: { id: { in: addonIds }, active: true } })
      : Promise.resolve([] as { id: string; durationMin: number; pricingMode: string }[]),
    params.breedName
      ? prisma.breed.findUnique({ where: { name: params.breedName }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (!service || !service.active) return [];

  const allServiceIds = [service.id, ...addonServices.map((a) => a.id)];
  const cells = breed
    ? await prisma.breedServicePrice.findMany({
        where: { breedId: breed.id, serviceId: { in: allServiceIds }, active: true },
        select: { serviceId: true, sizeOptionId: true, coat: true, durationMin: true },
      })
    : [];
  const pickDuration = (svc: { id: string; durationMin: number; pricingMode: string }): number => {
    if (svc.pricingMode !== 'PER_BREED' || !breed) return svc.durationMin;
    const candidates = cells.filter((c) => c.serviceId === svc.id && c.durationMin != null && c.durationMin > 0);
    if (candidates.length === 0) return svc.durationMin;
    const wantSize = params.sizeOptionId ?? null;
    const wantCoat = params.coatChoice ?? null;
    const score = (r: typeof candidates[number]): number => {
      let s = 0;
      if (r.sizeOptionId && r.sizeOptionId === wantSize) s += 4;
      else if (r.sizeOptionId == null && wantSize == null) s += 1;
      if (r.coat && r.coat === wantCoat) s += 2;
      else if (r.coat == null && wantCoat == null) s += 0.5;
      return s;
    };
    return candidates.slice().sort((a, b) => score(b) - score(a))[0]?.durationMin ?? svc.durationMin;
  };

  const totalMin = pickDuration(service) + addonServices.reduce((s, a) => s + pickDuration(a), 0);

  // Build local-date range
  const [yStr, mStr, dStr] = params.date.split('-');
  if (!yStr || !mStr || !dStr) return [];
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return [];

  // Local midnight in Rome → UTC
  const localMidnight = fromZonedTime(
    `${params.date}T00:00:00`,
    APP_TIMEZONE,
  );
  const localDayEnd = fromZonedTime(`${params.date}T23:59:59`, APP_TIMEZONE);

  // Day-of-week in Europe/Rome
  const zonedMidnight = toZonedTime(localMidnight, APP_TIMEZONE);
  const dayOfWeek = zonedMidnight.getDay();

  // Parallel: opening hours + closures + bookings + slot step + max concurrent.
  const [openings, closures, bookings, SLOT_STEP_MIN, MAX_CONCURRENT] = await Promise.all([
    prisma.openingHour.findMany({ where: { dayOfWeek, active: true } }),
    prisma.closure.findMany({
      where: { AND: [{ startsAt: { lt: localDayEnd } }, { endsAt: { gt: localMidnight } }] },
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        startsAt: { lt: localDayEnd },
        endsAt: { gt: localMidnight },
      },
      select: { startsAt: true, endsAt: true },
    }),
    getSlotStepMin(),
    getMaxConcurrentBookings(),
  ]);
  if (openings.length === 0) return [];

  const now = new Date();
  const slots: Slot[] = [];

  for (const opening of openings) {
    // For each opening window, generate slots stepping every SLOT_STEP_MIN
    const windowStart = addMinutes(localMidnight, opening.openMinute);
    const windowEnd = addMinutes(localMidnight, opening.closeMinute);

    let cursor = windowStart;
    while (addMinutes(cursor, totalMin) <= windowEnd) {
      const slotStart = cursor;
      const slotEnd = addMinutes(cursor, totalMin);

      // Skip past
      if (slotStart <= now) {
        cursor = addMinutes(cursor, SLOT_STEP_MIN);
        continue;
      }

      // Closure overlap
      const inClosure = closures.some(
        (c) => slotStart < c.endsAt && slotEnd > c.startsAt,
      );
      if (inClosure) {
        cursor = addMinutes(cursor, SLOT_STEP_MIN);
        continue;
      }

      // Booking overlap (buffer already in totalMin). Slot busy only if count >= capacity.
      const overlapping = bookings.filter(
        (b) => slotStart < b.endsAt && slotEnd > b.startsAt,
      ).length;
      if (overlapping >= MAX_CONCURRENT) {
        cursor = addMinutes(cursor, SLOT_STEP_MIN);
        continue;
      }

      slots.push({
        startISO: slotStart.toISOString(),
        label: format(toZonedTime(slotStart, APP_TIMEZONE), 'HH:mm'),
      });

      cursor = addMinutes(cursor, SLOT_STEP_MIN);
    }
  }

  // De-dup if multiple windows happen to overlap
  const seen = new Set<string>();
  return slots.filter((s) => {
    if (seen.has(s.startISO)) return false;
    seen.add(s.startISO);
    return true;
  });
}

export function localDateKey(d: Date): string {
  return format(toZonedTime(d, APP_TIMEZONE), 'yyyy-MM-dd');
}

export { startOfDay, endOfDay };
