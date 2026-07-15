'use server';

import { signIn, signOut, auth } from '@/lib/auth';
import { LoginSchema } from '@/lib/schema';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rate-limit';

export async function loginAction(
  raw: { email: string; password: string },
): Promise<{ ok: boolean; error?: string }> {
  // Anti brute-force: 10 tentativi / 15 min per IP (best-effort, in-memory).
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown';
  const rl = rateLimit({ key: `login:${ip}`, limit: 10, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return { ok: false, error: 'Troppi tentativi. Riprova tra qualche minuto.' };
  }

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
