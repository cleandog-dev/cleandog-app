'use client';

import { useState, useTransition } from 'react';
import type { Service } from '@prisma/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { upsertServiceAction, deleteServiceAction, recomputeBookingEndsAtAction, recomputeBookingPricesAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { formatDuration, formatEUR } from '@/lib/utils';

type Draft = {
  name: string;
  description: string;
  durationMin: number;
  priceCents: number;
  priceCoatShortMinCents: number | null;
  priceCoatShortMaxCents: number | null;
  priceCoatLongMinCents: number | null;
  priceCoatLongMaxCents: number | null;
  size: '' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'XLARGE';
  forAnimal: 'DOG' | 'CAT';
  active: boolean;
};

const empty: Draft = {
  name: '',
  description: '',
  durationMin: 60,
  priceCents: 3000,
  priceCoatShortMinCents: null,
  priceCoatShortMaxCents: null,
  priceCoatLongMinCents: null,
  priceCoatLongMaxCents: null,
  size: '',
  forAnimal: 'DOG',
  active: true,
};

export function ServicesManager({ services }: { services: Service[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function openNew() {
    setEditing(null);
    setDraft(empty);
    setOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setDraft({
      name: s.name,
      description: s.description ?? '',
      durationMin: s.durationMin,
      priceCents: s.priceCents,
      priceCoatShortMinCents: s.priceCoatShortMinCents ?? null,
      priceCoatShortMaxCents: s.priceCoatShortMaxCents ?? null,
      priceCoatLongMinCents: s.priceCoatLongMinCents ?? null,
      priceCoatLongMaxCents: s.priceCoatLongMaxCents ?? null,
      size: (s.size as Draft['size']) ?? '',
      forAnimal: (s.forAnimal as 'DOG' | 'CAT') ?? 'DOG',
      active: s.active,
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const payload = {
        ...draft,
        size: draft.size || undefined,
      };
      const r = await upsertServiceAction(editing?.id ?? null, payload);
      if (!r.ok) {
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
        return;
      }
      toast({ title: editing ? 'Servizio aggiornato' : 'Servizio creato' });
      setOpen(false);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const r = await recomputeBookingEndsAtAction();
              if (!r.ok) {
                toast({ title: 'Errore', description: r.error, variant: 'destructive' });
                return;
              }
              toast({ title: `Aggiornati ${r.data.updated} appuntamenti` });
            });
          }}
        >
          🔄 Allinea durate
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const r = await recomputeBookingPricesAction();
              if (!r.ok) {
                toast({ title: 'Errore', description: r.error, variant: 'destructive' });
                return;
              }
              toast({ title: `Ricalcolati ${r.data.updated} prezzi` });
            });
          }}
        >
          💶 Allinea prezzi
        </Button>
        <Button onClick={openNew} size="sm">+ Nuovo servizio</Button>
      </div>

      <div className="grid gap-2">
        {services.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center justify-between gap-2 py-2.5 sm:py-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="font-medium text-sm sm:text-base truncate">{s.name}</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {s.forAnimal === 'CAT' ? '🐈' : '🐕'}
                  </Badge>
                  {!s.active && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Off</Badge>
                  )}
                </div>
                {s.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1 sm:line-clamp-2">{s.description}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDuration(s.durationMin)}
                  {(() => {
                    const isBath = /bagno/i.test(s.name);
                    const isGroom = /tosatura/i.test(s.name);
                    if (isBath && isGroom) return ' · prezzo razza + tosatura';
                    if (isBath) return ' · prezzo per razza';
                    if (isGroom) return ' · prezzo per pelo';
                    return ` · ${formatEUR(s.priceCents)}`;
                  })()}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => openEdit(s)} className="px-2 sm:px-3">
                  <span className="sm:hidden">✏️</span>
                  <span className="hidden sm:inline">Modifica</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2 sm:px-3"
                  onClick={() => setDeleteTarget(s)}
                >
                  🗑
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Conferma eliminazione ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent style={{ borderRadius: 'var(--r-lg)', maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: 'var(--ink-900)' }}>
              Elimina servizio
            </DialogTitle>
          </DialogHeader>
          <div style={{ padding: '4px 0 8px' }}>
            <p style={{ fontSize: 14, color: 'var(--ink-600)', lineHeight: 1.6 }}>
              Stai per eliminare <span style={{ fontWeight: 700, color: 'var(--ink-900)' }}>{deleteTarget?.name}</span>.
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 8 }}>
              Questa azione è irreversibile.
            </p>
          </div>
          <DialogFooter style={{ gap: 8 }}>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annulla
            </Button>
            <Button
              disabled={pending}
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                if (!deleteTarget) return;
                const target = deleteTarget;
                setDeleteTarget(null);
                startTransition(async () => {
                  const r = await deleteServiceAction(target.id);
                  if (!r.ok) toast({ title: 'Impossibile eliminare', description: r.error, variant: 'destructive' });
                  else toast({ title: 'Servizio eliminato', description: target.name });
                });
              }}
            >
              {pending ? 'Elimino…' : 'Elimina'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modifica / Nuovo ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editing ? 'Modifica servizio' : 'Nuovo servizio'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editing ? (
              <p className="text-base font-semibold">{draft.name}</p>
            ) : (
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Descrizione</Label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            {(() => {
              const lower = draft.name.toLowerCase();
              const isBath = /bagno/.test(lower);
              const isGroom = /tosatura/.test(lower);
              const useBreedPricing = (isBath || isGroom) && draft.forAnimal === 'DOG';
              if (useBreedPricing) {
                return (
                  <>
                    <div className="space-y-1.5">
                      <Label>Durata (min)</Label>
                      <Input
                        type="number"
                        value={draft.durationMin}
                        onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) })}
                      />
                    </div>
                    <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                      💡 Prezzo calcolato automaticamente: <strong>
                        {isBath && isGroom ? 'prezzo razza + range tosatura'
                          : isBath ? 'prezzo della razza'
                          : 'range tosatura in base al pelo'}
                      </strong>. Modifica in <a href="/admin/breeds" className="underline">Razze</a>
                      {isGroom ? ' o nei campi tosatura sotto' : ''}.
                    </div>
                  </>
                );
              }
              return null;
            })()}
            <div className={`grid gap-3 ${(/bagno|tosatura/i.test(draft.name) && draft.forAnimal === 'DOG') ? 'hidden' : 'grid-cols-2'}`}>
              <div className="space-y-1.5">
                <Label>Durata (min)</Label>
                <Input
                  type="number"
                  value={draft.durationMin}
                  onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Prezzo (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={(draft.priceCents / 100).toFixed(2)}
                  onChange={(e) =>
                    setDraft({ ...draft, priceCents: Math.round(Number(e.target.value) * 100) })
                  }
                />
              </div>
            </div>
            {draft.name.toLowerCase().includes('tosatura') && draft.forAnimal === 'DOG' && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Prezzi tosatura — mostrati come &quot;da X €&quot;. Finale in negozio.
                </p>
                {(['Short', 'Long'] as const).map((coat) => {
                  const minKey = `priceCoat${coat}MinCents` as const;
                  return (
                    <div key={coat} className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <Label className="text-xs">
                        {coat === 'Short' ? 'Pelo corto' : 'Pelo lungo'} — Prezzo (€)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={draft[minKey] != null ? (draft[minKey]! / 100).toFixed(2) : ''}
                        placeholder="es. 10.00"
                        className="w-24"
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft({
                            ...draft,
                            [minKey]: v === '' ? null : Math.round(Number(v) * 100),
                            // mirror max = min to keep schema validation happy
                            [`priceCoat${coat}MaxCents`]: v === '' ? null : Math.round(Number(v) * 100),
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Animale</Label>
                <select
                  value={draft.forAnimal}
                  onChange={(e) => setDraft({ ...draft, forAnimal: e.target.value as 'DOG' | 'CAT' })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="DOG">Cane</option>
                  <option value="CAT">Gatto</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Taglia (opzionale)</Label>
                <select
                  value={draft.size}
                  onChange={(e) => setDraft({ ...draft, size: e.target.value as Draft['size'] })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Nessuna —</option>
                  <option value="SMALL">Piccola</option>
                  <option value="MEDIUM">Media</option>
                  <option value="LARGE">Grande</option>
                  <option value="XLARGE">Molto grande</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              Attivo (visibile ai clienti)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? 'Salvo…' : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
