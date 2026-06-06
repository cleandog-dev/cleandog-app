import { LoginForm } from '@/components/admin/LoginForm';
import { Logo } from '@/components/Logo';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Accesso' };

export default async function LoginPage() {
  const session = await auth();
  // Già loggato: instrada direttamente in base al ruolo (no bounce via guard).
  if (session?.user) {
    redirect(session.user.role === 'STAFF' ? '/admin/staff' : '/admin');
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5" style={{ background: 'var(--cream-100)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size={48} />
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
