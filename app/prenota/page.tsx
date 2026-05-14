import Link from 'next/link';
import { prisma } from '@/lib/db';
import { BookingFlow } from '@/components/BookingFlow';
import { Logo } from '@/components/Logo';
import { getDogBreeds, getCatBreed } from '@/lib/breeds-server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prenota' };

export default async function PrenotaPage() {
  const [services, dogBreeds, catBreed, extrasList] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: [{ name: 'asc' }],
    }),
    getDogBreeds(),
    getCatBreed(),
    prisma.extra.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ]);
  const catPrice = catBreed ? { min: catBreed.priceMin, max: catBreed.priceMax } : null;

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
        <BookingFlow services={services} dogBreeds={dogBreeds} catPrice={catPrice} extrasList={extrasList} />
      </main>
    </div>
  );
}
