import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/lib/auth-actions';
import { Logo } from '@/components/Logo';
import { AdminNavDesktop, AdminNavMobile } from '@/components/admin/AdminNav';
import { PushSubscribe } from '@/components/PushSubscribe';
import { SessionProviderClient } from '@/components/SessionProviderClient';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;

  return (
    <SessionProviderClient session={session}>
    <div className="min-h-screen" style={{ background: 'var(--cream-100)' }}>
      <header className="app-chrome">
        <div className="mx-auto max-w-screen-lg px-3 sm:px-5">
          <div className="flex h-12 sm:h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/admin">
                <Logo size={24} href={null} />
              </Link>
              <AdminNavDesktop role={role} />
            </div>
            <form action={logoutAction}>
              <button type="submit" className="btn-ghost" style={{ color: 'var(--ink-500)', padding: '6px 12px', fontSize: 13 }}>
                Esci
              </button>
            </form>
          </div>
          <AdminNavMobile role={role} />
        </div>
      </header>
      <main className="mx-auto max-w-screen-lg px-3 py-4 sm:px-5 sm:py-8">
        {/* Push notifications: ADMIN + STAFF ricevono le stesse notifiche
            sugli appuntamenti. All'eliminazione di un account staff le sue
            subscription vengono rimosse (deleteStaffUserAction) e pushToAdmins
            scarta comunque le subscription con userId orfano. */}
        <div className="mb-4">
          <PushSubscribe scope="ADMIN" />
        </div>
        {children}
      </main>
    </div>
    </SessionProviderClient>
  );
}
