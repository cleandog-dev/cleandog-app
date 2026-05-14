import { prisma } from '@/lib/db';
import { ServicesManager } from '@/components/admin/ServicesManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Servizi' };

export default async function AdminServicesPage() {
  const services = await prisma.service.findMany({
    orderBy: [{ active: 'desc' }, { priceCents: 'asc' }],
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Servizi</h1>
        <p className="text-sm text-muted-foreground">Gestisci catalogo, prezzi e durate.</p>
      </div>
      <ServicesManager services={services} />
    </div>
  );
}
