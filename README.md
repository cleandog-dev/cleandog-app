# CleanDOG 🐾🐱

Web app prenotazione e gestione appuntamenti per servizi di lavaggio e toelettatura **cani e gatti**.

## Logo + PWA

Salva il tuo logo come `public/logo.png` (qualunque dimensione, viene scalato).

Genera le icone PWA:
```bash
npm i -D sharp
node scripts/generate-icons.mjs
```
Oppure usa https://realfavicongenerator.net (vedi `scripts/generate-icons.md`).

## Stack
- Next.js 14 (App Router, RSC, Server Actions)
- TypeScript strict
- PostgreSQL + Prisma
- NextAuth v5 (Credentials)
- Tailwind + shadcn/ui
- Zod validation
- Resend (email)
- Timezone: `Europe/Rome`

## Setup locale (Windows / Mac / Linux)

### 1. Prerequisiti
- Node.js ≥ 20
- PostgreSQL locale, oppure account su Neon / Supabase / Railway (gratis)

### 2. Install
```bash
npm install
```

### 3. Configura `.env`
```bash
cp .env.example .env
```
Compila almeno:
- `DATABASE_URL` (es. `postgresql://postgres:postgres@localhost:5432/cleandog`)
- `AUTH_SECRET` — genera con: `openssl rand -base64 32` (oppure usa qualunque stringa lunga 32+ char)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — credenziali admin iniziali
- `NEXT_PUBLIC_APP_URL` — URL pubblico (in dev `http://localhost:3000`)

Opzionale (per email reali):
- `RESEND_API_KEY` (registrati su [resend.com](https://resend.com))
- `EMAIL_FROM`

### 4. DB + seed
```bash
npm run db:migrate         # crea tabelle
npm run db:seed            # admin + servizi demo + orari
```

### 5. Dev
```bash
npm run dev
```
- Frontend: http://localhost:3000
- Login admin: http://localhost:3000/login

## Scripts

| Cmd | Cosa fa |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build production |
| `npm run start` | Start production |
| `npm run lint` | ESLint |
| `npm run type-check` | tsc --noEmit |
| `npm run db:migrate` | Migrazione DB (dev) |
| `npm run db:deploy` | Migrazione DB (prod) |
| `npm run db:seed` | Seed |
| `npm run db:studio` | Prisma Studio (GUI DB) |

## Struttura

```
app/
  page.tsx              Landing
  prenota/              Flusso 3 step
  login/                Login admin
  admin/                Area protetta
    dashboard/          Lista prenotazioni
    services/           CRUD servizi
    closures/           CRUD chiusure
    export/csv/         Export CSV
  api/
    availability/       Slot disponibili
    book/               Crea prenotazione
    auth/[...nextauth]/ NextAuth handler
components/
  ui/                   shadcn primitives
  booking/              Step prenotazione
  admin/                Tabelle/form admin
lib/
  db.ts                 Prisma client
  schema.ts             Zod
  actions.ts            Server Actions (booking + admin)
  auth.ts               NextAuth config
  availability.ts       Calcolo slot
  email.ts              Resend
  rate-limit.ts         In-memory rate limit
prisma/
  schema.prisma
  seed.ts
```

## Deploy su Vercel (più semplice)

### 1. DB managed
Crea un PostgreSQL gratuito su uno di:
- [Neon](https://neon.tech) (consigliato)
- [Supabase](https://supabase.com)
- [Railway](https://railway.app)

Copia la `DATABASE_URL`.

### 2. Push su GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TUO_USER/cleandog-app.git
git push -u origin main
```

### 3. Importa su Vercel
- vercel.com → New Project → Import GitHub repo
- **Environment Variables** (copia da `.env.example`):
  - `DATABASE_URL`
  - `AUTH_SECRET`
  - `AUTH_URL` = `https://TUO-DOMINIO.vercel.app`
  - `AUTH_TRUST_HOST` = `true`
  - `ADMIN_EMAIL`, `ADMIN_PASSWORD`
  - `NEXT_PUBLIC_APP_URL` = `https://TUO-DOMINIO.vercel.app`
  - `RESEND_API_KEY` (opzionale)
  - `EMAIL_FROM` (opzionale)
- Deploy

### 4. Migra DB in produzione
Dal tuo terminale locale, con `.env` puntato al DB di produzione:
```bash
npm run db:deploy
npm run db:seed
```
Oppure aggiungi `prisma migrate deploy` allo script `build` (già presente: `prisma generate && next build` — espandere se vuoi `migrate deploy` automatico).

## Checklist pre-produzione

- [ ] `.env` con valori reali
- [ ] `AUTH_SECRET` forte (`openssl rand -base64 32`)
- [ ] DB migrato + seed eseguito
- [ ] Password admin cambiata dopo il primo login
- [ ] Dominio email verificato su Resend (per evitare spam)
- [ ] Test prenotazione end-to-end
- [ ] Test double-booking (apri 2 tab, conferma stesso slot)
- [ ] Test mobile (320px → 1440px)
- [ ] Lighthouse ≥ 90

## Troubleshooting

**`PrismaClient is unable to be run in the browser`** → assicurati che `lib/db.ts` non sia importato da componenti `'use client'`.

**Login non funziona** → verifica `AUTH_SECRET`, `AUTH_URL`, e che il seed sia stato eseguito.

**Email non arriva** → senza `RESEND_API_KEY` viene saltata silenziosamente (controlla logs `console.warn`). Configura Resend e verifica dominio.

**Conflitto slot** → atteso: se due utenti scelgono lo stesso slot in contemporanea, solo uno passa (transazione `Serializable` + `@@unique`).

## Estensioni future
- SMS reminder (Twilio)
- Pagamento online (Stripe)
- Multi-staff scheduling (split bookings per operatore)
- Recensioni + foto prima/dopo
- Endpoint GDPR data export per cliente
