import { prisma } from '@/lib/db';
import { ClosuresManager } from '@/components/admin/ClosuresManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Chiusure' };

export default async function AdminClosuresPage() {
  const closures = await prisma.closure.findMany({
    where: { endsAt: { gte: new Date() } },
    orderBy: { startsAt: 'asc' },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Chiusure</h1>
        <p className="text-sm text-muted-foreground">Festività e blocchi orari personalizzati.</p>
      </div>
      <ClosuresManager closures={closures} />
    </div>
  );
}
