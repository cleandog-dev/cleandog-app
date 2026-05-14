'use server';

import { signIn, signOut } from '@/lib/auth';
import { LoginSchema } from '@/lib/schema';
import { AuthError } from 'next-auth';

export async function loginAction(
  raw: { email: string; password: string },
): Promise<{ ok: boolean; error?: string }> {
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Credenziali non valide' };

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: '/admin/dashboard',
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: 'Email o password errati' };
    }
    throw e;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: '/login' });
}
