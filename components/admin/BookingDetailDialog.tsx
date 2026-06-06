'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { Booking, Service, Extra, BookingStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { APP_TIMEZONE, formatEUR, animalLabel, parseExtraNamesFromNotes, cleanUserNotes } from '@/lib/utils';
import { editBookingAction, getDayOverviewAction, type DaySlot } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { SlotPicker } from '@/components/admin/SlotPicker';
import { BreedPicker } from '@/components/admin/BreedPicker';
import type { BreedEntry, PricesByAnimal, BreedServicePriceEntry } from '@/lib/breeds';
import { makeCellKey } from '@/lib/breeds';

type CoatChoice = 'SHORT' | 'LONG';

type Row = Booking & { service: Service };

const statusVariant: Record<BookingStatus, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
  NO_SHOW: 'destructive',
};

const statusLabel: Record<BookingStatus, string> = {
  PENDING: 'In attesa',
  CONFIRMED: 'Confermata',
  COMPLETED: 'Completata',
  CANCELLED: 'Annullata',
  NO_SHOW: 'No-show',
};

function toLocalInput(d: Date): string {
  return format(toZonedTime(d, APP_TIMEZONE), "yyyy-MM-dd'T'HH:mm");
}

function cleanServiceName(name: string): string {
  return name.replace(/ — (Cane|Gatto)$/, '').trim();
}

type AddonItem = { serviceId?: string; name?: string; priceCents?: number };

function parseAddons(json: string | null): AddonItem[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as AddonItem[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

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

function formatServiceLine(b: Row): string {
  const primary = cleanServiceName(b.serviceName || b.service.name);
  const addons = parseAddons(b.addonItemsJson).map((a) => a.name ? cleanServiceName(a.name) : '').filter(Boolean);
  if (!addons.length) return primary;
  return `${primary} + ${addons.join(' + ')}`;
}

export function BookingDetailDialog({
  booking,
  onClose,
  initialMode = 'view',
  isAdmin = false,
}: {
  booking: Row | null;
  onClose: () => void;
  initialMode?: 'view' | 'edit';
  // Quando true, mostra il toggle ADMIN-only per escludere il servizio base.
  isAdmin?: boolean;
}) {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [slots, setSlots] = useState<DaySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  // Edit form fields
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerEmail, setEditCustomerEmail] = useState('');
  const [editDogName, setEditDogName] = useState('');
  const [editAnimalType, setEditAnimalType] = useState<'DOG' | 'CAT'>('DOG');
  const [editDogBreed, setEditDogBreed] = useState('');
  const [editSizeOptionId, setEditSizeOptionId] = useState('');
  const [editCoatChoice, setEditCoatChoice] = useState<'' | CoatChoice>('');
  const [editServiceId, setEditServiceId] = useState('');
  const [editAddonIds, setEditAddonIds] = useState<Set<string>>(new Set());
  // ADMIN-only: escludi il servizio "Sempre incluso" in casi eccezionali.
  const [omitDefaultService, setOmitDefaultService] = useState(false);

  // Lazy edit data (services/breeds/extras/pricesByAnimal)
  const [editData, setEditData] = useState<null | {
    services: Service[];
    breeds: BreedEntry[];
    extras: Extra[];
    pricesByAnimal: PricesByAnimal;
  }>(null);
  const [editDataLoading, setEditDataLoading] = useState(false);
  const [editDataError, setEditDataError] = useState<string | null>(null);

  const editDateOnly = editStartsAt.split('T')[0];
  const editTimeOnly = editStartsAt.split('T')[1]?.slice(0, 5) || '';
  const originalTimeOnly = booking ? format(toZonedTime(booking.startsAt, APP_TIMEZONE), 'HH:mm') : '';
  const originalDateOnly = booking ? format(toZonedTime(booking.startsAt, APP_TIMEZONE), 'yyyy-MM-dd') : '';

  useEffect(() => {
    if (booking) {
      setEditStartsAt(toLocalInput(booking.startsAt));
      setEditNotes(booking.notes ?? '');
      setEditCustomerName(booking.customerName ?? '');
      setEditCustomerPhone(booking.customerPhone ?? '');
      setEditCustomerEmail(booking.customerEmail ?? '');
      setEditDogName(booking.dogName ?? '');
      setEditDogBreed(booking.dogBreed ?? '');
      setEditSizeOptionId(booking.sizeOptionId ?? '');
      setEditCoatChoice((booking.coatChoice === 'SHORT' || booking.coatChoice === 'LONG') ? booking.coatChoice : '');
      setEditServiceId(booking.serviceId);
      const existingAddons = parseAddons(booking.addonItemsJson)
        .map((a) => a.serviceId).filter((x): x is string => !!x);
      setEditAddonIds(new Set(existingAddons));
      // Reset toggle ADMIN-only ad ogni apertura/cambio prenotazione.
      setOmitDefaultService(false);
      // Animal type inferred from service.forAnimal
      const a = (booking.service.forAnimal === 'CAT') ? 'CAT' : 'DOG';
      setEditAnimalType(a);
      setMode(initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, initialMode]);

  // Lazy-load edit data via API route. Don't gate on `editDataLoading` so React
  // Strict Mode double-invoke doesn't deadlock: cleanup aborts the first fetch
  // but the second effect run still starts a fresh fetch.
  useEffect(() => {
    if (mode !== 'edit' || editData) return;
    const controller = new AbortController();
    setEditDataLoading(true);
    setEditDataError(null);
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000);

    fetch('/api/admin/booking-edit-data', { signal: controller.signal, credentials: 'same-origin' })
      .then(async (res) => {
        window.clearTimeout(timeoutId);
        const body = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
        if (body.ok) setEditData(body.data);
        else setEditDataError(body.error ?? `HTTP ${res.status}`);
      })
      .catch((e: unknown) => {
        window.clearTimeout(timeoutId);
        if (e instanceof DOMException && e.name === 'AbortError') return; // aborted: cleanup or timeout-aborted
        console.error('[booking-edit-data fetch]', e);
        setEditDataError(e instanceof Error ? e.message : 'Errore caricamento');
      })
      .finally(() => setEditDataLoading(false));

    return () => { controller.abort(); window.clearTimeout(timeoutId); };
  }, [mode, editData]);

  // For slot picker: usa il primary EFFETTIVO che verrà inviato al server.
  // Quando ADMIN omette il servizio base, il primary cambia → la durata cambia →
  // gli slot devono essere ricalcolati con la durata del nuovo primary.
  // NB: computato inline da editData (non da `visibleAddons`, dichiarato più sotto)
  // per evitare TDZ. Mantiene parità di logica con `resolvedSubmission`.
  const effectivePrimaryIdForSlots = useMemo(() => {
    if (!omitDefaultService) return editServiceId;
    if (!editData) return editServiceId;
    const ordered = editData.services
      .filter((s) => editAddonIds.has(s.id) && s.active && !s.isDefault)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return ordered[0]?.id ?? '';
  }, [omitDefaultService, editServiceId, editAddonIds, editData]);

  const selectedServiceForSlots = useMemo(() => {
    if (!editData) return booking?.service ?? null;
    if (!effectivePrimaryIdForSlots) return booking?.service ?? null;
    return editData.services.find((s) => s.id === effectivePrimaryIdForSlots) ?? booking?.service ?? null;
  }, [editData, effectivePrimaryIdForSlots, booking]);

  useEffect(() => {
    if (!booking || mode !== 'edit' || !editDateOnly || !selectedServiceForSlots) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    getDayOverviewAction({ serviceId: selectedServiceForSlots.id, date: editDateOnly, excludeBookingId: booking.id })
      .then((r) => {
        if (cancelled) return;
        setSlots(r.ok ? r.data : []);
      })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, mode, editDateOnly, selectedServiceForSlots?.id]);

  // Derived form state
  const selectedBreedEntry = editData?.breeds.find((b) => b.name === editDogBreed) ?? null;
  const animalPayload = editData?.pricesByAnimal[editAnimalType];
  const priceMap = animalPayload?.pricesByBreed ?? {};
  const sizesMap = animalPayload?.sizesByBreed ?? {};
  const breedSizes = selectedBreedEntry ? (sizesMap[selectedBreedEntry.id] ?? []) : [];
  const hasSizes = breedSizes.length > 0;
  const isMixed = selectedBreedEntry?.coatType === 'MIXED';

  // Auto-pick single size when there's only one
  useEffect(() => {
    if (mode !== 'edit') return;
    if (!selectedBreedEntry) {
      if (editSizeOptionId) setEditSizeOptionId('');
      return;
    }
    if (!hasSizes) {
      if (editSizeOptionId) setEditSizeOptionId('');
      return;
    }
    if (breedSizes.length === 1 && editSizeOptionId !== breedSizes[0]!.id) {
      setEditSizeOptionId(breedSizes[0]!.id);
    } else if (editSizeOptionId && !breedSizes.find((s) => s.id === editSizeOptionId)) {
      setEditSizeOptionId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedBreedEntry?.id, hasSizes]);

  // Service candidates filtered by animal type + active
  const primaryCandidate = useMemo(
    () => editData?.services.find((s) => s.forAnimal === editAnimalType && s.isDefault && s.active) ?? null,
    [editData, editAnimalType],
  );
  const addonCandidates = useMemo(
    () => (editData?.services ?? [])
      .filter((s) => s.forAnimal === editAnimalType && s.active && !s.isDefault)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [editData, editAnimalType],
  );

  function lookupCells(breedId: string, serviceId: string): Record<string, BreedServicePriceEntry> | undefined {
    return priceMap?.[breedId]?.[serviceId];
  }

  function isServiceActiveForBreed(s: Service, breedId: string): boolean {
    if (s.pricingMode === 'FIXED') return true;
    const cells = lookupCells(breedId, s.id);
    if (!cells) return false;
    return Object.values(cells).some((c) => c.active);
  }

  const visibleAddons = useMemo(() => {
    if (!selectedBreedEntry) return addonCandidates;
    return addonCandidates.filter((s) => isServiceActiveForBreed(s, selectedBreedEntry.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addonCandidates, selectedBreedEntry?.id, priceMap]);

  function toggleAddon(id: string) {
    setEditAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Risoluzione effettiva del primary + addons da inviare al server.
  // Se ADMIN ha attivato omitDefaultService: il primary diventa il primo addon
  // selezionato (in ordine sortOrder), gli altri restano addons.
  const resolvedSubmission = useMemo(() => {
    if (!omitDefaultService) {
      return { serviceId: editServiceId, addonIds: Array.from(editAddonIds) };
    }
    const ordered = visibleAddons
      .filter((s) => editAddonIds.has(s.id))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (ordered.length === 0) return null;
    const newPrimary = ordered[0]!;
    return {
      serviceId: newPrimary.id,
      addonIds: ordered.slice(1).map((s) => s.id),
    };
  }, [omitDefaultService, editServiceId, editAddonIds, visibleAddons]);

  // Total price preview — usa il primary + addons risolti (riflette omit).
  const totalPriceEUR = useMemo(() => {
    if (!editData || !selectedBreedEntry) return null;
    if (hasSizes && breedSizes.length > 1 && !editSizeOptionId) return null;
    const sizeId = editSizeOptionId || null;
    const coatEff: CoatChoice | null = isMixed
      ? (editCoatChoice === 'LONG' ? 'LONG' : 'SHORT')
      : selectedBreedEntry.coatType === 'LONG' ? 'LONG'
        : selectedBreedEntry.coatType === 'SHORT' ? 'SHORT' : null;
    let total = 0;
    const primaryId = resolvedSubmission?.serviceId ?? '';
    const addonIdList = resolvedSubmission?.addonIds ?? [];
    const primary = primaryId ? editData.services.find((s) => s.id === primaryId) : null;
    if (primary) total += priceForService(primary, lookupCells(selectedBreedEntry.id, primary.id), sizeId, coatEff, !!isMixed);
    for (const id of addonIdList) {
      const svc = editData.services.find((s) => s.id === id);
      if (!svc) continue;
      total += priceForService(svc, lookupCells(selectedBreedEntry.id, svc.id), sizeId, coatEff, !!isMixed);
    }
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editData, selectedBreedEntry, hasSizes, breedSizes.length, editSizeOptionId, editCoatChoice, isMixed, resolvedSubmission, priceMap]);

  function handleClose() {
    setMode('view');
    onClose();
  }

  function saveEdit() {
    if (!booking) return;
    // Se ADMIN ha escluso il servizio base, deve esserci almeno un addon che lo sostituisca.
    if (omitDefaultService && !resolvedSubmission) {
      toast({
        title: 'Servizio mancante',
        description: 'Senza il servizio base, seleziona almeno un altro servizio.',
        variant: 'destructive',
      });
      return;
    }
    const finalServiceId = resolvedSubmission?.serviceId ?? editServiceId;
    const finalAddonIds = resolvedSubmission?.addonIds ?? Array.from(editAddonIds);
    const utcISO = fromZonedTime(editStartsAt, APP_TIMEZONE).toISOString();
    startTransition(async () => {
      const r = await editBookingAction({
        bookingId: booking.id,
        startsAt: utcISO,
        notes: editNotes,
        customerName: editCustomerName,
        customerEmail: editCustomerEmail || '',
        customerPhone: editCustomerPhone,
        dogName: editDogName,
        animalType: editAnimalType,
        dogBreed: editDogBreed,
        sizeOptionId: editSizeOptionId,
        coatChoice: isMixed && editCoatChoice ? editCoatChoice : undefined,
        serviceId: finalServiceId,
        addonServiceIds: finalAddonIds,
      });
      if (!r.ok) {
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
      } else {
        toast({ title: 'Prenotazione aggiornata' });
        handleClose();
      }
    });
  }

  return (
    <Dialog open={!!booking} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[92vh] overflow-y-auto">
        {booking && (() => {
          const local = toZonedTime(booking.startsAt, APP_TIMEZONE);
          return (
            <>
              {/* Hero header */}
              <div
                className="px-5 pt-5 pb-4"
                style={{ background: 'var(--sage-100)' }}
              >
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="text-2xl font-bold leading-tight">
                    {animalLabel(booking)}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    ✂️ {formatServiceLine(booking)}
                  </p>
                </DialogHeader>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-extrabold leading-none">
                    {format(local, 'HH:mm')}
                  </span>
                  <span className="text-sm text-muted-foreground capitalize">
                    · {format(local, 'EEE d MMM', { locale: it })}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant[booking.status]}>{statusLabel[booking.status]}</Badge>
                  <span className="text-xs text-muted-foreground">{booking.service.durationMin} min</span>
                  <span className="ml-auto text-lg font-bold">{formatEUR(booking.priceCents)}</span>
                </div>
              </div>

              {mode === 'view' ? (
                <>
                  {/* Quick actions */}
                  {booking.customerPhone && (() => {
                    const waPhone = booking.customerPhone.replace(/[^\d+]/g, '').replace(/^\+/, '');
                    return (
                      <div className="grid grid-cols-2 gap-2 border-b px-3 py-3">
                        <Button asChild variant="outline" size="sm" className="h-11">
                          <a href={`tel:${booking.customerPhone}`}>📞 Chiama</a>
                        </Button>
                        {waPhone && (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-11 hover:bg-emerald-50"
                            style={{ color: '#128C7E', borderColor: 'rgba(18, 140, 126, 0.3)' }}
                          >
                            <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer">
                              💬 WhatsApp
                            </a>
                          </Button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Body */}
                  <div className="space-y-3 px-5 py-4 text-sm">
                    <DetailRow label="Cliente">
                      <p className="font-medium">{booking.customerName}</p>
                      {booking.customerPhone && (
                        <p className="text-muted-foreground">{booking.customerPhone}</p>
                      )}
                      {booking.customerEmail && (
                        <p className="text-muted-foreground break-all">{booking.customerEmail}</p>
                      )}
                    </DetailRow>

                    <DetailRow label="Animale">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{animalLabel(booking)}</span>
                        {booking.dogBreed && <Badge variant="outline" className="text-[10px]">{booking.dogBreed}</Badge>}
                        {booking.dogSize && <Badge variant="secondary" className="text-[10px]">{booking.dogSize}</Badge>}
                      </div>
                    </DetailRow>

                    {(() => {
                      const primaryName = cleanServiceName(booking.serviceName || booking.service.name);
                      const addons = parseAddons(booking.addonItemsJson);
                      const primaryCents = booking.bathCents ?? (addons.length > 0
                        ? booking.priceCents - addons.reduce((s, a) => s + (a.priceCents ?? 0), 0) - (booking.extrasCents ?? 0)
                        : booking.priceCents - (booking.extrasCents ?? 0));
                      const items: Array<{ name: string; priceCents: number }> = [
                        { name: primaryName, priceCents: Math.max(0, primaryCents) },
                        ...addons.map((a) => ({ name: cleanServiceName(a.name ?? 'Servizio'), priceCents: a.priceCents ?? 0 })),
                      ];
                      return (
                        <DetailRow label={`Servizi (${items.length})`}>
                          <ul className="space-y-1">
                            {items.map((it, i) => (
                              <li key={`${it.name}-${i}`} className="flex items-baseline justify-between gap-2 text-sm">
                                <span className="flex-1 truncate">
                                  <span className="mr-1.5 text-xs opacity-60">{i === 0 ? '✂️' : '➕'}</span>
                                  {it.name}
                                </span>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {formatEUR(it.priceCents)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </DetailRow>
                      );
                    })()}

                    {(() => {
                      const extras = parseExtraNamesFromNotes(booking.notes);
                      if (!extras.length) return null;
                      return (
                        <DetailRow label={`Extra (${extras.length})`}>
                          <div className="flex flex-wrap gap-1.5">
                            {extras.map((name) => (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                                style={{ background: 'var(--sage-100)', color: 'var(--sage-800)' }}
                              >
                                ✨ {name}
                              </span>
                            ))}
                          </div>
                        </DetailRow>
                      );
                    })()}

                    {(() => {
                      const clean = cleanUserNotes(booking.notes);
                      if (!clean) return null;
                      return (
                        <DetailRow label="Note">
                          <p className="italic text-muted-foreground">{clean}</p>
                        </DetailRow>
                      );
                    })()}
                  </div>

                  {/* Sticky footer */}
                  <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t bg-background p-3">
                    <Button variant="outline" onClick={() => setMode('edit')} className="h-11">
                      ✏️ Modifica
                    </Button>
                    <Button onClick={handleClose} className="h-11">Chiudi</Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Edit form */}
                  <div className="space-y-3 px-5 py-4 text-sm">
                    {editDataLoading && !editData && (
                      <p className="text-xs text-muted-foreground">Carico razze e servizi…</p>
                    )}
                    {editDataError && (
                      <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
                        ⚠ Impossibile caricare razze/servizi: {editDataError}. Riavvia il server o ricarica la pagina.
                      </div>
                    )}

                    {/* Cliente */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Nome cliente</Label>
                        <Input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Telefono</Label>
                        <Input value={editCustomerPhone} onChange={(e) => setEditCustomerPhone(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Email (opzionale)</Label>
                      <Input value={editCustomerEmail} onChange={(e) => setEditCustomerEmail(e.target.value)} />
                    </div>

                    {/* Animale */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Animale</Label>
                        <select
                          value={editAnimalType}
                          onChange={(e) => {
                            const a = e.target.value as 'DOG' | 'CAT';
                            setEditAnimalType(a);
                            // Reset breed-dependent fields when switching animal
                            setEditDogBreed('');
                            setEditSizeOptionId('');
                            setEditCoatChoice('');
                            setEditAddonIds(new Set());
                          }}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="DOG">Cane</option>
                          <option value="CAT">Gatto</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label>Nome animale</Label>
                        <Input value={editDogName} onChange={(e) => setEditDogName(e.target.value)} />
                      </div>
                    </div>

                    {/* Razza */}
                    {editData && (
                      <BreedPicker
                        breeds={editData.breeds.filter((b) => b.animalType === editAnimalType)}
                        value={editDogBreed}
                        onChange={(name) => {
                          setEditDogBreed(name);
                          setEditSizeOptionId('');
                          setEditCoatChoice('');
                        }}
                        animalLabel={editAnimalType === 'CAT' ? 'gatto' : 'cane'}
                      />
                    )}

                    {/* Misura */}
                    {selectedBreedEntry && breedSizes.length > 1 && (
                      <div className="space-y-1">
                        <Label>Misura</Label>
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(breedSizes.length, 4)}, 1fr)` }}>
                          {breedSizes.map((sz) => {
                            const sel = editSizeOptionId === sz.id;
                            return (
                              <button
                                key={sz.id}
                                type="button"
                                onClick={() => setEditSizeOptionId(sz.id)}
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

                    {/* Pelo (MIXED) */}
                    {isMixed && (
                      <div className="space-y-1">
                        <Label>Tipo di pelo (Meticcio)</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['SHORT', 'LONG'] as const).map((c) => {
                            const sel = editCoatChoice === c;
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditCoatChoice(c)}
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

                    {/* Servizio */}
                    {editData && selectedBreedEntry && (primaryCandidate || visibleAddons.length > 0) && (
                      <div className="space-y-2">
                        <Label>Servizio</Label>
                        {/* Base card (nascosta se ADMIN ha attivato omitDefaultService) */}
                        {primaryCandidate && !omitDefaultService && (() => {
                          const isPrimaryActive = isServiceActiveForBreed(primaryCandidate, selectedBreedEntry.id);
                          if (!isPrimaryActive) return null;
                          const sel = editServiceId === primaryCandidate.id;
                          return (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setEditServiceId(primaryCandidate.id)}
                                className={`flex w-full items-center gap-3 rounded-md border-2 px-3 py-2 pr-10 text-left transition-colors ${
                                  sel ? 'border-primary bg-primary/5' : 'border-input'
                                }`}
                              >
                                <span className="text-xs font-semibold uppercase text-primary">Base</span>
                                <span className="flex-1 text-sm font-semibold">{primaryCandidate.displayName || primaryCandidate.name}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setOmitDefaultService(true)}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:bg-rose-100 hover:text-rose-700"
                                title="Escludi il servizio base da questa prenotazione"
                                aria-label="Escludi servizio base"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })()}

                        {/* Notice servizio base escluso */}
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
                        {visibleAddons.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Aggiungi al servizio</p>
                            {visibleAddons.map((svc) => {
                              const sel = editAddonIds.has(svc.id);
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
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {totalPriceEUR != null && totalPriceEUR > 0 && (
                      <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                        <span className="text-xs uppercase text-muted-foreground">Totale indicativo</span>
                        <span className="text-lg font-bold">{totalPriceEUR} €</span>
                      </div>
                    )}

                    {/* Data/Orario */}
                    <div className="space-y-1">
                      <Label>Data</Label>
                      <Input
                        type="date"
                        value={editDateOnly}
                        onChange={(e) => {
                          const time = editTimeOnly || '09:00';
                          setEditStartsAt(`${e.target.value}T${time}`);
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Orario</Label>
                      <SlotPicker
                        slots={slots}
                        loading={slotsLoading}
                        selectedTime={editTimeOnly}
                        onSelectTime={(time) => setEditStartsAt(`${editDateOnly}T${time}`)}
                        selfTime={originalTimeOnly}
                        selfActive={editDateOnly === originalDateOnly}
                        hint={
                          selectedServiceForSlots && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Durata: {selectedServiceForSlots.durationMin} min
                            </p>
                          )
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Note (opzionale)</Label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={2}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  {/* Sticky footer edit */}
                  <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t bg-background p-3">
                    <Button variant="outline" onClick={() => setMode('view')} disabled={pending} className="h-11">
                      Annulla
                    </Button>
                    <Button onClick={saveEdit} disabled={pending} className="h-11">
                      {pending ? 'Salvo…' : 'Salva'}
                    </Button>
                  </div>
                </>
              )}
            </>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
