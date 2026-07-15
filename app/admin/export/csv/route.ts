import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Neutralizza formula injection (Excel/Sheets eseguono celle che iniziano
// con = + - @): prefissa con apostrofo, poi quota per il CSV.
function csvCell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  // Solo ADMIN: l'export contiene l'intera anagrafica clienti (PII).
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const range = url.searchParams.get('range') ?? 'upcoming';
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const where =
    range === 'past'
      ? { startsAt: { lt: startToday } }
      : range === 'all'
        ? {}
        : { startsAt: { gte: startToday } };

  const bookings = await prisma.booking.findMany({
    where,
    include: { service: true },
    orderBy: { startsAt: 'asc' },
  });

  const headers = [
    'ID',
    'Data',
    'Ora',
    'Cliente',
    'Email',
    'Telefono',
    'Cane',
    'Razza',
    'Taglia',
    'Servizio',
    'Durata (min)',
    'Prezzo (€)',
    'Stato',
    'Note',
  ];
  const rows = bookings.map((b) => {
    const local = toZonedTime(b.startsAt, APP_TIMEZONE);
    return [
      b.id,
      format(local, 'yyyy-MM-dd'),
      format(local, 'HH:mm'),
      b.customerName,
      b.customerEmail,
      b.customerPhone,
      b.dogName,
      b.dogBreed ?? '',
      b.dogSize,
      b.service.name,
      String(b.service.durationMin),
      (b.priceCents / 100).toFixed(2),
      b.status,
      (b.notes ?? '').replace(/\n/g, ' '),
    ];
  });

  const csv = [headers, ...rows]
    .map((r) => r.map(csvCell).join(','))
    .join('\n');

  return new NextResponse('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cleandog-bookings-${range}-${format(now, 'yyyyMMdd-HHmm')}.csv"`,
    },
  });
}
