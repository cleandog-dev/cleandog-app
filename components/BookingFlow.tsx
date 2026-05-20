'use client';

import { useState, useTransition } from 'react';
import type { Service, Extra } from '@prisma/client';
import { ServiceStep, type ServiceSelection } from '@/components/booking/ServiceStep';
import { DateTimeStep } from '@/components/booking/DateTimeStep';
import { CustomerStep } from '@/components/booking/CustomerStep';
import { createBookingAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import type { BreedEntry, PricesByAnimal } from '@/lib/breeds';
import { PushSubscribe } from '@/components/PushSubscribe';

type Step = 1 | 2 | 3 | 4;

type BookingMeta = {
  slotISO: string;
  serviceName: string;
  durationMin: number;
  dogName: string;
  customerPhone: string;
};

// ── Calendar helpers ───────────────────────────────────────

function toICalDate(iso: string) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function googleCalUrl(meta: BookingMeta) {
  const start = toICalDate(meta.slotISO);
  const end = toICalDate(
    new Date(new Date(meta.slotISO).getTime() + meta.durationMin * 60_000).toISOString(),
  );
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `CleanDOG — ${meta.serviceName} (${meta.dogName})`,
    dates: `${start}/${end}`,
    details: `Appuntamento di toelettatura per ${meta.dogName}.`,
    location: 'Via Ghibellina 35, Messina',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function downloadIcal(meta: BookingMeta) {
  const start = toICalDate(meta.slotISO);
  const end = toICalDate(
    new Date(new Date(meta.slotISO).getTime() + meta.durationMin * 60_000).toISOString(),
  );
  const now = toICalDate(new Date().toISOString());
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CleanDOG//Booking//IT',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@cleandog.it`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:CleanDOG — ${meta.serviceName} (${meta.dogName})`,
    `DESCRIPTION:Appuntamento di toelettatura per ${meta.dogName}.`,
    'LOCATION:Via Ghibellina 35\\, Messina',
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Promemoria appuntamento CleanDOG',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cleandog-${meta.dogName.toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── BookingFlow ────────────────────────────────────────────

export function BookingFlow({
  services,
  dogBreeds,
  catBreeds,
  extrasList,
  pricesByAnimal,
}: {
  services: Service[];
  dogBreeds: BreedEntry[];
  catBreeds: BreedEntry[];
  extrasList: Extra[];
  pricesByAnimal: PricesByAnimal;
}) {
  const [step, setStep] = useState<Step>(1);
  const [selection, setSelection] = useState<ServiceSelection | null>(null);
  const [slotISO, setSlotISO] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [bookingMeta, setBookingMeta] = useState<BookingMeta | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function reset() {
    setStep(1); setSelection(null); setSlotISO(null);
    setConfirmedId(null); setBookingMeta(null);
  }

  function submit(form: {
    customerName: string;
    customerPhone: string;
    dogName?: string;
    notes?: string;
    privacyConsent: true;
  }) {
    if (!selection || !slotISO) return;
    startTransition(async () => {
      const coatNote = selection.coatChoice === 'SHORT' ? 'Pelo corto' : selection.coatChoice === 'LONG' ? 'Pelo lungo' : '';
      const combinedNotes = [coatNote, selection.extrasNote, form.notes].filter(Boolean).join(' · ') || undefined;
      const result = await createBookingAction({
        ...form,
        notes: combinedNotes,
        serviceId: selection.serviceId,
        addonServiceIds: selection.addonServiceIds ?? [],
        sizeOptionId: selection.sizeOptionId,
        startsAt: slotISO,
        animalType: selection.animalType,
        dogBreed: selection.breed,
        coatChoice: selection.coatChoice,
      });
      if (!result.ok) {
        toast({ title: 'Prenotazione non riuscita', description: result.error, variant: 'destructive' });
        return;
      }
      setConfirmedId(result.data.id);
      setBookingMeta({
        slotISO,
        serviceName: selection.serviceName.replace(/ — (Cane|Gatto)$/, ''),
        durationMin: selection.durationMin,
        dogName: form.dogName || selection.breed || 'animale',
        customerPhone: form.customerPhone,
      });
      setStep(4);
    });
  }

  return (
    <div>
      {step < 4 && (
        <div className="mb-8 flex items-center justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`stepdot ${step === n ? 'stepdot-active' : step > n ? 'stepdot-done' : ''}`} />
          ))}
        </div>
      )}

      {selection && step > 1 && step < 4 && (
        <div className="mb-6 flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'var(--sage-100)', borderRadius: 'var(--r-md)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--sage-800)' }}>
              {selection.breed} · {selection.serviceName.replace(/ — (Cane|Gatto)$/, '')}
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              <span style={{ fontStyle: 'italic', opacity: 0.7 }}>da</span> {selection.priceMin} € · {selection.durationMin} min
            </p>
          </div>
          <button type="button" onClick={() => setStep(1)} className="text-xs font-medium underline" style={{ color: 'var(--sage-700)' }}>
            Cambia
          </button>
        </div>
      )}

      <div key={step} className="step-enter">
        {step === 1 && (
          <ServiceStep
            services={services}
            dogBreeds={dogBreeds}
            catBreeds={catBreeds}
            extrasList={extrasList}
            pricesByAnimal={pricesByAnimal}
            initial={selection ?? undefined}
            onSelect={(s) => { setSelection(s); setSlotISO(null); setStep(2); }}
          />
        )}
        {step === 2 && selection && (
          <DateTimeStep
            serviceId={selection.serviceId}
            addonServiceIds={selection.addonServiceIds}
            breedName={selection.breed || null}
            sizeOptionId={selection.sizeOptionId ?? null}
            coatChoice={selection.coatChoice ?? null}
            selectedISO={slotISO}
            onBack={() => setStep(1)}
            onSelect={(iso) => { setSlotISO(iso); setStep(3); }}
          />
        )}
        {step === 3 && selection && slotISO && (
          <CustomerStep animalLabel={selection.animalType === 'CAT' ? 'gatto' : 'cane'} isSubmitting={isPending} onBack={() => setStep(2)} onSubmit={submit} />
        )}
        {step === 4 && confirmedId && (
          <SuccessStep confirmedId={confirmedId} meta={bookingMeta} onReset={reset} />
        )}
      </div>
    </div>
  );
}

// ── SuccessStep ────────────────────────────────────────────

function SuccessStep({ confirmedId, meta, onReset }: {
  confirmedId: string;
  meta: BookingMeta | null;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      {/* Check */}
      <div className="relative flex h-28 w-28 items-center justify-center rounded-full animate-pulse-soft" style={{ background: 'var(--sage-100)' }}>
        <svg width="56" height="56" viewBox="0 0 44 44" fill="none">
          <path
            d="M10 22l9 9 15-15"
            stroke="var(--sage-800)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="50"
            strokeDashoffset="50"
            style={{ animation: 'draw 800ms 200ms cubic-bezier(0.34,1.2,0.42,1) forwards' }}
          />
        </svg>
      </div>

      <div>
        <h2 className="display" style={{ fontSize: 'clamp(28px, 8vw, 44px)', color: 'var(--ink-900)' }}>
          Prenotazione confermata!
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-500)' }}>
          Ti aspettiamo.
        </p>
      </div>

      {/* Push subscribe for client (linked to phone) */}
      {meta?.customerPhone && (
        <div className="w-full">
          <PushSubscribe
            scope="CLIENT"
            customerPhone={meta.customerPhone}
            label="Ricevi promemoria 1h prima"
          />
        </div>
      )}

      {/* Aggiungi al calendario */}
      {meta && (
        <div className="w-full" style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--cream-300)' }}>
          <div style={{ background: 'var(--cream-200)', padding: '12px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-500)' }}>
              Aggiungi al calendario
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--cream-50)' }}>
            <a
              href={googleCalUrl(meta)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '18px 12px',
                textDecoration: 'none',
                borderRight: '1px solid var(--cream-300)',
                transition: 'background var(--dur-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cream-100)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon-google-calendar.png"
                alt="Google Calendar"
                width={32}
                height={32}
                style={{ objectFit: 'contain' }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)' }}>Google Calendar</span>
            </a>
            <button
              type="button"
              onClick={() => downloadIcal(meta)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '18px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                transition: 'background var(--dur-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cream-100)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Apple Calendar */}
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="10" fill="#FF3B30"/>
                <rect x="4" y="14" width="40" height="30" rx="6" fill="white"/>
                <rect x="4" y="14" width="40" height="10" fill="#FF3B30"/>
                <text x="24" y="11" textAnchor="middle" fill="white" fontSize="7" fontWeight="700" fontFamily="sans-serif">
                  CAL
                </text>
                <text x="24" y="34" textAnchor="middle" fill="#1C1C1E" fontSize="13" fontWeight="700" fontFamily="sans-serif">
                  .ics
                </text>
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)' }}>Apple / Outlook</span>
            </button>
          </div>
        </div>
      )}

      {/* Promemoria */}
      <div className="w-full rounded-xl p-4 text-left" style={{ background: 'var(--cream-200)', borderRadius: 'var(--r-lg)' }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">🔔</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink-900)' }}>Promemoria automatici attivi</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-500)' }}>
              Se hai abilitato le notifiche, riceverai un promemoria 1h prima dell&apos;appuntamento.
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs font-mono" style={{ color: 'var(--ink-300)' }}>
        #{confirmedId.slice(0, 8).toUpperCase()}
      </p>

      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={onReset} className="btn-ghost text-sm" style={{ color: 'var(--ink-500)' }}>
          Prenota un altro appuntamento
        </button>
        <a href="/cancella" className="text-xs underline" style={{ color: 'var(--ink-300)' }}>
          Devi cancellare? Vai qui
        </a>
      </div>
    </div>
  );
}
