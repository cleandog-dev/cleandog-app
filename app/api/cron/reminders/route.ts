import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pushToAdmins, pushToClientPhone } from '@/lib/push';
import {
  buildReminderAdminPayload,
  buildReminderClientPayload,
} from '@/lib/notify-builders';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function authorize(req: Request): Promise<{ ok: true } | { ok: false; res: Response }> {
  const expected = process.env.CRON_SECRET;
  const auth1 = req.headers.get('authorization');
  if (expected && auth1 === `Bearer ${expected}`) return { ok: true };
  // Allow admin session as fallback (manual trigger from UI)
  const session = await auth();
  if (session?.user) return { ok: true };
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
  const result = await runReminders();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: Request) {
  return GET(req);
}
