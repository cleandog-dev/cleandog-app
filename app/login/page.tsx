import { LoginForm } from '@/components/admin/LoginForm';
import { Logo } from '@/components/Logo';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Accesso' };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/admin/dashboard');

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
