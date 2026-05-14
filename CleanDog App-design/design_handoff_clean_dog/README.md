# Handoff: Clean Dog · Booking Web App

## Overview
Clean Dog is a fully-automated dog grooming booking web app for an artisanal pet salon in Milan. The flagship flow is a **7-step booking wizard** that lets a customer choose dog details, services, date/time, and contact info, then receive **automated reminders** (SMS, WhatsApp, email) before and after the appointment. The app's voice is calm, natural, artisanal — "organic luxury".

The bundle also includes a built-in design system reference (color/type/components/motion/states) accessible from the Tweaks panel.

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes showing the intended look, motion, and behavior. They are **not production code to copy directly**.

Your task is to **recreate these designs in the target codebase's existing environment** (React/Next.js, Vue, SvelteKit, etc.) using its established patterns, component primitives, routing, and form libraries. If the project has no codebase yet, pick a stack that fits the requirements (suggested: Next.js 14 + Tailwind + react-hook-form + Zod + a date library like `date-fns`, plus a backend that can schedule reminders — e.g. a queue with cron-like triggers, Twilio for SMS/WhatsApp, Resend for email).

The HTML prototype is single-state (uses React state) — production should persist bookings server-side, expose an admin view (out of scope for this prototype), and run a scheduled job that fires reminders at the right offsets.

## Fidelity
**High-fidelity.** Pixel-perfect mocks with final colors, typography, spacing, motion, and copy. Recreate them faithfully. The Italian copy is final and ready for production.

## Screens / Views

The wizard has 7 sequential steps. The user can jump back via the "Indietro" button or via "modifica" affordances on the summary screen. The header (sticky, blurred cream) is shown on steps 2–6; the welcome and success screens are full-bleed.

### 01 · Welcome (`StepWelcome`)
- **Purpose**: brand intro + primary CTA to start booking.
- **Layout**: centered column, max-width 560px, top decorative paw cluster (1 large floating + 2 small ambient), eyebrow → display headline (clamp 44–72px) → body copy → primary CTA → microcopy row with two trust signals.
- **Components**:
  - Hero paw: `Icon name="paw" size={72}` in `--sage-800`, with a 140×140 radial-gradient halo (`--sage-100` → transparent) pulsing at 4s. Floats vertically (`floaty` 6s).
  - Two ambient paws (sizes 28 & 22), `--brown-700`, opacity 0.35–0.4, staggered float delays.
  - Headline: `Cormorant Garamond 500`, italic accent on second line in `--brown-700`.
  - CTA: `.btn-primary` with `arrowRight` icon, 16px / padding 16px 32px.
  - Trust row: clock icon "Conferma in 5 min" + bell icon "Promemoria automatici" — 13px, `--ink-500`.
  - Footer attribution at viewport bottom: "Via dei Glicini 12, Milano · Aperti Lun–Sab" (11px, uppercase, `--ink-500`, letter-spacing 0.12em).

### 02 · Il tuo cane (`StepDog`)
- **Purpose**: collect dog name, size, coat type.
- **Layout**: 640px max, vertical form. Standard `StepHeader` (eyebrow / display title / subtitle).
- **Components**:
  - Text input: dog name, autofocus.
  - **Size selector**: 5-column grid of `SelectTile` (`XS / S / M / L / XL`) — each tile shows a line-art dog silhouette (size-specific), the size code, and weight range (e.g. "5 – 10 kg").
  - **Coat selector**: 4-column responsive grid (`auto-fit minmax(140px, 1fr)`), wider tiles. Options: Corto / Medio / Lungo / Riccio, each with a coat-pattern icon + breed hint (e.g. "Beagle, Boxer").
  - SelectTile selected state: `card-selected` (sage border + inset ring), icon turns `--sage-800`.
- **Validation**: cannot proceed unless `dogName && size && coat`.

### 03 · Servizi (`StepServices`)
- **Purpose**: multi-select services with live total.
- **Layout**: 720px max, vertical stack of full-width service cards.
- **Components** — service card grid `52px 1fr auto`:
  - Icon tile (52×52, radius 14): bg switches to `--sage-100` or `--brown-100` when selected (per-service color).
  - Title row: name + optional `badge-brown` "Più richiesto" pill.
  - Description (13px, `--ink-500`).
  - Meta row: clock icon + duration in minutes.
  - Right column: price (`Cormorant Garamond` 26px, `--sage-800`) + `CheckCircle` (24px round, fills `--sage-800` with white check when on).
- **Live total card** (visible when ≥1 selected): `--sage-100` background, `--sage-300` border, shows count + total minutes + total euro.
- Service catalog (final copy/prices):
  | id | name | desc | €  | min | icon | color | popular |
  |----|------|------|----|-----|------|-------|---------|
  | bath | Bagno & Asciugatura | Shampoo naturale, asciugatura delicata | 28 | 45 | bath | sage | – |
  | cut | Taglio & Styling | Forbici, rifinitura su misura | 38 | 60 | scissors | brown | – |
  | full | Toelettatura completa | Bagno + taglio + unghie + orecchie | 58 | 90 | full | sage | ✓ |
  | nails | Solo unghie | Taglio e limatura, 15 minuti | 12 | 15 | nails | brown | – |
  | parasite | Anti-parassiti | Trattamento naturale anti-pulci e zecche | 22 | 30 | shield | sage | – |

### 04 · Data e Ora (`StepDate`)
- **Purpose**: pick a day in the next 14 days + a time slot.
- **Layout**: 640px max. Month strip header (capitalized month + "Prossimi 14 giorni" hint), then 7-col day chip grid, then slot grid (revealed once a date is picked).
- **Day chips**: square cards, day-of-week label (L M M G V S D, 10px, `--ink-500`), date number (`Cormorant Garamond` 22px). Sundays disabled with "chiuso" sublabel and reduced opacity. Selected = sage border + sage text.
- **Slots**: `09:00 / 10:00 / 11:00 / 12:00 / 14:30 / 15:30 / 16:30 / 17:30`. Auto-fit grid `minmax(110px, 1fr)`. Booked slots show line-through, disabled, opacity 0.6. (In prototype, "booked" is deterministic from date hash; production should call a real availability API.)

### 05 · Contatti (`StepContact`)
- **Purpose**: collect customer info + reminder preferences.
- **Layout**: 560px max, vertical form.
- **Fields**:
  - Nome e cognome (required, autofocus)
  - Telefono (required, `inputMode="tel"`, ≥9 digits)
  - Email (optional, `inputMode="email"`)
  - Note per il toelettatore (textarea, optional)
- **Reminder preferences card** (sage-tinted card, bell icon):
  - SMS · 24h prima (default on)
  - Email · 24h prima (disabled until email provided)
  - WhatsApp · 2h prima (default on)
- Native checkboxes with `accentColor: var(--sage-800)`.

### 06 · Riepilogo (`StepSummary`)
- **Purpose**: review and confirm.
- **Layout**: 600px max, single tall summary card with multiple dashed-divider rows.
- **Card sections (top → bottom)**:
  1. **Date hero** — sage-gradient header. Eyebrow "Appuntamento" with inline "modifica" ghost button (top-right). Date in `display` font (clamp 22–30px, `--sage-800`, capitalized, `text-wrap: balance`). Below: "alle HH:MM · circa N min".
  2. **Dog row** — `SummaryRow` with paw icon, "Pepe · M · Medio · pelo riccio" pattern, edit button.
  3. **Services list** — header row + each service line (icon + name on left, € on right, dashed dividers).
  4. **Contact row** — phone icon, "Nome · phone", optional email subline.
  5. **Reminders banner** — sage-tinted full-width strip, bell icon + "Riceverai un promemoria via SMS + WHATSAPP".
  6. **Total footer** — "Totale stimato · paghi in negozio" / `display` 36px price.
- **Notes card** (separate, only if notes filled): cream-tinted, italicized in quotes.
- **Footer**: "Indietro" ghost left, **"Conferma prenotazione"** primary right (with check icon, padding 16/28).

### 07 · Successo (`StepSuccess`)
- **Purpose**: confirmation + reassurance about reminders.
- **Layout**: 520px max, centered, full-bleed.
- **Anims**:
  - **Confetti** (24 pieces): emitted from top-center, randomly travel ±300px x / 200–600px y / ±270° rotation over 1.6s with stagger, 5 brand colors + 3 shapes (square / tall rect / circle).
  - **Check medallion**: 120×120 sage-tinted disc, pulse-soft 2.4s loop. SVG checkmark draws in via `stroke-dashoffset` (50→0) over 800ms, easing organic, 200ms delay.
- Headline: "A presto, [first name]!" (clamp 38–56px), italic name in `--brown-700`.
- Reassurance copy mentions the booked date + time + dog name.
- **Reminder card** (cream): bell-icon tile + "Promemoria automatici attivi" + reassurance.
- Secondary CTA: "Aggiungi al calendario" (calendar icon).
- Tertiary ghost link: "Prenota un altro appuntamento" → restart flow.

### Aux · Reminders Panel (`RemindersPanel`)
A modal accessible from the header bell button on every step. Shows the **automated reminder timeline** the user has scheduled. Production should populate this from the actual scheduled jobs.

Sequence rendered (in order):
1. **Subito · ora · EMAIL** — booking confirmation. Marked "inviato" with sage tint.
2. **24h prima · SMS** (if SMS enabled) — `🐾 Domani alle HH:MM aspettiamo [dog]…`
3. **2h prima · WHATSAPP** (if WhatsApp enabled) — address + countdown.
4. **Dopo il bagno · WHATSAPP** — "tutto pronto + foto in arrivo".
5. **4 settimane dopo · EMAIL** — re-engagement: "È ora di un altro bagno?"

Modal chrome: cream card, 480px max, sticky header, close button. Footer microcopy: "Tutti gli invii sono completamente automatici."

## Interactions & Behavior

### Step transitions
- **Enter**: `translateY(20px) → 0` + opacity 0 → 1, **620ms**, easing `cubic-bezier(0.34, 1.2, 0.42, 1)`. Triggered via `key={step}` on `<main>` so React remounts.
- **Hover card**: `translateY(-2px)` + shadow upgrade, **220ms** organic.
- **Tile selection**: border + inset-ring snap to sage; icon color shift; check-circle scales `0.95 → 1`, **220ms** organic.
- **Hero paw float**: 6s loop, ease-soft, ±8px / ±2°. Two ambient paws have staggered delays.
- **Hero halo pulse**: 4s, scale `1 → 1.04`, opacity `1 → 0.85`.
- **Confetti**: see step 7.
- **Success check draw**: see step 7.
- **Modal**: backdrop `rgba(31, 26, 20, 0.4)` + 6px blur, opens with `stepEnter` 0.3s.

### Form validation
- Step 2: `dogName && size && coat`
- Step 3: at least one service
- Step 4: `date && time` (Sundays disabled)
- Step 5: `userName && phone.replace(/\D/g, '').length >= 9`
- Submit (step 6): always enabled (data already validated upstream).
- Disabled primary buttons: `--ink-300` background, no shadow, no hover transform, `cursor: not-allowed`.

### Reminders / automation (production work)
The **core requirement of this app is full automation**. The frontend only collects preferences — the backend must:
1. On booking confirmation: write a row + immediately send the confirmation email.
2. Enqueue 4 scheduled jobs at offsets:
   - `appointmentTime − 24h` → SMS (if `reminders.includes('sms')`)
   - `appointmentTime − 24h` → email (if `reminders.includes('email')` && email present)
   - `appointmentTime − 2h` → WhatsApp (if `reminders.includes('whatsapp')`)
   - `appointmentTime + duration` → WhatsApp "all done" (groomer triggers manually OR auto from a "complete" admin action)
   - `appointmentTime + 4 weeks` → re-engagement email (always sent unless customer opts out)
3. Each reminder includes: customer first name, dog name, appointment time, salon address. Templates are in the prototype's `RemindersPanel` component (Italian copy is final).
4. Handle reschedule replies (the SMS template advertises "rispondi 1" to reschedule) — minimum: forward reply to salon staff inbox. Stretch: link out to a self-service reschedule URL.

Suggested vendor stack: **Twilio Programmable Messaging** (SMS + WhatsApp), **Resend** or **Postmark** (email), **BullMQ + Redis** or a managed queue (Upstash QStash / Inngest) for delayed jobs. A simple Postgres `bookings` + `reminders` schema is enough.

### Routing
The prototype uses React local state. In production, the wizard should live at `/prenota` with each step as either a URL segment (`/prenota/cane`, `/prenota/servizi`, …) for linkable / refresh-safe progress, or a single page that tracks step in `?step=`. Persist partial booking state in `sessionStorage` so a refresh mid-flow doesn't lose data.

### Responsive
The prototype is mobile-first and works down to ~360px. Key breakpoints come from `clamp()` on display headlines and `auto-fit minmax()` grids for service/coat tiles. No separate desktop layout is required — content stays a single column up through ~720px max-width.

## State Management

```ts
type BookingState = {
  dogName: string;
  size: 'XS' | 'S' | 'M' | 'L' | 'XL' | null;
  coat: 'short' | 'med' | 'long' | 'curly' | null;
  services: ServiceId[];           // multi-select
  date: string | null;             // ISO 'YYYY-MM-DD'
  time: string | null;             // 'HH:MM'
  userName: string;
  phone: string;
  email: string;
  notes: string;
  reminders: ('sms' | 'email' | 'whatsapp')[];
};
```

In production: lift to a server action / API route on submit. Persist partial state to `sessionStorage` keyed by something like `cleandog:wizard:v1`.

## Design Tokens

All tokens live as CSS custom properties in `styles.css` (`:root`). Mirror them into your theme system (Tailwind config, CSS Modules, MUI theme — whatever the codebase uses).

### Colors

**Sage (primary)**
- `--sage-900` `#2A4032`
- `--sage-800` `#3D5A47` ← primary brand
- `--sage-700` `#4A6B54`
- `--sage-600` `#5C7A5E`
- `--sage-300` `#A8BCA9`
- `--sage-100` `#DCE5DD`

**Brown (accent)**
- `--brown-800` `#5C4631`
- `--brown-700` `#8B6A4F`
- `--brown-500` `#A6886A`
- `--brown-300` `#C4A882`
- `--brown-100` `#E8D9C3`

**Cream (background)**
- `--cream-50`  `#FBF7EF` (cards)
- `--cream-100` `#F5EDE0` (page bg)
- `--cream-200` `#EEE3D0`
- `--cream-300` `#E2D4BC` (borders)

**Ink (text)**
- `--ink-900` `#1F1A14` (primary)
- `--ink-700` `#4A3F32` (secondary)
- `--ink-500` `#7A6B57` (muted)
- `--ink-300` `#B5A78F` (disabled)

**Status**: `--danger #B85C3C`, `--success #5C7A5E`

### Typography
- **Display**: `Cormorant Garamond` (Google Fonts), weights 400/500, supports italic. `letter-spacing: -0.01em`, `line-height: 1.05`.
- **Body**: `DM Sans`, weights 400/500/600/700.
- **Mono**: `JetBrains Mono` (used only in design system reference).

### Spacing scale
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (vars `--s-1` … `--s-8`).

### Radii
- `--r-sm` 8px (small chips)
- `--r-md` 14px (inputs, icon tiles)
- `--r-lg` 22px (cards)
- `--r-xl` 32px (modals)
- `--r-pill` 999px (buttons, badges, step dots)

### Shadows (warm, sun-cast — brown-tinted, not gray)
- `--shadow-sm` `0 1px 2px rgba(92,70,49,.08), 0 2px 6px rgba(92,70,49,.04)`
- `--shadow-md` `0 4px 12px rgba(92,70,49,.10), 0 8px 24px rgba(92,70,49,.06)`
- `--shadow-lg` `0 12px 28px rgba(92,70,49,.14), 0 24px 48px rgba(92,70,49,.08)`
- `--shadow-glow` `0 0 0 4px rgba(61,90,71,.12)` (focus ring)

### Motion tokens
- `--ease-organic` `cubic-bezier(0.34, 1.2, 0.42, 1)` — overshoot, used for selections + step entries
- `--ease-soft` `cubic-bezier(0.4, 0, 0.2, 1)` — used for color/shadow transitions
- `--dur-fast` 220ms · `--dur-med` 380ms · `--dur-slow` 620ms

### Background texture
The page bg layers two radial gradients (warm top-left, sage bottom-right) over a procedurally-generated SVG noise (linen feel). See `body { ... }` in `styles.css` — copy verbatim.

## Components

Recreate as components in your framework. The prototype's `.jsx` files are explicit references for markup + styles:

- `Logo` — wordmark with line-art dog head + leaf accent. **Type-set**: "Clean" (regular sage) + "Dog" (italic brown, 4px gap).
- `Icon` — single inline SVG component, `viewBox="0 0 44 44"`, all paths use `currentColor`. Icon set in `icons.jsx` covers: `dogXS/S/M/L/XL`, `coatShort/Med/Long/Curly`, `bath / scissors / full / nails / shield`, `arrowRight / arrowLeft / check / clock / calendar / bell / paw / phone / edit / sparkle / close`.
- `Button` — three variants: `primary` (sage), `secondary` (cream + sage text + cream-300 border), `ghost` (transparent). Pill radius. Hover lifts primary by 1px.
- `Card` / `SelectableCard` — see `.card`/`.card-selectable`/`.card-selected` in styles.css.
- `Input` / `Textarea` — cream-50 bg, cream-300 border, sage focus ring (`--shadow-glow`).
- `Badge` — pill, three variants: default (cream-200/brown-700), `sage`, `brown`.
- `StepDot` — 8×8 pill, active state stretches to `width: 24px`.
- `CheckCircle` — 24px round, animates in/out with overshoot easing.

## Assets
**No external assets required.** Everything is inline SVG (icons + logo + brand mark) and CSS gradients/noise. The "paper texture" is an inline SVG `feTurbulence` filter in CSS — copy from `styles.css`. If your codebase prefers an actual asset, render that SVG to a tiled PNG once and reference it.

If you want photography of dogs/the salon for marketing pages outside the wizard (out of scope here), commission or license real photography — do not generate.

## Files in this bundle

| Path | What it is |
|------|------------|
| `Clean Dog.html` | Entry point — loads fonts, React, Babel, all scripts. |
| `styles.css` | All design tokens + base components. **Source of truth for tokens.** |
| `icons.jsx` | `Icon` and `Logo` components — inline SVG library. |
| `wizard-steps.jsx` | Steps 1–4 (Welcome, Dog, Services, Date) + shared `StepHeader`, `FooterNav`, `SelectTile`, `CheckCircle`. |
| `wizard-steps-2.jsx` | Steps 5–7 (Contact, Summary, Success) + `RemindersPanel`. |
| `app.jsx` | Wizard shell, header, step routing, plus a built-in **Design System reference overlay** (toggle via Tweaks). |
| `tweaks-panel.jsx` | Prototype-only sandbox panel — **do not port to production.** |

To preview locally: open `Clean Dog.html` in a browser. No build step.

## Out of scope (next steps for product team)
- Admin panel for the groomer (today's appointments, mark complete, manual reschedule).
- Real availability API + locking on slot selection.
- Payment (currently "paghi in negozio").
- Customer account / login / past bookings.
- Multi-pet management for repeat customers.
- i18n — copy is currently Italian-only.
