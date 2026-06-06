'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BreedEntry } from '@/lib/breeds';

/**
 * Searchable breed picker. Riusato in:
 *   - NewBookingDialog (create flow)
 *   - BookingDetailDialog (edit flow)
 */
export function BreedPicker({
  breeds,
  value,
  onChange,
  animalLabel = 'cane',
  label,
}: {
  breeds: BreedEntry[];
  value: string;
  onChange: (name: string) => void;
  animalLabel?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = breeds.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-1.5">
      <Label>{label ?? `Razza (${animalLabel})`}</Label>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full justify-between"
        onClick={() => { setSearch(''); setOpen(true); }}
      >
        <span className={value ? '' : 'text-muted-foreground'}>
          {value || '— Seleziona —'}
        </span>
        <span className="text-muted-foreground">▾</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b p-3 pb-2">
            <DialogTitle className="text-base">Seleziona razza</DialogTitle>
            <Input
              autoFocus
              placeholder="Cerca…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-2 h-10"
            />
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Nessuna razza trovata.</p>
            ) : (
              <ul className="divide-y">
                {filtered.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => { onChange(b.name); setOpen(false); }}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-accent/40 ${
                        value === b.name ? 'font-semibold' : ''
                      }`}
                      style={value === b.name ? { background: 'var(--sage-100)' } : undefined}
                    >
                      <span>{b.name}</span>
                      {value === b.name && <span style={{ color: 'var(--sage-800)' }}>✓</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
