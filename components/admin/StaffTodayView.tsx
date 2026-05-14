'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { Booking, Service, BookingStatus } from '@prisma/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { APP_TIMEZONE, formatEUR, animalLabel } from '@/lib/utils';
import { updateBookingStatusAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { BookingDetailDialog } from './BookingDetailDialog';

type Row = Booking & { service: Service };

const statusVariant: Record<
  BookingStatus,
  'default' | 'secondary' | 'destructive' | 'success' | 'warning'
> = {
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

export function StaffTodayView({ bookings }: { bookings: Row[] }) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Row | null>(null);
  const { toast } = useToast();

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  function setStatus(id: string, status: BookingStatus) {
    startTransition(async () => {
      const r = await updateBookingStatusAction({ bookingId: id, status });
      if (!r.ok) toast({ title: 'Errore', description: r.error, variant: 'destructive' });
      else toast({ title: 'Stato aggiornato' });
    });
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nessun appuntamento oggi. 🎉
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-2">
      {bookings.map((b) => {
        const local = toZonedTime(b.startsAt, APP_TIMEZONE);
        const isDone = b.status === 'COMPLETED';
        const isCancelled = b.status === 'CANCELLED' || b.status === 'NO_SHOW';
        return (
          <Card
            key={b.id}
            onClick={() => setSelected(b)}
            className={`cursor-pointer transition-shadow hover:shadow-md ${isCancelled ? 'opacity-60' : ''}`}
          >
            <CardContent className="flex flex-col gap-3 py-3 md:flex-row md:items-center">
              <div className="flex items-start gap-3 min-w-0 md:flex-1">
                <div
                  className="flex flex-col items-center justify-center rounded-md px-2 py-1.5 text-center w-[58px] flex-shrink-0 md:px-3 md:py-2 md:w-[68px]"
                  style={{ background: 'var(--cream-200)' }}
                >
                  <p className="text-lg font-bold leading-none md:text-xl">
                    {format(local, 'HH:mm')}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground md:text-[10px]">
                    {b.service.durationMin}m
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className={`text-sm font-semibold md:text-base ${isDone ? 'line-through' : ''}`}>
                      {animalLabel(b)}
                    </p>
                    <Badge variant={statusVariant[b.status]} className="text-[9px] px-1.5 py-0">
                      {statusLabel[b.status]}
                    </Badge>
                  </div>
                  {b.dogBreed && (
                    <p className="text-xs text-muted-foreground truncate">{b.dogBreed}</p>
                  )}
                  <p className="text-xs text-muted-foreground truncate">
                    {b.service.name.replace(/ — (Cane|Gatto)$/, '')} · {formatEUR(b.priceCents)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.customerName} · <a href={`tel:${b.customerPhone}`} className="underline">{b.customerPhone}</a>
                  </p>
                  {b.notes && (
                    <p className="mt-1 text-xs italic text-muted-foreground line-clamp-2">📝 {b.notes}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 md:ml-auto md:flex md:flex-shrink-0 md:flex-nowrap md:items-center md:gap-1.5" onClick={stop}>
                {!isDone && !isCancelled && (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={(e) => { e.stopPropagation(); setStatus(b.id, 'COMPLETED'); }}
                  >
                    ✓ Fatto
                  </Button>
                )}
                {b.status === 'PENDING' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={(e) => { e.stopPropagation(); setStatus(b.id, 'CONFIRMED'); }}
                  >
                    Conferma
                  </Button>
                )}
                {!isCancelled && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    className="text-red-500"
                    onClick={(e) => { e.stopPropagation(); setStatus(b.id, 'NO_SHOW'); }}
                  >
                    No-show
                  </Button>
                )}
                {isDone && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={(e) => { e.stopPropagation(); setStatus(b.id, 'CONFIRMED'); }}
                  >
                    ↩ Riapri
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <BookingDetailDialog booking={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
