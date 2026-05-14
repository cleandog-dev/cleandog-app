'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  BookingInputSchema,
  BookingEditSchema,
  ClosureSchema,
  ServiceAdminSchema,
  BookingStatusUpdateSchema,
  BreedAdminSchema,
  AdminBookingInputSchema,
  ExtraAdminSchema,
  OpeningHoursSchema,
} from '@/lib/schema';
import { rateLimit } from '@/lib/rate-limit';
import { sendBookingConfirmation } from '@/lib/email';
import { auth } from '@/lib/auth';
import { findBreedByName, getCatBreed } from '@/lib/breeds-server';
import { parseExtraNamesFromNotes } from '@/lib/utils';

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  );
}


// ── Public: create booking ─────────────────────────────────────
export async function createBookingAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ip = await getClientIp();
  const rl = rateLimit({ key: `book:${ip}`, limit: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return { ok: false, error: 'Troppe richieste. Riprova tra poco.' };
  }

  const parsed = BookingInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Dati non validi',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service || !service.active) {
    return { ok: false, error: 'Servizio non disponibile' };
  }

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
    return { ok: false, error: 'Orario non valido' };
  }
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // Closure check
      const closure = await tx.closure.findFirst({
        where: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      });
      if (closure) throw new Error('CLOSED');

      // Overlap check
      const overlap = await tx.booking.findFirst({
        where: {
          status: { in: ['PENDING', 'CONFIRMED'] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true },
      });
      if (overlap) throw new Error('OVERLAP');

      // Compute price (min of range — final price agreed in shop)
      let priceCents = service.priceCents;
      let dogSize: 'SMALL' | 'MEDIUM' | 'LARGE' | null = null;
      if (input.animalType === 'CAT') {
        const catBreed = await getCatBreed();
        if (catBreed) priceCents = catBreed.priceMin * 100;
      } else {
        const breed = await findBreedByName(input.dogBreed);
        const hasBath  = /bagno/i.test(service.name);
        const hasGroom = /tosatura/i.test(service.name);
        const bathCents = hasBath && breed ? breed.priceMin * 100 : 0;
        let groomCents = 0;
        if (hasGroom) {
          // Derive coat: from breed; if MIXED, use client choice
          const breedCoat = breed?.coatType;
          const coat = breedCoat === 'MIXED' ? input.coatChoice : breedCoat;
          if (coat === 'LONG') {
            groomCents = service.priceCoatLongMinCents ?? service.priceCents;
          } else {
            groomCents = service.priceCoatShortMinCents ?? service.priceCents;
          }
        }
        priceCents = bathCents + groomCents;
        if (priceCents === 0) priceCents = service.priceCents;
        if (breed) dogSize = breed.size;
      }

      // Add extras from notes
      const extraNames = parseExtraNamesFromNotes(input.notes);
      if (extraNames.length) {
        const exs = await tx.extra.findMany({
          where: { name: { in: extraNames }, active: true },
        });
        priceCents += exs.reduce((s, e) => s + e.priceCents, 0);
      }

      return tx.booking.create({
        data: {
          serviceId: service.id,
          startsAt,
          endsAt,
          status: 'CONFIRMED',
          customerName: input.customerName,
          customerEmail: input.customerEmail.toLowerCase(),
          customerPhone: input.customerPhone,
          dogName: input.dogName || '',
          dogBreed: input.dogBreed,
          dogSize,
          notes: input.notes || null,
          priceCents,
          privacyConsent: input.privacyConsent,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath('/admin/dashboard');

    // Fire-and-forget email
    sendBookingConfirmation({
      to: booking.customerEmail,
      customerName: booking.customerName,
      dogName: booking.dogName,
      serviceName: service.name,
      startsAt: booking.startsAt,
      priceCents: booking.priceCents,
    }).catch((e) => console.error('Email send failed:', e));

    return { ok: true, data: { id: booking.id } };
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'OVERLAP') {
        return { ok: false, error: 'Orario non più disponibile. Scegline un altro.' };
      }
      if (e.message === 'CLOSED') {
        return { ok: false, error: 'In quella fascia siamo chiusi.' };
      }
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'Orario non più disponibile. Scegline un altro.' };
    }
    console.error('createBooking error', e);
    return { ok: false, error: 'Errore inatteso. Riprova.' };
  }
}

// ── Admin: create booking manually ──────────────────────────────
export async function adminCreateBookingAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = AdminBookingInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Dati non validi',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service) return { ok: false, error: 'Servizio non trovato' };

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: 'Orario non valido' };
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);

  try {
    const booking = await prisma.$transaction(async (tx) => {
      if (!input.forceOverlap) {
        const closure = await tx.closure.findFirst({
          where: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
        });
        if (closure) throw new Error('CLOSED');

        const overlap = await tx.booking.findFirst({
          where: {
            status: { in: ['PENDING', 'CONFIRMED'] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { id: true },
        });
        if (overlap) throw new Error('OVERLAP');
      }

      let priceCents = service.priceCents;
      let dogSize: 'SMALL' | 'MEDIUM' | 'LARGE' | null = null;
      if (input.animalType === 'CAT') {
        const catBreed = await getCatBreed();
        if (catBreed) priceCents = catBreed.priceMin * 100;
      } else if (input.dogBreed) {
        const breed = await findBreedByName(input.dogBreed);
        const hasBath  = /bagno/i.test(service.name);
        const hasGroom = /tosatura/i.test(service.name);
        const bathCents = hasBath && breed ? breed.priceMin * 100 : 0;
        let groomCents = 0;
        if (hasGroom) {
          const breedCoat = breed?.coatType;
          const coat = breedCoat === 'MIXED' ? input.coatChoice : breedCoat;
          groomCents = coat === 'LONG'
            ? (service.priceCoatLongMinCents ?? service.priceCents)
            : (service.priceCoatShortMinCents ?? service.priceCents);
        }
        priceCents = bathCents + groomCents;
        if (priceCents === 0) priceCents = service.priceCents;
        if (breed) dogSize = breed.size;
      }

      // Add extras from notes
      const extraNames = parseExtraNamesFromNotes(input.notes);
      if (extraNames.length) {
        const exs = await tx.extra.findMany({
          where: { name: { in: extraNames }, active: true },
        });
        priceCents += exs.reduce((s, e) => s + e.priceCents, 0);
      }

      return tx.booking.create({
        data: {
          serviceId: service.id,
          startsAt,
          endsAt,
          status: 'CONFIRMED',
          customerName: input.customerName,
          customerEmail: input.customerEmail ? input.customerEmail.toLowerCase() : '',
          customerPhone: input.customerPhone ?? '',
          dogName: input.dogName || '',
          dogBreed: input.dogBreed || null,
          dogSize,
          notes: input.notes || null,
          priceCents,
          privacyConsent: true,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath('/admin/dashboard');
    return { ok: true, data: { id: booking.id } };
  } catch (e) {
    if (e instanceof Error && e.message === 'OVERLAP') {
      return { ok: false, error: 'OVERLAP' };
    }
    if (e instanceof Error && e.message === 'CLOSED') {
      return { ok: false, error: 'CLOSED' };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'OVERLAP' };
    }
    console.error('adminCreateBooking error', e);
    return { ok: false, error: 'Errore inatteso. Riprova.' };
  }
}

// ── Admin guard ────────────────────────────────────────────────
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHORIZED');
  return session;
}

// ── Admin: update booking status ───────────────────────────────
export async function updateBookingStatusAction(
  raw: unknown,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = BookingStatusUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Input non valido' };

  await prisma.booking.update({
    where: { id: parsed.data.bookingId },
    data: { status: parsed.data.status },
  });
  revalidatePath('/admin/dashboard');
  return { ok: true, data: null };
}

// ── Admin: edit booking date/time ─────────────────────────────
export async function editBookingAction(raw: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = BookingEditSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Dati non validi', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    include: { service: true },
  });
  if (!booking) return { ok: false, error: 'Prenotazione non trovata' };

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(
    startsAt.getTime() + booking.service.durationMin * 60_000,
  );

  try {
    await prisma.$transaction(async (tx) => {
      // Overlap check (exclude self)
      const overlap = await tx.booking.findFirst({
        where: {
          id: { not: booking.id },
          status: { in: ['PENDING', 'CONFIRMED'] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
      if (overlap) throw new Error('OVERLAP');

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          startsAt,
          endsAt,
          notes: parsed.data.notes ?? booking.notes,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    if (e instanceof Error && e.message === 'OVERLAP') {
      return { ok: false, error: 'Orario non disponibile — si sovrappone a un altro appuntamento.' };
    }
    return { ok: false, error: 'Errore inatteso' };
  }

  revalidatePath('/admin/dashboard');
  return { ok: true, data: null };
}

// ── Admin: delete booking ──────────────────────────────────────
export async function deleteBookingAction(bookingId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!bookingId) return { ok: false, error: 'ID mancante' };
  await prisma.booking.delete({ where: { id: bookingId } });
  revalidatePath('/admin/dashboard');
  return { ok: true, data: null };
}

// ── Admin: delete service ──────────────────────────────────────
export async function deleteServiceAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return { ok: false, error: 'ID mancante' };
  const bookings = await prisma.booking.count({ where: { serviceId: id } });
  if (bookings > 0)
    return { ok: false, error: `Impossibile eliminare: ${bookings} prenotazion${bookings === 1 ? 'e' : 'i'} collegate.` };
  await prisma.service.delete({ where: { id } });
  revalidatePath('/admin/services');
  revalidatePath('/prenota');
  return { ok: true, data: null };
}

// ── Admin: create/update service ───────────────────────────────
export async function upsertServiceAction(
  serviceId: string | null,
  raw: unknown,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = ServiceAdminSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Dati servizio non validi',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  if (serviceId) {
    const { name: _name, ...updateData } = parsed.data;
    const before = await prisma.service.findUnique({ where: { id: serviceId } });
    await prisma.service.update({ where: { id: serviceId }, data: updateData });
    // Cascade: if durationMin changed, recompute endsAt of FUTURE bookings of this service
    if (before && before.durationMin !== parsed.data.durationMin) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const future = await prisma.booking.findMany({
        where: { serviceId, startsAt: { gte: startOfToday } },
        select: { id: true, startsAt: true },
      });
      for (const b of future) {
        await prisma.booking.update({
          where: { id: b.id },
          data: { endsAt: new Date(b.startsAt.getTime() + parsed.data.durationMin * 60_000) },
        });
      }
    }
  } else {
    await prisma.service.create({ data: parsed.data });
  }
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/staff');
  revalidatePath('/prenota');
  return { ok: true, data: null };
}

// ── Admin: day slot overview ──────────────────────────────────────
export type DaySlot = {
  time: string;          // HH:mm
  startISO: string;      // UTC ISO
  status: 'free' | 'busy' | 'closed' | 'outside';
  busyWith?: string;     // dog name if busy
};

export async function getDayOverviewAction({
  serviceId,
  date,
}: {
  serviceId: string;
  date: string; // YYYY-MM-DD
}): Promise<{ ok: true; data: DaySlot[] } | { ok: false; error: string }> {
  await requireAdmin();
  const { fromZonedTime, toZonedTime } = await import('date-fns-tz');
  const { addMinutes } = await import('date-fns');
  const { APP_TIMEZONE } = await import('@/lib/utils');

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return { ok: false, error: 'Servizio non trovato' };

  const localMidnight = fromZonedTime(`${date}T00:00:00`, APP_TIMEZONE);
  const localDayEnd = fromZonedTime(`${date}T23:59:59`, APP_TIMEZONE);
  const dayOfWeek = toZonedTime(localMidnight, APP_TIMEZONE).getDay();

  const [openings, closures, bookings] = await Promise.all([
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
      select: { startsAt: true, endsAt: true, dogName: true, dogBreed: true },
    }),
  ]);

  const SLOT_STEP = 30;
  const START_H = 8;
  const END_H = 20;
  const dur = service.durationMin;
  const result: DaySlot[] = [];

  for (let m = START_H * 60; m < END_H * 60; m += SLOT_STEP) {
    const slotStart = addMinutes(localMidnight, m);
    const slotEnd = addMinutes(slotStart, dur);
    const hh = Math.floor(m / 60).toString().padStart(2, '0');
    const mm = (m % 60).toString().padStart(2, '0');
    const time = `${hh}:${mm}`;
    const startISO = slotStart.toISOString();

    const insideOpening = openings.some(
      (o) => m >= o.openMinute && m + dur <= o.closeMinute,
    );
    if (!insideOpening) {
      result.push({ time, startISO, status: 'outside' });
      continue;
    }

    const inClosure = closures.some(
      (c) => slotStart < c.endsAt && slotEnd > c.startsAt,
    );
    if (inClosure) {
      result.push({ time, startISO, status: 'closed' });
      continue;
    }

    const conflict = bookings.find(
      (b) => slotStart < b.endsAt && slotEnd > b.startsAt,
    );
    if (conflict) {
      result.push({
        time,
        startISO,
        status: 'busy',
        busyWith: conflict.dogName || conflict.dogBreed || 'occupato',
      });
      continue;
    }

    result.push({ time, startISO, status: 'free' });
  }

  return { ok: true, data: result };
}

// ── Admin: one-shot recompute endsAt of all future bookings ───────
export async function recomputeBookingEndsAtAction(): Promise<ActionResult<{ updated: number }>> {
  await requireAdmin();
  const services = await prisma.service.findMany({ select: { id: true, durationMin: true } });
  const map = new Map(services.map((s) => [s.id, s.durationMin]));
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const future = await prisma.booking.findMany({
    where: { startsAt: { gte: startOfToday } },
    select: { id: true, startsAt: true, endsAt: true, serviceId: true },
  });
  let updated = 0;
  for (const b of future) {
    const dur = map.get(b.serviceId);
    if (dur == null) continue;
    const newEnd = new Date(b.startsAt.getTime() + dur * 60_000);
    if (newEnd.getTime() !== b.endsAt.getTime()) {
      await prisma.booking.update({ where: { id: b.id }, data: { endsAt: newEnd } });
      updated++;
    }
  }
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/staff');
  return { ok: true, data: { updated } };
}

// ── Admin: recompute booking prices (re-applies breed/coat + extras) ──
export async function recomputeBookingPricesAction(): Promise<ActionResult<{ updated: number }>> {
  await requireAdmin();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const bookings = await prisma.booking.findMany({
    where: { startsAt: { gte: startOfToday } },
    include: { service: true },
  });
  const allExtras = await prisma.extra.findMany({ where: { active: true } });
  const extraByName = new Map(allExtras.map((e) => [e.name, e.priceCents]));

  let updated = 0;
  for (const b of bookings) {
    let priceCents = b.service.priceCents;
    if (b.dogBreed) {
      const breed = await findBreedByName(b.dogBreed);
      const hasBath = /bagno/i.test(b.service.name);
      const hasGroom = /tosatura/i.test(b.service.name);
      const bathCents = hasBath && breed ? breed.priceMin * 100 : 0;
      let groomCents = 0;
      if (hasGroom) {
        const breedCoat = breed?.coatType;
        // For MIXED coats we can't infer client choice — use SHORT as fallback
        const coat = breedCoat === 'MIXED' ? 'SHORT' : breedCoat;
        groomCents = coat === 'LONG'
          ? (b.service.priceCoatLongMinCents ?? b.service.priceCents)
          : (b.service.priceCoatShortMinCents ?? b.service.priceCents);
      }
      priceCents = bathCents + groomCents;
      if (priceCents === 0) priceCents = b.service.priceCents;
    } else if (/gatto/i.test(b.service.name)) {
      const catBreed = await getCatBreed();
      if (catBreed) priceCents = catBreed.priceMin * 100;
    }
    // Extras
    const extraNames = parseExtraNamesFromNotes(b.notes);
    for (const n of extraNames) {
      const c = extraByName.get(n);
      if (c) priceCents += c;
    }
    if (priceCents !== b.priceCents) {
      await prisma.booking.update({ where: { id: b.id }, data: { priceCents } });
      updated++;
    }
  }
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/staff');
  return { ok: true, data: { updated } };
}

// ── Admin: create closure ──────────────────────────────────────
export async function createClosureAction(raw: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = ClosureSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Dati chiusura non validi',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  await prisma.closure.create({
    data: {
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      reason: parsed.data.reason || null,
    },
  });
  revalidatePath('/admin/dashboard');
  return { ok: true, data: null };
}

export async function deleteClosureAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.closure.delete({ where: { id } });
  revalidatePath('/admin/dashboard');
  return { ok: true, data: null };
}

// ── Admin: breeds CRUD ────────────────────────────────────────
export async function upsertBreedAction(
  breedId: string | null,
  raw: unknown,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = BreedAdminSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Dati razza non validi',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = {
    name: parsed.data.name,
    animalType: parsed.data.animalType,
    size: parsed.data.animalType === 'DOG' ? (parsed.data.size ?? null) : null,
    coatType: parsed.data.animalType === 'DOG' ? (parsed.data.coatType ?? null) : null,
    priceMin: parsed.data.priceMin,
    priceMax: parsed.data.priceMax,
    active: parsed.data.active,
    sortOrder: parsed.data.sortOrder,
  };
  try {
    if (breedId) {
      await prisma.breed.update({ where: { id: breedId }, data });
    } else {
      await prisma.breed.create({ data });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'Esiste già una razza con questo nome' };
    }
    throw e;
  }
  revalidatePath('/admin/breeds');
  revalidatePath('/prenota');
  return { ok: true, data: null };
}

export async function deleteBreedAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.breed.delete({ where: { id } });
  revalidatePath('/admin/breeds');
  revalidatePath('/prenota');
  return { ok: true, data: null };
}

// ── Admin: extras CRUD ────────────────────────────────────────
export async function upsertExtraAction(
  extraId: string | null,
  raw: unknown,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = ExtraAdminSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Dati extra non validi',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    if (extraId) {
      await prisma.extra.update({ where: { id: extraId }, data: parsed.data });
    } else {
      await prisma.extra.create({ data: parsed.data });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'Esiste già un extra con questo nome' };
    }
    throw e;
  }
  revalidatePath('/admin/extras');
  revalidatePath('/prenota');
  return { ok: true, data: null };
}

export async function deleteExtraAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.extra.delete({ where: { id } });
  revalidatePath('/admin/extras');
  revalidatePath('/prenota');
  return { ok: true, data: null };
}

// ── Admin: opening hours bulk replace ────────────────────────
export async function saveOpeningHoursAction(raw: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = OpeningHoursSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Dati orari non validi',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  await prisma.$transaction([
    prisma.openingHour.deleteMany(),
    prisma.openingHour.createMany({
      data: parsed.data.hours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        openMinute: h.openMinute,
        closeMinute: h.closeMinute,
        active: h.active,
      })),
    }),
  ]);
  revalidatePath('/admin/hours');
  revalidatePath('/prenota');
  return { ok: true, data: null };
}
