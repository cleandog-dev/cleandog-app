'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE, formatEUR } from '@/lib/utils';

const FormSchema = z.object({
  customerName: z.string().min(2, 'Nome troppo corto').max(80),
  customerPhone: z.string().regex(/^(\+?[0-9\s\-().]{6,20})$/, 'Telefono non valido'),
  dogName: z.string().max(50).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  privacyConsent: z.literal(true, { errorMap: () => ({ message: 'Devi accettare la privacy policy' }) }),
});
type FormValues = z.infer<typeof FormSchema>;

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="label">{label}</label>
      {children}
      {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  );
}

export type BookingSummary = {
  serviceName: string;
  breed: string;
  sizeLabel?: string;
  coatChoice?: 'SHORT' | 'LONG';
  addonNames: string[];
  totalCents: number;
  startsAtISO: string;
};

export function CustomerStep({
  animalLabel,
  summary,
  isSubmitting,
  onBack,
  onSubmit,
}: {
  animalLabel: string;
  summary?: BookingSummary;
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: (v: FormValues) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      customerName: '', customerPhone: '',
      dogName: '', notes: '', privacyConsent: undefined as unknown as true,
    },
  });
  const errors = form.formState.errors;

  const whenLabel = summary
    ? (() => {
        const z = toZonedTime(new Date(summary.startsAtISO), APP_TIMEZONE);
        return format(z, "EEEE d MMMM 'alle' HH:mm", { locale: it });
      })()
    : null;
  const coatLabel = summary?.coatChoice === 'SHORT' ? 'Pelo corto' : summary?.coatChoice === 'LONG' ? 'Pelo lungo' : null;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {summary && (
        <div
          style={{
            background: 'var(--cream-50)',
            border: '1px solid var(--cream-300)',
            borderRadius: 'var(--r-md)',
            padding: '14px 16px',
            marginBottom: 20,
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--ink-500)',
              marginBottom: 8,
            }}
          >
            Riepilogo
          </p>
          {whenLabel && (
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)', textTransform: 'capitalize', marginBottom: 6 }}>
              {whenLabel}
            </p>
          )}
          <p style={{ fontSize: 13, color: 'var(--ink-700)', marginBottom: 2 }}>
            <span style={{ fontWeight: 500 }}>{summary.serviceName}</span>
            {summary.addonNames.length > 0 && (
              <span style={{ color: 'var(--ink-500)' }}> + {summary.addonNames.join(', ')}</span>
            )}
          </p>
          <p style={{ fontSize: 12, color: 'var(--ink-500)' }}>
            {summary.breed}
            {summary.sizeLabel ? ` · ${summary.sizeLabel}` : ''}
            {coatLabel ? ` · ${coatLabel}` : ''}
          </p>
          <div style={{ height: 1, background: 'var(--cream-300)', margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Totale</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--sage-800)' }}>
              {formatEUR(summary.totalCents)}
            </span>
          </div>
        </div>
      )}

      <Field label="Nome e cognome" error={errors.customerName?.message}>
        <input className="input-cd" {...form.register('customerName')} autoComplete="name" placeholder="Mario Rossi" />
      </Field>

      <Field label="Telefono" error={errors.customerPhone?.message}>
        <input className="input-cd" {...form.register('customerPhone')} autoComplete="tel" placeholder="+39 333 123 4567" inputMode="tel" />
      </Field>

      <div style={{ height: 1, background: 'var(--cream-300)', margin: '20px 0' }} />

      <Field label={`Nome del tuo ${animalLabel} (opzionale)`} error={errors.dogName?.message}>
        <input className="input-cd" {...form.register('dogName')} placeholder="Es. Luna" />
      </Field>

      <Field label="Note per il toelettatore (opzionale)" error={errors.notes?.message}>
        <textarea
          className="input-cd textarea"
          {...form.register('notes')}
          rows={2}
          placeholder="Allergie, comportamento, richieste speciali…"
        />
      </Field>

      {/* Privacy */}
      <div style={{ background: 'var(--cream-200)', borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            {...form.register('privacyConsent')}
            style={{ marginTop: 2, accentColor: 'var(--sage-800)', width: 16, height: 16, flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.5 }}>
            Acconsento al trattamento dei dati personali secondo la{' '}
            <a href="/privacy" target="_blank" style={{ color: 'var(--sage-700)', textDecoration: 'underline' }}>
              privacy policy
            </a>
            .
          </span>
        </label>
        {errors.privacyConsent?.message && (
          <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{errors.privacyConsent.message}</p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary justify-center"
          style={{ width: '100%', fontSize: 16, padding: '16px 28px' }}
        >
          <svg width="18" height="18" viewBox="0 0 44 44" fill="none">
            <path d="M10 22l9 9 15-15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {isSubmitting ? 'Conferma in corso…' : 'Conferma prenotazione'}
        </button>
        <button type="button" onClick={onBack} className="btn-ghost justify-center text-sm" style={{ color: 'var(--ink-500)' }}>
          ← Indietro
        </button>
      </div>
    </form>
  );
}
