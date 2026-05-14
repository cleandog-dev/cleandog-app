export type AnimalType = 'DOG' | 'CAT';
export type SizeCategory = 'SMALL' | 'MEDIUM' | 'LARGE';
export type CoatType = 'SHORT' | 'LONG' | 'MIXED';

export interface BreedEntry {
  id: string;
  name: string;
  animalType: AnimalType;
  size: SizeCategory | null;
  coatType: CoatType | null;
  priceMin: number;
  priceMax: number;
}

export function formatPrice(min: number, max: number): string {
  return min === max ? `${min} €` : `${min} – ${max} €`;
}

export const SIZE_LABELS: Record<SizeCategory, string> = {
  SMALL: 'Taglia Piccola',
  MEDIUM: 'Taglia Media',
  LARGE: 'Taglia Grande',
};
