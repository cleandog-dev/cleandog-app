'use client';

import { useState, useTransition } from 'react';
import type { OpeningHour } from '@prisma/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveOpeningHoursAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

type Row = {
  dayOfWeek: number;
  openMinute: number;
  closeMinute: number;
  active: boolean;
};

const DAYS: Array<[number, string]> = [
  [1, 'Lunedì'],
  [2, 'Martedì'],
  [3, 'Mercoledì'],
  [4, 'Giovedì'],
  [5, 'Venerdì'],
  [6, 'Sabato'],
  [0, 'Domenica'],
];

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${h}:${mm}`;
}

function timeToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function OpeningHoursManager({ rows }: { rows: OpeningHour[] }) {
  const initial: Row[] = DAYS.map(([d]) => {
    const existing = rows.find((r) => r.dayOfWeek === d);
    return existing
      ? {
          dayOfWeek: d,
          openMinute: existing.openMinute,
          closeMinute: existing.closeMinute,
          active: existing.active,
        }
      : { dayOfWeek: d, openMinute: 9 * 60, closeMinute: 18 * 60, active: false };
  });

  const [state, setState] = useState<Row[]>(initial);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function update(d: number, patch: Partial<Row>) {
    setState((prev) => prev.map((r) => (r.dayOfWeek === d ? { ...r, ...patch } : r)));
  }

  function save() {
    startTransition(async () => {
      const r = await saveOpeningHoursAction({ hours: state });
      if (!r.ok) {
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Orari salvati' });
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {DAYS.map(([d, label]) => {
          const row = state.find((r) => r.dayOfWeek === d)!;
          return (
            <Card key={d}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <label className="flex items-center gap-2 min-w-[130px]">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(e) => update(d, { active: e.target.checked })}
                  />
                  <span className="font-medium">{label}</span>
                </label>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Apre</span>
                    <Input
                      type="time"
                      step={900}
                      value={minutesToTime(row.openMinute)}
                      disabled={!row.active}
                      onChange={(e) => update(d, { openMinute: timeToMinutes(e.target.value) })}
                      className="h-9 w-[110px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Chiude</span>
                    <Input
                      type="time"
                      step={900}
                      value={minutesToTime(row.closeMinute)}
                      disabled={!row.active}
                      onChange={(e) => update(d, { closeMinute: timeToMinutes(e.target.value) })}
                      className="h-9 w-[110px]"
                    />
                  </div>
                  {!row.active && (
                    <span className="text-xs italic text-muted-foreground">Chiuso</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? 'Salvo…' : 'Salva orari'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Per chiusure straordinarie (festivi, ferie) usa la sezione <strong>Chiusure</strong>.
      </p>
    </div>
  );
}
