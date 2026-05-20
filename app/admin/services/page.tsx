import { prisma } from '@/lib/db';
import { ServicesManager } from '@/components/admin/ServicesManager';
import { getPricingGaps } from '@/lib/breeds-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Servizi' };

export default async function AdminServicesPage() {
  const [services, gaps] = await Promise.all([
    prisma.service.findMany({
      where: { deletedAt: null },
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
    getPricingGaps(),
  ]);
  const missingByService = gaps.byService;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Servizi</h1>
        <p className="text-sm text-muted-foreground">Gestisci catalogo, prezzi e durate.</p>
      </div>
      <ServicesManager services={services} missingByService={missingByService} />
    </div>
  );
}
