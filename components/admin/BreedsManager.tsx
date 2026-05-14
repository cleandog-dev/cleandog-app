'use client';

import { useMemo, useState, useTransition } from 'react';
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
import { upsertBreedAction, deleteBreedAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { formatPrice, SIZE_LABELS, type BreedEntry, type SizeCategory, type CoatType } from '@/lib/breeds';

type Draft = {
  name: string;
  animalType: 'DOG' | 'CAT';
  size: '' | SizeCategory;
  coatType: '' | CoatType;
  priceMin: number;
  priceMax: number;
  active: boolean;
  sortOrder: number;
};

const empty: Draft = {
  name: '',
  animalType: 'DOG',
  size: 'MEDIUM',
  coatType: 'SHORT',
  priceMin: 25,
  priceMax: 25,
  active: true,
  sortOrder: 0,
};

const SIZE_ORDER: Record<SizeCategory, number> = { SMALL: 0, MEDIUM: 1, LARGE: 2 };

export function BreedsManager({ breeds }: { breeds: BreedEntry[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BreedEntry | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [deleteTarget, setDeleteTarget] = useState<BreedEntry | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'DOG' | 'CAT'>('ALL');
  const [search, setSearch] = useState('');
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return breeds
      .filter((b) => (filter === 'ALL' ? true : b.animalType === filter))
      .filter((b) => (q ? b.name.toLowerCase().includes(q) : true))
      .slice()
      .sort((a, b) => {
        if (a.animalType !== b.animalType) return a.animalType.localeCompare(b.animalType);
        const sa = a.size ? SIZE_ORDER[a.size] : 99;
        const sb = b.size ? SIZE_ORDER[b.size] : 99;
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name);
      });
  }, [breeds, filter, search]);

  function openNew() {
    setEditing(null);
    setDraft(empty);
    setOpen(true);
  }

  function openEdit(b: BreedEntry) {
    setEditing(b);
    setDraft({
      name: b.name,
      animalType: b.animalType,
      size: b.size ?? '',
      coatType: b.coatType ?? '',
      priceMin: b.priceMin,
      priceMax: b.priceMax,
      active: true,
      sortOrder: 0,
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const payload = {
        name: draft.name.trim(),
        animalType: draft.animalType,
        size: draft.animalType === 'DOG' ? (draft.size || null) : null,
        coatType: draft.animalType === 'DOG' ? (draft.coatType || null) : null,
        priceMin: draft.priceMin,
        priceMax: draft.priceMin,
        active: draft.active,
        sortOrder: draft.sortOrder,
      };
      const r = await upsertBreedAction(editing?.id ?? null, payload);
      if (!r.ok) {
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
        return;
      }
      toast({ title: editing ? 'Razza aggiornata' : 'Razza creata' });
      setOpen(false);
    });
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center justify-between gap-2 sm:flex-1">
          <div className="flex gap-1">
            {(['ALL', 'DOG', 'CAT'] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'default' : 'outline'}
                onClick={() => setFilter(f)}
                className="px-2.5"
              >
                {f === 'ALL' ? 'Tutte' : f === 'DOG' ? 'Cani' : 'Gatti'}
              </Button>
            ))}
          </div>
          <Button onClick={openNew} size="sm" className="sm:hidden">
            + Nuova
          </Button>
        </div>
        <Input
          placeholder="Cerca razza…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 sm:flex-1"
        />
        <Button onClick={openNew} size="sm" className="hidden sm:inline-flex">
          + Nuova razza
        </Button>
      </div>

      <div className="grid gap-2">
        {visible.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nessuna razza trovata.
            </CardContent>
          </Card>
        ) : (
          visible.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex items-center justify-between gap-2 py-2.5 sm:py-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm sm:text-base truncate">{b.name}</h3>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {b.size && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{SIZE_LABELS[b.size]}</Badge>}
                    {b.coatType && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {b.coatType === 'SHORT' ? 'Corto' : b.coatType === 'LONG' ? 'Lungo' : 'Variabile'}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      da {b.priceMin} €
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(b)} className="px-2 sm:px-3">
                    <span className="sm:hidden">✏️</span>
                    <span className="hidden sm:inline">Modifica</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2 sm:px-3"
                    onClick={() => setDeleteTarget(b)}
                  >
                    🗑
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle>Elimina razza</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stai per eliminare <span className="font-semibold text-foreground">{deleteTarget?.name}</span>.
            Le prenotazioni passate non saranno toccate. Continuare?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annulla</Button>
            <Button
              disabled={pending}
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                if (!deleteTarget) return;
                const target = deleteTarget;
                setDeleteTarget(null);
                startTransition(async () => {
                  const r = await deleteBreedAction(target.id);
                  if (!r.ok) toast({ title: 'Errore', description: r.error, variant: 'destructive' });
                  else toast({ title: 'Razza eliminata', description: target.name });
                });
              }}
            >
              {pending ? 'Elimino…' : 'Elimina'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / New */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifica razza' : 'Nuova razza'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Animale</Label>
                <select
                  value={draft.animalType}
                  onChange={(e) => setDraft({ ...draft, animalType: e.target.value as 'DOG' | 'CAT' })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="DOG">Cane</option>
                  <option value="CAT">Gatto</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Taglia {draft.animalType === 'CAT' && <span className="text-muted-foreground">(N/A)</span>}</Label>
                <select
                  value={draft.size}
                  disabled={draft.animalType === 'CAT'}
                  onChange={(e) => setDraft({ ...draft, size: e.target.value as Draft['size'] })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="">— Seleziona —</option>
                  <option value="SMALL">Piccola</option>
                  <option value="MEDIUM">Media</option>
                  <option value="LARGE">Grande</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo di pelo {draft.animalType === 'CAT' && <span className="text-muted-foreground">(N/A)</span>}</Label>
              <select
                value={draft.coatType}
                disabled={draft.animalType === 'CAT'}
                onChange={(e) => setDraft({ ...draft, coatType: e.target.value as Draft['coatType'] })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">— Seleziona —</option>
                <option value="SHORT">Pelo corto</option>
                <option value="LONG">Pelo lungo</option>
                <option value="MIXED">Variabile (es. Meticcio)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Determina il prezzo della tosatura. &quot;Variabile&quot; fa scegliere il pelo al cliente.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Prezzo Bagno minimo (€)</Label>
              <Input
                type="number"
                value={draft.priceMin}
                onChange={(e) => setDraft({ ...draft, priceMin: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Mostrato come &quot;da X €&quot;. Prezzo finale concordato in negozio.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={save} disabled={pending}>
              {pending ? 'Salvo…' : 'Salva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
