import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/lib/auth-actions';
import { Logo } from '@/components/Logo';
import { AdminNavDesktop, AdminNavMobile } from '@/components/admin/AdminNav';
import { PushSubscribe } from '@/components/PushSubscribe';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream-100)' }}>
      <header className="app-chrome">
        <div className="mx-auto max-w-screen-lg px-3 sm:px-5">
          <div className="flex h-12 sm:h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/admin/dashboard">
                <Logo size={24} href={null} />
              </Link>
              <AdminNavDesktop />
            </div>
            <form action={logoutAction}>
              <button type="submit" className="btn-ghost" style={{ color: 'var(--ink-500)', padding: '6px 12px', fontSize: 13 }}>
                Esci
              </button>
            </form>
          </div>
          <AdminNavMobile />
        </div>
      </header>
      <main className="mx-auto max-w-screen-lg px-3 py-4 sm:px-5 sm:py-8">
        <div className="mb-4">
          <PushSubscribe scope="ADMIN" />
        </div>
        {children}
      </main>
    </div>
  );
}
