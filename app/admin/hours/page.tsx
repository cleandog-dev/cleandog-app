import { prisma } from '@/lib/db';
import { OpeningHoursManager } from '@/components/admin/OpeningHoursManager';
import { SlotStepCard } from '@/components/admin/SlotStepCard';
import { ClosuresManager } from '@/components/admin/ClosuresManager';
import { getSlotStepMin } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orari e chiusure' };

export default async function AdminHoursPage() {
  const [rows, slotStep, closures] = await Promise.all([
    prisma.openingHour.findMany(),
    getSlotStepMin(),
    prisma.closure.findMany({
      where: { endsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
    }),
  ]);
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Orari e chiusure</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Gestione tempo: intervallo slot, orari settimanali, chiusure straordinarie.
        </p>
      </div>

      <SlotStepCard initial={slotStep} />

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Orari settimanali</h2>
        <p className="text-xs text-muted-foreground">Apertura standard del negozio per giorno della settimana.</p>
        <OpeningHoursManager rows={rows} />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Chiusure straordinarie</h2>
        <p className="text-xs text-muted-foreground">Festività, ferie, blocchi orari per casi particolari.</p>
        <ClosuresManager closures={closures} />
      </section>
    </div>
  );
}
