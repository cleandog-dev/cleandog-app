'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import type { Service, Extra } from '@prisma/client';
import { format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { adminCreateBookingAction, getDayOverviewAction, type DaySlot } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { APP_TIMEZONE } from '@/lib/utils';
import type { BreedEntry, PricesByAnimal, BreedServicePriceEntry } from '@/lib/breeds';
import { makeCellKey } from '@/lib/breeds';
import { ClientPicker, type PickerSelection } from '@/components/admin/ClientPicker';
import { SlotPicker } from '@/components/admin/SlotPicker';
import { BreedPicker } from '@/components/admin/BreedPicker';
import type { ClientSummary } from '@/lib/clients';

type CoatChoice = 'SHORT' | 'LONG';

type Draft = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  dogName: string;
  animalType: 'DOG' | 'CAT';
  dogBreed: string;
  sizeOptionId: string;
  startsAt: string;
  notes: string;
  coatChoice: '' | CoatChoice;
};

const emptyDraft = (): Draft => ({
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  dogName: '',
  animalType: 'DOG',
  dogBreed: '',
  sizeOptionId: '',
  startsAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  notes: '',
  coatChoice: '',
});

function pickCell(
  cells: Record<string, BreedServicePriceEntry> | undefined,
  sizeOptionId: string | null,
  coat: CoatChoice | null,
): BreedServicePriceEntry | undefined {
  if (!cells) return undefined;
  const candidates: Array<[string | null, CoatChoice | null]> = [
    [sizeOptionId, coat],
    [sizeOptionId, null],
    [null, coat],
    [null, null],
  ];
  for (const [s, c] of candidates) {
    const e = cells[makeCellKey(s, c)];
    if (e) return e;
  }
  return undefined;
}

function priceForService(
  service: Service,
  cells: Record<string, BreedServicePriceEntry> | undefined,
  sizeOptionId: string | null,
  coatChoice: CoatChoice | null,
  isMixed: boolean,
): number {
  if (service.pricingMode === 'FIXED') return Math.round((service.priceCents ?? 0) / 100);
  const entry = pickCell(cells, sizeOptionId, coatChoice);
  if (!entry || entry.active === false) return 0;
  const cents = isMixed && coatChoice === 'LONG' && entry.priceLongCents != null
    ? entry.priceLongCents
    : entry.priceCents ?? 0;
  return Math.round((cents ?? 0) / 100);
}

export function NewBookingDialog({
  services,
  breeds,
  extras,
  pricesByAnimal,
  isAdmin = false,
}: {
  services: Service[];
  breeds: BreedEntry[];
  extras: Extra[];
  pricesByAnimal: PricesByAnimal;
  // Quando true, mostra il toggle "Escludi servizio base" sul card Base.
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const [selectedExtraIds, setSelectedExtraIds] = useState<Set<string>>(new Set());
  const [clientTab, setClientTab] = useState<'new' | 'existing'>('new');
  const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null);
  // Override ADMIN-only: rimuovi il servizio "Sempre incluso" in casi eccezionali.
  const [omitDefaultService, setOmitDefaultService] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function applyClientSelection(sel: PickerSelection) {
    setSelectedClient(sel.client);
    setDraft((d) => {
      const next: Draft = {
        ...d,
        customerName: sel.client.name,
        customerPhone: sel.client.phone,
        customerEmail: sel.client.email ?? '',
      };
      if (sel.animal) {
        next.dogName = sel.animal.dogName;
        if (sel.animal.dogBreed) next.dogBreed = sel.animal.dogBreed;
        if (sel.animal.sizeOptionId) next.sizeOptionId = sel.animal.sizeOptionId;
        if (sel.animal.coatChoice) next.coatChoice = sel.animal.coatChoice;
      }
      return next;
    });
  }

  function clearClient() {
    setSelectedClient(null);
    setDraft((d) => ({
      ...d,
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      dogName: '',
      dogBreed: '',
      sizeOptionId: '',
      coatChoice: '',
    }));
    setSelectedAddonIds(new Set());
    setSelectedExtraIds(new Set());
  }

  const filteredBreeds = useMemo(
    () => breeds.filter((b) => b.animalType === draft.animalType),
    [breeds, draft.animalType],
  );

  const selectedBreed = useMemo(
    () => breeds.find((b) => b.name === draft.dogBreed) ?? null,
    [breeds, draft.dogBreed],
  );
  const animalPayload = pricesByAnimal[draft.animalType];
  const priceMap = useMemo(() => animalPayload?.pricesByBreed ?? {}, [animalPayload]);
  const sizesMap = useMemo(() => animalPayload?.sizesByBreed ?? {}, [animalPayload]);
  const breedSizes = useMemo(
    () => (selectedBreed ? (sizesMap[selectedBreed.id] ?? []) : []),
    [selectedBreed, sizesMap],
  );
  const hasSizes = breedSizes.length > 0;

  const isMixed = selectedBreed?.coatType === 'MIXED';
  const showCoatPicker = isMixed;
  const effectiveCoat: CoatChoice | null = isMixed
    ? (draft.coatChoice === 'LONG' ? 'LONG' : 'SHORT')
    : selectedBreed?.coatType === 'LONG' ? 'LONG'
    : selectedBreed?.coatType === 'SHORT' ? 'SHORT'
    : null;

  function lookupCells(breedId: string, serviceId: string): Record<string, BreedServicePriceEntry> | undefined {
    return priceMap?.[breedId]?.[serviceId];
  }

  function isServiceActiveForBreed(s: Service, breedId: string): boolean {
    if (s.pricingMode === 'FIXED') return true;
    const cells = lookupCells(breedId, s.id);
    if (!cells) return false;
    return Object.values(cells).some((c) => c.active);
  }

  const primaryCandidate = useMemo(
    () => services.find((s) => s.forAnimal === draft.animalType && s.isDefault && s.active) ?? null,
    [services, draft.animalType],
  );
  const addonCandidates = useMemo(
    () => services
      .filter((s) => s.forAnimal === draft.animalType && s.active && !s.isDefault)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [services, draft.animalType],
  );

  const primaryService = useMemo(() => {
    // ADMIN può escludere manualmente il servizio "Sempre incluso" per casi particolari.
    if (omitDefaultService) return null;
    if (!primaryCandidate) return null;
    if (!selectedBreed) return primaryCandidate;
    return isServiceActiveForBreed(primaryCandidate, selectedBreed.id) ? primaryCandidate : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [omitDefaultService, primaryCandidate, selectedBreed, priceMap]);

  const addonServices = useMemo(() => {
    if (!selectedBreed) return addonCandidates;
    return addonCandidates.filter((s) => isServiceActiveForBreed(s, selectedBreed.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addonCandidates, selectedBreed, priceMap]);

  const visibleExtras = useMemo(
    () => extras.filter((e) => e.active && (!e.dogOnly || draft.animalType === 'DOG')),
    [extras, draft.animalType],
  );

  // Auto-pick single size; clear if not in current breed sizes
  useEffect(() => {
    if (!selectedBreed) {
      if (draft.sizeOptionId) setDraft((d) => ({ ...d, sizeOptionId: '' }));
      return;
    }
    if (!hasSizes) {
      if (draft.sizeOptionId) setDraft((d) => ({ ...d, sizeOptionId: '' }));
      return;
    }
    if (breedSizes.length === 1) {
      const onlyId = breedSizes[0]?.id ?? '';
      if (draft.sizeOptionId !== onlyId) setDraft((d) => ({ ...d, sizeOptionId: onlyId }));
      return;
    }
    if (draft.sizeOptionId && !breedSizes.find((s) => s.id === draft.sizeOptionId)) {
      setDraft((d) => ({ ...d, sizeOptionId: '' }));
    }
  }, [selectedBreed, hasSizes, breedSizes, draft.sizeOptionId]);

  // Drop addons no longer visible after breed change
  useEffect(() => {
    if (!selectedBreed) return;
    setSelectedAddonIds((prev) => {
      const allowed = new Set(addonServices.map((s) => s.id));
      const next = new Set<string>();
      let changed = false;
      for (const id of prev) {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [selectedBreed, addonServices]);

  // Resolve booking primary + addons for server payload
  const resolvedBooking = useMemo(() => {
    if (!selectedBreed) return null;
    let bookingPrimary: Service | null = primaryService;
    let bookingAddons: Service[] = addonServices.filter((s) => selectedAddonIds.has(s.id));
    if (!bookingPrimary) {
      const ordered = bookingAddons.slice().sort((a, b) => a.sortOrder - b.sortOrder);
      if (!ordered.length) return null;
      bookingPrimary = ordered[0] ?? null;
      if (!bookingPrimary) return null;
      const primaryId = bookingPrimary.id;
      bookingAddons = ordered.filter((s) => s.id !== primaryId);
    }
    return { bookingPrimary, bookingAddons };
  }, [selectedBreed, primaryService, addonServices, selectedAddonIds]);

  // Total price preview
  const totalPrice = useMemo(() => {
    if (!selectedBreed || !resolvedBooking) return null;
    if (hasSizes && breedSizes.length > 1 && !draft.sizeOptionId) return null;
    let total = 0;
    const sizeId = draft.sizeOptionId || null;
    total += priceForService(
      resolvedBooking.bookingPrimary,
      lookupCells(selectedBreed.id, resolvedBooking.bookingPrimary.id),
      sizeId, effectiveCoat, !!isMixed,
    );
    for (const a of resolvedBooking.bookingAddons) {
      total += priceForService(a, lookupCells(selectedBreed.id, a.id), sizeId, effectiveCoat, !!isMixed);
    }
    for (const e of extras) {
      if (selectedExtraIds.has(e.id)) total += Math.round(e.priceCents / 100);
    }
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedBooking, selectedBreed, draft.sizeOptionId, effectiveCoat, isMixed, selectedExtraIds, extras, priceMap, hasSizes, breedSizes.length]);

  const [warning, setWarning] = useState<'OVERLAP' | 'CLOSED' | null>(null);
  const [slots, setSlots] = useState<DaySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const dateOnly = draft.startsAt.split('T')[0];
  const timeOnly = draft.startsAt.split('T')[1]?.slice(0, 5) || '';

  // Load slots: use resolved primary id
  const slotsServiceId = resolvedBooking?.bookingPrimary.id ?? '';
  useEffect(() => {
    if (!slotsServiceId || !dateOnly) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    getDayOverviewAction({ serviceId: slotsServiceId, date: dateOnly })
      .then((r) => {
        if (cancelled) return;
        setSlots(r.ok ? r.data : []);
      })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [slotsServiceId, dateOnly]);

  function reset() {
    setDraft(emptyDraft());
    setSelectedAddonIds(new Set());
    setSelectedExtraIds(new Set());
    setSelectedClient(null);
    setClientTab('new');
    setWarning(null);
    setSlots([]);
    setOmitDefaultService(false);
  }

  function toggleAddon(id: string) {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExtra(id: string) {
    setSelectedExtraIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sizeRequiredMissing = !!selectedBreed && breedSizes.length > 1 && !draft.sizeOptionId;
  const canSubmit =
    !!selectedBreed &&
    !sizeRequiredMissing &&
    !!resolvedBooking &&
    draft.customerName.trim().length >= 2 &&
    draft.customerPhone.trim().length >= 3 &&
    !!timeOnly;

  async function submit(force = false) {
    if (!resolvedBooking) return;
    startTransition(async () => {
      const utcISO = fromZonedTime(draft.startsAt, APP_TIMEZONE).toISOString();

      // Append extras to notes (server parses `Extra: name1, name2` segment)
      const extraNames = extras.filter((e) => selectedExtraIds.has(e.id)).map((e) => e.name);
      const extrasSegment = extraNames.length ? `Extra: ${extraNames.join(', ')}` : '';
      const notesParts: string[] = [];
      if (draft.notes.trim()) notesParts.push(draft.notes.trim());
      if (extrasSegment) notesParts.push(extrasSegment);
      const composedNotes = notesParts.join(' · ');

      const r = await adminCreateBookingAction({
        customerName: draft.customerName,
        customerEmail: draft.customerEmail || undefined,
        customerPhone: draft.customerPhone,
        dogName: draft.dogName || undefined,
        animalType: draft.animalType,
        dogBreed: draft.dogBreed || undefined,
        serviceId: resolvedBooking.bookingPrimary.id,
        addonServiceIds: resolvedBooking.bookingAddons.map((s) => s.id),
        sizeOptionId: draft.sizeOptionId || undefined,
        coatChoice: showCoatPicker ? (draft.coatChoice || undefined) : undefined,
        startsAt: utcISO,
        notes: composedNotes || undefined,
        forceOverlap: force,
      });
      if (!r.ok) {
        if (r.error === 'OVERLAP' || r.error === 'CLOSED') {
          setWarning(r.error);
          return;
        }
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Prenotazione creata' });
      setOpen(false);
      reset();
    });
  }

  return (
    <>
      <Button onClick={() => { reset(); setOpen(true); }} size="sm">
        + Nuova prenotazione
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuova prenotazione</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Client mode tabs */}
            <div className="inline-flex w-full rounded-md border bg-muted/30 p-0.5 text-sm">
              <button
                type="button"
                onClick={() => { setClientTab('new'); }}
                className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
                  clientTab === 'new'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                ➕ Nuovo cliente
              </button>
              <button
                type="button"
                onClick={() => { setClientTab('existing'); }}
                className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
                  clientTab === 'existing'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🔍 Cliente esistente
              </button>
            </div>

            {clientTab === 'existing' && (
              <ClientPicker
                selected={selectedClient}
                onPick={applyClientSelection}
                onClear={clearClient}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome cliente</Label>
                <Input value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefono</Label>
                <Input value={draft.customerPhone} onChange={(e) => setDraft({ ...draft, customerPhone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Animale</Label>
                <select
                  value={draft.animalType}
                  onChange={(e) => {
                    setDraft({ ...draft, animalType: e.target.value as 'DOG' | 'CAT', dogBreed: '', sizeOptionId: '', coatChoice: '' });
                    setSelectedAddonIds(new Set());
                    setSelectedExtraIds(new Set());
                    setOmitDefaultService(false);
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="DOG">Cane</option>
                  <option value="CAT">Gatto</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Nome animale <span className="text-xs font-normal text-muted-foreground">(opzionale)</span></Label>
                <Input value={draft.dogName} onChange={(e) => setDraft({ ...draft, dogName: e.target.value })} />
              </div>
            </div>

            <BreedPicker
              breeds={filteredBreeds}
              value={draft.dogBreed}
              onChange={(name) => setDraft({ ...draft, dogBreed: name, sizeOptionId: '', coatChoice: '' })}
              animalLabel={draft.animalType === 'CAT' ? 'gatto' : 'cane'}
            />

            {/* Size picker (only if breed has 2+ sizes) */}
            {selectedBreed && breedSizes.length > 1 && (
              <div className="space-y-1.5">
                <Label>Misura</Label>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(breedSizes.length, 4)}, 1fr)` }}>
                  {breedSizes.map((sz) => {
                    const sel = draft.sizeOptionId === sz.id;
                    return (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => setDraft({ ...draft, sizeOptionId: sz.id })}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          sel ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background hover:bg-accent'
                        }`}
                      >
                        {sz.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Coat picker (MIXED only) */}
            {showCoatPicker && selectedBreed && (
              <div className="space-y-1.5">
                <Label>Tipo di pelo (Meticcio)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['SHORT', 'LONG'] as const).map((c) => {
                    const sel = draft.coatChoice === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDraft({ ...draft, coatChoice: c })}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          sel ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background hover:bg-accent'
                        }`}
                      >
                        {c === 'SHORT' ? 'Pelo corto' : 'Pelo lungo'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Services */}
            {selectedBreed && !sizeRequiredMissing && (primaryService || addonServices.length > 0 || (omitDefaultService && primaryCandidate)) && (
              <div className="space-y-2">
                <Label>Servizi</Label>

                {primaryService && (() => {
                  const p = priceForService(
                    primaryService,
                    lookupCells(selectedBreed.id, primaryService.id),
                    draft.sizeOptionId || null,
                    effectiveCoat,
                    !!isMixed,
                  );
                  return (
                    <div className="flex items-center gap-3 rounded-md border-2 border-primary bg-primary/5 px-3 py-2">
                      <span className="text-xs font-semibold uppercase text-primary">Base</span>
                      <span className="flex-1 text-sm font-semibold">{primaryService.displayName || primaryService.name}</span>
                      <span className="text-sm font-medium text-muted-foreground">{p > 0 ? `${p} €` : '—'}</span>
                      <button
                        type="button"
                        onClick={() => setOmitDefaultService(true)}
                        className="ml-1 rounded p-1 text-muted-foreground transition-colors hover:bg-rose-100 hover:text-rose-700"
                        title="Escludi il servizio base da questa prenotazione"
                        aria-label="Escludi servizio base"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })()}

                {/* Servizio base escluso */}
                {omitDefaultService && primaryCandidate && (
                  <div className="flex items-center gap-3 rounded-md border border-dashed bg-muted/30 px-3 py-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Base</span>
                    <span className="flex-1 text-sm text-muted-foreground line-through">
                      {primaryCandidate.displayName || primaryCandidate.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-rose-700">escluso</span>
                    <button
                      type="button"
                      onClick={() => setOmitDefaultService(false)}
                      className="rounded px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10"
                    >
                      Ripristina
                    </button>
                  </div>
                )}

                {addonServices.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {primaryService ? 'Aggiungi al servizio (multi-selezione)' : 'Scegli uno o più servizi'}
                    </p>
                    <div className="space-y-1">
                      {addonServices.map((svc) => {
                        const sel = selectedAddonIds.has(svc.id);
                        const p = priceForService(svc, lookupCells(selectedBreed.id, svc.id), draft.sizeOptionId || null, effectiveCoat, !!isMixed);
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() => toggleAddon(svc.id)}
                            className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                              sel ? 'border-primary bg-primary/10' : 'border-input bg-background hover:bg-accent'
                            }`}
                          >
                            <input type="checkbox" checked={sel} readOnly className="accent-primary" />
                            <span className="flex-1 text-sm font-medium">{svc.displayName || svc.name}</span>
                            <span className="text-sm text-muted-foreground">{p > 0 ? `+${p} €` : '—'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedBreed && !primaryService && addonServices.length === 0 && (
              <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                Nessun servizio attivo per questa razza.
              </div>
            )}

            {/* Extras */}
            {selectedBreed && resolvedBooking && visibleExtras.length > 0 && (
              <div className="space-y-1.5">
                <Label>Servizi extra</Label>
                <div className="space-y-1">
                  {visibleExtras.map((e) => {
                    const sel = selectedExtraIds.has(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => toggleExtra(e.id)}
                        className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                          sel ? 'border-primary bg-primary/10' : 'border-input bg-background hover:bg-accent'
                        }`}
                      >
                        <input type="checkbox" checked={sel} readOnly className="accent-primary" />
                        <span className="flex-1 text-sm">{e.name}</span>
                        <span className="text-sm text-muted-foreground">+{Math.round(e.priceCents / 100)} €</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {totalPrice != null && totalPrice > 0 && (
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                <span className="text-xs uppercase text-muted-foreground">Totale indicativo</span>
                <span className="text-lg font-bold">{totalPrice} €</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={dateOnly}
                onChange={(e) => {
                  const time = timeOnly || '09:00';
                  setDraft({ ...draft, startsAt: `${e.target.value}T${time}` });
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Orario {slotsServiceId ? '' : <span className="text-xs font-normal text-muted-foreground">(scegli prima il servizio)</span>}</Label>
              {!slotsServiceId ? (
                <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                  Seleziona razza e servizio per vedere gli orari
                </div>
              ) : (
                <SlotPicker
                  slots={slots}
                  loading={slotsLoading}
                  selectedTime={timeOnly}
                  onSelectTime={(time) => setDraft({ ...draft, startsAt: `${dateOnly}T${time}` })}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Note (opzionale)</Label>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            {warning && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-800">
                  {warning === 'CLOSED' ? 'Negozio chiuso' : 'Slot pieno'}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  {warning === 'CLOSED'
                    ? 'In quella fascia c\'è una chiusura attiva. Forzare comunque?'
                    : 'Tutte le postazioni sono occupate in quella fascia. Forzare comunque?'}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={pending}
                  onClick={() => submit(true)}
                >
                  Forza creazione
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={() => submit(false)} disabled={pending || !canSubmit}>
              {pending ? 'Salvo…' : 'Crea prenotazione'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

