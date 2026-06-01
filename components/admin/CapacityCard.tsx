'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { setMaxConcurrentBookingsAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

const OPTIONS = [1, 2, 3, 4];

export function CapacityCard({ initial }: { initial: number }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<number>(initial);
  const [savedValue, setSavedValue] = useState<number>(initial);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function save() {
    startTransition(async () => {
      const r = await setMaxConcurrentBookingsAction(value);
      if (!r.ok) {
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
      } else {
        toast({ title: 'Capacità aggiornata' });
        setSavedValue(value);
        setOpen(false);
      }
    });
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-lg border bg-white"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm list-none select-none">
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">🪑</span>
          <span>Postazioni in parallelo</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {savedValue} {savedValue === 1 ? 'posto' : 'posti'}
          </span>
        </span>
        <span className="text-muted-foreground text-xs">{open ? '▴' : '▾'}</span>
      </summary>
      <div className="border-t px-4 py-3">
        <p className="text-xs text-muted-foreground mb-3">
          Numero massimo di prenotazioni che possono sovrapporsi nello stesso orario (es. 2 postazioni di toelettatura = 2 cani in contemporanea).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setValue(n)}
                className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: value === n ? 'var(--sage-800)' : 'var(--cream-100)',
                  color: value === n ? 'white' : 'var(--ink-700)',
                  borderColor: value === n ? 'var(--sage-800)' : 'var(--cream-300)',
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <Button onClick={save} disabled={pending || value === savedValue} size="sm" className="ml-auto">
            {pending ? 'Salvo…' : 'Salva'}
          </Button>
        </div>
      </div>
    </details>
  );
}
