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
import { upsertServiceAction, deleteServiceAction, recomputeBookingEndsAtAction, recomputeBookingPricesAction, moveServiceAction } from '@/lib/actions';
import { NumericInput } from '@/components/ui/numeric-input';
import { useToast } from '@/hooks/use-toast';
import { formatDuration } from '@/lib/utils';

type Draft = {
  name: string;
  displayName: string;
  description: string;
  durationMin: number;
  priceCents: number;
  pricingMode: 'FIXED' | 'PER_BREED';
  breedScope: 'ALL' | 'SELECTED';
  isDefault: boolean;
  forAnimal: 'DOG' | 'CAT' | 'OTHER';
  active: boolean;
};

const empty: Draft = {
  name: '',
  displayName: '',
  description: '',
  durationMin: 60,
  priceCents: 0,
  pricingMode: 'PER_BREED',
  breedScope: 'ALL',
  isDefault: false,
  forAnimal: 'DOG',
  active: true,
};

export function ServicesManager({ services, missingByService = {} }: { services: Service[]; missingByService?: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [tab, setTab] = useState<'DOG' | 'CAT' | 'OTHER'>('DOG');
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const visible = services
    .filter((s) => (tab === 'OTHER' ? !s.forAnimal : s.forAnimal === tab))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const counts = {
    DOG: services.filter((s) => s.forAnimal === 'DOG').length,
    CAT: services.filter((s) => s.forAnimal === 'CAT').length,
    OTHER: services.filter((s) => !s.forAnimal).length,
  };

  function openNew() {
    setEditing(null);
    setDraft(empty);
    setOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    const sAny = s as unknown as { pricingMode?: string; breedScope?: string; isDefault?: boolean; displayName?: string | null };
    setDraft({
      name: s.name,
      displayName: sAny.displayName ?? '',
      description: s.description ?? '',
      durationMin: s.durationMin,
      priceCents: s.priceCents,
      pricingMode: (sAny.pricingMode as Draft['pricingMode']) ?? 'FIXED',
      breedScope: (sAny.breedScope as Draft['breedScope']) ?? 'ALL',
      isDefault: sAny.isDefault ?? false,
      forAnimal: (s.forAnimal as 'DOG' | 'CAT') ?? 'OTHER',
      active: s.active,
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const payload = {
        ...draft,
        forAnimal: draft.forAnimal === 'OTHER' ? null : draft.forAnimal,
        displayName: draft.displayName.trim() || null,
        priceCoatShortMinCents: null,
        priceCoatShortMaxCents: null,
        priceCoatLongMinCents: null,
        priceCoatLongMaxCents: null,
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

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['DOG', 'CAT', 'OTHER'] as const).map((t) => {
          const active = tab === t;
          const label = t === 'DOG' ? '🐕 Cane' : t === 'CAT' ? '🐈 Gatto' : '➕ Altri';
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors"
              style={{
                color: active ? 'var(--sage-800)' : 'var(--ink-500)',
                fontWeight: active ? 700 : 500,
                borderBottom: active ? '2px solid var(--sage-800)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {label}
              <span className="ml-1.5 text-xs text-muted-foreground">({counts[t]})</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2">
        {visible.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nessun servizio in questa categoria.
            </CardContent>
          </Card>
        ) : (
          visible.map((s, idx) => {
            const sAny = s as unknown as { displayName?: string | null; pricingMode?: string; breedScope?: string; isDefault?: boolean };
            const shown = sAny.displayName?.trim() || s.name.replace(/ — (Cane|Gatto)$/, '');
            const isBreedPriced = sAny.pricingMode === 'PER_BREED';
            const isFirst = idx === 0;
            const isLast = idx === visible.length - 1;
            return (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between gap-2 py-2.5 sm:py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-medium text-sm sm:text-base truncate">{shown}</h3>
                      {sAny.isDefault && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ background: 'var(--sage-100)', color: 'var(--sage-800)', borderColor: 'var(--sage-200)' }}>
                          Sempre incluso
                        </Badge>
                      )}
                      {!s.active && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Off</Badge>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1 sm:line-clamp-2">{s.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDuration(s.durationMin)}
                      {isBreedPriced
                        ? ` · prezzo per razza${sAny.breedScope === 'SELECTED' ? ' (solo alcune)' : ''}`
                        : ` · ${(s.priceCents / 100).toFixed(2)} €`}
                    </p>
                    {isBreedPriced && (missingByService[s.id] ?? 0) > 0 && (
                      <p className="mt-1 text-[11px]" style={{ color: '#b45309' }}>
                        ⚠ Mancano prezzi per {missingByService[s.id]} razz{missingByService[s.id] === 1 ? 'a' : 'e'} — vai a <a href="/admin/breeds" className="underline">Razze</a>.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0 items-center">
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending || isFirst}
                        title="Sposta su"
                        onClick={() => {
                          startTransition(async () => {
                            const r = await moveServiceAction(s.id, 'up');
                            if (!r.ok) toast({ title: 'Errore', description: r.error, variant: 'destructive' });
                          });
                        }}
                        className="h-6 w-6 p-0"
                      >
                        ▲
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending || isLast}
                        title="Sposta giù"
                        onClick={() => {
                          startTransition(async () => {
                            const r = await moveServiceAction(s.id, 'down');
                            if (!r.ok) toast({ title: 'Errore', description: r.error, variant: 'destructive' });
                          });
                        }}
                        className="h-6 w-6 p-0"
                      >
                        ▼
                      </Button>
                    </div>
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
            );
          })
        )}
      </div>

      {/* ── Conferma eliminazione ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent style={{ borderRadius: 'var(--r-lg)', maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: 'var(--ink-900)' }}>
              Disattiva servizio
            </DialogTitle>
          </DialogHeader>
          <div style={{ padding: '4px 0 8px' }}>
            <p style={{ fontSize: 14, color: 'var(--ink-600)', lineHeight: 1.6 }}>
              Stai per disattivare <span style={{ fontWeight: 700, color: 'var(--ink-900)' }}>{deleteTarget?.name}</span>.
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 8 }}>
              Il servizio sparirà dalla lista e dal flow cliente. Le prenotazioni storiche restano leggibili. Puoi ricrearlo con lo stesso nome quando vuoi.
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
                  if (!r.ok) toast({ title: 'Impossibile disattivare', description: r.error, variant: 'destructive' });
                  else toast({ title: 'Servizio disattivato', description: target.name });
                });
              }}
            >
              {pending ? 'Disattivo…' : 'Disattiva'}
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
              <p className="text-xs text-muted-foreground">
                Servizio: <span className="font-medium text-foreground">{draft.name}</span>
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="es. Parking 1 ora"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Nome visibile al cliente <span className="text-xs font-normal text-muted-foreground">(opzionale)</span></Label>
              <Input
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                placeholder="es. Bagno relax"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrizione</Label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Durata (min)</Label>
              <NumericInput
                value={draft.durationMin || null}
                onChange={(n) => setDraft({ ...draft, durationMin: n ?? 0 })}
                placeholder="60"
                min={15}
                max={480}
              />
            </div>

            <div className="space-y-2 rounded-lg border p-3" style={{ background: 'var(--cream-50)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--sage-800)' }}>
                Tipo prezzo
              </p>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="pricingMode"
                  checked={draft.pricingMode === 'FIXED'}
                  onChange={() => setDraft({ ...draft, pricingMode: 'FIXED' })}
                  className="mt-1"
                />
                <span>
                  <strong>Prezzo fisso</strong>
                  <span className="block text-xs text-muted-foreground">Stesso prezzo per qualsiasi razza/cliente.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="pricingMode"
                  checked={draft.pricingMode === 'PER_BREED'}
                  onChange={() => setDraft({ ...draft, pricingMode: 'PER_BREED' })}
                  className="mt-1"
                />
                <span>
                  <strong>Per razza</strong>
                  <span className="block text-xs text-muted-foreground">Prezzo definito per ogni razza in <a href="/admin/breeds" className="underline">Razze</a>.</span>
                </span>
              </label>

              {draft.pricingMode === 'FIXED' && (
                <div className="space-y-1.5 pt-2">
                  <Label>Prezzo (€)</Label>
                  <NumericInput
                    value={draft.priceCents > 0 ? draft.priceCents / 100 : null}
                    allowDecimal
                    placeholder="0"
                    onChange={(n) =>
                      setDraft({ ...draft, priceCents: n == null ? 0 : Math.round(n * 100) })
                    }
                  />
                </div>
              )}

              {draft.pricingMode === 'PER_BREED' && (
                <div className="pt-2 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Applica a:</p>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="breedScope"
                      checked={draft.breedScope === 'ALL'}
                      onChange={() => setDraft({ ...draft, breedScope: 'ALL' })}
                      className="mt-1"
                    />
                    <span>
                      <strong>Tutte le razze</strong>
                      <span className="block text-xs text-muted-foreground">Auto-aggiunge una riga prezzo in ogni razza compatibile.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="breedScope"
                      checked={draft.breedScope === 'SELECTED'}
                      onChange={() => setDraft({ ...draft, breedScope: 'SELECTED' })}
                      className="mt-1"
                    />
                    <span>
                      <strong>Solo alcune razze</strong>
                      <span className="block text-xs text-muted-foreground">Vai in Razze e attiva il servizio dove serve.</span>
                    </span>
                  </label>
                </div>
              )}
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={draft.isDefault}
                onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                className="mt-1"
              />
              <span>
                <strong>Sempre incluso</strong>
                <span className="block text-xs text-muted-foreground">Auto-aggiunto a ogni prenotazione (es. bagno). Solo uno per animale.</span>
              </span>
            </label>

            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <select
                value={draft.forAnimal}
                onChange={(e) => setDraft({ ...draft, forAnimal: e.target.value as Draft['forAnimal'] })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="DOG">🐕 Cane</option>
                <option value="CAT">🐈 Gatto</option>
                <option value="OTHER">➕ Altro (es. parking, asilo)</option>
              </select>
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
