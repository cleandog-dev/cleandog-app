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
import { findBreedByName, getBreedWithServicePrices, type BreedServicePriceRow, type BreedSizeOptionDTO } from '@/lib/breeds-server';
import { parseExtraNamesFromNotes } from '@/lib/utils';
import { getSlotStepMin } from '@/lib/settings';
import { pushToAdmins, pushToClientPhone } from '@/lib/push';
import {
  buildBookingCreatedAdminPayload,
  buildBookingConfirmedClientPayload,
  buildBookingCancelledAdminPayload,
  buildBookingCancelledClientPayload,
  buildBookingRescheduledClientPayload,
  buildBookingStatusAdminPayload,
} from '@/lib/notify-builders';
import { priceBooking } from '@/lib/pricing';

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

  // Pre-compute price + per-cell duration override (so endsAt reflects breed×size×coat overrides).
  const priced = await priceBooking({
    primaryServiceId: service.id,
    addonServiceIds: input.addonServiceIds,
    breedName: input.dogBreed,
    coatChoice: input.coatChoice ?? null,
    sizeOptionId: input.sizeOptionId ?? null,
  });
  const totalDuration = priced.totalDurationMin > 0 ? priced.totalDurationMin : service.durationMin;

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
    return { ok: false, error: 'Orario non valido' };
  }
  const endsAt = new Date(startsAt.getTime() + totalDuration * 60_000);

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

      // Resolve dogSize for legacy snapshot
      let dogSize: 'SMALL' | 'MEDIUM' | 'LARGE' | null = null;
      const breed = await findBreedByName(input.dogBreed);
      if (breed) dogSize = breed.size;

      let priceCents = priced.serviceTotalCents;
      if (priceCents === 0) priceCents = service.priceCents;

      // Add extras from notes + snapshot
      const extraNames = parseExtraNamesFromNotes(input.notes);
      let extrasCents = 0;
      let extrasSnapshot: Array<{ name: string; priceCents: number }> = [];
      if (extraNames.length) {
        const exs = await tx.extra.findMany({
          where: { name: { in: extraNames }, active: true },
        });
        extrasCents = exs.reduce((s, e) => s + e.priceCents, 0);
        extrasSnapshot = exs.map((e) => ({ name: e.name, priceCents: e.priceCents }));
        priceCents += extrasCents;
      }

      let dogSizeLabel: string | null = null;
      if (input.sizeOptionId) {
        const sz = await tx.breedSizeOption.findUnique({ where: { id: input.sizeOptionId } });
        dogSizeLabel = sz?.label ?? null;
      }

      return tx.booking.create({
        data: {
          serviceId: service.id,
          serviceName: service.name,
          sizeOptionId: input.sizeOptionId ?? null,
          dogSizeLabel,
          startsAt,
          endsAt,
          status: 'CONFIRMED',
          customerName: input.customerName,
          customerEmail: input.customerEmail ? input.customerEmail.toLowerCase() : '',
          customerPhone: input.customerPhone,
          dogName: input.dogName || '',
          dogBreed: input.dogBreed,
          dogSize,
          notes: input.notes || null,
          priceCents,
          bathCents: priced.bathCents,
          trimCents: priced.trimCents,
          touchUpCents: priced.touchUpCents,
          extrasCents: extrasSnapshot.length ? extrasCents : null,
          extrasJson: extrasSnapshot.length ? JSON.stringify(extrasSnapshot) : null,
          addonItemsJson: priced.addonItems.length ? JSON.stringify(priced.addonItems) : null,
          coatChoice: input.coatChoice ?? null,
          privacyConsent: input.privacyConsent,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath('/admin/dashboard');

    // Fire-and-forget email (only if customer provided email)
    if (booking.customerEmail) {
      sendBookingConfirmation({
        to: booking.customerEmail,
        customerName: booking.customerName,
        dogName: booking.dogName,
        serviceName: service.name,
        startsAt: booking.startsAt,
        priceCents: booking.priceCents,
      }).catch((e) => console.error('Email send failed:', e));
    }

    // Push notification → admin (new booking)
    pushToAdmins(
      'BOOKING_CREATED',
      buildBookingCreatedAdminPayload(booking, service.name),
      booking.id,
    ).catch((e) => console.error('Admin push failed:', e));

    // Push notification → client (booking confirmed, if already subscribed for phone)
    if (booking.customerPhone) {
      pushToClientPhone(
        booking.customerPhone,
        'BOOKING_CONFIRMED',
        buildBookingConfirmedClientPayload(booking, service.name),
        booking.id,
      ).catch((e) => console.error('Client push failed:', e));
    }

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

  const priced = await priceBooking({
    primaryServiceId: service.id,
    addonServiceIds: input.addonServiceIds,
    breedName: input.dogBreed || null,
    coatChoice: input.coatChoice ?? null,
    sizeOptionId: input.sizeOptionId ?? null,
  });
  const totalDurationAdmin = priced.totalDurationMin > 0 ? priced.totalDurationMin : service.durationMin;

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: 'Orario non valido' };
  const endsAt = new Date(startsAt.getTime() + totalDurationAdmin * 60_000);

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

      let dogSize: 'SMALL' | 'MEDIUM' | 'LARGE' | null = null;
      if (input.dogBreed) {
        const breed = await findBreedByName(input.dogBreed);
        if (breed) dogSize = breed.size;
      }

      let priceCents = priced.serviceTotalCents;
      if (priceCents === 0) priceCents = service.priceCents;

      // Add extras from notes + snapshot
      const extraNames = parseExtraNamesFromNotes(input.notes);
      let extrasCents = 0;
      let extrasSnapshot: Array<{ name: string; priceCents: number }> = [];
      if (extraNames.length) {
        const exs = await tx.extra.findMany({
          where: { name: { in: extraNames }, active: true },
        });
        extrasCents = exs.reduce((s, e) => s + e.priceCents, 0);
        extrasSnapshot = exs.map((e) => ({ name: e.name, priceCents: e.priceCents }));
        priceCents += extrasCents;
      }

      let dogSizeLabel: string | null = null;
      if (input.sizeOptionId) {
        const sz = await tx.breedSizeOption.findUnique({ where: { id: input.sizeOptionId } });
        dogSizeLabel = sz?.label ?? null;
      }

      return tx.booking.create({
        data: {
          serviceId: service.id,
          serviceName: service.name,
          sizeOptionId: input.sizeOptionId ?? null,
          dogSizeLabel,
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
          bathCents: priced.bathCents,
          trimCents: priced.trimCents,
          touchUpCents: priced.touchUpCents,
          extrasCents: extrasSnapshot.length ? extrasCents : null,
          extrasJson: extrasSnapshot.length ? JSON.stringify(extrasSnapshot) : null,
          addonItemsJson: priced.addonItems.length ? JSON.stringify(priced.addonItems) : null,
          coatChoice: input.coatChoice ?? null,
          privacyConsent: true,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath('/admin/dashboard');

    // Push to admins also when admin creates a booking
    pushToAdmins(
      'BOOKING_CREATED',
      buildBookingCreatedAdminPayload(booking, service.name),
      booking.id,
    ).catch((e) => console.error('Admin push failed:', e));

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

  const updated = await prisma.booking.update({
    where: { id: parsed.data.bookingId },
    data: { status: parsed.data.status },
    include: { service: true },
  });
  revalidatePath('/admin/dashboard');

  // Notify admin on every status change
  pushToAdmins(
    'BOOKING_EDITED',
    buildBookingStatusAdminPayload(updated, updated.service.name, parsed.data.status),
    updated.id,
  ).catch((e) => console.error('Admin push failed:', e));

  // Notify client when cancelled
  if (parsed.data.status === 'CANCELLED' && updated.customerPhone) {
    pushToClientPhone(
      updated.customerPhone,
      'BOOKING_CANCELLED',
      buildBookingCancelledClientPayload(updated, updated.service.name),
      updated.id,
    ).catch((e) => console.error('Client push failed:', e));
  }

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

  // Resolve total duration including per-cell (breed×size×coat) overrides.
  let addonIds: string[] = [];
  if (booking.addonItemsJson) {
    try {
      const arr = JSON.parse(booking.addonItemsJson) as Array<{ serviceId?: string }>;
      addonIds = arr.map((x) => x.serviceId).filter((x): x is string => !!x);
    } catch {}
  }
  const pricedEdit = await priceBooking({
    primaryServiceId: booking.serviceId,
    addonServiceIds: addonIds,
    breedName: booking.dogBreed,
    coatChoice: (booking.coatChoice === 'SHORT' || booking.coatChoice === 'LONG') ? booking.coatChoice : null,
    sizeOptionId: booking.sizeOptionId,
  });
  const totalDuration = pricedEdit.totalDurationMin > 0 ? pricedEdit.totalDurationMin : booking.service.durationMin;

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(startsAt.getTime() + totalDuration * 60_000);

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

  // Notify client if the time actually changed
  if (booking.customerPhone && startsAt.getTime() !== booking.startsAt.getTime()) {
    const updatedBooking = { ...booking, startsAt };
    pushToClientPhone(
      booking.customerPhone,
      'BOOKING_EDITED',
      buildBookingRescheduledClientPayload(updatedBooking, booking.service.name, booking.startsAt),
      booking.id,
    ).catch((e) => console.error('Client push failed:', e));
  }

  return { ok: true, data: null };
}

// ── Admin: delete booking ──────────────────────────────────────
export async function deleteBookingAction(bookingId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!bookingId) return { ok: false, error: 'ID mancante' };
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true },
  });
  await prisma.booking.delete({ where: { id: bookingId } });
  revalidatePath('/admin/dashboard');

  if (booking) {
    pushToAdmins(
      'BOOKING_CANCELLED',
      buildBookingCancelledAdminPayload(booking, booking.service.name),
      booking.id,
    ).catch((e) => console.error('Admin push failed:', e));
    if (booking.customerPhone) {
      pushToClientPhone(
        booking.customerPhone,
        'BOOKING_CANCELLED',
        buildBookingCancelledClientPayload(booking, booking.service.name),
        booking.id,
      ).catch((e) => console.error('Client push failed:', e));
    }
  }

  return { ok: true, data: null };
}

// ── Admin: move service up/down (swap sortOrder with neighbour) ──
export async function moveServiceAction(
  id: string,
  direction: 'up' | 'down',
): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return { ok: false, error: 'ID mancante' };
  const svc = await prisma.service.findUnique({ where: { id } });
  if (!svc || svc.deletedAt) return { ok: false, error: 'Servizio non trovato' };
  // Find neighbour in same forAnimal group, by sortOrder.
  const neighbour = await prisma.service.findFirst({
    where: {
      id: { not: id },
      deletedAt: null,
      forAnimal: svc.forAnimal,
      ...(direction === 'up'
        ? { sortOrder: { lt: svc.sortOrder } }
        : { sortOrder: { gt: svc.sortOrder } }),
    },
    orderBy: { sortOrder: direction === 'up' ? 'desc' : 'asc' },
  });
  if (!neighbour) return { ok: true, data: null }; // already at edge
  await prisma.$transaction([
    prisma.service.update({ where: { id: svc.id }, data: { sortOrder: neighbour.sortOrder } }),
    prisma.service.update({ where: { id: neighbour.id }, data: { sortOrder: svc.sortOrder } }),
  ]);
  revalidatePath('/admin/services');
  revalidatePath('/prenota');
  return { ok: true, data: null };
}

// ── Admin: soft-delete service ─────────────────────────────────
// Booking storici restano leggibili (FK intact + serviceName snapshot).
// Nome rinominato con suffisso per liberare il vincolo unique → ricreabile.
export async function deleteServiceAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!id) return { ok: false, error: 'ID mancante' };
  const svc = await prisma.service.findUnique({ where: { id } });
  if (!svc) return { ok: false, error: 'Servizio non trovato' };
  if (svc.deletedAt) return { ok: true, data: null };
  const suffix = `__deleted_${id.slice(-6)}_${Date.now().toString(36)}`;
  await prisma.service.update({
    where: { id },
    data: {
      name: `${svc.name}${suffix}`,
      active: false,
      deletedAt: new Date(),
    },
  });
  revalidatePath('/admin/services');
  revalidatePath('/admin/breeds');
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // If a soft-deleted service with same original name exists → restore it.
    const restoreTarget = await prisma.service.findFirst({
      where: {
        deletedAt: { not: null },
        name: { startsWith: `${parsed.data.name}__deleted_` },
      },
      orderBy: { deletedAt: 'desc' },
    });
    // Append to bottom of its forAnimal group on create (sortOrder = max + 10).
    const maxRow = await prisma.service.aggregate({
      _max: { sortOrder: true },
      where: { deletedAt: null, forAnimal: parsed.data.forAnimal ?? null },
    });
    const nextSortOrder = (maxRow._max.sortOrder ?? 0) + 10;
    const created = restoreTarget
      ? await prisma.service.update({
          where: { id: restoreTarget.id },
          data: { ...parsed.data, deletedAt: null, sortOrder: nextSortOrder },
        })
      : await prisma.service.create({ data: { ...parsed.data, sortOrder: nextSortOrder } });
    // Auto-populate BreedServicePrice if PER_BREED + ALL: row per breed matching forAnimal
    if (created.pricingMode === 'PER_BREED' && created.breedScope === 'ALL') {
      const breeds = await prisma.breed.findMany({
        where: created.forAnimal ? { animalType: created.forAnimal } : {},
        select: { id: true },
      });
      if (breeds.length) {
        // Auto-populate placeholder rows for each breed, but as **opt-out by default**:
        // active=false means the service is not enabled for this breed until admin opts in
        // by setting a price (or toggling Attivo). Avoids spamming "Mancano prezzi" warnings.
        await prisma.breedServicePrice.createMany({
          data: breeds.map((b) => ({
            breedId: b.id,
            serviceId: created.id,
            priceCents: null,
            active: false,
          })),
          skipDuplicates: true,
        });
      }
    }
  }
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/staff');
  revalidatePath('/admin/breeds');
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

  const SLOT_STEP = await getSlotStepMin();
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
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const future = await prisma.booking.findMany({
    where: { startsAt: { gte: startOfToday } },
    select: {
      id: true, startsAt: true, endsAt: true, serviceId: true,
      addonItemsJson: true, dogBreed: true, sizeOptionId: true, coatChoice: true,
    },
  });
  let updated = 0;
  for (const b of future) {
    let addonIds: string[] = [];
    if (b.addonItemsJson) {
      try {
        const arr = JSON.parse(b.addonItemsJson) as Array<{ serviceId?: string }>;
        addonIds = arr.map((x) => x.serviceId).filter((x): x is string => !!x);
      } catch {}
    }
    const priced = await priceBooking({
      primaryServiceId: b.serviceId,
      addonServiceIds: addonIds,
      breedName: b.dogBreed,
      coatChoice: (b.coatChoice === 'SHORT' || b.coatChoice === 'LONG') ? b.coatChoice : null,
      sizeOptionId: b.sizeOptionId,
    });
    if (priced.totalDurationMin <= 0) continue;
    const newEnd = new Date(b.startsAt.getTime() + priced.totalDurationMin * 60_000);
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
    let addonServiceIds: string[] = [];
    if (b.addonItemsJson) {
      try {
        const arr = JSON.parse(b.addonItemsJson) as Array<{ serviceId?: string }>;
        addonServiceIds = arr.map((x) => x.serviceId).filter((x): x is string => !!x);
      } catch {}
    }
    const priced = await priceBooking({
      primaryServiceId: b.serviceId,
      addonServiceIds,
      breedName: b.dogBreed,
      coatChoice: (b.coatChoice as 'SHORT' | 'LONG' | null) ?? null,
      sizeOptionId: b.sizeOptionId ?? null,
    });
    let priceCents = priced.serviceTotalCents;
    if (priceCents === 0) priceCents = b.service.priceCents;
    // Extras (snapshot if present, else from notes)
    const extraNames = parseExtraNamesFromNotes(b.notes);
    for (const n of extraNames) {
      const c = extraByName.get(n);
      if (c) priceCents += c;
    }
    if (priceCents !== b.priceCents) {
      await prisma.booking.update({
        where: { id: b.id },
        data: {
          priceCents,
          bathCents: priced.bathCents,
          trimCents: priced.trimCents,
          touchUpCents: priced.touchUpCents,
          addonItemsJson: priced.addonItems.length ? JSON.stringify(priced.addonItems) : null,
        },
      });
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
    size: parsed.data.size ?? null,
    coatType: parsed.data.coatType ?? null,
    priceMin: parsed.data.priceMin,
    priceMax: parsed.data.priceMax,
    priceTrim: parsed.data.priceTrim ?? null,
    priceTrimLong: parsed.data.priceTrimLong ?? null,
    priceTouchUp: parsed.data.priceTouchUp ?? null,
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

// ── Admin: load breed editor data ─────────────────────────────
export async function getBreedEditorAction(breedId: string): Promise<
  ActionResult<{ rows: BreedServicePriceRow[]; sizes: BreedSizeOptionDTO[] }>
> {
  await requireAdmin();
  const res = await getBreedWithServicePrices(breedId);
  if (!res) return { ok: false, error: 'Razza non trovata' };
  return { ok: true, data: { rows: res.rows, sizes: res.sizes } };
}

// ── Admin: bulk upsert breed↔service prices (size × coat cells) ─
export async function bulkUpsertBreedServicePricesAction(input: {
  breedId: string;
  // For each service: which cells exist (sizeOptionId+coat) with their price; plus a per-service active flag.
  services: Array<{
    serviceId: string;
    active: boolean;
    cells: Array<{
      sizeOptionId: string | null;
      coat: 'SHORT' | 'LONG' | null;
      priceCents: number | null;
      priceLongCents?: number | null;
      durationMin?: number | null;
    }>;
  }>;
}): Promise<ActionResult> {
  await requireAdmin();
  if (!input.breedId) return { ok: false, error: 'breedId mancante' };

  // For each (service), delete existing rows and recreate from `cells`. Simpler than upsert
  // when the cell set may change (sizes added/removed).
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const s of input.services) {
    // If admin entered any positive price, force the service active for this breed
    // (auto-enable on pricing — saves a click). If toggle is explicitly off AND no prices,
    // keep inactive.
    const hasAnyPrice = s.cells.some(
      (c) => (c.priceCents != null && c.priceCents > 0) || (c.priceLongCents != null && c.priceLongCents > 0),
    );
    const effectiveActive = hasAnyPrice ? true : s.active;
    ops.push(
      prisma.breedServicePrice.deleteMany({
        where: { breedId: input.breedId, serviceId: s.serviceId },
      }),
    );
    if (s.cells.length === 0) {
      // No cells means single-variant null/null row for opt-in/out tracking.
      ops.push(
        prisma.breedServicePrice.create({
          data: {
            breedId: input.breedId,
            serviceId: s.serviceId,
            sizeOptionId: null,
            coat: null,
            priceCents: null,
            priceLongCents: null,
            durationMin: null,
            active: effectiveActive,
          },
        }),
      );
      continue;
    }
    for (const c of s.cells) {
      ops.push(
        prisma.breedServicePrice.create({
          data: {
            breedId: input.breedId,
            serviceId: s.serviceId,
            sizeOptionId: c.sizeOptionId,
            coat: c.coat,
            priceCents: c.priceCents,
            priceLongCents: c.priceLongCents ?? null,
            durationMin: c.durationMin != null && c.durationMin > 0 ? c.durationMin : null,
            active: effectiveActive,
          },
        }),
      );
    }
  }
  await prisma.$transaction(ops);
  revalidatePath('/admin/breeds');
  revalidatePath('/prenota');
  return { ok: true, data: null };
}

// ── Admin: bulk replace breed sizes ───────────────────────────
export async function setBreedSizesAction(input: {
  breedId: string;
  sizes: Array<{ id?: string; label: string; sortOrder: number; active: boolean }>;
}): Promise<ActionResult> {
  await requireAdmin();
  if (!input.breedId) return { ok: false, error: 'breedId mancante' };
  // Strategy: update existing by id; create new; soft-delete missing.
  const existing = await prisma.breedSizeOption.findMany({ where: { breedId: input.breedId } });
  const keepIds = new Set(input.sizes.filter((s) => s.id).map((s) => s.id!));
  const toDelete = existing.filter((e) => !keepIds.has(e.id));
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const e of toDelete) {
    ops.push(prisma.breedSizeOption.delete({ where: { id: e.id } }));
  }
  for (const s of input.sizes) {
    const label = s.label.trim();
    if (!label) continue;
    if (s.id) {
      ops.push(
        prisma.breedSizeOption.update({
          where: { id: s.id },
          data: { label, sortOrder: s.sortOrder, active: s.active },
        }),
      );
    } else {
      ops.push(
        prisma.breedSizeOption.create({
          data: { breedId: input.breedId, label, sortOrder: s.sortOrder, active: s.active },
        }),
      );
    }
  }
  await prisma.$transaction(ops);
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

// ── Admin: save slot step (minutes) ────────────────────────────
export async function setSlotStepMinAction(min: number): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(min) || min < 5 || min > 120) {
    return { ok: false, error: 'Valore non valido (5-120 min)' };
  }
  await prisma.setting.upsert({
    where: { key: 'slot_step_min' },
    create: { key: 'slot_step_min', value: String(min) },
    update: { value: String(min) },
  });
  revalidatePath('/admin/hours');
  revalidatePath('/prenota');
  return { ok: true, data: null };
}

// ── Public (no auth): client lookup own upcoming bookings by phone ─
// Rate-limited. Returns minimal info (id, startsAt, serviceName, dogName, status).
export type ClientBookingLite = {
  id: string;
  startsAt: string; // ISO
  endsAt: string;
  serviceName: string;
  dogName: string;
  status: string;
  priceCents: number;
};

function normalizePhone(p: string): string {
  return p.replace(/[\s\-().]/g, '');
}

export async function lookupBookingsByPhoneAction(
  phone: string,
): Promise<ActionResult<{ bookings: ClientBookingLite[] }>> {
  const ip = await getClientIp();
  const rl = rateLimit({ key: `lookup:${ip}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) return { ok: false, error: 'Troppe richieste, riprova tra poco.' };

  const clean = normalizePhone(phone ?? '');
  if (clean.length < 6) return { ok: false, error: 'Numero non valido' };

  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      customerPhone: { contains: clean.slice(-9) }, // last 9 digits, tolerates +39 prefix variations
      startsAt: { gte: now },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    include: { service: true },
    orderBy: { startsAt: 'asc' },
    take: 20,
  });

  return {
    ok: true,
    data: {
      bookings: bookings.map((b) => ({
        id: b.id,
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        serviceName: b.serviceName ?? b.service.name,
        dogName: b.dogName,
        status: b.status,
        priceCents: b.priceCents,
      })),
    },
  };
}

// ── Public (no auth): client cancels their own booking by id + phone match ─
export async function clientCancelBookingAction(input: {
  bookingId: string;
  phone: string;
}): Promise<ActionResult> {
  const ip = await getClientIp();
  const rl = rateLimit({ key: `cancel:${ip}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) return { ok: false, error: 'Troppe richieste, riprova tra poco.' };

  const clean = normalizePhone(input.phone ?? '');
  if (clean.length < 6 || !input.bookingId) return { ok: false, error: 'Dati non validi' };

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { service: true },
  });
  if (!booking) return { ok: false, error: 'Prenotazione non trovata' };

  // Phone match (compare last 9 digits, normalized)
  if (normalizePhone(booking.customerPhone).slice(-9) !== clean.slice(-9)) {
    return { ok: false, error: 'Numero non corrispondente' };
  }
  if (booking.status === 'CANCELLED') return { ok: false, error: 'Già cancellata' };
  if (booking.startsAt.getTime() <= Date.now()) {
    return { ok: false, error: 'Non puoi cancellare una prenotazione passata. Contattaci.' };
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'CANCELLED' },
  });
  revalidatePath('/admin/dashboard');

  // Notify admin
  pushToAdmins(
    'BOOKING_CANCELLED',
    buildBookingCancelledAdminPayload(booking, booking.service.name),
    booking.id,
  ).catch((e) => console.error('Admin push failed:', e));
  // Confirm to client
  if (booking.customerPhone) {
    pushToClientPhone(
      booking.customerPhone,
      'BOOKING_CANCELLED',
      buildBookingCancelledClientPayload(booking, booking.service.name),
      booking.id,
    ).catch((e) => console.error('Client push failed:', e));
  }

  return { ok: true, data: null };
}
