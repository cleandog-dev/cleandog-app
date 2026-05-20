import Link from 'next/link';
import { prisma } from '@/lib/db';
import { BookingFlow } from '@/components/BookingFlow';
import { Logo } from '@/components/Logo';
import { getDogBreeds, getCatBreeds, getPricesMapForAnimal } from '@/lib/breeds-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prenota' };

export default async function PrenotaPage() {
  const [services, dogBreeds, catBreeds, extrasList, dogPrices, catPrices] = await Promise.all([
    prisma.service.findMany({
      where: { active: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    getDogBreeds(),
    getCatBreeds(),
    prisma.extra.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    getPricesMapForAnimal('DOG'),
    getPricesMapForAnimal('CAT'),
  ]);
  const pricesByAnimal = { DOG: dogPrices, CAT: catPrices };

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream-100)' }}>
      <header className="app-chrome">
        <div className="mx-auto flex h-14 max-w-screen-md items-center gap-3 px-5">
          <Link
            href="/"
            className="btn-ghost flex items-center gap-1 p-2"
            style={{ color: 'var(--ink-500)' }}
          >
            <svg width="18" height="18" viewBox="0 0 44 44" fill="none">
              <path d="M28 8L14 22l14 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <Logo />
        </div>
      </header>

      <main className="mx-auto max-w-screen-md px-5 py-8">
        <p className="eyebrow mb-2">Prenotazione</p>
        <h1 className="display mb-1" style={{ fontSize: 'clamp(28px, 7vw, 40px)', color: 'var(--ink-900)' }}>
          Prenota il tuo appuntamento
        </h1>
        <p className="mb-8 text-sm" style={{ color: 'var(--ink-500)' }}>
          Scegli servizio, data e lascia i tuoi dati.
        </p>
        <BookingFlow services={services} dogBreeds={dogBreeds} catBreeds={catBreeds} extrasList={extrasList} pricesByAnimal={pricesByAnimal} />
      </main>
    </div>
  );
}
