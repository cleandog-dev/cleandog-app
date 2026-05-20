import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

type Body = {
  scope: 'ADMIN' | 'CLIENT';
  customerPhone?: string;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  userAgent?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }

  const { scope, subscription, customerPhone, userAgent } = body;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ ok: false, error: 'Missing subscription' }, { status: 400 });
  }
  if (scope !== 'ADMIN' && scope !== 'CLIENT') {
    return NextResponse.json({ ok: false, error: 'Invalid scope' }, { status: 400 });
  }

  let userId: string | null = null;
  if (scope === 'ADMIN') {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    userId = (session.user as { id?: string }).id ?? null;
  }
  if (scope === 'CLIENT' && !customerPhone) {
    return NextResponse.json({ ok: false, error: 'Phone required for CLIENT scope' }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      scope,
      userId,
      customerPhone: scope === 'CLIENT' ? customerPhone ?? null : null,
      userAgent: userAgent ?? null,
      lastUsedAt: new Date(),
    },
    create: {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      scope,
      userId,
      customerPhone: scope === 'CLIENT' ? customerPhone ?? null : null,
      userAgent: userAgent ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
