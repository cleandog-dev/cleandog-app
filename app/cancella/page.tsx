import { ClientCancel } from '@/components/ClientCancel';

export const metadata = { title: 'Cancella prenotazione' };
export const dynamic = 'force-dynamic';

export default function CancellaPage() {
  return (
    <main className="min-h-screen" style={{ background: 'var(--cream-50)' }}>
      <div className="mx-auto max-w-md px-5 py-10">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--ink-700)' }}>
          Cancella prenotazione
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--ink-500)' }}>
          Inserisci il tuo numero di telefono per vedere le prenotazioni future.
        </p>
        <ClientCancel />
        <div className="mt-8 text-center">
          <a href="/" className="text-sm underline" style={{ color: 'var(--sage-800)' }}>
            Torna alla home
          </a>
        </div>
      </div>
    </main>
  );
}
