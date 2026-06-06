'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE, formatEUR } from '@/lib/utils';
import type { ClientSummary } from '@/lib/clients';

type SortKey = 'name' | 'phone' | 'visits' | 'lastVisit' | 'spent';
type SortDir = 'asc' | 'desc';
type Sort = { key: SortKey; dir: SortDir };

// Default direction when first clicking a column: text → asc, number/date → desc.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: 'asc',
  phone: 'asc',
  visits: 'desc',
  lastVisit: 'desc',
  spent: 'desc',
};

export function ClientsList({ clients }: { clients: ClientSummary[] }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'lastVisit', dir: 'desc' });
  // Avoid hydration mismatch: relative dates depend on client clock; render
  // only after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    const qDigits = q.replace(/[^\d]/g, '');
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (qDigits.length > 0 && (c.phoneKey.includes(qDigits) || c.phone.includes(qDigits))),
    );
  }, [clients, search]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    const dirMul = sort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case 'name':
          cmp = (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
          break;
        case 'phone':
          cmp = (a.phone || '').localeCompare(b.phone || '', 'it', { numeric: true });
          break;
        case 'visits':
          cmp = a.totalBookings - b.totalBookings;
          break;
        case 'lastVisit':
          cmp = a.lastVisit.getTime() - b.lastVisit.getTime();
          break;
        case 'spent':
          cmp = a.totalSpentCents - b.totalSpentCents;
          break;
      }
      return cmp * dirMul;
    });
    return arr;
  }, [filtered, sort]);

  function toggleSort(key: SortKey) {
    setSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: DEFAULT_DIR[key] },
    );
  }

  function fmtDate(d: Date): string {
    return format(toZonedTime(d, APP_TIMEZONE), 'd MMM yyyy', { locale: it });
  }

  function fmtRelative(d: Date): string {
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days <= 0) return 'oggi';
    if (days === 1) return 'ieri';
    if (days < 30) return `${days} g fa`;
    if (days < 365) return `${Math.floor(days / 30)} mesi fa`;
    return `${Math.floor(days / 365)} anni fa`;
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Cerca per nome o telefono…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          {search ? 'Nessun cliente trovato.' : 'Nessun cliente in archivio.'}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {sorted.length} {sorted.length === 1 ? 'cliente' : 'clienti'}
            {search && ` su ${clients.length}`}
          </p>
          <div className="overflow-x-auto rounded-lg border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <SortableHeader sortKey="name"      align="left"   current={sort} onSort={toggleSort}>Cliente</SortableHeader>
                  <SortableHeader sortKey="phone"     align="left"   current={sort} onSort={toggleSort} className="hidden sm:table-cell">Telefono</SortableHeader>
                  <SortableHeader sortKey="visits"    align="center" current={sort} onSort={toggleSort}>Visite</SortableHeader>
                  <SortableHeader sortKey="lastVisit" align="left"   current={sort} onSort={toggleSort}>Ultima</SortableHeader>
                  <SortableHeader sortKey="spent"     align="right"  current={sort} onSort={toggleSort}>Speso</SortableHeader>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c.phoneKey} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-3">
                      <Link href={`/admin/clienti/${c.phoneKey}`} className="block">
                        <div className="font-medium">{c.name || '—'}</div>
                        <div className="text-xs text-muted-foreground sm:hidden">{c.phone}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.animalsCount} {c.animalsCount === 1 ? 'animale' : 'animali'}
                          {c.activeBookings > 0 && ` · ${c.activeBookings} attive`}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <Link href={`/admin/clienti/${c.phoneKey}`} className="text-muted-foreground">
                        {c.phone}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-xs">
                      <Link href={`/admin/clienti/${c.phoneKey}`}>{c.totalBookings}</Link>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/admin/clienti/${c.phoneKey}`}>
                        <div className="text-xs">{fmtDate(c.lastVisit)}</div>
                        <div className="text-[10px] text-muted-foreground" suppressHydrationWarning>
                          {mounted ? fmtRelative(c.lastVisit) : ''}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link href={`/admin/clienti/${c.phoneKey}`} className="font-medium">
                        {formatEUR(c.totalSpentCents)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SortableHeader({
  sortKey,
  align,
  current,
  onSort,
  className,
  children,
}: {
  sortKey: SortKey;
  align: 'left' | 'center' | 'right';
  current: Sort;
  onSort: (k: SortKey) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isActive = current.key === sortKey;
  const arrow = isActive ? (current.dir === 'asc' ? '↑' : '↓') : '↕';
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const justifyCls = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th className={`px-3 py-2 ${alignCls} ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide transition-colors hover:text-foreground ${justifyCls} ${
          isActive ? 'text-foreground' : ''
        }`}
        title={`Ordina per ${typeof children === 'string' ? children.toLowerCase() : ''}`}
      >
        <span>{children}</span>
        <span className={`text-[10px] ${isActive ? 'opacity-100' : 'opacity-40'}`}>{arrow}</span>
      </button>
    </th>
  );
}
