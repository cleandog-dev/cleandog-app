'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Slot } from '@/lib/availability';

function buildDateOptions(days = 21): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function DateTimeStep({ serviceId, addonServiceIds, breedName, sizeOptionId, coatChoice, selectedISO, onBack, onSelect }: {
  serviceId: string;
  addonServiceIds?: string[];
  breedName?: string | null;
  sizeOptionId?: string | null;
  coatChoice?: 'SHORT' | 'LONG' | null;
  selectedISO: string | null;
  onBack: () => void;
  onSelect: (iso: string) => void;
}) {
  const dates = buildDateOptions(21);
  const [selectedDate, setSelectedDate] = useState(() => format(dates[0]!, 'yyyy-MM-dd'));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addonsParam = (addonServiceIds ?? []).join(',');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ serviceId, date: selectedDate });
    if (addonsParam) params.set('addonServiceIds', addonsParam);
    if (breedName) params.set('breedName', breedName);
    if (sizeOptionId) params.set('sizeOptionId', sizeOptionId);
    if (coatChoice) params.set('coatChoice', coatChoice);
    fetch(`/api/availability?${params.toString()}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: { slots: Slot[] }) => { if (!cancelled) setSlots(d.slots); })
      .catch(() => { if (!cancelled) setError('Impossibile caricare gli orari'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [serviceId, addonsParam, selectedDate, breedName, sizeOptionId, coatChoice]);

  return (
    <div className="space-y-6">
      {/* Month label */}
      <div>
        <p className="eyebrow mb-3">{format(new Date(), 'MMMM yyyy', { locale: it })} · Prossimi 21 giorni</p>

        {/* Day chips — horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5">
          {dates.map((d) => {
            const key = format(d, 'yyyy-MM-dd');
            const dow = d.getDay();
            const isSun = dow === 0;
            const isSelected = key === selectedDate;

            return (
              <button
                key={key}
                type="button"
                onClick={() => !isSun && setSelectedDate(key)}
                disabled={isSun}
                style={{
                  minWidth: 52,
                  padding: '10px 6px',
                  borderRadius: 'var(--r-md)',
                  border: isSelected ? '1px solid var(--sage-800)' : '1px solid var(--cream-300)',
                  background: isSelected ? 'var(--sage-800)' : 'var(--cream-50)',
                  color: isSelected ? 'var(--cream-50)' : isSun ? 'var(--ink-300)' : 'var(--ink-700)',
                  opacity: isSun ? 0.5 : 1,
                  cursor: isSun ? 'not-allowed' : 'pointer',
                  transition: 'all var(--dur-fast) var(--ease-organic)',
                  flexShrink: 0,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: isSelected ? 0.8 : 1, color: isSelected ? 'inherit' : 'var(--ink-500)' }}>
                  {format(d, 'EEE', { locale: it })}
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, fontSize: 22, lineHeight: 1.1 }}>
                  {format(d, 'd')}
                </div>
                {isSun && <div style={{ fontSize: 9, opacity: 0.7 }}>chiuso</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      <div>
        <p className="eyebrow mb-3">Orari disponibili</p>

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ height: 44, borderRadius: 'var(--r-md)', background: 'var(--cream-200)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

        {!loading && !error && slots.length === 0 && (
          <div
            className="py-10 text-center text-sm"
            style={{ background: 'var(--cream-50)', borderRadius: 'var(--r-lg)', color: 'var(--ink-500)', border: '1px dashed var(--cream-300)' }}
          >
            Nessuna disponibilità.<br/>
            <span style={{ fontSize: 12, color: 'var(--ink-300)' }}>Prova un altro giorno.</span>
          </div>
        )}

        {!loading && slots.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
            {slots.map((s) => {
              const sel = selectedISO === s.startISO;
              return (
                <button
                  key={s.startISO}
                  type="button"
                  onClick={() => onSelect(s.startISO)}
                  style={{
                    padding: '11px 8px',
                    borderRadius: 'var(--r-md)',
                    border: sel ? '1px solid var(--sage-800)' : '1px solid var(--cream-300)',
                    background: sel ? 'var(--sage-800)' : 'var(--cream-50)',
                    color: sel ? 'var(--cream-50)' : 'var(--ink-700)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    fontSize: 15,
                    cursor: 'pointer',
                    transition: 'all var(--dur-fast) var(--ease-organic)',
                    boxShadow: sel ? 'var(--shadow-md)' : 'none',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="btn-ghost text-sm flex items-center gap-2"
        style={{ color: 'var(--ink-500)', padding: '10px 0' }}
      >
        <svg width="16" height="16" viewBox="0 0 44 44" fill="none">
          <path d="M28 8L14 22l14 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Indietro
      </button>
    </div>
  );
}
