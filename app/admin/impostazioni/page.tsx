import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { OpeningHoursManager } from '@/components/admin/OpeningHoursManager';
import { SlotStepCard } from '@/components/admin/SlotStepCard';
import { CapacityCard } from '@/components/admin/CapacityCard';
import { ClosuresManager } from '@/components/admin/ClosuresManager';
import { StaffAccountsManager } from '@/components/admin/StaffAccountsManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TabsNav, type TabItem } from '@/components/admin/TabsNav';
import { getSlotStepMin, getMaxConcurrentBookings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Impostazioni' };

const TABS: TabItem[] = [
  { key: 'orari', label: 'Orari & Capacità', icon: '🕐' },
  { key: 'account', label: 'Account staff', icon: '👤' },
  { key: 'export', label: 'Export', icon: '📤' },
];

type TabKey = 'orari' | 'account' | 'export';

export default async function AdminImpostazioniPage(
  props: { searchParams: Promise<{ tab?: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') redirect('/admin/staff');
  const sp = await props.searchParams;
  const tab: TabKey = sp.tab === 'export' ? 'export' : sp.tab === 'account' ? 'account' : 'orari';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Impostazioni</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Orari, capacità, account staff, export prenotazioni.
        </p>
      </div>

      <TabsNav tabs={TABS} defaultKey="orari" />

      {tab === 'orari' && <OrariTab />}
      {tab === 'account' && <AccountTab />}
      {tab === 'export' && <ExportTab />}
    </div>
  );
}

async function AccountTab() {
  const users = await prisma.user.findMany({
    where: { role: 'STAFF' },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return <StaffAccountsManager initialUsers={users} />;
}

async function OrariTab() {
  const [rows, slotStep, maxConcurrent, closures] = await Promise.all([
    prisma.openingHour.findMany(),
    getSlotStepMin(),
    getMaxConcurrentBookings(),
    prisma.closure.findMany({
      where: { endsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
    }),
  ]);
  return (
    <div className="space-y-4">
      <SlotStepCard initial={slotStep} />
      <CapacityCard initial={maxConcurrent} />
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Orari settimanali</h2>
        <p className="text-xs text-muted-foreground">
          Apertura standard del negozio per giorno della settimana.
        </p>
        <OpeningHoursManager rows={rows} />
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Chiusure straordinarie</h2>
        <p className="text-xs text-muted-foreground">
          Festività, ferie, blocchi orari per casi particolari.
        </p>
        <ClosuresManager closures={closures} />
      </section>
    </div>
  );
}

function ExportTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Esporta prenotazioni</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button asChild>
          <a href="/admin/export/csv?range=upcoming">Future (CSV)</a>
        </Button>
        <Button asChild variant="outline">
          <a href="/admin/export/csv?range=all">Tutte (CSV)</a>
        </Button>
        <Button asChild variant="outline">
          <a href="/admin/export/csv?range=past">Passate (CSV)</a>
        </Button>
      </CardContent>
    </Card>
  );
}
