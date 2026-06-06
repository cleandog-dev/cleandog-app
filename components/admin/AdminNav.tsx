'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV_ITEMS: Array<[string, string]> = [
  ['/admin', 'Dashboard'],
  ['/admin/prenotazioni', 'Prenotazioni'],
  ['/admin/staff', 'Personale'],
  ['/admin/clienti', 'Clienti'],
  ['/admin/catalogo', 'Catalogo'],
  ['/admin/impostazioni', 'Impostazioni'],
];

// Voci accessibili allo STAFF. Deny-by-default: qualunque cosa fuori da
// questo set è ADMIN-only. Se `role` è undefined/strano, si comporta come STAFF.
const STAFF_ALLOWED = new Set(['/admin/prenotazioni', '/admin/staff']);

function navItemsForRole(role: 'ADMIN' | 'STAFF' | undefined): Array<[string, string]> {
  if (role === 'ADMIN') return NAV_ITEMS;
  return NAV_ITEMS.filter(([href]) => STAFF_ALLOWED.has(href));
}

function PendingFade({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span
      style={{
        opacity: pending ? 0.55 : 1,
        transition: 'opacity 140ms ease-out',
      }}
    >
      {children}
    </span>
  );
}

export function AdminNavDesktop({ role }: { role?: 'ADMIN' | 'STAFF' }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  return (
    <nav className="hidden items-center gap-4 text-sm md:flex" style={{ color: 'var(--ink-500)' }}>
      {items.map(([href, label]) => {
        const active = href === '/admin'
          ? pathname === '/admin'
          : pathname === href || pathname?.startsWith(href + '/');
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
            <PendingFade>{label}</PendingFade>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminNavMobile({ role }: { role?: 'ADMIN' | 'STAFF' }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 md:hidden" style={{ scrollbarWidth: 'none' }}>
      {items.map(([href, label]) => {
        const active = href === '/admin'
          ? pathname === '/admin'
          : pathname === href || pathname?.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: active ? 'var(--sage-100)' : 'transparent',
              color: active ? 'var(--sage-800)' : 'var(--ink-500)',
              border: active ? '1px solid var(--sage-300)' : '1px solid var(--cream-300)',
            }}
          >
            <PendingFade>{label}</PendingFade>
          </Link>
        );
      })}
    </nav>
  );
}
