'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export type TabItem = {
  key: string;
  label: string;
  icon?: string;
};

export function TabsNav({ tabs, defaultKey }: { tabs: TabItem[]; defaultKey: string }) {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const active = searchParams?.get('tab') ?? defaultKey;

  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {tabs.map((t) => {
        const isActive = t.key === active;
        const href = t.key === defaultKey ? pathname : `${pathname}?tab=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
            className="-mb-px rounded-t-md px-3 py-2 text-sm font-medium transition-colors"
            style={{
              color: isActive ? 'var(--sage-800)' : 'var(--ink-500)',
              borderBottom: isActive ? '2px solid var(--sage-800)' : '2px solid transparent',
              background: isActive ? 'var(--sage-100)' : 'transparent',
            }}
          >
            {t.icon && <span className="mr-1">{t.icon}</span>}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
