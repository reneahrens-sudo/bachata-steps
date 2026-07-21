# BachataSteps

Moderne PWA zum Verwalten, Üben und Teilen von Bachata-Moves & -Combos — Nachfolger von bachatasteps.com.

## Stack
- React 19 + Vite + TypeScript + Tailwind CSS 4
- Supabase (Auth, Postgres, Storage) — Projekt `ehuilbajfmksnozjnsmx` (Region eu-central-1)
- TanStack Query, react-router, dnd-kit
- PWA via vite-plugin-pwa · Deploy: Netlify

## Entwicklung
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Produktions-Build nach dist/
```
`.env.local` enthält `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`.

## Datenbank
Schema & RLS liegen als Supabase-Migrationen im Projekt (via MCP angelegt):
`01_core_tables`, `02_rls_policies`, `03_lock_down_trigger_fn`.
Kernidee: Combos sind `moves`-Zeilen mit `kind='combo'` + geordnete `combo_items`.

## Bestandscontent importieren (Firestore → Supabase)
Siehe `scripts/import-firestore.mjs` (Kopf-Kommentar). Kurz:
1. Service-Account-Key als `scripts/service-account.json`
2. `SUPABASE_SERVICE_KEY` in `.env.local`
3. `npm i -D firebase-admin`
4. `node scripts/import-firestore.mjs --discover` → Feldstruktur ansehen, `mapDoc` anpassen
5. `node scripts/import-firestore.mjs`

## Deploy (Netlify)
Build `npm run build`, Publish `dist`. Env-Vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
im Netlify-UI setzen. `netlify.toml` enthält den SPA-Redirect.
