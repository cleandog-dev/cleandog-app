// Seed data — moved from lib/breeds.ts. Only used by prisma/seed.ts to populate the Breed table.
// Runtime code reads breeds from the DB instead.

export type SeedSize = 'SMALL' | 'MEDIUM' | 'LARGE';
export type SeedCoat = 'SHORT' | 'LONG' | 'MIXED';

export interface BreedSeedEntry {
  name: string;
  size: SeedSize;
  coatType?: SeedCoat;
  priceMin: number;
  priceMax: number;
}

export const CAT_PRICE_SEED = { min: 30, max: 35 };

export const DOG_BREEDS_SEED: BreedSeedEntry[] = [
  // ── PICCOLA ──
  { name: 'Barboncino Toy',                size: 'SMALL', coatType: 'LONG',  priceMin: 20, priceMax: 20 },
  { name: 'Bassotto',                      size: 'SMALL', coatType: 'SHORT', priceMin: 20, priceMax: 20 },
  { name: 'Bolognese',                     size: 'SMALL', coatType: 'LONG',  priceMin: 20, priceMax: 20 },
  { name: 'Bulldog Francese',              size: 'SMALL', coatType: 'SHORT', priceMin: 20, priceMax: 20 },
  { name: 'Carlino',                       size: 'SMALL', coatType: 'SHORT', priceMin: 20, priceMax: 20 },
  { name: 'Cavalier King Charles Spaniel', size: 'SMALL', coatType: 'LONG',  priceMin: 25, priceMax: 25 },
  { name: 'Chihuahua',                     size: 'SMALL', coatType: 'SHORT', priceMin: 15, priceMax: 15 },
  { name: 'Jack Russell Terrier',          size: 'SMALL', coatType: 'SHORT', priceMin: 25, priceMax: 25 },
  { name: 'Levriero Italiano',             size: 'SMALL', coatType: 'SHORT', priceMin: 20, priceMax: 20 },
  { name: 'Maltese',                       size: 'SMALL', coatType: 'LONG',  priceMin: 20, priceMax: 20 },
  { name: 'Pechinese',                     size: 'SMALL', coatType: 'LONG',  priceMin: 25, priceMax: 25 },
  { name: 'Pinscher',                      size: 'SMALL', coatType: 'SHORT', priceMin: 20, priceMax: 20 },
  { name: 'Shih Tzu',                      size: 'SMALL', coatType: 'LONG',  priceMin: 25, priceMax: 25 },
  { name: 'Spitz',                         size: 'SMALL', coatType: 'LONG',  priceMin: 25, priceMax: 25 },
  { name: 'Yorkshire',                     size: 'SMALL', coatType: 'LONG',  priceMin: 20, priceMax: 25 },
  // ── MEDIA ──
  { name: 'Airedale Terrier',              size: 'MEDIUM', coatType: 'SHORT', priceMin: 25, priceMax: 25 },
  { name: 'American Staffordshire Terrier',size: 'MEDIUM', coatType: 'SHORT', priceMin: 30, priceMax: 30 },
  { name: 'Barboncino',                    size: 'MEDIUM', coatType: 'LONG',  priceMin: 25, priceMax: 25 },
  { name: 'Basset Hound',                  size: 'MEDIUM', coatType: 'SHORT', priceMin: 25, priceMax: 25 },
  { name: 'Beagle',                        size: 'MEDIUM', coatType: 'SHORT', priceMin: 25, priceMax: 25 },
  { name: 'Border Collie',                 size: 'MEDIUM', coatType: 'LONG',  priceMin: 30, priceMax: 30 },
  { name: 'Boxer',                         size: 'MEDIUM', coatType: 'SHORT', priceMin: 30, priceMax: 30 },
  { name: 'Bracco Italiano',               size: 'MEDIUM', coatType: 'SHORT', priceMin: 25, priceMax: 25 },
  { name: 'Bull Terrier',                  size: 'MEDIUM', coatType: 'SHORT', priceMin: 30, priceMax: 30 },
  { name: 'Bulldog Inglese',               size: 'MEDIUM', coatType: 'SHORT', priceMin: 25, priceMax: 25 },
  { name: 'Chow Chow',                     size: 'MEDIUM', coatType: 'LONG',  priceMin: 35, priceMax: 40 },
  { name: 'Cocker Spaniel',                size: 'MEDIUM', coatType: 'LONG',  priceMin: 25, priceMax: 25 },
  { name: 'Corgi Pembroke',                size: 'MEDIUM', coatType: 'SHORT', priceMin: 28, priceMax: 28 },
  { name: 'Dalmata',                       size: 'MEDIUM', coatType: 'SHORT', priceMin: 25, priceMax: 25 },
  { name: 'Lagotto Romagnolo',             size: 'MEDIUM', coatType: 'LONG',  priceMin: 25, priceMax: 25 },
  { name: 'Meticcio',                      size: 'MEDIUM', coatType: 'MIXED', priceMin: 15, priceMax: 60 },
  { name: 'Pastore delle Shetland',        size: 'MEDIUM', coatType: 'LONG',  priceMin: 30, priceMax: 30 },
  { name: 'Setter / Setter Inglese',       size: 'MEDIUM', coatType: 'LONG',  priceMin: 30, priceMax: 30 },
  { name: 'Shar Pei',                      size: 'MEDIUM', coatType: 'SHORT', priceMin: 30, priceMax: 35 },
  { name: 'Shiba',                         size: 'MEDIUM', coatType: 'SHORT', priceMin: 25, priceMax: 30 },
  { name: 'Schnauzer Nano',                size: 'MEDIUM', coatType: 'LONG',  priceMin: 25, priceMax: 25 },
  { name: 'Siberian Husky',                size: 'MEDIUM', coatType: 'LONG',  priceMin: 30, priceMax: 30 },
  { name: 'Whippet',                       size: 'MEDIUM', coatType: 'SHORT', priceMin: 25, priceMax: 25 },
  // ── GRANDE ──
  { name: 'Akita Inu',                     size: 'LARGE', coatType: 'LONG',  priceMin: 35, priceMax: 40 },
  { name: 'Alano',                         size: 'LARGE', coatType: 'SHORT', priceMin: 45, priceMax: 45 },
  { name: 'Alaskan Malamute',              size: 'LARGE', coatType: 'LONG',  priceMin: 45, priceMax: 45 },
  { name: 'Barbone',                       size: 'LARGE', coatType: 'LONG',  priceMin: 35, priceMax: 40 },
  { name: 'Bullmastiff',                   size: 'LARGE', coatType: 'SHORT', priceMin: 40, priceMax: 40 },
  { name: 'Cane Corso',                    size: 'LARGE', coatType: 'SHORT', priceMin: 45, priceMax: 45 },
  { name: 'Dobermann',                     size: 'LARGE', coatType: 'SHORT', priceMin: 30, priceMax: 30 },
  { name: 'Dogo Argentino',                size: 'LARGE', coatType: 'SHORT', priceMin: 35, priceMax: 40 },
  { name: 'Golden Retriever',              size: 'LARGE', coatType: 'LONG',  priceMin: 40, priceMax: 40 },
  { name: 'Labrador',                      size: 'LARGE', coatType: 'SHORT', priceMin: 35, priceMax: 35 },
  { name: 'Levriero / Greyhound',          size: 'LARGE', coatType: 'SHORT', priceMin: 30, priceMax: 40 },
  { name: 'Levriero Afgano',               size: 'LARGE', coatType: 'LONG',  priceMin: 60, priceMax: 60 },
  { name: 'Mastino Napoletano',            size: 'LARGE', coatType: 'SHORT', priceMin: 45, priceMax: 50 },
  { name: 'Pastore Belga',                 size: 'LARGE', coatType: 'LONG',  priceMin: 35, priceMax: 35 },
  { name: 'Pastore del Caucaso',           size: 'LARGE', coatType: 'LONG',  priceMin: 35, priceMax: 40 },
  { name: 'Pastore Maremmano Abruzzese',   size: 'LARGE', coatType: 'LONG',  priceMin: 40, priceMax: 45 },
  { name: 'Pastore Tedesco (pelo corto)',  size: 'LARGE', coatType: 'SHORT', priceMin: 30, priceMax: 30 },
  { name: 'Pastore Tedesco (pelo lungo)',  size: 'LARGE', coatType: 'LONG',  priceMin: 40, priceMax: 40 },
  { name: 'Rottweiler',                    size: 'LARGE', coatType: 'SHORT', priceMin: 30, priceMax: 30 },
  { name: 'San Bernardo',                  size: 'LARGE', coatType: 'LONG',  priceMin: 50, priceMax: 60 },
  { name: 'Schnauzer',                     size: 'LARGE', coatType: 'LONG',  priceMin: 35, priceMax: 35 },
  { name: 'Terranova',                     size: 'LARGE', coatType: 'LONG',  priceMin: 45, priceMax: 50 },
  { name: 'Weimaraner',                    size: 'LARGE', coatType: 'SHORT', priceMin: 30, priceMax: 30 },
  { name: 'Wolf Spitz',                    size: 'LARGE', coatType: 'LONG',  priceMin: 45, priceMax: 45 },
];
