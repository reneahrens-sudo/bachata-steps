/* ============================================================
   BachataSteps – Browser-Export
   ------------------------------------------------------------
   So benutzt du es:
   1. Öffne https://bachatasteps.com und melde dich als Admin an
      (in dem Tab, in dem du normal eingeloggt bist).
   2. Drücke F12 → Reiter "Console".
   3. Kopiere den GESAMTEN Inhalt dieser Datei hinein, Enter.
   4. Es lädt automatisch eine Datei "bachatasteps-export.json"
      in deinen Downloads-Ordner herunter.
   5. Sag mir Bescheid – ich importiere sie dann nach Supabase.

   Reines Lesen deiner eigenen Datenbank, es wird nichts verändert.
   ============================================================ */
(async () => {
  const cfg = {
    apiKey: 'AIzaSyAeetu1dErrbt5J03IugAO3STkWf9V_V7U',
    authDomain: 'bachatasteps9.firebaseapp.com',
    projectId: 'bachatasteps9',
    storageBucket: 'bachatasteps9.firebasestorage.app',
    messagingSenderId: '763733103807',
    appId: '1:763733103807:web:c5da66cb45ae90c4a6e20a',
  }

  const V = '10.13.2'
  let appMod, fsMod, authMod
  try {
    appMod = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`)
    fsMod = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
    authMod = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`)
  } catch (e) {
    console.error('❌ Konnte Firebase-SDK nicht laden (evtl. CSP). Melde dich bei mir, dann bauen wir einen Fallback.', e)
    return
  }

  const app = appMod.initializeApp(cfg, 'exporter_' + Date.now())
  const auth = authMod.getAuth(app)
  await new Promise((res) => {
    const un = authMod.onAuthStateChanged(auth, (u) => {
      console.log('🔐 Angemeldet als:', u ? u.email || u.uid : '(kein Login gefunden – Rules müssen dann öffentlich lesbar sein)')
      un()
      res()
    })
  })
  const db = fsMod.getFirestore(app)

  // Kandidaten für den Collection-Namen (Client-SDK kann Collections nicht auflisten)
  const candidates = [
    'moves', 'figures', 'steps', 'combos', 'dances', 'videos', 'elements',
    'items', 'content', 'cards', 'tricks', 'lessons', 'moveList', 'bachata', 'figure', 'move',
  ]

  const result = {}
  for (const c of candidates) {
    try {
      const snap = await fsMod.getDocs(fsMod.collection(db, c))
      if (snap.size) {
        result[c] = snap.docs.map((d) => ({ _id: d.id, ...d.data() }))
        console.log(`✅ ${c}: ${snap.size} Dokumente`)
      }
    } catch (e) {
      /* nicht vorhanden oder kein Zugriff – ignorieren */
    }
  }

  const totals = Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.length]))
  if (!Object.keys(result).length) {
    console.warn('⚠️ Keine der Standard-Collections gefunden. Sag mir den echten Collection-Namen, dann passe ich das Skript an.')
    return
  }
  console.log('📦 Export-Übersicht:', totals)

  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'bachatasteps-export.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  console.log('⬇️  bachatasteps-export.json wird heruntergeladen.')
  return totals
})()
