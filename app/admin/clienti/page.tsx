import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { aggregateClients } from '@/lib/clients';
import { ClientsList } from '@/components/admin/ClientsList';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clienti' };

export default async function AdminClientiPage() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') redirect('/admin/staff');
  const rows = await prisma.booking.findMany({
    select: {
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      dogName: true,
      dogBreed: true,
      dogSize: true,
      sizeOptionId: true,
      coatChoice: true,
      status: true,
      startsAt: true,
      priceCents: true,
    },
    orderBy: { startsAt: 'desc' },
    take: 5000,
  });
  const clients = aggregateClients(rows);

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl font-bold sm:text-2xl">Clienti</h1>
      <ClientsList clients={clients} />
    </div>
  );
}
