import { prisma } from '@/lib/db';
import { OpeningHoursManager } from '@/components/admin/OpeningHoursManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orari' };

export default async function AdminHoursPage() {
  const rows = await prisma.openingHour.findMany();
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Orari di apertura</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Imposta gli orari settimanali. Influisce sugli slot disponibili in fase di prenotazione.
        </p>
      </div>
      <OpeningHoursManager rows={rows} />
    </div>
  );
}
