import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const subs = await prisma.pushSubscription.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      scope: true,
      endpoint: true,
      userAgent: true,
      customerPhone: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  const logs = await prisma.notificationLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      event: true,
      scope: true,
      status: true,
      error: true,
      bookingId: true,
      subscriptionId: true,
      createdAt: true,
    },
  });

  const env = {
    hasPublicVapid: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    hasPrivateVapid: !!process.env.VAPID_PRIVATE_KEY,
    vapidSubject: process.env.VAPID_SUBJECT ?? null,
    publicVapidPreview: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      ? `${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.slice(0, 8)}...${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.slice(-4)}`
      : null,
  };

  const subSummary = subs.map((s) => ({
    ...s,
    endpointHost: (() => {
      try {
        return new URL(s.endpoint).host;
      } catch {
        return 'invalid';
      }
    })(),
    endpoint: `${s.endpoint.slice(0, 40)}...${s.endpoint.slice(-12)}`,
  }));

  return NextResponse.json({
    ok: true,
    env,
    subscriptionsCount: subs.length,
    subscriptions: subSummary,
    recentLogs: logs,
  });
}
