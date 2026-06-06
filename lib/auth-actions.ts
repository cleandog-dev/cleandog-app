'use server';

import { signIn, signOut, auth } from '@/lib/auth';
import { LoginSchema } from '@/lib/schema';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

export async function loginAction(
  raw: { email: string; password: string },
): Promise<{ ok: boolean; error?: string }> {
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Credenziali non valide' };

  try {
    // redirect: false → non lanciare NEXT_REDIRECT qui, così possiamo
    // leggere la sessione e decidere noi la destinazione in base al ruolo.
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: 'Email o password errati' };
    }
    throw e;
  }

  // Sessione appena creata: leggi il ruolo e instrada di conseguenza.
  const session = await auth();
  const dest = session?.user?.role === 'STAFF' ? '/admin/staff' : '/admin';
  redirect(dest); // throw NEXT_REDIRECT
}

export async function logoutAction() {
  await signOut({ redirectTo: '/login' });
}
