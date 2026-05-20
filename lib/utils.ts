import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const APP_TIMEZONE = 'Europe/Rome';

export function formatEUR(cents: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

/**
 * Display name for animal: dogName if set, else breed, else '—'.
 */
export function animalLabel(b: { dogName?: string | null; dogBreed?: string | null }): string {
  const name = b.dogName?.trim();
  if (name) return name;
  const breed = b.dogBreed?.trim();
  if (breed) return breed;
  return 'Senza nome';
}

// Parse "Extra: name1, name2" segment from notes (segments joined by ' · ')
export function parseExtraNamesFromNotes(notes: string | null | undefined): string[] {
  if (!notes) return [];
  for (const seg of notes.split(' · ')) {
    const m = seg.match(/^\s*Extra:\s*(.+)$/);
    if (m) {
      return (m[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

// Remove "Extra: ..." and "Pelo ..." segments from notes — leave only user-typed text
export function cleanUserNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  return notes
    .split(' · ')
    .filter((seg) => !/^\s*Extra:/.test(seg) && !/^\s*Pelo\s+(corto|lungo)/i.test(seg))
    .join(' · ')
    .trim();
}
