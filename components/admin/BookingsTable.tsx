'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { Booking, Service, BookingStatus } from '@prisma/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { APP_TIMEZONE, formatEUR, animalLabel } from '@/lib/utils';
import {
  updateBookingStatusAction,
  deleteBookingAction,
} from '@/lib/actions';
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

export function BookingsTable({
  bookings,
  currentRange,
}: {
  bookings: Row[];
  currentRange: string;
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const [selected, setSelected] = useState<Row | null>(null);
  const [selectedMode, setSelectedMode] = useState<'view' | 'edit'>('view');
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);

  function openDetail(b: Row, mode: 'view' | 'edit' = 'view') {
    setSelectedMode(mode);
    setSelected(b);
  }

  function changeStatus(id: string, status: BookingStatus) {
    startTransition(async () => {
      const r = await updateBookingStatusAction({ bookingId: id, status });
      if (!r.ok) toast({ title: 'Errore', description: r.error, variant: 'destructive' });
      else toast({ title: 'Stato aggiornato' });
    });
  }

  function performDelete() {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    startTransition(async () => {
      const r = await deleteBookingAction(id);
      if (!r.ok) toast({ title: 'Errore', description: r.error, variant: 'destructive' });
      else toast({ title: 'Prenotazione eliminata' });
      setConfirmDelete(null);
    });
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(['upcoming', 'past', 'all'] as const).map((r) => (
            <Button
              key={r}
              asChild
              size="sm"
              variant={currentRange === r ? 'default' : 'outline'}
            >
              <Link href={`/admin/dashboard?view=list&range=${r}`}>
                {r === 'upcoming' ? 'Future' : r === 'past' ? 'Passate' : 'Tutte'}
              </Link>
            </Button>
          ))}
        </div>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nessuna prenotazione.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Quando</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Animale</th>
                  <th className="px-3 py-2 text-left">Servizio</th>
                  <th className="px-3 py-2 text-right">Prezzo</th>
                  <th className="px-3 py-2 text-left">Stato</th>
                  <th className="px-3 py-2 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const local = toZonedTime(b.startsAt, APP_TIMEZONE);
                  return (
                    <tr
                      key={b.id}
                      className="border-t hover:bg-muted/20 cursor-pointer"
                      onClick={() => openDetail(b, 'view')}
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium">{format(local, 'dd/MM/yyyy')}</div>
                        <div className="text-xs text-muted-foreground">{format(local, 'HH:mm')}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{b.customerName}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.customerPhone}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{animalLabel(b)}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.dogBreed ?? '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3 max-w-[160px]">
                        <span className="line-clamp-2">{b.service.name}</span>
                      </td>
                      <td className="px-3 py-3 text-right">{formatEUR(b.priceCents)}</td>
                      <td className="px-3 py-3">
                        <Badge variant={statusVariant[b.status]}>{statusLabel[b.status]}</Badge>
                      </td>
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <select
                            value={b.status}
                            disabled={pending}
                            onChange={(e) => changeStatus(b.id, e.target.value as BookingStatus)}
                            className="h-8 rounded-md border bg-background px-2 text-xs"
                          >
                            {(Object.keys(statusLabel) as BookingStatus[]).map((s) => (
                              <option key={s} value={s}>
                                {statusLabel[s]}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => openDetail(b, 'edit')}
                          >
                            ✏️
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => setConfirmDelete(b)}
                          >
                            🗑
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BookingDetailDialog
        booking={selected}
        onClose={() => setSelected(null)}
        initialMode={selectedMode}
      />

      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o && !pending) setConfirmDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Eliminare la prenotazione?</DialogTitle>
          </DialogHeader>
          {confirmDelete && (() => {
            const local = toZonedTime(confirmDelete.startsAt, APP_TIMEZONE);
            return (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-semibold">{confirmDelete.customerName}</p>
                <p className="text-xs text-muted-foreground">
                  {animalLabel(confirmDelete)} · {confirmDelete.service.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  📅 {format(local, 'dd/MM/yyyy')} alle {format(local, 'HH:mm')}
                </p>
              </div>
            );
          })()}
          <p className="text-xs text-muted-foreground">
            L&apos;operazione è definitiva e non può essere annullata. Per uno storico, imposta lo stato su <strong>Annullata</strong> invece di eliminare.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={pending}>
              Annulla
            </Button>
            <Button
              onClick={performDelete}
              disabled={pending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {pending ? 'Elimino…' : 'Elimina definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
