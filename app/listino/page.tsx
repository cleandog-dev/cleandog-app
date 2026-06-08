import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ListinoClient, type ListinoBreed } from './ListinoClient';

// Revalidazione ISR ogni 5 minuti: bilanciamento freschezza vs cold-start Neon.
// Se devi forzare refresh istantaneo dopo edit admin, aggiungi `revalidatePath('/listino')`
// nelle server action di breed/price (out of scope qui).
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Listino prezzi — Toelettatura cani e gatti',
  description:
    'Prezzi di toelettatura per razza e taglia a Messina. Bagno, taglio e cura per cani e gatti. Pulizia orecchie, unghie e svuotamento sacche anali sempre inclusi.',
  alternates: { canonical: '/listino' },
  openGraph: {
    title: 'Listino prezzi · CleanDOG Messina',
    description:
      'Prezzi trasparenti per la toelettatura del tuo cane o gatto. Più di 80 razze a listino. Prenota online in 3 minuti.',
    type: 'website',
    locale: 'it_IT',
  },
};

// Mapping enum DB → display per la UI listino (3 fasce visive).
const SIZE_MAP: Record<string, 'piccola' | 'media' | 'grande'> = {
  SMALL: 'piccola',
  MEDIUM: 'media',
  LARGE: 'grande',
  XLARGE: 'grande',
};

// Servizi sempre inclusi nel prezzo base: informativi, non bookable.
// Hardcoded perché non sono modellati come Service nel DB.
const INCLUDED_SERVICES = [
  'Pulizia delle orecchie',
  'Svuotamento sacche anali',
  'Sistemazione unghie',
];

type BreedWithPrices = {
  id: string;
  name: string;
  animalType: string;
  size: string | null;
  priceMin: number;
  servicePrices: { priceCents: number | null }[];
};

// Prezzo "da" più basso disponibile per la razza sul servizio dato.
// Fallback su breed.priceMin (legacy) se non ci sono BreedServicePrice rows.
function resolveStartingPrice(b: BreedWithPrices): number | null {
  const validCents = b.servicePrices
    .map((sp) => sp.priceCents)
    .filter((p): p is number => typeof p === 'number' && p > 0);
  if (validCents.length > 0) {
    return Math.round(Math.min(...validCents) / 100);
  }
  if (b.priceMin > 0) return b.priceMin;
  return null;
}

export default async function ListinoPage() {
  // Query 1: razze attive con i prezzi del servizio "default" (bagno) per animale.
  // Query 2: servizi aggiuntivi in evidenza (Spuntatura, Tosatura, Toeletta completa)
  //          con tutti i loro prezzi per razza, per calcolare il range €X–€Y.
  // Le 2 query corrono in parallelo → niente latenza aggiunta.
  const [breeds, featuredServices] = await Promise.all([
    prisma.breed.findMany({
      where: { active: true },
      orderBy: [{ animalType: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, animalType: true, size: true, priceMin: true,
        servicePrices: {
          where: {
            active: true,
            service: { isDefault: true, active: true, deletedAt: null },
          },
          select: { priceCents: true },
        },
      },
    }),
    prisma.service.findMany({
      where: {
        active: true,
        deletedAt: null,
        forAnimal: 'DOG',
        isDefault: false,
        OR: [
          { name: { contains: 'spuntat', mode: 'insensitive' } },
          { name: { contains: 'tosatur', mode: 'insensitive' } },
          { name: { contains: 'toeletta', mode: 'insensitive' } },
        ],
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, name: true, displayName: true,
        breedPrices: {
          where: {
            active: true,
            priceCents: { gt: 0 },
            breed: { animalType: 'DOG', active: true },
          },
          select: { priceCents: true },
        },
      },
    }),
  ]);

  // Partiziono per tipo animale e mappo in shape UI.
  const dogsForUI: ListinoBreed[] = [];
  const catPrices: number[] = [];
  for (const b of breeds as BreedWithPrices[]) {
    const price = resolveStartingPrice(b);
    if (price == null) continue;
    if (b.animalType === 'DOG') {
      const size = b.size ? SIZE_MAP[b.size] : 'media';
      if (!size) continue;
      dogsForUI.push({ name: b.name, size, price });
    } else if (b.animalType === 'CAT') {
      catPrices.push(price);
    }
  }

  const catsMin = catPrices.length ? Math.min(...catPrices) : 30;
  const catsMax = catPrices.length ? Math.max(...catPrices) : 35;

  // Per ciascun servizio in evidenza calcolo il range €X–€Y dai prezzi BreedServicePrice.
  // I servizi senza prezzi configurati vengono esclusi (filter null).
  const featured = featuredServices
    .map((s) => {
      const cents = s.breedPrices
        .map((p) => p.priceCents)
        .filter((c): c is number => typeof c === 'number' && c > 0);
      if (cents.length === 0) return null;
      return {
        name: s.displayName || s.name,
        min: Math.round(Math.min(...cents) / 100),
        max: Math.round(Math.max(...cents) / 100),
      };
    })
    .filter((x): x is { name: string; min: number; max: number } => x !== null);

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream-100)' }}>
      {/* Sticky top bar: torna home + CTA prenota */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur"
        style={{
          background: 'rgba(245, 237, 224, 0.85)',
          borderColor: 'var(--cream-300)',
        }}
      >
        <div className="mx-auto flex max-w-screen-md items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: 'var(--ink-500)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Home
          </Link>
          <Link
            href="/prenota"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-transform hover:scale-[1.02]"
            style={{
              background: 'var(--sage-800)',
              color: 'var(--cream-50)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Prenota
          </Link>
        </div>
      </header>

      <ListinoClient
        dogs={dogsForUI}
        cats={{ min: catsMin, max: catsMax }}
        featured={featured}
        included={INCLUDED_SERVICES}
      />
    </div>
  );
}
