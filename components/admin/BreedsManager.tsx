'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
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
import {
  upsertBreedAction,
  deleteBreedAction,
  getBreedEditorAction,
  bulkUpsertBreedServicePricesAction,
  setBreedSizesAction,
} from '@/lib/actions';
import { NumericInput } from '@/components/ui/numeric-input';
import { useToast } from '@/hooks/use-toast';
import { SIZE_LABELS, type BreedEntry, type SizeCategory, type CoatType } from '@/lib/breeds';

type TagliaChoice = 'NONE' | SizeCategory | 'VARIABLE';

type Draft = {
  name: string;
  animalType: 'DOG' | 'CAT';
  taglia: TagliaChoice;
  coatType: '' | CoatType;
  active: boolean;
  sortOrder: number;
};

type SizeRow = {
  // id present = existing; absent = new (created on save)
  id?: string;
  label: string;
  sortOrder: number;
  active: boolean;
  // temporary client-side identifier (used as React key + cell linkage when no id yet)
  tempKey: string;
};

type Cell = { priceCents: number | null; durationMin: number | null };

type ServiceRow = {
  serviceId: string;
  serviceName: string;
  serviceDisplayName: string | null;
  isDefault: boolean;
  breedScope: string;
  active: boolean;
  defaultDurationMin: number; // service-level fallback (placeholder)
  cells: Record<string, Cell>;
};

const empty: Draft = {
  name: '',
  animalType: 'DOG',
  taglia: 'MEDIUM',
  coatType: 'SHORT',
  active: true,
  sortOrder: 0,
};

function newCellKey(sizeKey: string | null, coat: 'SHORT' | 'LONG' | null): string {
  // sizeKey is either the persisted id OR the tempKey for unsaved sizes
  return `${sizeKey ?? 'none'}::${coat ?? 'NONE'}`;
}

function genTempKey(): string {
  return `tmp-${Math.random().toString(36).slice(2, 9)}`;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  animalType: 'Animale',
  size: 'Taglia',
  coatType: 'Tipo di pelo',
  priceMin: 'Prezzo min',
  priceMax: 'Prezzo max',
  priceTrim: 'Prezzo tosatura',
  priceTrimLong: 'Prezzo tosatura (lungo)',
  priceTouchUp: 'Prezzo spuntatura',
  active: 'Attiva',
  sortOrder: 'Ordine',
};

function formatFieldErrors(fe: Record<string, string[] | undefined> | undefined): string {
  if (!fe) return '';
  const parts: string[] = [];
  for (const [k, msgs] of Object.entries(fe)) {
    if (!msgs?.length) continue;
    const label = FIELD_LABELS[k] ?? k;
    parts.push(`${label}: ${msgs.join(', ')}`);
  }
  return parts.join(' · ');
}

const SIZE_PRESETS: { label: string; values: string[] }[] = [
  { label: 'P / M / G', values: ['Piccolo', 'Medio', 'Grande'] },
  { label: 'P / M / G / XL', values: ['Piccolo', 'Medio', 'Grande', 'XL'] },
  { label: 'Nessuna (1 prezzo)', values: [] },
];

type MissingEntry = { serviceId: string; serviceName: string };

export function BreedsManager({
  breeds,
  missingByBreed = {},
}: {
  breeds: BreedEntry[];
  missingByBreed?: Record<string, MissingEntry[]>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BreedEntry | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BreedEntry | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'DOG' | 'CAT'>('ALL');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [search, setSearch] = useState('');
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return breeds
      .filter((b) => (filter === 'ALL' ? true : b.animalType === filter))
      .filter((b) => (onlyIncomplete ? (missingByBreed[b.id]?.length ?? 0) > 0 : true))
      .filter((b) => (q ? b.name.toLowerCase().includes(q) : true))
      .slice()
      .sort((a, b) => {
        if (a.animalType !== b.animalType) return a.animalType.localeCompare(b.animalType);
        return a.name.localeCompare(b.name);
      });
  }, [breeds, filter, search, onlyIncomplete, missingByBreed]);

  const totalIncomplete = useMemo(
    () => breeds.reduce((n, b) => n + ((missingByBreed[b.id]?.length ?? 0) > 0 ? 1 : 0), 0),
    [breeds, missingByBreed],
  );

  function openNew() {
    setEditing(null);
    setDraft(empty);
    setSizes([]);
    setServices([]);
    setOpen(true);
  }

  function openEdit(b: BreedEntry) {
    setEditing(b);
    // taglia derived from breed.size; will be overridden to 'VARIABLE' once the editor
    // loads and detects existing size options.
    setDraft({
      name: b.name,
      animalType: b.animalType,
      taglia: b.size ?? 'NONE',
      coatType: b.coatType ?? '',
      active: true,
      sortOrder: 0,
    });
    setSizes([]);
    setServices([]);
    setOpen(true);
  }

  // Load editor payload when opening dialog
  useEffect(() => {
    if (!open || !editing) return;
    let cancelled = false;
    setLoading(true);
    getBreedEditorAction(editing.id).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        const loadedSizes: SizeRow[] = r.data.sizes.map((s) => ({
          id: s.id,
          label: s.label,
          sortOrder: s.sortOrder,
          active: s.active,
          tempKey: s.id,
        }));
        setSizes(loadedSizes);
        // If this breed has saved size options, treat the form as "Variabile".
        if (loadedSizes.length > 0) {
          setDraft((d) => ({ ...d, taglia: 'VARIABLE' }));
        }
        const loadedServices: ServiceRow[] = r.data.rows.map((row) => {
          const cells: Record<string, Cell> = {};
          for (const k in row.cells) {
            const v = row.cells[k];
            cells[k] = { priceCents: v?.priceCents ?? null, durationMin: v?.durationMin ?? null };
            // legacy priceLongCents (when cell key is "none::NONE" and breed is MIXED)
            if (k === 'none::NONE' && v?.priceLongCents != null) {
              cells['none::LONG'] = { priceCents: v.priceLongCents, durationMin: v?.durationMin ?? null };
            }
          }
          return {
            serviceId: row.serviceId,
            serviceName: row.serviceName,
            serviceDisplayName: row.serviceDisplayName,
            isDefault: row.isDefault,
            breedScope: row.breedScope,
            active: row.active,
            defaultDurationMin: row.defaultDurationMin,
            cells,
          };
        });
        setServices(loadedServices);
      } else {
        toast({ title: 'Errore caricamento dati', description: r.error, variant: 'destructive' });
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, editing, toast]);

  const isMixed = draft.coatType === 'MIXED';
  const coatColumns: Array<'SHORT' | 'LONG' | null> = isMixed ? ['SHORT', 'LONG'] : [null];

  function addSize() {
    setSizes((prev) => [
      ...prev,
      { label: '', sortOrder: (prev[prev.length - 1]?.sortOrder ?? 0) + 10, active: true, tempKey: genTempKey() },
    ]);
  }

  function updateSize(tempKey: string, patch: Partial<SizeRow>) {
    setSizes((prev) => prev.map((s) => (s.tempKey === tempKey ? { ...s, ...patch } : s)));
  }

  function removeSize(tempKey: string) {
    setSizes((prev) => prev.filter((s) => s.tempKey !== tempKey));
  }

  function moveSize(tempKey: string, dir: 'up' | 'down') {
    setSizes((prev) => {
      const idx = prev.findIndex((s) => s.tempKey === tempKey);
      if (idx < 0) return prev;
      const j = dir === 'up' ? idx - 1 : idx + 1;
      if (j < 0 || j >= prev.length) return prev;
      const copy = prev.slice();
      [copy[idx], copy[j]] = [copy[j]!, copy[idx]!];
      // Re-emit sortOrder values
      return copy.map((s, i) => ({ ...s, sortOrder: (i + 1) * 10 }));
    });
  }

  function applyPreset(values: string[]) {
    const next: SizeRow[] = values.map((label, i) => ({
      label,
      sortOrder: (i + 1) * 10,
      active: true,
      tempKey: genTempKey(),
    }));
    setSizes(next);
  }

  function updateCellPrice(serviceId: string, cellKey: string, val: number | null) {
    setServices((prev) =>
      prev.map((s) => {
        if (s.serviceId !== serviceId) return s;
        const prevCell = s.cells[cellKey] ?? { priceCents: null, durationMin: null };
        return { ...s, cells: { ...s.cells, [cellKey]: { ...prevCell, priceCents: val } } };
      }),
    );
  }

  function updateCellDuration(serviceId: string, cellKey: string, val: number | null) {
    setServices((prev) =>
      prev.map((s) => {
        if (s.serviceId !== serviceId) return s;
        const prevCell = s.cells[cellKey] ?? { priceCents: null, durationMin: null };
        return { ...s, cells: { ...s.cells, [cellKey]: { ...prevCell, durationMin: val } } };
      }),
    );
  }

  function toggleServiceActive(serviceId: string, active: boolean) {
    setServices((prev) => prev.map((s) => (s.serviceId === serviceId ? { ...s, active } : s)));
  }

  async function save() {
    startTransition(async () => {
      // Persisted Breed.size: only when a concrete S/M/L is picked; 'VARIABLE' or 'NONE' → null.
      const persistedSize: SizeCategory | null =
        draft.taglia === 'SMALL' || draft.taglia === 'MEDIUM' || draft.taglia === 'LARGE'
          ? draft.taglia
          : null;
      // If taglia is VARIABLE we keep the current sizes editor; otherwise clear all.
      const sizesPayload = draft.taglia === 'VARIABLE'
        ? sizes
            .filter((s) => s.label.trim())
            .map((s) => ({ id: s.id, label: s.label.trim(), sortOrder: s.sortOrder, active: s.active }))
        : [];

      // 1) Save breed anagrafica
      const payload = {
        name: draft.name.trim(),
        animalType: draft.animalType,
        size: persistedSize,
        coatType: draft.coatType || null,
        priceMin: 0,
        priceMax: 0,
        priceTrim: null,
        priceTrimLong: null,
        priceTouchUp: null,
        active: draft.active,
        sortOrder: draft.sortOrder,
      };
      const r1 = await upsertBreedAction(editing?.id ?? null, payload);
      if (!r1.ok) {
        const desc = formatFieldErrors(r1.fieldErrors) || r1.error;
        toast({ title: 'Errore razza', description: desc, variant: 'destructive' });
        return;
      }
      if (!editing) {
        toast({ title: 'Razza creata', description: 'Riapri la razza per impostare i prezzi.' });
        setOpen(false);
        return;
      }

      // 2) Save sizes (returns canonical ids — but we re-fetch to get them)
      const r2 = await setBreedSizesAction({
        breedId: editing.id,
        sizes: sizesPayload,
      });
      if (!r2.ok) {
        const desc = formatFieldErrors(r2.fieldErrors) || r2.error;
        toast({ title: 'Errore misure', description: desc, variant: 'destructive' });
        return;
      }

      // 3) Re-fetch to get persisted size ids (for newly created sizes)
      const r3 = await getBreedEditorAction(editing.id);
      if (!r3.ok) {
        toast({ title: 'Errore', description: r3.error, variant: 'destructive' });
        return;
      }
      // Build mapping: client tempKey → persisted id by label+sortOrder match.
      const persistedSizes = r3.data.sizes;
      const tempToId = new Map<string, string>();
      for (const cs of sizes.filter((s) => s.label.trim())) {
        if (cs.id) tempToId.set(cs.tempKey, cs.id);
        else {
          const match = persistedSizes.find(
            (p) => p.label === cs.label.trim() && p.sortOrder === cs.sortOrder,
          );
          if (match) tempToId.set(cs.tempKey, match.id);
        }
      }

      // 4) Build cells per service in canonical (persisted sizeOptionId, coat) form
      const servicesPayload = services.map((svc) => {
        const cells: Array<{ sizeOptionId: string | null; coat: 'SHORT' | 'LONG' | null; priceCents: number | null; durationMin: number | null }> = [];
        const sizeRows: Array<{ key: string | null; tempKey: string | null }> =
          sizes.length === 0
            ? [{ key: null, tempKey: null }]
            : sizes
                .filter((s) => s.label.trim())
                .map((s) => ({ key: s.id ?? tempToId.get(s.tempKey) ?? null, tempKey: s.tempKey }));
        for (const sr of sizeRows) {
          for (const coat of coatColumns) {
            const lookupSizeKey = sr.key ?? sr.tempKey;
            const k = newCellKey(lookupSizeKey, coat);
            const v = svc.cells[k];
            cells.push({
              sizeOptionId: sr.key,
              coat,
              priceCents: v?.priceCents != null ? Math.round(v.priceCents) : null,
              durationMin: v?.durationMin != null ? Math.round(v.durationMin) : null,
            });
          }
        }
        return { serviceId: svc.serviceId, active: svc.active, cells };
      });

      const r4 = await bulkUpsertBreedServicePricesAction({
        breedId: editing.id,
        services: servicesPayload,
      });
      if (!r4.ok) {
        const desc = formatFieldErrors(r4.fieldErrors) || r4.error;
        toast({ title: 'Errore prezzi', description: desc, variant: 'destructive' });
        return;
      }
      toast({ title: 'Razza aggiornata' });
      setOpen(false);
    });
  }

  // Group services for rendering
  const defaultServices = services.filter((s) => s.isDefault);
  const addonServices = services.filter((s) => !s.isDefault);

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
          <Button onClick={openNew} size="sm" className="sm:hidden">+ Nuova</Button>
        </div>
        <div className="relative sm:flex-1">
          <Input
            placeholder="Cerca razza…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Cancella ricerca"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
        <Button onClick={openNew} size="sm" className="hidden sm:inline-flex">+ Nuova razza</Button>
      </div>

      {totalIncomplete > 0 && (
        <button
          type="button"
          onClick={() => setOnlyIncomplete((v) => !v)}
          className="self-start text-xs font-medium rounded-md border px-2.5 py-1 transition-colors"
          style={{
            background: onlyIncomplete ? '#fef3c7' : 'white',
            borderColor: onlyIncomplete ? '#f59e0b' : 'var(--cream-300)',
            color: onlyIncomplete ? '#92400e' : 'var(--ink-700)',
          }}
        >
          {onlyIncomplete ? '✓ ' : ''}⚠ {totalIncomplete} razz{totalIncomplete === 1 ? 'a' : 'e'} con prezzi mancanti
        </button>
      )}

      <div className="grid gap-2">
        {visible.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nessuna razza trovata.
            </CardContent>
          </Card>
        ) : (
          visible.map((b) => {
            const missing = missingByBreed[b.id] ?? [];
            const missingNames = missing.map((m) => m.serviceName);
            const preview = missingNames.slice(0, 2).join(', ');
            const more = missingNames.length - 2;
            return (
            <Card key={b.id}>
              <CardContent className="flex items-center justify-between gap-2 py-2.5 sm:py-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm sm:text-base truncate">{b.name}</h3>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {b.animalType === 'CAT' ? '🐈' : '🐕'}
                    </Badge>
                    {b.size && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{SIZE_LABELS[b.size]}</Badge>}
                    {b.coatType && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {b.coatType === 'SHORT' ? 'Corto' : b.coatType === 'LONG' ? 'Lungo' : 'Variabile'}
                      </Badge>
                    )}
                  </div>
                  {missing.length > 0 && (
                    <p
                      className="mt-1 text-[11px]"
                      style={{ color: '#b45309' }}
                      title={missingNames.join(', ')}
                    >
                      ⚠ Mancano prezzi: <span className="font-medium">{preview}</span>
                      {more > 0 ? ` +${more} altr${more === 1 ? 'o' : 'i'}` : ''}
                    </p>
                  )}
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
            );
          })
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
        <DialogContent className="max-h-[92vh] overflow-y-auto">
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
                <Label>Taglia</Label>
                <select
                  value={draft.taglia}
                  onChange={(e) => setDraft({ ...draft, taglia: e.target.value as TagliaChoice })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="NONE">—</option>
                  <option value="SMALL">Piccola</option>
                  <option value="MEDIUM">Media</option>
                  <option value="LARGE">Grande</option>
                  <option value="VARIABLE">Variabile (più misure)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo di pelo</Label>
              <select
                value={draft.coatType}
                onChange={(e) => setDraft({ ...draft, coatType: e.target.value as Draft['coatType'] })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Seleziona —</option>
                <option value="SHORT">Pelo corto</option>
                <option value="LONG">Pelo lungo</option>
                <option value="MIXED">Variabile (es. Meticcio)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                &quot;Variabile&quot; abilita doppio prezzo (corto/lungo) sui servizi.
              </p>
            </div>

            {editing ? (
              loading ? (
                <p className="text-xs text-muted-foreground">Caricamento…</p>
              ) : (
                <>
                  {/* MISURE — solo se taglia = Variabile */}
                  {draft.taglia === 'VARIABLE' && (
                  <div className="space-y-2 rounded-lg border p-3" style={{ background: 'var(--cream-100)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--sage-800)' }}>
                        Misure
                      </p>
                      <Button size="sm" variant="outline" onClick={addSize} className="h-7 text-xs">
                        + Aggiungi
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      0 misure = un prezzo unico. 2+ misure = il cliente sceglie. Etichetta libera.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {SIZE_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          className="text-[11px] px-2 py-1 rounded border"
                          style={{ borderColor: 'var(--cream-300)', background: 'white' }}
                          onClick={() => applyPreset(p.values)}
                        >
                          Preset: {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {sizes.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">Nessuna misura. Un solo prezzo per servizio.</p>
                      ) : (
                        sizes.map((s, idx) => (
                          <div key={s.tempKey} className="flex items-center gap-1.5 rounded-md border bg-white p-1.5">
                            <Input
                              value={s.label}
                              onChange={(e) => updateSize(s.tempKey, { label: e.target.value })}
                              placeholder="es. Piccolo"
                              className="h-8 flex-1 text-sm"
                            />
                            <Button size="sm" variant="ghost" onClick={() => moveSize(s.tempKey, 'up')} disabled={idx === 0} className="h-6 w-6 p-0">▲</Button>
                            <Button size="sm" variant="ghost" onClick={() => moveSize(s.tempKey, 'down')} disabled={idx === sizes.length - 1} className="h-6 w-6 p-0">▼</Button>
                            <Button size="sm" variant="ghost" onClick={() => removeSize(s.tempKey)} className="h-6 w-6 p-0 text-red-500">🗑</Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  )}

                  {/* PREZZI SERVIZI */}
                  <div className="space-y-3 rounded-lg border p-3" style={{ background: 'var(--cream-100)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--sage-800)' }}>
                      Prezzi servizi
                    </p>
                    {services.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nessun servizio &quot;per razza&quot; configurato per {draft.animalType === 'CAT' ? 'gatti' : 'cani'}.
                        Crea un servizio in <a href="/admin/services" className="underline">Servizi</a>.
                      </p>
                    ) : (
                      <>
                        {defaultServices.length > 0 && (
                          <PriceMatrixSection
                            title="Sempre incluso"
                            subtitle="Servizio auto-aggiunto ad ogni prenotazione"
                            services={defaultServices}
                            sizes={draft.taglia === 'VARIABLE' ? sizes : []}
                            coatColumns={coatColumns}
                            onPriceChange={updateCellPrice}
                            onDurationChange={updateCellDuration}
                            onToggleActive={toggleServiceActive}
                          />
                        )}
                        {addonServices.length > 0 && (
                          <PriceMatrixSection
                            title="Aggiuntivi"
                            subtitle="Selezionabili dal cliente"
                            services={addonServices}
                            sizes={draft.taglia === 'VARIABLE' ? sizes : []}
                            coatColumns={coatColumns}
                            onPriceChange={updateCellPrice}
                            onDurationChange={updateCellDuration}
                            onToggleActive={toggleServiceActive}
                          />
                        )}
                      </>
                    )}
                  </div>
                </>
              )
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Salva la razza per impostare misure e prezzi.
              </p>
            )}
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

function PriceMatrixSection({
  title,
  subtitle,
  services,
  sizes,
  coatColumns,
  onPriceChange,
  onDurationChange,
  onToggleActive,
}: {
  title: string;
  subtitle: string;
  services: ServiceRow[];
  sizes: SizeRow[];
  coatColumns: Array<'SHORT' | 'LONG' | null>;
  onPriceChange: (serviceId: string, cellKey: string, val: number | null) => void;
  onDurationChange: (serviceId: string, cellKey: string, val: number | null) => void;
  onToggleActive: (serviceId: string, active: boolean) => void;
}) {
  const sizeRows: Array<{ key: string; label: string }> =
    sizes.length === 0
      ? [{ key: 'none', label: 'Prezzo unico' }]
      : sizes
          .filter((s) => s.label.trim())
          .map((s) => ({ key: s.id ?? s.tempKey, label: s.label }));
  const showCoatColumns = coatColumns.length > 1;
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium" style={{ color: 'var(--ink-700)' }}>{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {services.map((svc) => (
        <div key={svc.serviceId} className="rounded-md border bg-white p-2.5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{svc.serviceDisplayName || svc.serviceName}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Durata default: {svc.defaultDurationMin} min
                {svc.breedScope === 'SELECTED' ? ' · opt-in per razza' : ''}
              </p>
            </div>
            <label className="flex items-center gap-1 text-xs flex-shrink-0">
              <input
                type="checkbox"
                checked={svc.active}
                onChange={(e) => onToggleActive(svc.serviceId, e.target.checked)}
              />
              Attivo
            </label>
          </div>
          {svc.active && (
            <div className="space-y-2">
              {sizeRows.map((sr) => {
                const sizeKey = sr.key === 'none' ? null : sr.key;
                return (
                  <div key={sr.key} className="space-y-1">
                    {sizeRows.length > 1 || showCoatColumns ? (
                      <p className="text-[11px] font-semibold" style={{ color: 'var(--ink-700)' }}>{sr.label}</p>
                    ) : null}
                    <div className={`grid gap-2 ${showCoatColumns ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                      {coatColumns.map((coat) => {
                        const k = `${sizeKey ?? 'none'}::${coat ?? 'NONE'}`;
                        const v = svc.cells[k];
                        return (
                          <div key={coat ?? 'none'} className="rounded border bg-cream-50 p-1.5" style={{ background: 'var(--cream-50)' }}>
                            {showCoatColumns && (
                              <p className="text-[10px] text-muted-foreground mb-1 text-center">
                                {coat === 'SHORT' ? 'Pelo corto' : 'Pelo lungo'}
                              </p>
                            )}
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="text-[9px] uppercase tracking-wide text-muted-foreground">Prezzo €</label>
                                <NumericInput
                                  value={v?.priceCents != null ? v.priceCents / 100 : null}
                                  allowDecimal
                                  onChange={(n) => onPriceChange(svc.serviceId, k, n == null ? null : Math.round(n * 100))}
                                  placeholder="—"
                                  min={0}
                                  max={1000}
                                />
                              </div>
                              <div>
                                <label className="text-[9px] uppercase tracking-wide text-muted-foreground">Durata min</label>
                                <NumericInput
                                  value={v?.durationMin ?? null}
                                  onChange={(n) => onDurationChange(svc.serviceId, k, n == null ? null : Math.round(n))}
                                  placeholder={String(svc.defaultDurationMin)}
                                  min={0}
                                  max={600}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
