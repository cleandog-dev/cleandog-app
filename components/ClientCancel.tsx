'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import {
  lookupBookingsByPhoneAction,
  clientCancelBookingAction,
  type ClientBookingLite,
} from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_TIMEZONE, formatEUR } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function ClientCancel() {
  const [phone, setPhone] = useState('');
  const [bookings, setBookings] = useState<ClientBookingLite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { toast } = useToast();

  function lookup() {
    setError(null);
    startTransition(async () => {
      const r = await lookupBookingsByPhoneAction(phone);
      if (!r.ok) {
        setError(r.error);
        setBookings(null);
      } else {
        setBookings(r.data.bookings);
      }
    });
  }

  function cancel(id: string) {
    startTransition(async () => {
      const r = await clientCancelBookingAction({ bookingId: id, phone });
      if (!r.ok) {
        toast({ title: 'Errore', description: r.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Prenotazione cancellata' });
      setBookings((prev) => (prev ? prev.filter((b) => b.id !== id) : prev));
      setConfirmId(null);
    });
  }

  function fmt(iso: string): string {
    const z = toZonedTime(new Date(iso), APP_TIMEZONE);
    return format(z, 'EEEE dd MMMM · HH:mm', { locale: it });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ink-500)' }}>
          Numero di telefono
        </label>
        <div className="flex gap-2">
          <Input
            type="tel"
            inputMode="tel"
            placeholder="es. 333 1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }}
            className="flex-1"
          />
          <Button onClick={lookup} disabled={pending || phone.length < 6}>
            {pending ? 'Cerco…' : 'Cerca'}
          </Button>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>

      {bookings !== null && (
        <div className="space-y-2">
          {bookings.length === 0 ? (
            <div
              className="rounded-lg border p-4 text-center text-sm"
              style={{ background: 'white', borderColor: 'var(--cream-300)', color: 'var(--ink-500)' }}
            >
              Nessuna prenotazione futura trovata per questo numero.
            </div>
          ) : (
            bookings.map((b) => (
              <div
                key={b.id}
                className="rounded-lg border p-4 space-y-3"
                style={{ background: 'white', borderColor: 'var(--cream-300)' }}
              >
                <div>
                  <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--ink-500)' }}>
                    {b.dogName || 'Prenotazione'}
                  </p>
                  <p className="font-semibold" style={{ color: 'var(--ink-700)' }}>
                    {b.serviceName}
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'var(--ink-500)' }}>
                    {fmt(b.startsAt)}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
                    {formatEUR(b.priceCents)}
                  </p>
                </div>
                {confirmId === b.id ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmId(null)}
                      disabled={pending}
                      className="flex-1"
                    >
                      Annulla
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => cancel(b.id)}
                      disabled={pending}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      {pending ? 'Cancello…' : 'Conferma cancellazione'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmId(b.id)}
                    className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Cancella questa prenotazione
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
