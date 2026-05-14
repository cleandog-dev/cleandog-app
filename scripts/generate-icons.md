# Generare le icone PWA

Hai 2 opzioni.

## Opzione A — Online (più veloce, no install)

1. Vai su https://realfavicongenerator.net
2. Carica `public/logo.png`
3. Scarica il pacchetto e copia in `public/`:
   - `favicon.ico`
   - `apple-icon.png` (o `apple-touch-icon.png` → rinomina)
   - `icon-192.png` (`android-chrome-192x192.png` → rinomina)
   - `icon-512.png` (`android-chrome-512x512.png` → rinomina)

## Opzione B — Locale con sharp

```bash
npm i -D sharp
node scripts/generate-icons.mjs
```

Crea automaticamente le 4 dimensioni partendo da `public/logo.png`.
