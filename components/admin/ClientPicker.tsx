'use client';

import { useEffect, useRef, useState } from 'react';
import { listClientsAction, getClientDetailAction } from '@/lib/actions';
import type { ClientSummary, ClientDetail, ClientAnimal } from '@/lib/clients';
import { formatEUR } from '@/lib/utils';

export type PickerSelection = {
  client: ClientSummary;
  detail: ClientDetail | null;
  animal: ClientAnimal | null;
};

export function ClientPicker({
  onPick,
  selected,
  onClear,
}: {
  onPick: (sel: PickerSelection) => void;
  selected: ClientSummary | null;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // For animal sub-picker (rendered AFTER selection)
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (selected) return; // skip search while a client is selected
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const r = await listClientsAction({ search: query.trim(), limit: 8 });
        if (r.ok) setResults(r.data.clients);
        else setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  async function handlePick(client: ClientSummary) {
    setOpen(false);
    setLoadingDetail(true);
    let resolved: ClientDetail | null = null;
    try {
      const r = await getClientDetailAction(client.phoneKey);
      if (r.ok) resolved = r.data.client;
    } finally {
      setLoadingDetail(false);
    }
    setDetail(resolved);
    const animals = resolved?.animals ?? [];
    // If only one animal, auto-apply animal selection. Else parent picks.
    const auto = animals.length === 1 ? animals[0]! : null;
    onPick({ client, detail: resolved, animal: auto });
  }

  function pickAnimal(a: ClientAnimal | null) {
    if (!selected) return;
    onPick({ client: selected, detail, animal: a });
  }

  if (selected) {
    return (
      <div className="space-y-2 rounded-md border bg-emerald-50 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-emerald-800">Cliente selezionato</p>
            <p className="truncate font-semibold">{selected.name || '—'}</p>
            <p className="text-xs text-muted-foreground">
              {selected.phone} · {selected.totalBookings} visite · {formatEUR(selected.totalSpentCents)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setDetail(null); setQuery(''); setResults([]); onClear(); }}
            className="text-xs text-muted-foreground hover:underline"
          >
            Cambia
          </button>
        </div>

        {loadingDetail ? (
          <p className="text-xs text-muted-foreground">Carico animali…</p>
        ) : detail && detail.animals.length >= 2 ? (
          <div className="space-y-1.5 pt-2">
            <p className="text-xs font-medium">Scegli animale:</p>
            <div className="flex flex-wrap gap-1.5">
              {detail.animals.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => pickAnimal(a)}
                  className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-emerald-100"
                >
                  {a.dogName || a.dogBreed || 'Senza nome'}
                  {a.dogBreed && a.dogName ? ` (${a.dogBreed})` : ''}
                  <span className="ml-1 text-muted-foreground">{a.visitsCount}×</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => pickAnimal(null)}
                className="rounded-full border-2 border-dashed border-emerald-500 px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
              >
                + Nuovo animale
              </button>
            </div>
          </div>
        ) : detail && detail.animals.length === 1 ? (
          <p className="text-xs text-muted-foreground">
            Animale autocompilato: <strong>{detail.animals[0]!.dogName || detail.animals[0]!.dogBreed}</strong>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <input
        type="search"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        placeholder="Cerca cliente per nome o telefono…"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {open && query.trim().length >= 1 && (
        <div className="rounded-md border bg-background shadow-sm">
          {loading ? (
            <p className="p-3 text-xs text-muted-foreground">Cerco…</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              Nessun cliente trovato. Usa il tab &quot;Nuovo cliente&quot; per crearne uno.
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto divide-y">
              {results.map((c) => (
                <li key={c.phoneKey}>
                  <button
                    type="button"
                    onClick={() => handlePick(c)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {c.totalBookings}×
                      <div className="text-[10px]">{formatEUR(c.totalSpentCents)}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
