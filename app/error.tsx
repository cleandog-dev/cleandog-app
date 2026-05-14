'use client';

import { Button } from '@/components/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Qualcosa è andato storto</h1>
      <p className="text-sm text-muted-foreground">
        {process.env.NODE_ENV === 'development' ? error.message : 'Errore inatteso.'}
      </p>
      <Button onClick={reset}>Riprova</Button>
    </div>
  );
}
