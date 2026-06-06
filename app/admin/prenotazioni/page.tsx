import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { BookingsTable } from '@/components/admin/BookingsTable';
import { WeekCalendar } from '@/components/admin/WeekCalendar';
import { NewBookingDialog } from '@/components/admin/NewBookingDialog';
import { AutoRefresh } from '@/components/admin/AutoRefresh';
import { getAllBreedsAdmin, getPricesMapForAnimal } from '@/lib/breeds-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prenotazioni' };

export default async function AdminPrenotazioniPage(
  props: {
    searchParams: Promise<{ range?: string; view?: string }>;
  }
) {
  const session = await auth();
  const isAdmin = session?.user?.role === 'ADMIN';
  const searchParams = await props.searchParams;
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

  const calStart = new Date(startOfToday);
  calStart.setDate(calStart.getDate() - 7);
  const calEnd = new Date(startOfToday);
  calEnd.setDate(calEnd.getDate() + 28);

  const [bookings, calendarBookings, totalUpcoming, totalToday, services, breeds, extras, dogPrices, catPrices] = await Promise.all([
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
      take: 500,
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
    prisma.service.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } }),
    getAllBreedsAdmin(),
    prisma.extra.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    getPricesMapForAnimal('DOG'),
    getPricesMapForAnimal('CAT'),
  ]);

  const pricesByAnimal = { DOG: dogPrices, CAT: catPrices };

  return (
    <div className="space-y-3 sm:space-y-3">
      <AutoRefresh intervalMs={180_000} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight sm:text-lg">Prenotazioni</h1>
            <p className="text-[11px] text-muted-foreground sm:text-xs">CleanDOG · Messina</p>
          </div>
          <div className="sm:hidden">
            <NewBookingDialog services={services} breeds={breeds} extras={extras} pricesByAnimal={pricesByAnimal} isAdmin={isAdmin} />
          </div>
        </div>

        <div className="grid grid-cols-3 overflow-hidden rounded-xl border bg-white shadow-sm sm:flex sm:gap-2 sm:bg-transparent sm:border-0 sm:shadow-none sm:overflow-visible">
          <Stat title="Oggi" value={totalToday} />
          <Stat title="Prossime" value={totalUpcoming} hasDivider />
          <Stat title="In lista" value={bookings.length} hasDivider />
        </div>

        <div className="hidden sm:block">
          <NewBookingDialog services={services} breeds={breeds} extras={extras} pricesByAnimal={pricesByAnimal} isAdmin={isAdmin} />
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-b pb-0.5">
        {([
          ['calendar', '📅', 'Settimana'],
          ['grid', '🕐', 'Calendario'],
          ['list', '📋', 'Lista'],
        ] as const).map(([v, icon, label]) => (
          <a
            key={v}
            href={`/admin/prenotazioni?view=${v}&range=${range}`}
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

      {view === 'calendar' && <WeekCalendar bookings={calendarBookings} isAdmin={isAdmin} />}
      {view === 'grid' && <WeekCalendar bookings={calendarBookings} mobileView="grid" isAdmin={isAdmin} />}
      {view === 'list' && <BookingsTable bookings={bookings} currentRange={range} isAdmin={isAdmin} />}
    </div>
  );
}

function Stat({ title, value, hasDivider = false }: { title: string; value: number; hasDivider?: boolean }) {
  return (
    <>
      <div className={`flex flex-col items-center justify-center py-3 sm:hidden ${hasDivider ? 'border-l' : ''}`}>
        <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold leading-tight">{value}</p>
      </div>
      <div className="hidden sm:flex items-baseline gap-1.5 rounded-lg border bg-white px-3 py-1.5 shadow-sm">
        <span className="text-lg font-bold leading-none">{value}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>
    </>
  );
}
