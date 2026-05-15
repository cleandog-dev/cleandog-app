'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { setSlotStepMinAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

const OPTIONS = [10, 15, 20, 30, 45, 60];

export function SlotStepCard({ initial }: { initial: number }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<number>(initial);
  const [savedValue, setSavedValue] = useState<number>(initial);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function save() {
    startTransition(async () => {
      const r = await setSlotStepMinAction(value);
      if (!r.ok) {
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
      } else {
        toast({ title: 'Intervallo aggiornato' });
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
          <span className="text-muted-foreground">⚙️</span>
          <span>Intervallo slot</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {savedValue} min
          </span>
        </span>
        <span className="text-muted-foreground text-xs">{open ? '▴' : '▾'}</span>
      </summary>
      <div className="border-t px-4 py-3">
        <p className="text-xs text-muted-foreground mb-3">
          Frequenza con cui mostrare gli orari disponibili al cliente (es. ogni 15 min → 09:00, 09:15, 09:30…).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setValue(m)}
                className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: value === m ? 'var(--sage-800)' : 'var(--cream-100)',
                  color: value === m ? 'white' : 'var(--ink-700)',
                  borderColor: value === m ? 'var(--sage-800)' : 'var(--cream-300)',
                }}
              >
                {m} min
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
