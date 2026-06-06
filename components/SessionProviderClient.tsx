'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

// Client wrapper per esporre la sessione ai componenti che la richiedono via useSession().
// Usato in app/admin/layout.tsx per gating UI role-aware (es. toggle ADMIN-only).
export function SessionProviderClient({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
