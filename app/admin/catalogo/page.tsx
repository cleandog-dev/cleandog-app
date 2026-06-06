import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ServicesManager } from '@/components/admin/ServicesManager';
import { ExtrasManager } from '@/components/admin/ExtrasManager';
import { BreedsManager } from '@/components/admin/BreedsManager';
import { TabsNav, type TabItem } from '@/components/admin/TabsNav';
import {
  getAllBreedsAdmin,
  getBreedsMissingPrices,
  getPricingGaps,
} from '@/lib/breeds-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Catalogo' };

const TABS: TabItem[] = [
  { key: 'servizi', label: 'Servizi', icon: '✂️' },
  { key: 'extra', label: 'Extra', icon: '✨' },
  { key: 'razze', label: 'Razze & prezzi', icon: '🐾' },
];

type TabKey = 'servizi' | 'extra' | 'razze';

export default async function AdminCatalogoPage(
  props: { searchParams: Promise<{ tab?: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') redirect('/admin/staff');
  const sp = await props.searchParams;
  const tab: TabKey =
    sp.tab === 'extra' ? 'extra' : sp.tab === 'razze' ? 'razze' : 'servizi';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Catalogo</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Servizi proposti, extra opzionali, razze e listino prezzi.
        </p>
      </div>

      <TabsNav tabs={TABS} defaultKey="servizi" />

      {tab === 'servizi' && <ServiziTab />}
      {tab === 'extra' && <ExtraTab />}
      {tab === 'razze' && <RazzeTab />}
    </div>
  );
}

async function ServiziTab() {
  const [services, gaps] = await Promise.all([
    prisma.service.findMany({
      where: { deletedAt: null },
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
    getPricingGaps(),
  ]);
  return <ServicesManager services={services} missingByService={gaps.byService} />;
}

async function ExtraTab() {
  const extras = await prisma.extra.findMany({
    orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  return <ExtrasManager extras={extras} />;
}

async function RazzeTab() {
  const [breeds, missingByBreed] = await Promise.all([
    getAllBreedsAdmin(),
    getBreedsMissingPrices(),
  ]);
  return <BreedsManager breeds={breeds} missingByBreed={missingByBreed} />;
}
