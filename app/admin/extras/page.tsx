import { prisma } from '@/lib/db';
import { ExtrasManager } from '@/components/admin/ExtrasManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Extra' };

export default async function AdminExtrasPage() {
  const extras = await prisma.extra.findMany({
    orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Servizi extra</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Gestisci gli extra opzionali proposti ai clienti durante la prenotazione.
        </p>
      </div>
      <ExtrasManager extras={extras} />
    </div>
  );
}
