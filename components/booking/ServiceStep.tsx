'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { Service, Extra } from '@prisma/client';
import type { AnimalType, BreedEntry, PricesByAnimal, BreedServicePriceEntry, BreedSizeOption } from '@/lib/breeds';
import { makeCellKey } from '@/lib/breeds';

export type CoatChoice = 'SHORT' | 'LONG';

export type ServiceSelection = {
  serviceId: string;
  serviceName: string;
  durationMin: number;
  animalType: AnimalType;
  breed: string;
  priceMin: number;
  priceMax: number;
  extrasNote: string;
  coatChoice?: CoatChoice;
  addonServiceIds: string[];
  sizeOptionId?: string;
  sizeLabel?: string;
};

/** Pick the best matching cell for (sizeOptionId, coat): exact, then size-only, then coat-only, then null/null. */
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
  // Legacy fallback: row stored at (null,null) but breed is MIXED + LONG → use priceLongCents
  const cents = isMixed && coatChoice === 'LONG' && entry.priceLongCents != null
    ? entry.priceLongCents
    : entry.priceCents ?? 0;
  return Math.round((cents ?? 0) / 100);
}

export function ServiceStep({
  services,
  dogBreeds,
  catBreeds,
  extrasList,
  pricesByAnimal,
  initial,
  onSelect,
}: {
  services: Service[];
  dogBreeds: BreedEntry[];
  catBreeds: BreedEntry[];
  extrasList: Extra[];
  pricesByAnimal: PricesByAnimal;
  initial?: ServiceSelection;
  onSelect: (s: ServiceSelection) => void;
}) {
  const initBreed = initial
    ? (initial.animalType === 'DOG' ? dogBreeds : catBreeds).find((b) => b.name === initial.breed) ?? null
    : null;

  const initExtras = useMemo(() => {
    if (!initial?.extrasNote) return new Set<string>();
    const match = initial.extrasNote.match(/Extra:\s*(.+)$/);
    if (!match) return new Set<string>();
    const names = (match[1] ?? '').split(/,\s*/).map((s) => s.trim());
    const ids = extrasList.filter((e) => names.includes(e.name)).map((e) => e.id);
    return new Set(ids);
  }, [initial, extrasList]);

  const initAddonIds = new Set<string>(initial?.addonServiceIds ?? []);

  const [animal, setAnimal]           = useState<AnimalType | null>(initial?.animalType ?? null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(initAddonIds);
  const [selectedBreed, setSelectedBreed] = useState<BreedEntry | null>(initBreed);
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(initial?.sizeOptionId ?? null);
  const [search, setSearch]           = useState('');
  const [extras, setExtras]           = useState<Set<string>>(initExtras);
  const [mixedCoatChoice, setMixedCoatChoice] = useState<CoatChoice>(
    initial?.coatChoice === 'LONG' ? 'LONG' : 'SHORT'
  );

  const servicesRef = useRef<HTMLDivElement | null>(null);
  const breedRef    = useRef<HTMLDivElement | null>(null);
  const searchRef   = useRef<HTMLInputElement | null>(null);
  const mountedRef  = useRef(false);

  // Primary = isDefault service for animal (only one). Addons = others.
  // NOTE: candidate lists ignore breed; visiblePrimary/visibleAddons below filter by breed activation.
  const primaryCandidate = useMemo(
    () => services.find((s) => s.forAnimal === animal && s.isDefault && s.active) ?? null,
    [services, animal],
  );
  const addonCandidates = useMemo(
    () => services
      .filter((s) => s.forAnimal === animal && s.active && !s.isDefault)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [services, animal],
  );

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (animal && breedRef.current) {
      const t = setTimeout(() => {
        breedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        searchRef.current?.focus({ preventScroll: true });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [animal]);

  useEffect(() => {
    if (!mountedRef.current) return;
    if (selectedBreed && servicesRef.current) {
      const t = setTimeout(() => {
        servicesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [selectedBreed]);

  const breedCoat = selectedBreed?.coatType ?? null;
  const isMixed = breedCoat === 'MIXED';
  const effectiveCoat: CoatChoice | null =
    isMixed ? mixedCoatChoice
    : breedCoat === 'LONG' ? 'LONG'
    : breedCoat === 'SHORT' ? 'SHORT'
    : null;

  const showCoatPicker = isMixed;

  const breedsForAnimal = animal === 'CAT' ? catBreeds : dogBreeds;

  const filtered = useMemo<BreedEntry[]>(() => {
    const q = search.toLowerCase();
    return breedsForAnimal.filter((b) => b.name.toLowerCase().includes(q));
  }, [search, breedsForAnimal]);

  const visibleExtras = extrasList.filter((e) => e.active && (!e.dogOnly || animal === 'DOG'));

  const extraTotal = useMemo(
    () => extrasList.filter((e) => extras.has(e.id)).reduce((s, e) => s + e.priceCents / 100, 0),
    [extras, extrasList],
  );

  // Map of (breedId → serviceId → cellKey → entry) for currently selected animal
  const animalPayload = animal ? pricesByAnimal[animal] : null;
  const priceMap = useMemo(() => animalPayload?.pricesByBreed ?? {}, [animalPayload]);
  const sizesMap = useMemo(() => animalPayload?.sizesByBreed ?? {}, [animalPayload]);

  function lookupCells(breedId: string, serviceId: string): Record<string, BreedServicePriceEntry> | undefined {
    return priceMap?.[breedId]?.[serviceId];
  }

  // Hide services not active for selected breed. FIXED-mode = always visible.
  // PER_BREED-mode = at least one active cell required.
  function isServiceActiveForBreed(s: Service, breedId: string): boolean {
    if (s.pricingMode === 'FIXED') return true;
    const cells = lookupCells(breedId, s.id);
    if (!cells) return false;
    return Object.values(cells).some((c) => c.active);
  }

  const primaryService = useMemo<Service | null>(() => {
    if (!primaryCandidate) return null;
    if (!selectedBreed) return primaryCandidate;
    return isServiceActiveForBreed(primaryCandidate, selectedBreed.id) ? primaryCandidate : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryCandidate, selectedBreed, priceMap]);

  const addonServices = useMemo<Service[]>(() => {
    if (!selectedBreed) return addonCandidates;
    return addonCandidates.filter((s) => isServiceActiveForBreed(s, selectedBreed.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addonCandidates, selectedBreed, priceMap]);

  // Drop selected addons no longer visible after breed change
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

  const breedSizes: BreedSizeOption[] = useMemo(
    () => (selectedBreed ? (sizesMap[selectedBreed.id] ?? []) : []),
    [selectedBreed, sizesMap],
  );
  const hasSizes = breedSizes.length > 0;

  // Reset selectedSizeId when breed changes if it doesn't belong to this breed
  useEffect(() => {
    if (!selectedBreed) {
      if (selectedSizeId !== null) setSelectedSizeId(null);
      return;
    }
    if (!hasSizes) {
      if (selectedSizeId !== null) setSelectedSizeId(null);
      return;
    }
    // If only one size, auto-select
    if (breedSizes.length === 1) {
      const onlyId = breedSizes[0]?.id ?? null;
      if (selectedSizeId !== onlyId) setSelectedSizeId(onlyId);
      return;
    }
    // If currently selected not in this breed's sizes, clear
    if (selectedSizeId && !breedSizes.find((s) => s.id === selectedSizeId)) {
      setSelectedSizeId(null);
    }
  }, [selectedBreed, hasSizes, breedSizes, selectedSizeId]);

  const basePrice = useMemo(() => {
    if (!selectedBreed) return null;
    // If breed has 2+ sizes but none picked yet, withhold price.
    if (hasSizes && breedSizes.length > 1 && !selectedSizeId) return null;
    let total = 0;
    if (primaryService) {
      total += priceForService(
        primaryService,
        lookupCells(selectedBreed.id, primaryService.id),
        selectedSizeId,
        effectiveCoat,
        isMixed,
      );
    }
    for (const id of selectedAddonIds) {
      const svc = addonServices.find((s) => s.id === id);
      if (!svc) continue;
      total += priceForService(svc, lookupCells(selectedBreed.id, svc.id), selectedSizeId, effectiveCoat, isMixed);
    }
    return { min: total, max: total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBreed, primaryService, addonServices, selectedAddonIds, effectiveCoat, isMixed, priceMap, selectedSizeId, hasSizes, breedSizes.length]);

  const totalPrice = useMemo(() => {
    if (!basePrice) return null;
    return { min: basePrice.min + extraTotal, max: basePrice.max + extraTotal };
  }, [basePrice, extraTotal]);

  function toggleExtra(id: string) {
    setExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAddon(id: string) {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function changeAnimal(a: AnimalType) {
    setAnimal(a);
    setSelectedBreed(null);
    setSelectedSizeId(null);
    setSearch('');
    setExtras(new Set());
    setSelectedAddonIds(new Set());
  }

  // Without a default service, user must pick at least one service from the list.
  // Also: if breed has 2+ sizes, size must be picked.
  const sizeRequiredButMissing = !!selectedBreed && breedSizes.length > 1 && !selectedSizeId;
  const canContinue =
    !!animal &&
    !!selectedBreed &&
    !sizeRequiredButMissing &&
    (!!primaryService || selectedAddonIds.size > 0);

  function handleContinue() {
    if (!canContinue || !animal) return;

    const extraNames = extrasList.filter((e) => extras.has(e.id)).map((e) => e.name);
    const extrasNote = extraNames.length ? `Extra: ${extraNames.join(', ')}` : '';

    const priceBase = totalPrice ?? { min: 0, max: 0 };

    // Resolve primary for booking: real isDefault when present, otherwise first selected by sortOrder.
    let bookingPrimary: Service | null = primaryService;
    let bookingAddonServices: Service[] = addonServices.filter((s) => selectedAddonIds.has(s.id));
    if (!bookingPrimary) {
      const ordered = bookingAddonServices.slice().sort((a, b) => a.sortOrder - b.sortOrder);
      if (!ordered.length) return;
      bookingPrimary = ordered[0] ?? null;
      if (!bookingPrimary) return;
      const primaryIdNonNull: string = bookingPrimary.id;
      bookingAddonServices = ordered.filter((s) => s.id !== primaryIdNonNull);
    }

    // Duration = primary + sum addon durations
    const addonDurations = bookingAddonServices.reduce((sum, s) => sum + s.durationMin, 0);
    const durationMin = bookingPrimary.durationMin + addonDurations;

    // Composite display name: primary [+ addon names]
    const addonNames = bookingAddonServices.map((s) => s.displayName || s.name);
    const primaryLabel = bookingPrimary.displayName || bookingPrimary.name;
    const composedName = addonNames.length ? `${primaryLabel} + ${addonNames.join(' + ')}` : primaryLabel;

    const pickedSize = selectedSizeId ? breedSizes.find((s) => s.id === selectedSizeId) : null;

    onSelect({
      serviceId: bookingPrimary.id,
      serviceName: composedName,
      durationMin,
      animalType: animal,
      breed: selectedBreed?.name ?? '',
      priceMin: priceBase.min,
      priceMax: priceBase.max,
      extrasNote,
      coatChoice: effectiveCoat ?? undefined,
      // Real list of addons sent to server (excludes the resolved primary).
      addonServiceIds: bookingAddonServices.map((s) => s.id),
      sizeOptionId: selectedSizeId ?? undefined,
      sizeLabel: pickedSize?.label,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── 1. Animale ── */}
      <div>
        <p className="eyebrow mb-3">Con chi vieni?</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {([['DOG', '🐕', 'Cane'] , ['CAT', '🐈', 'Gatto']] as const).map(([a, icon, label]) => {
            const sel = animal === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => changeAnimal(a)}
                style={{
                  padding: '20px 10px',
                  borderRadius: 'var(--r-lg)',
                  border: sel ? '2px solid var(--sage-800)' : '1px solid var(--cream-300)',
                  background: sel ? 'var(--sage-100)' : 'var(--cream-50)',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  fontWeight: 700, fontSize: 16,
                  color: sel ? 'var(--sage-800)' : 'var(--ink-700)',
                  cursor: 'pointer',
                  transition: 'all var(--dur-fast) var(--ease-organic)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  boxShadow: sel ? 'var(--shadow-md)' : 'none',
                }}
              >
                <span style={{ fontSize: 40 }}>{icon}</span>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. Razza (no prezzi nella lista) ── */}
      {animal && (
        <div ref={breedRef} style={{ scrollMarginTop: 16 }}>
          <p className="eyebrow mb-3">Razza {animal === 'CAT' ? 'del gatto' : 'del cane'}</p>

          {selectedBreed ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 'var(--r-md)',
                background: 'var(--sage-800)',
                color: 'white',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
                <span style={{ fontSize: 15 }}>✓</span>
                {selectedBreed.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedBreed(null);
                  setSearch('');
                  setTimeout(() => searchRef.current?.focus(), 50);
                }}
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  border: 'none',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '5px 12px',
                  borderRadius: 999,
                  cursor: 'pointer',
                }}
              >
                Cambia razza
              </button>
            </div>
          ) : (
            <>
              <input
                ref={searchRef}
                type="text"
                className="input-cd"
                placeholder={animal === 'CAT' ? 'Cerca… es. Persiano, Siamese' : 'Cerca… es. Labrador, Maltese, Yorkshire'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 2 }}>
                {filtered.map((breed: BreedEntry) => (
                  <button
                    key={breed.id}
                    type="button"
                    onClick={() => setSelectedBreed(breed)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                      padding: '12px 14px',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--cream-200)',
                      background: 'transparent',
                      cursor: 'pointer',
                      transition: 'all var(--dur-fast) var(--ease-organic)',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ink-800)' }}>
                      {breed.name}
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p style={{ fontSize: 13, color: 'var(--ink-400)', padding: '10px 0' }}>
                    Razza non trovata. Contattaci per un preventivo.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 3a. Misura (se razza ha 2+ misure) ── */}
      {selectedBreed && breedSizes.length > 1 && (
        <div>
          <p className="eyebrow mb-3">Misura del {animal === 'CAT' ? 'gatto' : 'cane'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(breedSizes.length, 4)}, 1fr)`, gap: 10 }}>
            {breedSizes.map((sz) => {
              const sel = selectedSizeId === sz.id;
              return (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => setSelectedSizeId(sz.id)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: 'var(--r-md)',
                    border: sel ? '2px solid var(--sage-800)' : '1px solid var(--cream-300)',
                    background: sel ? 'var(--sage-100)' : 'var(--cream-50)',
                    cursor: 'pointer',
                    transition: 'all var(--dur-fast) var(--ease-organic)',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 700, color: sel ? 'var(--sage-800)' : 'var(--ink-900)' }}>
                    {sz.label}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3b. Tipo pelo (solo MIXED) — dopo misura, prima dei servizi ── */}
      {showCoatPicker && selectedBreed && (!hasSizes || breedSizes.length <= 1 || !!selectedSizeId) && (
        <div>
          <p className="eyebrow mb-3">Tipo di pelo</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(['SHORT', 'LONG'] as const).map((coat) => {
              const sel = mixedCoatChoice === coat;
              const label = coat === 'SHORT' ? 'Pelo corto' : 'Pelo lungo';
              return (
                <button
                  key={coat}
                  type="button"
                  onClick={() => setMixedCoatChoice(coat)}
                  style={{
                    padding: '14px 12px',
                    borderRadius: 'var(--r-md)',
                    border: sel ? '2px solid var(--sage-800)' : '1px solid var(--cream-300)',
                    background: sel ? 'var(--sage-100)' : 'var(--cream-50)',
                    cursor: 'pointer',
                    transition: 'all var(--dur-fast) var(--ease-organic)',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 700, color: sel ? 'var(--sage-800)' : 'var(--ink-900)' }}>
                    {label}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. Servizi (prezzi per razza/misura) ── */}
      {animal && selectedBreed && !sizeRequiredButMissing && (primaryService || addonServices.length > 0) && (
        <div ref={servicesRef} style={{ scrollMarginTop: 16 }}>
          <p className="eyebrow mb-3">
            {primaryService ? `Servizio per ${selectedBreed.name}` : `Servizi per ${selectedBreed.name}`}
          </p>

          {/* Primary auto-incluso con prezzo (solo se isDefault esiste) */}
          {primaryService && (() => {
            const p = priceForService(
              primaryService,
              lookupCells(selectedBreed.id, primaryService.id),
              selectedSizeId,
              effectiveCoat,
              isMixed,
            );
            return (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 18px',
                  borderRadius: 'var(--r-md)',
                  border: '1.5px solid var(--sage-800)',
                  background: 'var(--sage-100)',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 24 }}>🛁</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--sage-800)' }}>
                    {primaryService.displayName || primaryService.name}
                  </p>
                  {primaryService.description && (
                    <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 3 }}>
                      {primaryService.description}
                    </p>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: 'var(--brown-700)', whiteSpace: 'nowrap' }}>
                  {p > 0 ? (
                    <>
                      <span style={{ fontSize: 11, fontStyle: 'italic', marginRight: 3, opacity: 0.7 }}>da</span>
                      <span style={{ fontSize: 18 }}>{p} €</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>—</span>
                  )}
                </span>
              </div>
            );
          })()}

          {addonServices.length > 0 && (
            <>
              {primaryService && (
                <p className="eyebrow mb-3" style={{ marginTop: 8 }}>Aggiungi al servizio</p>
              )}
              {!primaryService && (
                <p className="eyebrow mb-3" style={{ marginTop: 8 }}>Scegli uno o più servizi</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {addonServices.map((svc) => {
                  const sel = selectedAddonIds.has(svc.id);
                  const p = priceForService(svc, lookupCells(selectedBreed.id, svc.id), selectedSizeId, effectiveCoat, isMixed);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleAddon(svc.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 18px',
                        borderRadius: 'var(--r-md)',
                        border: sel ? '2px solid var(--sage-800)' : '1px solid var(--cream-300)',
                        background: sel ? 'var(--sage-100)' : 'var(--cream-50)',
                        cursor: 'pointer',
                        transition: 'all var(--dur-fast) var(--ease-organic)',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 15, color: sel ? 'var(--sage-800)' : 'var(--ink-900)' }}>
                          {svc.displayName || svc.name}
                        </p>
                        {svc.description && (
                          <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 3 }}>{svc.description}</p>
                        )}
                      </div>
                      <span style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: 'var(--brown-700)', whiteSpace: 'nowrap', marginRight: sel ? 6 : 0 }}>
                        {p > 0 ? (
                          <>
                            <span style={{ fontSize: 11, fontStyle: 'italic', marginRight: 3, opacity: 0.7 }}>+</span>
                            <span style={{ fontSize: 16 }}>{p} €</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>—</span>
                        )}
                      </span>
                      {sel && (
                        <svg width="22" height="22" viewBox="0 0 44 44" fill="none" style={{ flexShrink: 0 }}>
                          <circle cx="22" cy="22" r="20" fill="var(--sage-800)" />
                          <path d="M12 22l7 7 13-13" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {animal && selectedBreed && !primaryService && addonServices.length === 0 && (
        <div className="rounded-md border p-4 text-sm" style={{ borderColor: 'var(--cream-300)', background: 'var(--cream-50)' }}>
          Nessun servizio configurato per {animal === 'CAT' ? 'gatti' : 'cani'}.
          Contattaci per maggiori informazioni.
        </div>
      )}

      {/* ── Sempre incluso (sotto servizi, sopra extra) ── */}
      {animal && selectedBreed && (primaryService || selectedAddonIds.size > 0) && (
        <div
          style={{
            borderRadius: 'var(--r-md)',
            padding: '12px 14px 12px 16px',
            background: 'white',
            borderLeft: '3px solid var(--sage-800)',
            border: '1px solid var(--cream-300)',
            borderLeftWidth: 3,
            borderLeftColor: 'var(--sage-800)',
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--sage-800)',
              marginBottom: 4,
            }}
          >
            ✓ Sempre incluso
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.6 }}>
            Pulizia orecchie · Svuotamento sacche anali · Sistemazione unghie
          </p>
        </div>
      )}

      {/* ── 4. Extra ── */}
      {animal && selectedBreed && (primaryService || selectedAddonIds.size > 0) && visibleExtras.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Servizi extra</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visibleExtras.map((e) => {
              const checked = extras.has(e.id);
              return (
                <label
                  key={e.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 'var(--r-md)',
                    border: checked ? '1.5px solid var(--sage-800)' : '1px solid var(--cream-300)',
                    background: checked ? 'var(--sage-100)' : 'var(--cream-50)',
                    cursor: 'pointer',
                    transition: 'all var(--dur-fast) var(--ease-organic)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExtra(e.id)}
                      style={{ accentColor: 'var(--sage-800)', width: 17, height: 17, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 14, fontWeight: checked ? 600 : 400, color: checked ? 'var(--sage-800)' : 'var(--ink-800)' }}>
                      {e.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-cormorant), serif', fontWeight: 600, color: 'var(--brown-600)' }}>
                    +{(e.priceCents / 100).toFixed(2).replace('.00', '')} €
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CTA ── */}
      {animal && selectedBreed && (primaryService || addonServices.length > 0) && (
        <div>
          {totalPrice && (
            <>
              <p style={{ fontSize: 12, color: 'var(--ink-500)', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.5, textAlign: 'center' }}>
                <strong style={{ fontStyle: 'normal', color: 'var(--ink-700)' }}>N.B.</strong> *Il prezzo finale è sempre concordato in negozio, a discrezione del personale in base alle condizioni dell&apos;animale.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>
                  Prezzo indicativo{extraTotal > 0 ? ` (inclusi extra)` : ''}
                </span>
                <span style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: 'var(--brown-700)', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 14, fontStyle: 'italic', marginRight: 4, opacity: 0.7 }}>da</span>
                  <span style={{ fontSize: 28 }}>{totalPrice.min} €</span>
                </span>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="btn-primary justify-center"
            style={{ width: '100%', fontSize: 16, padding: '16px 28px', opacity: canContinue ? 1 : 0.4, cursor: canContinue ? 'pointer' : 'not-allowed' }}
          >
            {!selectedBreed
              ? 'Seleziona la razza per continuare'
              : sizeRequiredButMissing
                ? 'Seleziona la misura per continuare'
                : !primaryService && selectedAddonIds.size === 0
                  ? 'Seleziona almeno un servizio'
                  : 'Scegli data e orario →'}
          </button>
        </div>
      )}
    </div>
  );
}
