'use client';

import { useEffect, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { Booking, Service, BookingStatus } from '@prisma/client';
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
}: {
  booking: Row | null;
  onClose: () => void;
  initialMode?: 'view' | 'edit';
}) {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [slots, setSlots] = useState<DaySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const editDateOnly = editStartsAt.split('T')[0];
  const editTimeOnly = editStartsAt.split('T')[1]?.slice(0, 5) || '';
  const originalTimeOnly = booking ? format(toZonedTime(booking.startsAt, APP_TIMEZONE), 'HH:mm') : '';
  const originalDateOnly = booking ? format(toZonedTime(booking.startsAt, APP_TIMEZONE), 'yyyy-MM-dd') : '';

  useEffect(() => {
    if (booking) {
      setEditStartsAt(toLocalInput(booking.startsAt));
      setEditNotes(booking.notes ?? '');
      setMode(initialMode);
    }
    // Intentionally key on booking.id only — full booking ref churns each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, initialMode]);

  useEffect(() => {
    if (!booking || mode !== 'edit' || !editDateOnly) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    getDayOverviewAction({ serviceId: booking.service.id, date: editDateOnly })
      .then((r) => {
        if (cancelled) return;
        setSlots(r.ok ? r.data : []);
      })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, mode, editDateOnly]);

  function handleClose() {
    setMode('view');
    onClose();
  }

  function saveEdit() {
    if (!booking) return;
    const utcISO = fromZonedTime(editStartsAt, APP_TIMEZONE).toISOString();
    startTransition(async () => {
      const r = await editBookingAction({
        bookingId: booking.id,
        startsAt: utcISO,
        notes: editNotes,
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
                    <div className="space-y-1.5">
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

                    <div className="space-y-1.5">
                      <Label>Orario</Label>
                      {slotsLoading ? (
                        <p className="text-xs text-muted-foreground">Carico orari…</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                            {slots.filter((s) => s.status !== 'outside').map((s) => {
                              const isSel = editTimeOnly === s.time;
                              const isSelf =
                                editDateOnly === originalDateOnly && s.time === originalTimeOnly;
                              const effectiveStatus = isSelf ? 'free' : s.status;
                              const isBusy = effectiveStatus === 'busy';
                              const isClosed = effectiveStatus === 'closed';
                              const cls = isSel
                                ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30'
                                : isBusy
                                  ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                                  : isClosed
                                    ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                                    : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100';
                              return (
                                <button
                                  key={s.time}
                                  type="button"
                                  title={
                                    isSelf
                                      ? 'Orario attuale'
                                      : isBusy
                                        ? `Occupato: ${s.busyWith}`
                                        : isClosed
                                          ? 'Chiuso'
                                          : 'Libero'
                                  }
                                  onClick={() => setEditStartsAt(`${editDateOnly}T${s.time}`)}
                                  className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${cls}`}
                                >
                                  {s.time}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded-sm bg-emerald-300" /> libero
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded-sm bg-red-300" /> occupato
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded-sm bg-amber-300" /> chiuso
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Durata: {booking.service.durationMin} min
                          </p>
                        </>
                      )}
                    </div>

                    <div className="space-y-1.5">
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
