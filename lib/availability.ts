import { prisma } from '@/lib/db';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { addMinutes, format, startOfDay, endOfDay } from 'date-fns';
import { APP_TIMEZONE } from '@/lib/utils';

export interface Slot {
  startISO: string; // UTC ISO
  label: string;    // HH:mm in Europe/Rome
}

const SLOT_STEP_MIN = 30;

/**
 * Compute available slots for a service on a given local date.
 * - Respects opening hours (weekly recurring) in Europe/Rome
 * - Respects closures
 * - Respects existing CONFIRMED/PENDING bookings (with buffer)
 * - Filters past slots (in Europe/Rome "now")
 */
export async function getAvailableSlots(params: {
  serviceId: string;
  date: string; // YYYY-MM-DD (local Rome date)
}): Promise<Slot[]> {
  const service = await prisma.service.findUnique({
    where: { id: params.serviceId },
  });
  if (!service || !service.active) return [];

  const totalMin = service.durationMin;

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

  const openings = await prisma.openingHour.findMany({
    where: { dayOfWeek, active: true },
  });
  if (openings.length === 0) return [];

  // Closures intersecting this day
  const closures = await prisma.closure.findMany({
    where: {
      AND: [{ startsAt: { lt: localDayEnd } }, { endsAt: { gt: localMidnight } }],
    },
  });

  // Existing bookings on that day (consider PENDING + CONFIRMED as occupying)
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
      startsAt: { lt: localDayEnd },
      endsAt: { gt: localMidnight },
    },
    select: { startsAt: true, endsAt: true },
  });

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

      // Booking overlap (buffer already in totalMin)
      const overlap = bookings.some(
        (b) => slotStart < b.endsAt && slotEnd > b.startsAt,
      );
      if (overlap) {
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
