import { prisma } from '@/lib/db';
import { BookingsTable } from '@/components/admin/BookingsTable';
import { WeekCalendar } from '@/components/admin/WeekCalendar';
import { NewBookingDialog } from '@/components/admin/NewBookingDialog';
import { AutoRefresh } from '@/components/admin/AutoRefresh';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllBreedsAdmin } from '@/lib/breeds-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: { range?: string; view?: string };
}) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const view = searchParams.view ?? 'calendar';
  const range = searchParams.range ?? 'upcoming';

  const where =
    range === 'past'
      ? { startsAt: { lt: startOfToday } }
      : range === 'all'
        ? {}
        : { startsAt: { gte: startOfToday } };

  // For calendar: fetch 5 weeks around today
  const calStart = new Date(startOfToday);
  calStart.setDate(calStart.getDate() - 7);
  const calEnd = new Date(startOfToday);
  calEnd.setDate(calEnd.getDate() + 28);

  const [bookings, calendarBookings, totalUpcoming, totalToday, services, breeds] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { startsAt: range === 'past' ? 'desc' : 'asc' },
      include: { service: true },
      take: 200,
    }),
    prisma.booking.findMany({
      where: {
        startsAt: { gte: calStart, lt: calEnd },
        status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] },
      },
      include: { service: true },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.booking.count({
      where: { startsAt: { gte: startOfToday }, status: { in: ['PENDING', 'CONFIRMED'] } },
    }),
    prisma.booking.count({
      where: {
        startsAt: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 86_400_000) },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    }),
    prisma.service.findMany({ orderBy: { name: 'asc' } }),
    getAllBreedsAdmin(),
  ]);

  return (
    <div className="space-y-3 sm:space-y-3">
      <AutoRefresh intervalMs={60_000} />

      {/* Top bar: title + stats + new booking in single row on desktop */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight sm:text-lg">Dashboard</h1>
            <p className="text-[11px] text-muted-foreground sm:text-xs">CleanDOG · Messina</p>
          </div>
          <div className="sm:hidden">
            <NewBookingDialog services={services} breeds={breeds} />
          </div>
        </div>

        {/* Stats — mobile full row, desktop inline compact */}
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border bg-white shadow-sm sm:flex sm:gap-2 sm:bg-transparent sm:border-0 sm:shadow-none sm:overflow-visible">
          <Stat title="Oggi" value={totalToday} />
          <Stat title="Prossime" value={totalUpcoming} hasDivider />
          <Stat title="In lista" value={bookings.length} hasDivider />
        </div>

        <div className="hidden sm:block">
          <NewBookingDialog services={services} breeds={breeds} />
        </div>
      </div>

      {/* View switcher */}
      <div className="flex gap-1.5 overflow-x-auto border-b pb-0.5">
        {([
          ['calendar', '📅', 'Settimana'],
          ['grid', '🕐', 'Calendario'],
          ['list', '📋', 'Lista'],
        ] as const).map(([v, icon, label]) => (
          <a
            key={v}
            href={`/admin/dashboard?view=${v}&range=${range}`}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-colors sm:px-3 sm:py-1 sm:text-xs ${
              view === v
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {icon} {label}
          </a>
        ))}
      </div>

      {/* Week list view */}
      {view === 'calendar' && <WeekCalendar bookings={calendarBookings} />}

      {/* Time-grid calendar view */}
      {view === 'grid' && <WeekCalendar bookings={calendarBookings} mobileView="grid" />}

      {/* List view */}
      {view === 'list' && <BookingsTable bookings={bookings} currentRange={range} />}
    </div>
  );
}

function Stat({ title, value, hasDivider = false }: { title: string; value: number; hasDivider?: boolean }) {
  return (
    <>
      {/* Mobile inline segmented */}
      <div className={`flex flex-col items-center justify-center py-3 sm:hidden ${hasDivider ? 'border-l' : ''}`}>
        <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold leading-tight">{value}</p>
      </div>
      {/* Desktop pill compact */}
      <div className="hidden sm:flex items-baseline gap-1.5 rounded-lg border bg-white px-3 py-1.5 shadow-sm">
        <span className="text-lg font-bold leading-none">{value}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>
    </>
  );
}
