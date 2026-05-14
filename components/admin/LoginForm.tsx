'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginInput } from '@/lib/schema';
import { loginAction } from '@/lib/auth-actions';

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  function onSubmit(values: LoginInput) {
    setError(null);
    startTransition(async () => {
      const r = await loginAction(values);
      if (!r.ok) setError(r.error ?? 'Errore');
    });
  }

  return (
    <div className="card-cd" style={{ padding: '32px 28px' }}>
      <p className="eyebrow mb-2">Area riservata</p>
      <h1 className="display mb-6" style={{ fontSize: 28, color: 'var(--ink-900)' }}>Accedi</h1>
      <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="label">Email</label>
          <input className="input-cd" type="email" autoComplete="email" {...form.register('email')} />
          {form.formState.errors.email?.message && (
            <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{form.formState.errors.email.message}</p>
          )}
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input-cd" type="password" autoComplete="current-password" {...form.register('password')} />
          {form.formState.errors.password?.message && (
            <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{form.formState.errors.password.message}</p>
          )}
        </div>
        {error && <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary justify-center"
          style={{ width: '100%', marginTop: 8, padding: '14px 28px', fontSize: 15 }}
        >
          {pending ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
    </div>
  );
}
