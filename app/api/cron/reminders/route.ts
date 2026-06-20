import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pushToAdmins, pushToClientPhone } from '@/lib/push';
import {
  buildReminderAdminPayload,
  buildReminderClientPayload,
} from '@/lib/notify-builders';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Business-hours guard: reminders only matter for bookings during opening hours.
// Window is +50/+70min, earliest useful run ~07:00, latest ~21:00 Europe/Rome.
// Returning early here avoids waking Neon compute (no prisma call) outside this window,
// so the DB scales to zero overnight even if the external cron keeps firing.
function romeHourMinute(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { hour, minute };
}

// True only for one 5-min cron tick per quarter-hour (:00 :15 :30 :45 buckets),
// so a 5-min external cron still hits the DB just ~4x/hour. Reminder window is
// 20min wide (+50/+70), so a 15-min cadence never misses a booking.
function shouldRun(): { run: boolean; reason?: string } {
  const { hour, minute } = romeHourMinute();
  if (hour < 7 || hour >= 21) return { run: false, reason: 'outside-business-hours' };
  if (minute % 15 >= 5) return { run: false, reason: 'throttled-quarter-hour' };
  return { run: true };
}

async function authorize(
  req: Request,
): Promise<{ ok: true; via: 'cron' | 'admin' } | { ok: false; res: Response }> {
  const expected = process.env.CRON_SECRET;
  const auth1 = req.headers.get('authorization');
  if (expected && auth1 === `Bearer ${expected}`) return { ok: true, via: 'cron' };
  // Allow admin session as fallback (manual trigger from UI)
  const session = await auth();
  if (session?.user) return { ok: true, via: 'admin' };
  return { ok: false, res: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
}

async function runReminders() {
  // Window: bookings starting between now+50min and now+70min, not already sent
  const now = new Date();
  const lower = new Date(now.getTime() + 50 * 60_000);
  const upper = new Date(now.getTime() + 70 * 60_000);

  const candidates = await prisma.booking.findMany({
    where: {
      startsAt: { gte: lower, lte: upper },
      reminderSentAt: null,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    include: { service: true },
  });

  let adminSent = 0;
  let clientSent = 0;

  for (const b of candidates) {
    const res1 = await pushToAdmins(
      'REMINDER_ADMIN',
      buildReminderAdminPayload(b, b.service.name),
      b.id,
    );
    adminSent += res1.sent;

    if (b.customerPhone) {
      const res2 = await pushToClientPhone(
        b.customerPhone,
        'REMINDER_CLIENT',
        buildReminderClientPayload(b, b.service.name),
        b.id,
      );
      clientSent += res2.sent;
    }

    await prisma.booking.update({
      where: { id: b.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return { processed: candidates.length, adminSent, clientSent };
}

export async function GET(req: Request) {
  const a = await authorize(req);
  if (!a.ok) return a.res;
  // Skip before touching the DB so Neon stays suspended (scale-to-zero) when no work is due.
  // Admin manual triggers always run (for testing); only the external cron is throttled.
  if (a.via === 'cron') {
    const gate = shouldRun();
    if (!gate.run) {
      return NextResponse.json({ ok: true, skipped: gate.reason });
    }
  }
  const result = await runReminders();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: Request) {
  return GET(req);
}
