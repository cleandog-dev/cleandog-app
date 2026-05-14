import 'server-only';
import { prisma } from './db';
import type { BreedEntry, AnimalType, SizeCategory, CoatType } from './breeds';

function toEntry(b: {
  id: string;
  name: string;
  animalType: string;
  size: string | null;
  coatType: string | null;
  priceMin: number;
  priceMax: number;
}): BreedEntry {
  return {
    id: b.id,
    name: b.name,
    animalType: b.animalType as AnimalType,
    size: (b.size as SizeCategory | null) ?? null,
    coatType: (b.coatType as CoatType | null) ?? null,
    priceMin: b.priceMin,
    priceMax: b.priceMax,
  };
}

export async function getDogBreeds(): Promise<BreedEntry[]> {
  const rows = await prisma.breed.findMany({
    where: { animalType: 'DOG', active: true },
    orderBy: [{ size: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toEntry);
}

export async function getCatBreed(): Promise<BreedEntry | null> {
  const row = await prisma.breed.findFirst({
    where: { animalType: 'CAT', active: true },
    orderBy: { sortOrder: 'asc' },
  });
  return row ? toEntry(row) : null;
}

export async function findBreedByName(name: string): Promise<BreedEntry | null> {
  const row = await prisma.breed.findUnique({ where: { name } });
  return row ? toEntry(row) : null;
}

export async function getAllBreedsAdmin(): Promise<BreedEntry[]> {
  const rows = await prisma.breed.findMany({
    orderBy: [{ animalType: 'asc' }, { size: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toEntry);
}
