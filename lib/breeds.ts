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
  priceTrim: number | null;
  priceTrimLong: number | null;
  priceTouchUp: number | null;
}

export function formatPrice(min: number, max: number): string {
  return min === max ? `${min} €` : `${min} – ${max} €`;
}

export const SIZE_LABELS: Record<SizeCategory, string> = {
  SMALL: 'Taglia Piccola',
  MEDIUM: 'Taglia Media',
  LARGE: 'Taglia Grande',
};

export type BreedServicePriceEntry = {
  priceCents: number | null;
  priceLongCents: number | null;
  active: boolean;
};
export type BreedSizeOption = {
  id: string;
  label: string;
  sortOrder: number;
  active: boolean;
};
// breedId → serviceId → cellKey → entry. cellKey = `${sizeOptionId|'none'}::${coat|'NONE'}`
export type BreedPriceMap = Record<string, Record<string, Record<string, BreedServicePriceEntry>>>;
export type BreedSizesMap = Record<string, BreedSizeOption[]>;
export type AnimalPayload = { pricesByBreed: BreedPriceMap; sizesByBreed: BreedSizesMap };
// animalType → payload
export type PricesByAnimal = { DOG: AnimalPayload; CAT: AnimalPayload };

export function makeCellKey(sizeOptionId: string | null, coat: 'SHORT' | 'LONG' | null): string {
  return `${sizeOptionId ?? 'none'}::${coat ?? 'NONE'}`;
}
