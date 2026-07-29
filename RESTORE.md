# Ripristino del database da backup

Procedura verificata il 2026-07-28 con un ripristino completo end-to-end su un
progetto Supabase separato: tutti i conteggi delle tabelle hanno combaciato
esattamente con l'export di produzione.

## 1. Backup (sola lettura, sicuro da eseguire in qualsiasi momento)

```
node scripts/db-export.mjs
```

Salva un JSON in `backup/db-export-<timestamp>.json`. Legge solo dal DB puntato
da `DATABASE_URL` in `.env` — nessuna scrittura.

## 2. Ripristino su un database nuovo/vuoto

Le migrazioni **non si ricostruiscono in modo pulito da zero** — servono due
correzioni manuali per modifiche fatte in passato direttamente sul database di
produzione, mai catturate in una migrazione vera. Finché non viene creata una
migrazione ufficiale che le include, seguire questi passaggi nell'ordine:

```
# 1. Applica le migrazioni: si ferma su 20260519140000_service_sort_order
DATABASE_URL="<url-nuovo-db>" DIRECT_URL="<url-diretto-nuovo-db>" npx prisma migrate deploy

# 2. Fix bug "forAnimal" (colonna mai creata da nessuna migrazione)
npx prisma db execute --url "<url-diretto-nuovo-db>" \
  --stdin <<< 'ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "forAnimal" TEXT;'

# 3. Applica manualmente il contenuto della migrazione bloccata
npx prisma db execute --file "prisma/migrations/20260519140000_service_sort_order/migration.sql" \
  --url "<url-diretto-nuovo-db>"

# 4. Segna la migrazione come applicata
DATABASE_URL="<url-nuovo-db>" DIRECT_URL="<url-diretto-nuovo-db>" \
  npx prisma migrate resolve --applied 20260519140000_service_sort_order

# 5. Continua con le migrazioni restanti
DATABASE_URL="<url-nuovo-db>" DIRECT_URL="<url-diretto-nuovo-db>" npm run db:deploy

# 6. Fix bug "dogSize" (vincolo NOT NULL mai rimosso da una migrazione)
npx prisma db execute --url "<url-diretto-nuovo-db>" \
  --stdin <<< 'ALTER TABLE "Booking" ALTER COLUMN "dogSize" DROP NOT NULL;'

# 7. Import dei dati veri
DATABASE_URL="<url-nuovo-db>" node scripts/db-import.mjs backup/db-export-<timestamp>.json
```

`db-import.mjs` usa `createMany({ skipDuplicates: true })`: è sicuro rilanciarlo
più volte, non sovrascrive né cancella righe già presenti.

## Nota

I due fix manuali (`forAnimal`, `dogSize`) andrebbero risolti con una migrazione
Prisma vera nel repo, così questi passaggi a mano non servirebbero più. Rimandato
di proposito: richiede di toccare la tabella di tracciamento migrazioni anche sul
database di produzione, da fare come intervento a parte con un backup fresco
dedicato, non incastrato in mezzo ad altro lavoro.
