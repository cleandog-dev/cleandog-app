'use server';

import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { after } from 'next/server';
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
  StaffCreateSchema,
} from '@/lib/schema';
import { rateLimit } from '@/lib/rate-limit';
import { sendBookingConfirmation } from '@/lib/email';
import { auth } from '@/lib/auth';
import { findBreedByName, getBreedWithServicePrices, getAllBreedsAdmin, getPricesMapForAnimal, type BreedServicePriceRow, type BreedSizeOptionDTO } from '@/lib/breeds-server';
import { toZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE, parseExtraNamesFromNotes } from '@/lib/utils';
import { getSlotStepMin, getMaxConcurrentBookings } from '@/lib/settings';
import { pushToAdmins, pushToClientPhone } from '@/lib/push';
import {
  buildBookingCreatedAdminPayload,
  buildBookingConfirmedClientPayload,
  buildBookingCancelledAdminPayload,
  buildBookingCancelledClientPayload,
  buildBookingEditedAdminPayload,
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

  // Orari di apertura: l'UI mostra solo slot validi, ma un POST diretto a
  // /api/book può inviare qualsiasi orario — il server rivalida sempre.
  // Stessa semantica di getAvailableSlots: inizio ≥ apertura, fine ≤ chiusura.
  const localStart = toZonedTime(startsAt, APP_TIMEZONE);
  const startMinute = localStart.getHours() * 60 + localStart.getMinutes();
  const dayOpenings = await prisma.openingHour.findMany({
    where: { dayOfWeek: localStart.getDay(), active: true },
  });
  const insideOpening = dayOpenings.some(
    (o) => startMinute >= o.openMinute && startMinute + totalDuration <= o.closeMinute,
  );
  if (!insideOpening) {
    return { ok: false, error: 'Orario fuori dagli orari di apertura. Scegli un altro slot.' };
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // Closure check
      const closure = await tx.closure.findFirst({
        where: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      });
      if (closure) throw new Error('CLOSED');

      // Capacity check: count overlapping bookings; reject if >= max concurrent.
      const [overlapCount, maxConcurrent] = await Promise.all([
        tx.booking.count({
          where: {
            status: { in: ['PENDING', 'CONFIRMED'] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
        }),
        getMaxConcurrentBookings(),
      ]);
      if (overlapCount >= maxConcurrent) throw new Error('OVERLAP');

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

    // Email di conferma: dentro after() — su Vercel il fire-and-forget nudo
    // può essere ucciso quando la response parte prima che Resend risponda.
    if (booking.customerEmail) {
      after(() =>
        sendBookingConfirmation({
          to: booking.customerEmail,
          customerName: booking.customerName,
          dogName: booking.dogName,
          serviceName: service.name,
          startsAt: booking.startsAt,
          priceCents: booking.priceCents,
        }).catch((e) => console.error('Email send failed:', e)),
      );
    }

    // Push notification → admin (new booking)
    after(() =>
      pushToAdmins(
        'BOOKING_CREATED',
        buildBookingCreatedAdminPayload(booking, service.name),
        booking.id,
      ).catch((e) => console.error('Admin push failed:', e)),
    );

    // Push notification → client (booking confirmed, if already subscribed for phone)
    if (booking.customerPhone) {
      after(() =>
        pushToClientPhone(
          booking.customerPhone,
          'BOOKING_CONFIRMED',
          buildBookingConfirmedClientPayload(booking, service.name),
          booking.id,
        ).catch((e) => console.error('Client push failed:', e)),
      );
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
  await requireStaffOrAdmin();
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

        const [overlapCount, maxConcurrent] = await Promise.all([
          tx.booking.count({
            where: {
              status: { in: ['PENDING', 'CONFIRMED'] },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          }),
          getMaxConcurrentBookings(),
        ]);
        if (overlapCount >= maxConcurrent) throw new Error('OVERLAP');
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
    after(() =>
      pushToAdmins(
        'BOOKING_CREATED',
        buildBookingCreatedAdminPayload(booking, service.name),
        booking.id,
      ).catch((e) => console.error('Admin push failed:', e)),
    );

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

// ── Role guards ────────────────────────────────────────────────
// `requireAdmin` è strict: solo ruolo ADMIN passa. Doppio check: token + DB lookup
// (così se l'utente viene eliminato il suo JWT residuo non vale più nulla).
async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN' || !session.user.id) {
    throw new Error('FORBIDDEN');
  }
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!u || u.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return session;
}

// `requireStaffOrAdmin` consente ADMIN o STAFF. Stesso pattern doppio check.
async function requireStaffOrAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  if ((role !== 'ADMIN' && role !== 'STAFF') || !session?.user?.id) {
    throw new Error('UNAUTHORIZED');
  }
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!u || (u.role !== 'ADMIN' && u.role !== 'STAFF')) {
    throw new Error('FORBIDDEN');
  }
  return session;
}

// ── Admin: update booking status ───────────────────────────────
export async function updateBookingStatusAction(
  raw: unknown,
): Promise<ActionResult> {
  await requireStaffOrAdmin();
  const parsed = BookingStatusUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Input non valido' };

  let updated;
  try {
    updated = await prisma.booking.update({
      where: { id: parsed.data.bookingId },
      data: { status: parsed.data.status },
      include: { service: true },
    });
  } catch (e) {
    // P2025 = record inesistente (già eliminato da un'altra tab/utente)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return { ok: false, error: 'Prenotazione non trovata (forse già eliminata)' };
    }
    throw e;
  }
  revalidatePath('/admin/dashboard');

  // Notify admin on every status change
  after(() =>
    pushToAdmins(
      'BOOKING_EDITED',
      buildBookingStatusAdminPayload(updated, updated.service.name, parsed.data.status),
      updated.id,
    ).catch((e) => console.error('Admin push failed:', e)),
  );

  // Notify client when cancelled
  if (parsed.data.status === 'CANCELLED' && updated.customerPhone) {
    after(() =>
      pushToClientPhone(
        updated.customerPhone,
        'BOOKING_CANCELLED',
        buildBookingCancelledClientPayload(updated, updated.service.name),
        updated.id,
      ).catch((e) => console.error('Client push failed:', e)),
    );
  }

  return { ok: true, data: null };
}

// ── Admin: edit booking date/time ─────────────────────────────
export async function editBookingAction(raw: unknown): Promise<ActionResult> {
  await requireStaffOrAdmin();
  const parsed = BookingEditSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Dati non validi', fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const input = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { service: true },
  });
  if (!booking) return { ok: false, error: 'Prenotazione non trovata' };

  // Resolve effective fields (use input value if provided, else keep existing).
  const effectiveServiceId = input.serviceId ?? booking.serviceId;
  const effectiveBreed = input.dogBreed !== undefined ? (input.dogBreed || null) : booking.dogBreed;
  const effectiveSizeOptionId = input.sizeOptionId !== undefined ? (input.sizeOptionId || null) : booking.sizeOptionId;
  const effectiveCoat = input.coatChoice !== undefined
    ? input.coatChoice
    : ((booking.coatChoice === 'SHORT' || booking.coatChoice === 'LONG') ? booking.coatChoice : null);

  // Resolve addons. If client passed addonServiceIds, use them; else parse existing snapshot.
  let existingAddonIds: string[] = [];
  if (booking.addonItemsJson) {
    try {
      const arr = JSON.parse(booking.addonItemsJson) as Array<{ serviceId?: string }>;
      existingAddonIds = arr.map((x) => x.serviceId).filter((x): x is string => !!x);
    } catch {}
  }
  const addonIds: string[] =
    input.addonServiceIds !== undefined ? input.addonServiceIds : existingAddonIds;

  // Load updated service (if changed) to get fresh defaults for duration/price.
  const effService = effectiveServiceId === booking.serviceId
    ? booking.service
    : await prisma.service.findUnique({ where: { id: effectiveServiceId } });
  if (!effService) return { ok: false, error: 'Servizio non trovato' };

  const pricedEdit = await priceBooking({
    primaryServiceId: effectiveServiceId,
    addonServiceIds: addonIds,
    breedName: effectiveBreed,
    coatChoice: (effectiveCoat === 'SHORT' || effectiveCoat === 'LONG') ? effectiveCoat : null,
    sizeOptionId: effectiveSizeOptionId,
  });
  const totalDuration = pricedEdit.totalDurationMin > 0 ? pricedEdit.totalDurationMin : effService.durationMin;

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + totalDuration * 60_000);

  // Recompute price snapshot if any pricing-affecting field changed
  const pricingChanged =
    input.serviceId !== undefined ||
    input.addonServiceIds !== undefined ||
    input.dogBreed !== undefined ||
    input.sizeOptionId !== undefined ||
    input.coatChoice !== undefined;

  let newPriceCents = booking.priceCents;
  let newAddonItemsJson = booking.addonItemsJson;
  let newBathCents = booking.bathCents;
  let newTrimCents = booking.trimCents;
  let newTouchUpCents = booking.touchUpCents;
  if (pricingChanged) {
    let p = pricedEdit.serviceTotalCents;
    if (p === 0) p = effService.priceCents;
    // Keep extras snapshot as-is (no change here)
    p += booking.extrasCents ?? 0;
    newPriceCents = p;
    newAddonItemsJson = pricedEdit.addonItems.length ? JSON.stringify(pricedEdit.addonItems) : null;
    newBathCents = pricedEdit.bathCents;
    newTrimCents = pricedEdit.trimCents;
    newTouchUpCents = pricedEdit.touchUpCents;
  }

  // Resolve dogSize label snapshot if size changed
  let newDogSizeLabel = booking.dogSizeLabel;
  if (input.sizeOptionId !== undefined) {
    if (effectiveSizeOptionId) {
      const sz = await prisma.breedSizeOption.findUnique({ where: { id: effectiveSizeOptionId } });
      newDogSizeLabel = sz?.label ?? null;
    } else {
      newDogSizeLabel = null;
    }
  }

  // Resolve dogSize enum from breed if breed changed
  let newDogSize: typeof booking.dogSize = booking.dogSize;
  if (input.dogBreed !== undefined) {
    if (effectiveBreed) {
      const b = await findBreedByName(effectiveBreed);
      newDogSize = b ? b.size : null;
    } else {
      newDogSize = null;
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const [overlapCount, maxConcurrent] = await Promise.all([
        tx.booking.count({
          where: {
            id: { not: booking.id },
            status: { in: ['PENDING', 'CONFIRMED'] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
        }),
        getMaxConcurrentBookings(),
      ]);
      if (overlapCount >= maxConcurrent) throw new Error('OVERLAP');

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          startsAt,
          endsAt,
          notes: input.notes !== undefined ? (input.notes || null) : booking.notes,
          customerName: input.customerName ?? booking.customerName,
          customerEmail: input.customerEmail !== undefined ? input.customerEmail.toLowerCase() : booking.customerEmail,
          customerPhone: input.customerPhone ?? booking.customerPhone,
          dogName: input.dogName !== undefined ? (input.dogName || '') : booking.dogName,
          dogBreed: input.dogBreed !== undefined ? (input.dogBreed || null) : booking.dogBreed,
          dogSize: newDogSize,
          sizeOptionId: input.sizeOptionId !== undefined ? (effectiveSizeOptionId || null) : booking.sizeOptionId,
          dogSizeLabel: newDogSizeLabel,
          coatChoice: input.coatChoice !== undefined ? (input.coatChoice || null) : booking.coatChoice,
          serviceId: effectiveServiceId,
          serviceName: effectiveServiceId === booking.serviceId ? booking.serviceName : effService.name,
          priceCents: newPriceCents,
          bathCents: newBathCents,
          trimCents: newTrimCents,
          touchUpCents: newTouchUpCents,
          addonItemsJson: newAddonItemsJson,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    if (e instanceof Error && e.message === 'OVERLAP') {
      return { ok: false, error: 'Orario non disponibile — si sovrappone a un altro appuntamento.' };
    }
    return { ok: false, error: 'Errore inatteso' };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/prenotazioni');
  revalidatePath('/admin/staff');
  revalidatePath('/admin/clienti');
  revalidatePath('/admin/dashboard');

  // Diff dei campi modificati (etichette leggibili per la notifica admin).
  // `relevant` = modifica operativa (calendario/durata/prezzo) → merita un push.
  // Modifiche solo anagrafiche (nomi, contatti, note) non notificano, ma se
  // salvate insieme a una modifica operativa compaiono comunque nell'elenco.
  const changes: string[] = [];
  let pushWorthy = false;
  const addChange = (label: string, relevant: boolean) => {
    changes.push(label);
    if (relevant) pushWorthy = true;
  };
  if (startsAt.getTime() !== booking.startsAt.getTime()) addChange('data/ora', true);
  if (input.serviceId !== undefined && input.serviceId !== booking.serviceId) addChange('servizio', true);
  if (input.addonServiceIds !== undefined) {
    const prev = [...existingAddonIds].sort().join(',');
    const next = [...input.addonServiceIds].sort().join(',');
    if (prev !== next) addChange('servizi aggiuntivi', true);
  }
  if (input.dogBreed !== undefined && (input.dogBreed || null) !== booking.dogBreed) addChange('razza', true);
  if (input.sizeOptionId !== undefined && (effectiveSizeOptionId || null) !== booking.sizeOptionId) addChange('taglia', true);
  if (input.coatChoice !== undefined && (input.coatChoice || null) !== booking.coatChoice) addChange('pelo', true);
  if (input.customerName !== undefined && input.customerName !== booking.customerName) addChange('nome cliente', false);
  if (input.customerPhone !== undefined && input.customerPhone !== booking.customerPhone) addChange('telefono', false);
  if (input.customerEmail !== undefined && input.customerEmail.toLowerCase() !== booking.customerEmail) addChange('email', false);
  if (input.dogName !== undefined && (input.dogName || '') !== booking.dogName) addChange('nome animale', false);
  if (input.notes !== undefined && (input.notes || null) !== booking.notes) addChange('note', false);

  // Notify admins only when an operational change happened
  if (pushWorthy) {
    const updatedForPush = {
      ...booking,
      startsAt,
      customerName: input.customerName ?? booking.customerName,
      customerPhone: input.customerPhone ?? booking.customerPhone,
      dogName: input.dogName !== undefined ? (input.dogName || '') : booking.dogName,
      dogBreed: effectiveBreed,
      priceCents: newPriceCents,
    };
    after(() =>
      pushToAdmins(
        'BOOKING_EDITED',
        buildBookingEditedAdminPayload(updatedForPush, effService.name, changes),
        booking.id,
      ).catch((e) => console.error('Admin push failed:', e)),
    );
  }

  // Notify client if the time actually changed
  if (booking.customerPhone && startsAt.getTime() !== booking.startsAt.getTime()) {
    const updatedBooking = { ...booking, startsAt };
    after(() =>
      pushToClientPhone(
        booking.customerPhone,
        'BOOKING_EDITED',
        buildBookingRescheduledClientPayload(updatedBooking, booking.service.name, booking.startsAt),
        booking.id,
      ).catch((e) => console.error('Client push failed:', e)),
    );
  }

  return { ok: true, data: null };
}

// ── Admin: delete booking ──────────────────────────────────────
export async function deleteBookingAction(bookingId: string): Promise<ActionResult> {
  await requireStaffOrAdmin();
  if (!bookingId) return { ok: false, error: 'ID mancante' };
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true },
  });
  if (!booking) return { ok: false, error: 'Prenotazione non trovata (forse già eliminata)' };
  try {
    await prisma.booking.delete({ where: { id: bookingId } });
  } catch (e) {
    // Race doppia-tab: già eliminata nel frattempo → esito idempotente, niente push doppio.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      revalidatePath('/admin/dashboard');
      return { ok: true, data: null };
    }
    throw e;
  }
  revalidatePath('/admin/dashboard');

  if (booking) {
    after(() =>
      pushToAdmins(
        'BOOKING_CANCELLED',
        buildBookingCancelledAdminPayload(booking, booking.service.name),
        booking.id,
      ).catch((e) => console.error('Admin push failed:', e)),
    );
    if (booking.customerPhone) {
      after(() =>
        pushToClientPhone(
          booking.customerPhone,
          'BOOKING_CANCELLED',
          buildBookingCancelledClientPayload(booking, booking.service.name),
          booking.id,
        ).catch((e) => console.error('Client push failed:', e)),
      );
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
  busyWith?: string;     // joined dog names (back-compat: 'foo, bar')
  busyCount?: number;    // how many bookings overlap this slot
  capacity?: number;     // max concurrent at compute time
  busyDogs?: string[];   // individual dog names occupying the slot
};

export async function getDayOverviewAction({
  serviceId,
  date,
  excludeBookingId,
}: {
  serviceId: string;
  date: string; // YYYY-MM-DD
  // When editing an existing booking, pass its id so its own slot doesn't count
  // toward the busy/capacity calculation on overlapping times.
  excludeBookingId?: string;
}): Promise<{ ok: true; data: DaySlot[] } | { ok: false; error: string }> {
  await requireStaffOrAdmin();
  const { fromZonedTime, toZonedTime } = await import('date-fns-tz');
  const { addMinutes, format } = await import('date-fns');
  const { APP_TIMEZONE } = await import('@/lib/utils');

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return { ok: false, error: 'Servizio non trovato' };

  const localMidnight = fromZonedTime(`${date}T00:00:00`, APP_TIMEZONE);
  const localDayEnd = fromZonedTime(`${date}T23:59:59`, APP_TIMEZONE);
  const dayOfWeek = toZonedTime(localMidnight, APP_TIMEZONE).getDay();

  const [openings, closures, bookings, SLOT_STEP, MAX_CONCURRENT] = await Promise.all([
    prisma.openingHour.findMany({ where: { dayOfWeek, active: true } }),
    prisma.closure.findMany({
      where: { AND: [{ startsAt: { lt: localDayEnd } }, { endsAt: { gt: localMidnight } }] },
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        startsAt: { lt: localDayEnd },
        endsAt: { gt: localMidnight },
        ...(excludeBookingId ? { NOT: { id: excludeBookingId } } : {}),
      },
      select: { startsAt: true, endsAt: true, dogName: true, dogBreed: true },
    }),
    getSlotStepMin(),
    getMaxConcurrentBookings(),
  ]);
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

    const overlapping = bookings.filter(
      (b) => slotStart < b.endsAt && slotEnd > b.startsAt,
    );
    const busyCount = overlapping.length;
    const busyDogs = overlapping.map((b) => {
      const name = b.dogName || b.dogBreed || 'occupato';
      const s = format(toZonedTime(b.startsAt, APP_TIMEZONE), 'HH:mm');
      const e = format(toZonedTime(b.endsAt, APP_TIMEZONE), 'HH:mm');
      return `${name} (${s}–${e})`;
    });
    if (busyCount >= MAX_CONCURRENT) {
      result.push({
        time,
        startISO,
        status: 'busy',
        busyWith: busyDogs.join(', '),
        busyCount,
        capacity: MAX_CONCURRENT,
        busyDogs,
      });
      continue;
    }

    result.push({
      time,
      startISO,
      status: 'free',
      busyCount,
      capacity: MAX_CONCURRENT,
      busyDogs: busyCount > 0 ? busyDogs : undefined,
      busyWith: busyCount > 0 ? busyDogs.join(', ') : undefined,
    });
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
  try {
    await prisma.closure.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return { ok: false, error: 'Chiusura già eliminata' };
    }
    throw e;
  }
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
  try {
    await prisma.breed.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return { ok: false, error: 'Razza già eliminata' };
    }
    throw e;
  }
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
  try {
    await prisma.extra.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return { ok: false, error: 'Extra già eliminato' };
    }
    throw e;
  }
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

// ── Admin: save max concurrent bookings (postazioni in parallelo) ──
export async function setMaxConcurrentBookingsAction(max: number): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(max) || max < 1 || max > 10) {
    return { ok: false, error: 'Valore non valido (1-10 postazioni)' };
  }
  await prisma.setting.upsert({
    where: { key: 'max_concurrent_bookings' },
    create: { key: 'max_concurrent_bookings', value: String(max) },
    update: { value: String(max) },
  });
  revalidatePath('/admin/hours');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/staff');
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
  after(() =>
    pushToAdmins(
      'BOOKING_CANCELLED',
      buildBookingCancelledAdminPayload(booking, booking.service.name),
      booking.id,
    ).catch((e) => console.error('Admin push failed:', e)),
  );
  // Confirm to client
  if (booking.customerPhone) {
    after(() =>
      pushToClientPhone(
        booking.customerPhone,
        'BOOKING_CANCELLED',
        buildBookingCancelledClientPayload(booking, booking.service.name),
        booking.id,
      ).catch((e) => console.error('Client push failed:', e)),
    );
  }

  return { ok: true, data: null };
}

// ── Admin: Clienti aggregati (virtuali, no DB schema change) ────────
import {
  aggregateClients as _aggregateClients,
  aggregateClientDetail as _aggregateClientDetail,
  normalizePhone as _normalizePhone,
  type ClientSummary,
  type ClientDetail,
} from '@/lib/clients';

export async function listClientsAction(
  params: { search?: string; limit?: number } = {},
): Promise<ActionResult<{ clients: ClientSummary[] }>> {
  // STAFF deve poter cercare clienti esistenti dal picker in NewBookingDialog.
  // Non leakka dati: STAFF già vede tutti name/phone/email nelle prenotazioni.
  await requireStaffOrAdmin();
  const rows = await prisma.booking.findMany({
    select: {
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      dogName: true,
      dogBreed: true,
      dogSize: true,
      sizeOptionId: true,
      coatChoice: true,
      status: true,
      startsAt: true,
      priceCents: true,
    },
    orderBy: { startsAt: 'desc' },
    take: 5000,
  });
  let clients = _aggregateClients(rows);
  const q = params.search?.trim().toLowerCase();
  if (q) {
    const qDigits = q.replace(/[^\d]/g, '');
    clients = clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (qDigits.length > 0 && (c.phoneKey.includes(qDigits) || c.phone.includes(qDigits))),
    );
  }
  if (params.limit && params.limit > 0) clients = clients.slice(0, params.limit);
  return { ok: true, data: { clients } };
}

export async function getClientDetailAction(
  phoneKey: string,
): Promise<ActionResult<{ client: ClientDetail | null }>> {
  // STAFF: serve per auto-compilare i dati di un cliente esistente nella creazione prenotazione.
  await requireStaffOrAdmin();
  const normalized = _normalizePhone(phoneKey);
  if (!normalized) return { ok: true, data: { client: null } };
  // Prisma can't natively filter "endsWith N digits after stripping non-digits".
  // Load recent bookings then filter in JS. Cap at 5000 for safety.
  const all = await prisma.booking.findMany({
    include: { service: true },
    orderBy: { startsAt: 'desc' },
    take: 5000,
  });
  const filtered = all.filter((b) => _normalizePhone(b.customerPhone) === normalized);
  if (filtered.length === 0) return { ok: true, data: { client: null } };
  return { ok: true, data: { client: _aggregateClientDetail(filtered) } };
}

// ── Admin: dati per il form completo di modifica prenotazione ───────
// Carica services + breeds + extras + pricesByAnimal al volo per
// BookingDetailDialog in modalità edit. Nessuna scrittura DB.
export async function getBookingEditDataAction(): Promise<ActionResult<{
  services: Awaited<ReturnType<typeof prisma.service.findMany>>;
  breeds: Awaited<ReturnType<typeof getAllBreedsAdmin>>;
  extras: Awaited<ReturnType<typeof prisma.extra.findMany>>;
  pricesByAnimal: { DOG: Awaited<ReturnType<typeof getPricesMapForAnimal>>; CAT: Awaited<ReturnType<typeof getPricesMapForAnimal>> };
}>> {
  await requireStaffOrAdmin();
  const [services, breeds, extras, dogPrices, catPrices] = await Promise.all([
    prisma.service.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } }),
    getAllBreedsAdmin(),
    prisma.extra.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    getPricesMapForAnimal('DOG'),
    getPricesMapForAnimal('CAT'),
  ]);
  return { ok: true, data: { services, breeds, extras, pricesByAnimal: { DOG: dogPrices, CAT: catPrices } } };
}

// ── Admin/Staff: aggiorna manualmente prezzo finale di una prenotazione ──
// Usato per sconti, rincari, arrotondamenti decisi sul posto.
export async function updateBookingPriceAction(input: {
  bookingId: string;
  priceCents: number;
}): Promise<ActionResult<{ priceCents: number }>> {
  await requireStaffOrAdmin();
  const bookingId = String(input?.bookingId ?? '').trim();
  const priceCents = Number(input?.priceCents);
  if (!bookingId) return { ok: false, error: 'Prenotazione non specificata' };
  if (!Number.isFinite(priceCents) || priceCents < 0 || priceCents > 10_000_00) {
    return { ok: false, error: 'Prezzo non valido (0 - 10.000 €)' };
  }
  const intCents = Math.round(priceCents);
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { priceCents: intCents },
    select: { id: true, priceCents: true },
  });
  revalidatePath('/admin');
  revalidatePath('/admin/staff');
  revalidatePath('/admin/prenotazioni');
  revalidatePath('/admin/clienti');
  return { ok: true, data: { priceCents: updated.priceCents } };
}

// ── Admin: gestione account STAFF ───────────────────────────────────
// Genera password forte 16-char URL-safe (96 bit entropy da crypto.randomBytes).
function generateStrongPassword(): string {
  return randomBytes(12).toString('base64url').slice(0, 16);
}

export type StaffUserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

export async function listStaffUsersAction(): Promise<ActionResult<{ users: StaffUserRow[] }>> {
  await requireAdmin();
  const users = await prisma.user.findMany({
    where: { role: 'STAFF' },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return { ok: true, data: { users } };
}

export async function createStaffUserAction(
  raw: unknown,
): Promise<ActionResult<{ password: string; user: StaffUserRow }>> {
  await requireAdmin();
  const parsed = StaffCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Dati non validi',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const password = generateStrongPassword();
  const hash = await bcrypt.hash(password, 10);
  try {
    const created = await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name,
        password: hash,
        role: 'STAFF',
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    revalidatePath('/admin/impostazioni');
    return { ok: true, data: { password, user: created } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'Email già usata' };
    }
    return { ok: false, error: 'Errore inatteso' };
  }
}

export async function resetStaffPasswordAction(userId: string): Promise<ActionResult<{ password: string }>> {
  const session = await requireAdmin();
  const id = String(userId ?? '').trim();
  if (!id) return { ok: false, error: 'ID mancante' };
  if (id === session.user.id) return { ok: false, error: 'Non puoi resettare la tua password qui' };
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target || target.role !== 'STAFF') return { ok: false, error: 'Account non trovato' };
  const password = generateStrongPassword();
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { password: hash } });
  return { ok: true, data: { password } };
}

export async function deleteStaffUserAction(userId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const id = String(userId ?? '').trim();
  if (!id) return { ok: false, error: 'ID mancante' };
  if (id === session.user.id) return { ok: false, error: 'Non puoi eliminare te stesso' };
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target || target.role !== 'STAFF') return { ok: false, error: 'Account non trovato' };
  await prisma.$transaction([
    // Le sue subscription push muoiono con l'account: il dispositivo di un ex
    // dipendente non deve più ricevere notifiche con dati dei clienti.
    prisma.pushSubscription.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);
  revalidatePath('/admin/impostazioni');
  return { ok: true, data: null };
}
