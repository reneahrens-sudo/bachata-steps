#!/usr/bin/env node
/**
 * Importiert den bestehenden bachatasteps.com-Content (Firestore-Projekt "bachatasteps9")
 * in die neue Supabase-"moves"-Tabelle.
 *
 * VORAUSSETZUNG (eines von beiden):
 *   A) Service-Account-Key (empfohlen, umgeht Security-Rules):
 *      Firebase-Konsole → Projekteinstellungen → Dienstkonten → "Neuen privaten Schlüssel generieren"
 *      → JSON speichern als scripts/service-account.json
 *   B) Firestore-REST-API aktiviert + öffentliche Read-Rules:
 *      Dann reicht der öffentliche Web-API-Key (unten als Fallback).
 *
 * NUTZUNG:
 *   1. npm i -D firebase-admin        (nur für dieses Skript)
 *   2. In .env.local ergänzen: SUPABASE_SERVICE_KEY=<service_role key aus Supabase Settings→API>
 *   3. node scripts/import-firestore.mjs --discover     # zeigt Collections + 1 Beispiel-Doc
 *   4. Mapping unten (mapDoc) an die echte Feldstruktur anpassen
 *   5. node scripts/import-firestore.mjs                # führt den Import aus
 *   6. node scripts/import-firestore.mjs --dry          # nur anzeigen, nichts schreiben
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import admin from 'firebase-admin'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const DISCOVER = args.includes('--discover')
const DRY = args.includes('--dry')

// ---- Firestore init ----
const saPath = join(__dirname, 'service-account.json')
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = admin.firestore()

// ---- Supabase init ----
function envFromDotenv() {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}
const env = envFromDotenv()
const supabase =
  DRY || DISCOVER
    ? null
    : createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false },
      })

// ---- Kategorie-/Level-Mapping (an bachatasteps-Werte anpassen nach --discover) ----
const CATEGORY_MAP = {
  intro: 'intro',
  footwork: 'footwork',
  sensual: 'sensual',
  bachazouk: 'bachazouk',
  spectacular: 'spectacular',
  ladystyle: 'ladystyle',
  'lady-style': 'ladystyle',
  menstyle: 'menstyle',
  'men-style': 'menstyle',
  step: 'step',
  basic: 'basicstep',
  basicstep: 'basicstep',
}

/** Wandelt ein Firestore-Dokument in eine Supabase-moves-Zeile um. NACH --discover anpassen! */
function mapDoc(id, d) {
  const cat = (d.category || d.type || '').toString().toLowerCase().replace(/\s+/g, '')
  return {
    legacy_id: id,
    kind: d.isCombo || d.combo ? 'combo' : 'move',
    name: d.name || d.title || d.label || '(ohne Namen)',
    description: d.description || d.desc || null,
    style: (d.style || d.dance || 'bachata').toString().toLowerCase(),
    category: CATEGORY_MAP[cat] || null,
    level: Number(d.level || d.difficulty) || null,
    // Medien liegen auf dem Bunny-CDN → direkt weiterverwenden:
    media_url: d.videoUrl || d.gifUrl || d.url || d.video || null,
    thumb_url: d.thumbUrl || d.thumbnail || d.poster || null,
    youtube_id: null,
    source_links: d.source ? [{ label: 'Quelle', url: d.source }] : [],
    tags: Array.isArray(d.tags) ? d.tags : [],
    is_official: true,
    owner_id: null,
    visibility: 'public',
  }
}

async function listTopCollections() {
  const cols = await db.listCollections()
  return cols.map((c) => c.id)
}

async function discover() {
  const cols = await listTopCollections()
  console.log('Top-Level Collections:', cols)
  for (const name of cols) {
    const snap = await db.collection(name).limit(1).get()
    console.log(`\n=== ${name} (${snap.size > 0 ? 'Beispiel-Doc:' : 'leer'}) ===`)
    snap.forEach((doc) => console.log(doc.id, JSON.stringify(doc.data(), null, 2)))
  }
}

async function run() {
  // TODO: nach --discover den echten Collection-Namen eintragen (z.B. 'moves' oder 'figures')
  const COLLECTION = process.env.FS_COLLECTION || 'moves'
  const snap = await db.collection(COLLECTION).get()
  console.log(`${snap.size} Dokumente in "${COLLECTION}" gefunden.`)

  const rows = []
  snap.forEach((doc) => rows.push(mapDoc(doc.id, doc.data())))

  if (DRY) {
    console.log(JSON.stringify(rows.slice(0, 3), null, 2))
    console.log(`… insgesamt ${rows.length} Zeilen (dry-run, nichts geschrieben).`)
    return
  }

  // Batch-Upsert (idempotent über legacy_id)
  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('moves').upsert(chunk, { onConflict: 'legacy_id' })
    if (error) throw error
    console.log(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}`)
  }
  console.log('✓ Import abgeschlossen.')
}

if (DISCOVER) await discover()
else await run()
process.exit(0)
