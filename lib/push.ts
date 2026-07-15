import 'server-only';
import webpush from 'web-push';
import { prisma } from '@/lib/db';

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@cleandog.local';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!PUBLIC || !PRIVATE) {
    console.warn('[push] VAPID keys missing — notifications disabled');
    return;
  }
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
};

export type NotificationEvent =
  | 'BOOKING_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_EDITED'
  | 'REMINDER_ADMIN'
  | 'REMINDER_CLIENT';

async function sendOne(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  event: NotificationEvent,
  scope: 'ADMIN' | 'CLIENT',
  bookingId?: string,
): Promise<boolean> {
  const payloadStr = JSON.stringify(payload);
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payloadStr,
      { urgency: 'high', TTL: 60 },
    );
    await Promise.all([
      prisma.pushSubscription.update({
        where: { id: sub.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {}),
      prisma.notificationLog.create({
        data: {
          event,
          scope,
          bookingId: bookingId ?? null,
          subscriptionId: sub.id,
          status: 'SENT',
          payload: payloadStr,
        },
      }).catch(() => {}),
    ]);
    return true;
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    const gone = e.statusCode === 404 || e.statusCode === 410;
    const cleanups: Array<Promise<unknown>> = [];
    if (gone) {
      cleanups.push(prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {}));
    }
    cleanups.push(
      prisma.notificationLog.create({
        data: {
          event,
          scope,
          bookingId: bookingId ?? null,
          subscriptionId: sub.id,
          status: 'FAILED',
          error: `${e.statusCode ?? '?'}: ${e.message ?? 'unknown'}`,
          payload: payloadStr,
        },
      }).catch(() => {}),
    );
    await Promise.all(cleanups);
    return false;
  }
}

export async function pushToAdmins(
  event: NotificationEvent,
  payload: PushPayload,
  bookingId?: string,
): Promise<{ sent: number; failed: number; skipped: number }> {
  ensureConfigured();
  if (!configured) return { sent: 0, failed: 0, skipped: 1 };

  const allSubs = await prisma.pushSubscription.findMany({ where: { scope: 'ADMIN' } });

  // Difesa: scarta (ed elimina) subscription il cui utente non esiste più
  // (es. account STAFF eliminato prima che deleteStaffUserAction pulisse le sue).
  // userId null = subscription legacy pre-RBAC: mantenuta per back-compat.
  const linkedIds = Array.from(new Set(allSubs.map((s) => s.userId).filter((x): x is string => !!x)));
  const aliveIds = linkedIds.length
    ? new Set(
        (await prisma.user.findMany({ where: { id: { in: linkedIds } }, select: { id: true } })).map((u) => u.id),
      )
    : new Set<string>();
  const subs = allSubs.filter((s) => !s.userId || aliveIds.has(s.userId));
  const orphans = allSubs.filter((s) => s.userId && !aliveIds.has(s.userId));
  if (orphans.length) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } })
      .catch(() => {});
  }

  if (subs.length === 0) {
    await prisma.notificationLog.create({
      data: { event, scope: 'ADMIN', bookingId: bookingId ?? null, status: 'SKIPPED', error: 'no_subscriptions', payload: JSON.stringify(payload) },
    });
    return { sent: 0, failed: 0, skipped: 1 };
  }

  const results = await Promise.all(
    subs.map((sub) => sendOne(sub, payload, event, 'ADMIN', bookingId)),
  );
  const sent = results.filter(Boolean).length;
  return { sent, failed: results.length - sent, skipped: 0 };
}

export async function pushToClientPhone(
  phone: string,
  event: NotificationEvent,
  payload: PushPayload,
  bookingId?: string,
): Promise<{ sent: number; failed: number; skipped: number }> {
  ensureConfigured();
  if (!configured || !phone) return { sent: 0, failed: 0, skipped: 1 };

  const subs = await prisma.pushSubscription.findMany({
    where: { scope: 'CLIENT', customerPhone: phone },
  });
  if (subs.length === 0) {
    await prisma.notificationLog.create({
      data: { event, scope: 'CLIENT', bookingId: bookingId ?? null, status: 'SKIPPED', error: 'no_subscriptions', payload: JSON.stringify(payload) },
    });
    return { sent: 0, failed: 0, skipped: 1 };
  }

  const results = await Promise.all(
    subs.map((sub) => sendOne(sub, payload, event, 'CLIENT', bookingId)),
  );
  const sent = results.filter(Boolean).length;
  return { sent, failed: results.length - sent, skipped: 0 };
}
