import Link from 'next/link';

export const metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-12">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Home
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Privacy policy</h1>
      <div className="prose mt-6 space-y-4 text-sm text-foreground">
        <p>
          I dati raccolti tramite il modulo di prenotazione (nome, email, telefono, dati del cane,
          eventuali note) sono trattati esclusivamente per la gestione dell'appuntamento di
          toelettatura.
        </p>
        <p>
          <strong>Titolare:</strong> Cleandog · <strong>Base giuridica:</strong> esecuzione di un
          contratto. <strong>Conservazione:</strong> 24 mesi dalla data dell'appuntamento.
        </p>
        <p>
          Diritti dell'interessato: accesso, rettifica, cancellazione, portabilità, opposizione.
          Per esercitarli scrivi all'indirizzo indicato nei contatti.
        </p>
        <p>
          Non condividiamo i dati con terze parti, fatta eccezione per i fornitori tecnici
          necessari (hosting, invio email) vincolati da accordi di trattamento dati.
        </p>
      </div>
    </div>
  );
}
