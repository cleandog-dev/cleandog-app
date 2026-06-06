'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import type { Booking, Service, BookingStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { APP_TIMEZONE, formatEUR, animalLabel } from '@/lib/utils';
import type { ClientDetail as ClientDetailType } from '@/lib/clients';
import { BookingDetailDialog } from '@/components/admin/BookingDetailDialog';

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

export function ClientDetail({ client }: { client: ClientDetailType }) {
  const [selected, setSelected] = useState<Row | null>(null);

  const waPhone = client.phone.replace(/[^\d+]/g, '').replace(/^\+/, '');

  function fmtDate(d: Date): string {
    return format(toZonedTime(d, APP_TIMEZONE), 'd MMM yyyy', { locale: it });
  }

  function fmtFreq(days: number | null): string {
    if (days == null) return '—';
    if (days < 14) return `ogni ${Math.round(days)} giorni`;
    if (days < 60) return `ogni ${Math.round(days / 7)} settimane`;
    return `ogni ${Math.round(days / 30)} mesi`;
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/clienti" className="text-xs text-muted-foreground hover:underline">
          ← Torna a Clienti
        </Link>
      </div>

      {/* Hero */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--sage-100)' }}>
        <h1 className="text-2xl font-bold leading-tight">{client.name || 'Cliente senza nome'}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <a href={`tel:${client.phone}`} className="hover:underline">📞 {client.phone}</a>
          {waPhone && (
            <a
              href={`https://wa.me/${waPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: '#128C7E' }}
            >
              💬 WhatsApp
            </a>
          )}
          {client.email && (
            <a href={`mailto:${client.email}`} className="text-muted-foreground hover:underline">
              ✉ {client.email}
            </a>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Visite" value={String(client.totalBookings)} />
        <StatCard label="Speso" value={formatEUR(client.totalSpentCents)} />
        <StatCard label="Ultima" value={fmtDate(client.lastVisit)} />
        <StatCard label="Frequenza" value={fmtFreq(client.avgGapDays)} />
      </div>

      {/* Animals */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Animali ({client.animals.length})
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {client.animals.map((a) => (
            <div key={a.key} className="rounded-lg border bg-background p-3">
              <p className="font-medium">{a.dogName || a.dogBreed || 'Senza nome'}</p>
              <p className="text-xs text-muted-foreground">
                {a.dogBreed ?? '—'}
                {a.dogSize && ` · ${a.dogSize}`}
                {a.coatChoice && ` · ${a.coatChoice === 'LONG' ? 'pelo lungo' : 'pelo corto'}`}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {a.visitsCount} {a.visitsCount === 1 ? 'visita' : 'visite'} · ultima {fmtDate(a.lastVisit)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* History */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Storico ({client.bookings.length})
        </h2>
        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Animale</th>
                <th className="px-3 py-2 text-left hidden sm:table-cell">Servizio</th>
                <th className="px-3 py-2 text-left">Stato</th>
                <th className="px-3 py-2 text-right">Prezzo</th>
              </tr>
            </thead>
            <tbody>
              {client.bookings.map((b) => {
                const local = toZonedTime(b.startsAt, APP_TIMEZONE);
                return (
                  <tr
                    key={b.id}
                    className="cursor-pointer border-t hover:bg-muted/20"
                    onClick={() => setSelected(b as Row)}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{format(local, 'dd/MM/yyyy')}</div>
                      <div className="text-xs text-muted-foreground">{format(local, 'HH:mm')}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{animalLabel(b)}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">{b.service.name}</div>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell max-w-[200px]">
                      <span className="line-clamp-2 text-xs">{b.serviceName || b.service.name}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={statusVariant[b.status]}>{statusLabel[b.status]}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-mono">{formatEUR(b.priceCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pagina Clienti è ADMIN-only (vedi guard in app/admin/clienti/page.tsx),
          quindi l'utente che apre questo dialog è sempre ADMIN. */}
      <BookingDetailDialog booking={selected} onClose={() => setSelected(null)} isAdmin />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold sm:text-base">{value}</p>
    </div>
  );
}
