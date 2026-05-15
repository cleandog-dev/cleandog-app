'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV_ITEMS: Array<[string, string]> = [
  ['/admin/staff', 'Personale'],
  ['/admin/dashboard', 'Prenotazioni'],
  ['/admin/services', 'Servizi'],
  ['/admin/breeds', 'Razze'],
  ['/admin/extras', 'Extra'],
  ['/admin/hours', 'Orari'],
  ['/admin/export', 'Export'],
];

export function AdminNavDesktop() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-4 text-sm md:flex" style={{ color: 'var(--ink-500)' }}>
      {NAV_ITEMS.map(([href, label]) => {
        const active = pathname === href || pathname?.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className="transition-colors hover:text-ink-900"
            style={{
              color: active ? 'var(--sage-800)' : 'inherit',
              fontWeight: active ? 700 : 400,
              borderBottom: active ? '2px solid var(--sage-800)' : '2px solid transparent',
              paddingBottom: 2,
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminNavMobile() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 md:hidden" style={{ scrollbarWidth: 'none' }}>
      {NAV_ITEMS.map(([href, label]) => {
        const active = pathname === href || pathname?.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={{
              background: active ? 'var(--sage-800)' : 'var(--cream-200)',
              color: active ? 'white' : 'var(--ink-700)',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
