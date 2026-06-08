'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './listino.module.css';

export type ListinoBreed = {
  name: string;
  size: 'piccola' | 'media' | 'grande';
  price: number; // euro
};

export type FeaturedService = { name: string; min: number; max: number };

export type ListinoProps = {
  dogs: ListinoBreed[];
  cats: { min: number; max: number };
  // Servizi aggiuntivi in evidenza (Spuntatura, Tosatura, Toeletta completa).
  // Array vuoto se nessuno ha prezzi configurati nel DB.
  featured: FeaturedService[];
  included: string[];
};

const SIZE_ORDER: Array<'piccola' | 'media' | 'grande'> = ['piccola', 'media', 'grande'];
const SIZE_META: Record<'piccola' | 'media' | 'grande', { label: string; dot: number }> = {
  piccola: { label: 'Taglia Piccola', dot: 7 },
  media: { label: 'Taglia Media', dot: 11 },
  grande: { label: 'Taglia Grande', dot: 15 },
};

const euro = (n: number) => `€${n}`;

// Normalizza per ricerca: lowercase + via accenti.
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const nText = norm(text);
  const nQ = norm(query);
  const i = nText.indexOf(nQ);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className={styles.mark}>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

export function ListinoClient({ dogs, cats, featured, included }: ListinoProps) {
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<'all' | 'piccola' | 'media' | 'grande'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const nQ = norm(query.trim());
    return dogs.filter((b) => {
      if (size !== 'all' && b.size !== size) return false;
      if (nQ && !norm(b.name).includes(nQ)) return false;
      return true;
    });
  }, [dogs, query, size]);

  const grouped = useMemo(() => {
    const g: Record<'piccola' | 'media' | 'grande', ListinoBreed[]> = {
      piccola: [], media: [], grande: [],
    };
    for (const b of filtered) g[b.size].push(b);
    return g;
  }, [filtered]);

  const total = filtered.length;
  const chips: Array<{ id: 'all' | 'piccola' | 'media' | 'grande'; label: string }> = [
    { id: 'all', label: 'Tutte' },
    { id: 'piccola', label: 'Piccola' },
    { id: 'media', label: 'Media' },
    { id: 'grande', label: 'Grande' },
  ];

  return (
    <div className={styles.page}>
      {/* Brand header */}
      <header className={styles.brand}>
        <div className={styles.wordmark} aria-label="CleanDOG">
          <span className={styles.wordmarkClean}>Clean</span>
          <span className={styles.wordmarkDog}>DOG</span>
        </div>
        <p className={styles.tagline}>Bagno &amp; Toelettatura · Cani &amp; Gatti</p>
        <span className={styles.rule} aria-hidden="true" />
        <h1 className={`display ${styles.title}`}>Listino Prezzi</h1>
      </header>

      {/* Sempre compreso */}
      <section className={styles.included} aria-labelledby="included-title">
        <h2 id="included-title" className={styles.includedTitle}>Sempre compreso nel prezzo</h2>
        <ul className={styles.includedList}>
          {included.map((item) => (
            <li key={item}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Sticky controls: search + chips + count */}
      <div className={styles.controls}>
        <div className={styles.controlsInner}>
          <div className={styles.searchbar}>
            <svg className={styles.searchicon} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              placeholder="Cerca la razza del tuo cane…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Cerca razza"
            />
            {query && (
              <button
                type="button"
                className={styles.clear}
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                aria-label="Cancella ricerca"
              >
                ×
              </button>
            )}
          </div>
          <div className={styles.chips} role="group" aria-label="Filtro per taglia">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${styles.chip} ${size === c.id ? styles.chipOn : ''}`}
                onClick={() => setSize(c.id)}
                aria-pressed={size === c.id}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className={styles.count} aria-live="polite">
            {total === 0 ? 'Nessun risultato' : `${total} razze`}
          </div>
        </div>
      </div>

      <main className={styles.listino}>
        {total === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Nessuna razza trovata</p>
            <p className={styles.emptySub}>
              Prova un altro nome oppure scrivici: troviamo noi la tariffa giusta per il tuo amico.
            </p>
            <button
              type="button"
              className={styles.emptyReset}
              onClick={() => { setQuery(''); setSize('all'); inputRef.current?.focus(); }}
            >
              Azzera la ricerca
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {SIZE_ORDER.map((s) => {
              const breeds = grouped[s];
              if (!breeds.length) return null;
              const prices = breeds.map((b) => b.price);
              const min = Math.min(...prices);
              const max = Math.max(...prices);
              const range = min === max ? euro(min) : `${euro(min)}–${euro(max)}`;
              return (
                <section key={s} className={styles.section}>
                  <header className={styles.sectionHead}>
                    <div className={styles.sectionTitle}>
                      <span className={styles.sizedot} aria-hidden="true">
                        <span
                          className={styles.sizedotRing}
                          style={{ width: SIZE_META[s].dot, height: SIZE_META[s].dot }}
                        />
                      </span>
                      <h2>{SIZE_META[s].label}</h2>
                    </div>
                    <div className={styles.sectionMeta}>
                      <span className={styles.sectionRange}>{range}</span>
                      <span className={styles.sectionCount}>{breeds.length} razze</span>
                    </div>
                  </header>
                  <ul className={styles.rows}>
                    {breeds.map((b) => (
                      <li key={`${b.size}-${b.name}`} className={styles.row}>
                        <span className={styles.rowName}>
                          <Highlight text={b.name} query={query} />
                        </span>
                        <span className={styles.rowPrice}>{euro(b.price)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Servizi aggiuntivi (Spuntatura/Tosatura/Toeletta completa).
          Stesso pattern della sezione Gatti. Solo quelli con prezzi nel DB. */}
      {featured.map((svc, i) => {
        const id = `featured-${i}`;
        return (
          <section key={svc.name} className={styles.cats} aria-labelledby={id}>
            <div className={styles.catsLeft}>
              <p className={styles.catsEyebrow}>Servizio aggiuntivo</p>
              <h2 id={id} className={styles.catsTitle}>{svc.name}</h2>
              <p className={styles.catsNote}>
                Prezzo variabile in base alla razza, alla taglia e alla lunghezza del pelo.
              </p>
            </div>
            <div className={styles.catsPrice}>
              <span className={styles.catsNum}>
                {svc.min === svc.max ? svc.min : `${svc.min} – ${svc.max}`}
              </span>
              <span className={styles.catsCur}>€</span>
            </div>
          </section>
        );
      })}

      {/* Sezione Gatti */}
      <section className={styles.cats} aria-labelledby="cats-title">
        <div className={styles.catsLeft}>
          <p className={styles.catsEyebrow}>Anche i gatti</p>
          <h2 id="cats-title" className={styles.catsTitle}>Gatti</h2>
          <p className={styles.catsNote}>
            Prezzo variabile in base alla taglia e alla lunghezza del pelo.
          </p>
        </div>
        <div className={styles.catsPrice}>
          <span className={styles.catsNum}>
            {cats.min === cats.max ? cats.min : `${cats.min} – ${cats.max}`}
          </span>
          <span className={styles.catsCur}>€</span>
        </div>
      </section>

      {/* CTA finale per conversione */}
      <section className={styles.cta}>
        <h2 className={`display ${styles.ctaTitle}`}>Pronto a prenotare?</h2>
        <p className={styles.ctaText}>
          Scegli data e orario in 3 minuti. Conferma immediata, promemoria automatici prima dell&apos;appuntamento.
        </p>
        <Link href="/prenota" className={`btn-primary ${styles.ctaButton}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Prenota appuntamento
        </Link>
        <a href="tel:0903354798" className={styles.ctaPhone}>
          oppure chiama 090 335 4798
        </a>
      </section>

      {/* Disclaimer prezzi: chiarisce che il listino è indicativo. */}
      <aside className={styles.disclaimer} role="note">
        <p>
          <strong>Nota.</strong> I prezzi indicati sono di riferimento e possono essere
          adeguati in negozio dai nostri operatori in base alle effettive condizioni
          dell&apos;animale (manto nodoso o sporco, taglie particolari, comportamento,
          esigenze specifiche). La tariffa finale viene sempre comunicata e concordata
          al momento del servizio.
        </p>
      </aside>

      <footer className={styles.foot}>
        <p className={styles.footLine}>Il benessere del tuo amico è la nostra missione</p>
      </footer>
    </div>
  );
}
