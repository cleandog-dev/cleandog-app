'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { Closure } from '@prisma/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClosureAction, deleteClosureAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { APP_TIMEZONE } from '@/lib/utils';

export function ClosuresManager({ closures }: { closures: Closure[] }) {
  const [pending, startTransition] = useTransition();
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const { toast } = useToast();

  function add() {
    if (!startsAt || !endsAt) {
      toast({ title: 'Compila inizio e fine', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const r = await createClosureAction({
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        reason,
      });
      if (!r.ok) {
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Chiusura aggiunta' });
      setStartsAt('');
      setEndsAt('');
      setReason('');
    });
  }

  function remove(id: string) {
    if (!confirm('Eliminare questa chiusura?')) return;
    startTransition(async () => {
      const r = await deleteClosureAction(id);
      if (!r.ok) toast({ title: 'Errore', description: r.error, variant: 'destructive' });
      else toast({ title: 'Eliminata' });
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="font-medium">Nuova chiusura</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Inizio</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fine</Label>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo (opzionale)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ferie, festività…" />
          </div>
          <div>
            <Button onClick={add} disabled={pending}>
              {pending ? 'Salvo…' : 'Aggiungi chiusura'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        {closures.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessuna chiusura programmata.</p>
        )}
        {closures.map((c) => {
          const s = toZonedTime(c.startsAt, APP_TIMEZONE);
          const e = toZonedTime(c.endsAt, APP_TIMEZONE);
          return (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="text-sm">
                  <div className="font-medium">
                    {format(s, 'dd/MM/yyyy HH:mm')} → {format(e, 'dd/MM/yyyy HH:mm')}
                  </div>
                  {c.reason && <div className="text-xs text-muted-foreground">{c.reason}</div>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)} disabled={pending}>
                  Elimina
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
