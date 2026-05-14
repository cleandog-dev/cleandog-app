'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { Service, Extra } from '@prisma/client';
import { formatPrice, type AnimalType, type BreedEntry } from '@/lib/breeds';

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
};

export function ServiceStep({
  services,
  dogBreeds,
  catPrice,
  extrasList,
  initial,
  onSelect,
}: {
  services: Service[];
  dogBreeds: BreedEntry[];
  catPrice: { min: number; max: number } | null;
  extrasList: Extra[];
  initial?: ServiceSelection;
  onSelect: (s: ServiceSelection) => void;
}) {
  const initBreed = initial?.animalType === 'DOG'
    ? dogBreeds.find((b) => b.name === initial.breed) ?? null
    : null;

  const initExtras = useMemo(() => {
    if (!initial?.extrasNote) return new Set<string>();
    const match = initial.extrasNote.match(/Extra:\s*(.+)$/);
    if (!match) return new Set<string>();
    const names = match[1].split(/,\s*/).map((s) => s.trim());
    const ids = extrasList.filter((e) => names.includes(e.name)).map((e) => e.id);
    return new Set(ids);
  }, [initial, extrasList]);

  const [animal, setAnimal]           = useState<AnimalType | null>(initial?.animalType ?? null);
  const [serviceId, setServiceId]     = useState<string>(initial?.serviceId ?? '');
  const [selectedBreed, setSelectedBreed] = useState<BreedEntry | null>(initBreed);
  const [search, setSearch]           = useState('');
  const [extras, setExtras]           = useState<Set<string>>(initExtras);
  const [mixedCoatChoice, setMixedCoatChoice] = useState<CoatChoice>(
    initial?.coatChoice === 'LONG' ? 'LONG' : 'SHORT'
  );

  const servicesRef = useRef<HTMLDivElement | null>(null);
  const breedRef    = useRef<HTMLDivElement | null>(null);
  const searchRef   = useRef<HTMLInputElement | null>(null);
  const mountedRef  = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (animal && servicesRef.current) {
      servicesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [animal]);

  useEffect(() => {
    if (!mountedRef.current) return;
    if (serviceId && breedRef.current) {
      const t = setTimeout(() => {
        breedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (animal === 'DOG') searchRef.current?.focus({ preventScroll: true });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [serviceId, animal]);

  const selectedService = services.find((s) => s.id === serviceId);

  const serviceHasGroom = !!selectedService && /tosatura/i.test(selectedService.name);
  const serviceHasBath  = !!selectedService && /bagno/i.test(selectedService.name);

  // Derive coat: from breed; if MIXED, from user choice
  const breedCoat = selectedBreed?.coatType ?? null;
  const isMixed = breedCoat === 'MIXED';
  const effectiveCoat: CoatChoice | null =
    !serviceHasGroom || animal !== 'DOG' ? null
    : isMixed ? mixedCoatChoice
    : breedCoat === 'LONG' ? 'LONG'
    : 'SHORT'; // default short for null/SHORT

  const showCoatPicker = serviceHasGroom && animal === 'DOG' && isMixed;

  const groomRange = useMemo(() => {
    if (!selectedService || !serviceHasGroom || animal !== 'DOG') return { min: 0, max: 0 };
    const cents = (min: number | null | undefined, max: number | null | undefined) => ({
      min: (min ?? 0) / 100,
      max: (max ?? 0) / 100,
    });
    if (effectiveCoat === 'LONG') {
      return cents(selectedService.priceCoatLongMinCents, selectedService.priceCoatLongMaxCents);
    }
    return cents(selectedService.priceCoatShortMinCents, selectedService.priceCoatShortMaxCents);
  }, [selectedService, serviceHasGroom, animal, effectiveCoat]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dogBreeds.filter((b) => b.name.toLowerCase().includes(q));
  }, [search, dogBreeds]);

  const visibleExtras = extrasList.filter((e) => e.active && (!e.dogOnly || animal === 'DOG'));

  const extraTotal = useMemo(
    () => extrasList.filter((e) => extras.has(e.id)).reduce((s, e) => s + e.priceCents / 100, 0),
    [extras, extrasList],
  );

  const basePrice = useMemo(() => {
    if (!animal) return null;
    if (animal === 'CAT') return catPrice ? { min: catPrice.min, max: catPrice.max } : null;
    if (!selectedBreed) return null;
    const bathMin = serviceHasBath ? selectedBreed.priceMin : 0;
    const bathMax = serviceHasBath ? selectedBreed.priceMax : 0;
    return { min: bathMin + groomRange.min, max: bathMax + groomRange.max };
  }, [animal, selectedBreed, catPrice, serviceHasBath, groomRange]);

  const totalPrice = useMemo(() => {
    if (!basePrice) return null;
    return { min: basePrice.min + extraTotal, max: basePrice.max + extraTotal };
  }, [basePrice, extraTotal]);

  function toggleExtra(id: string) {
    setExtras((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function changeAnimal(a: AnimalType) {
    setAnimal(a);
    setSelectedBreed(null);
    setSearch('');
    setExtras(new Set());
    setServiceId('');
  }

  const canContinue =
    !!animal && !!selectedService && (animal === 'CAT' || !!selectedBreed);

  function handleContinue() {
    if (!canContinue || !selectedService || !animal) return;

    const extraNames = extrasList.filter((e) => extras.has(e.id)).map((e) => e.name);
    const extrasNote = extraNames.length ? `Extra: ${extraNames.join(', ')}` : '';

    const priceBase = totalPrice ?? { min: 0, max: 0 };

    onSelect({
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      durationMin: selectedService.durationMin,
      animalType: animal,
      breed: animal === 'CAT' ? 'Gatto' : (selectedBreed?.name ?? ''),
      priceMin: priceBase.min,
      priceMax: priceBase.max,
      extrasNote,
      coatChoice: effectiveCoat ?? undefined,
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
                  fontFamily: "'DM Sans', sans-serif",
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

      {/* ── 2. Servizi (filtrati per animale) ── */}
      {animal && (
        <div ref={servicesRef} style={{ scrollMarginTop: 16 }}>
          <p className="eyebrow mb-3">Che servizio vuoi?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {services
              .filter((s) => s.forAnimal === animal)
              .sort((a, b) => {
                const order = (n: string) =>
                  n.startsWith('Bagno +') ? 3 : n.startsWith('Bagno') ? 1 : 2;
                return order(a.name) - order(b.name);
              })
              .map((s) => {
              const sel = s.id === serviceId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setServiceId(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: 'var(--r-md)',
                    border: sel ? '2px solid var(--sage-800)' : '1px solid var(--cream-300)',
                    background: sel ? 'var(--sage-100)' : 'var(--cream-50)',
                    cursor: 'pointer',
                    transition: 'all var(--dur-fast) var(--ease-organic)',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: sel ? 'var(--sage-800)' : 'var(--ink-900)' }}>
                      {s.name.replace(/ — (Cane|Gatto)$/, '')}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 3 }}>{s.description}</p>
                  </div>
                  {sel && (
                    <svg width="22" height="22" viewBox="0 0 44 44" fill="none" style={{ flexShrink: 0, marginLeft: 14 }}>
                      <circle cx="22" cy="22" r="20" fill="var(--sage-800)" />
                      <path d="M12 22l7 7 13-13" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. Razza (se cane) ── */}
      {animal === 'DOG' && serviceId && (
        <div ref={breedRef} style={{ scrollMarginTop: 16 }}>
          <p className="eyebrow mb-3">Razza del cane <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--ink-500)', fontSize: 11 }}>— prezzo per razza</span></p>
          <input
            ref={searchRef}
            type="text"
            className="input-cd"
            placeholder="Cerca… es. Labrador, Maltese, Yorkshire"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 2 }}>
            {filtered.map((breed) => {
              const isSel = selectedBreed?.id === breed.id;
              return (
                <button
                  key={breed.id}
                  type="button"
                  onClick={() => setSelectedBreed(breed)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--r-md)',
                    border: isSel ? '1.5px solid var(--sage-800)' : '1px solid var(--cream-200)',
                    background: isSel ? 'var(--sage-100)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all var(--dur-fast) var(--ease-organic)',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: isSel ? 600 : 400, color: isSel ? 'var(--sage-800)' : 'var(--ink-800)', flex: 1, minWidth: 0 }}>
                    {breed.name}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: 'var(--brown-700)', whiteSpace: 'nowrap', marginLeft: 12 }}>
                    <span>
                      <span style={{ fontSize: 11, fontStyle: 'italic', marginRight: 3, opacity: 0.7 }}>da</span>
                      <span style={{ fontSize: 15 }}>{breed.priceMin} €</span>
                    </span>
                    {serviceHasGroom && (() => {
                      const isLong = breed.coatType === 'LONG';
                      const isMixed = breed.coatType === 'MIXED';
                      const minC = isLong ? selectedService?.priceCoatLongMinCents : selectedService?.priceCoatShortMinCents;
                      if (minC == null) return null;
                      const min = Math.round(minC / 100);
                      return (
                        <span style={{ fontSize: 11, fontStyle: 'italic', opacity: 0.75, color: 'var(--ink-600)' }}>
                          + tosat. {isMixed ? '?' : ''}da {min} €
                        </span>
                      );
                    })()}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--ink-400)', padding: '10px 0' }}>
                Razza non trovata. Contattaci per un preventivo.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── 3c. Tipo pelo (solo Meticcio/MIXED) ── */}
      {showCoatPicker && selectedBreed && (
        <div>
          <p className="eyebrow mb-3">Tipo di pelo del cane</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(['SHORT', 'LONG'] as const).map((coat) => {
              const sel = mixedCoatChoice === coat;
              const label = coat === 'SHORT' ? 'Pelo corto' : 'Pelo lungo';
              const minC = coat === 'SHORT' ? selectedService?.priceCoatShortMinCents : selectedService?.priceCoatLongMinCents;
              const rangeText = minC != null
                ? `da ${Math.round(minC / 100)} €`
                : '—';
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
                    textAlign: 'left',
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 700, color: sel ? 'var(--sage-800)' : 'var(--ink-900)' }}>
                    {label}
                  </p>
                  <p style={{ fontSize: 13, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: 'var(--brown-700)', marginTop: 4 }}>
                    {serviceHasBath ? '+' : ''}{rangeText}
                  </p>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 6 }}>
            Prezzo finale concordato in negozio.
          </p>
        </div>
      )}

      {/* ── 3b. Gatto prezzo ── */}
      {animal === 'CAT' && serviceId && catPrice && (
        <div ref={breedRef} style={{ background: 'var(--sage-100)', borderRadius: 'var(--r-md)', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', scrollMarginTop: 16 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--sage-800)' }}>Gatto</p>
          <p style={{ fontSize: 24, fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, color: 'var(--brown-700)' }}>
            <span style={{ fontSize: 14, fontStyle: 'italic', opacity: 0.7, marginRight: 4 }}>da</span>{catPrice.min} €
          </p>
        </div>
      )}

      {/* ── 4. Extra (dopo che tutto è scelto) ── */}
      {animal && serviceId && (animal === 'CAT' || selectedBreed) && (
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
                  <span style={{ fontSize: 14, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: 'var(--brown-600)' }}>
                    +{(e.priceCents / 100).toFixed(2).replace('.00', '')} €
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sempre incluso ── */}
      {animal && serviceId && (
        <div style={{ borderRadius: 'var(--r-md)', padding: '14px 16px', background: 'var(--cream-200)', fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.7 }}>
          <p style={{ fontWeight: 700, color: 'var(--ink-800)', marginBottom: 4 }}>✓ Sempre incluso</p>
          Pulizia orecchie · Svuotamento sacche anali · Sistemazione unghie
        </div>
      )}

      {/* ── CTA ── */}
      {animal && serviceId && (
        <div>
          {totalPrice && (
            <>
              <p style={{ fontSize: 12, color: 'var(--ink-500)', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.5, textAlign: 'center' }}>
                Il prezzo finale è sempre concordato in negozio, a discrezione del personale in base alle condizioni dell&apos;animale.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>
                  Prezzo indicativo{extraTotal > 0 ? ` (inclusi extra)` : ''}
                </span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, color: 'var(--brown-700)', whiteSpace: 'nowrap' }}>
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
            {!canContinue && animal === 'DOG' ? 'Seleziona la razza per continuare' : 'Scegli data e orario →'}
          </button>
        </div>
      )}
    </div>
  );
}
