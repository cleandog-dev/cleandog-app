import { prisma } from '@/lib/db';
import { StaffTodayView } from '@/components/admin/StaffTodayView';
import { WeekCalendar } from '@/components/admin/WeekCalendar';
import { AutoRefresh } from '@/components/admin/AutoRefresh';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Personale' };

export default async function AdminStaffPage() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

  // Week range (current week ± buffer for calendar)
  const calStart = new Date(startOfToday);
  calStart.setDate(calStart.getDate() - 7);
  const calEnd = new Date(startOfToday);
  calEnd.setDate(calEnd.getDate() + 28);

  const [todayBookings, weekBookings, totalToday, completedToday, pendingToday] = await Promise.all([
    prisma.booking.findMany({
      where: {
        startsAt: { gte: startOfToday, lt: endOfToday },
        status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] },
      },
      orderBy: { startsAt: 'asc' },
      include: { service: true },
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
      where: {
        startsAt: { gte: startOfToday, lt: endOfToday },
        status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] },
      },
    }),
    prisma.booking.count({
      where: {
        startsAt: { gte: startOfToday, lt: endOfToday },
        status: 'COMPLETED',
      },
    }),
    prisma.booking.count({
      where: {
        startsAt: { gte: startOfToday, lt: endOfToday },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    }),
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <AutoRefresh intervalMs={180_000} />

      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Personale</h1>
        <p className="text-[11px] text-muted-foreground sm:text-sm">
          Aggiornamento automatico ogni 3 min
        </p>
      </div>

      <div
        className="grid grid-cols-3 overflow-hidden rounded-xl border bg-white shadow-sm sm:gap-3 sm:bg-transparent sm:border-0 sm:shadow-none sm:overflow-visible"
      >
        <Stat title="Oggi" value={totalToday} accent="primary" />
        <Stat title="Da fare" value={pendingToday} accent="warning" hasDivider />
        <Stat title="Fatte" value={completedToday} accent="success" hasDivider />
      </div>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Oggi
          </h2>
          <span className="text-xs text-muted-foreground">
            {todayBookings.length === 0 ? 'nessuno' : `${todayBookings.length} appt.`}
          </span>
        </div>
        <StaffTodayView bookings={todayBookings} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Settimana
        </h2>
        <WeekCalendar bookings={weekBookings} />
      </section>
    </div>
  );
}

function Stat({
  title,
  value,
  accent,
  hasDivider = false,
}: {
  title: string;
  value: number;
  accent: 'primary' | 'warning' | 'success';
  hasDivider?: boolean;
}) {
  const color = accent === 'warning' ? 'text-amber-600' : accent === 'success' ? 'text-emerald-600' : 'text-primary';
  return (
    <>
      {/* Mobile inline segmented; Desktop card */}
      <div className={`flex flex-col items-center justify-center py-3 sm:hidden ${hasDivider ? 'border-l' : ''}`}>
        <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className={`text-2xl font-bold leading-tight ${color}`}>{value}</p>
      </div>
      <Card className="hidden sm:block">
        <CardContent className="py-3 sm:py-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
            {title}
          </p>
          <p className={`text-2xl font-bold sm:text-3xl ${color}`}>{value}</p>
        </CardContent>
      </Card>
    </>
  );
}
