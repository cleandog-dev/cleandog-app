import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import {
  computePeriodComparison,
  computeLifetimeRevenue,
  computeYTDComparison,
  computeTTMComparison,
  bookingsChart,
  topClientsInPeriod,
  topServicesInPeriod,
  periodTitle,
  type Period,
} from '@/lib/dashboard-stats';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

const VALID_PERIODS: Period[] = ['week', 'month', 'quarter', 'semester', 'year'];

export default async function AdminLandingPage(
  props: { searchParams: Promise<{ period?: string; offset?: string }> },
) {
  // STAFF non vede la dashboard riassuntiva — rimbalza alla pagina "Personale".
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') redirect('/admin/staff');
  const sp = await props.searchParams;
  const raw = sp.period as Period | undefined;
  const period: Period = raw && VALID_PERIODS.includes(raw) ? raw : 'month';
  const rawOffset = parseInt(sp.offset ?? '0', 10);
  const offset = Number.isFinite(rawOffset) ? Math.max(-120, Math.min(120, rawOffset)) : 0;

  const now = new Date();
  const rows = await prisma.booking.findMany({
    select: {
      status: true,
      startsAt: true,
      priceCents: true,
      serviceName: true,
      customerName: true,
      customerPhone: true,
      dogName: true,
      service: { select: { name: true } },
    },
    orderBy: { startsAt: 'asc' },
  });

  const comparison = computePeriodComparison(rows, period, now, offset);
  const lifetime = computeLifetimeRevenue(rows, now);
  const ytd = computeYTDComparison(rows, now);
  const ttm = computeTTMComparison(rows, now);
  const chart = bookingsChart(rows, period, now, offset);
  const tc = topClientsInPeriod(rows, period, 5, now, offset);
  const ts = topServicesInPeriod(rows, period, 5, now, offset);
  const title = periodTitle(period, now, offset);

  return (
    <AdminDashboard
      period={period}
      offset={offset}
      periodTitle={title}
      nowISO={now.toISOString()}
      comparison={comparison}
      ytd={ytd}
      ttm={ttm}
      lifetime={lifetime}
      chart={chart}
      topClients={tc}
      topServices={ts}
    />
  );
}
