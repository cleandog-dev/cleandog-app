import { prisma } from '@/lib/db';
import { aggregateClientDetail, normalizePhone } from '@/lib/clients';
import { ClientDetail } from '@/components/admin/ClientDetail';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cliente' };

export default async function AdminClienteDetailPage(
  props: { params: Promise<{ phoneKey: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') redirect('/admin/staff');
  const { phoneKey: raw } = await props.params;
  const phoneKey = normalizePhone(decodeURIComponent(raw));
  if (!phoneKey) notFound();

  const all = await prisma.booking.findMany({
    include: { service: true },
    orderBy: { startsAt: 'desc' },
    take: 5000,
  });
  const filtered = all.filter((b) => normalizePhone(b.customerPhone) === phoneKey);
  const client = aggregateClientDetail(filtered);
  if (!client) notFound();

  return <ClientDetail client={client} />;
}
