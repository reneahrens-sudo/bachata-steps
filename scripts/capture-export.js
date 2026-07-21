/* ============================================================
   BachataSteps – Netzwerk-Capture-Export (PHP-Backend)
   ------------------------------------------------------------
   WICHTIG (Erkenntnis 2026-07-20):
   Der Content liegt NICHT in Firebase. Das Firebase-Projekt
   "bachatasteps9" wird nur für den Login (Auth) benutzt.
   Firestore ist deaktiviert, es gibt keine Realtime-DB und
   keinen Storage-Bucket. Die Figuren/Videos kommen aus dem
   PHP-/MySQL-Backend von bachatasteps.com – und die Seite
   sperrt fremde IPs ("tiltott ip"). Export geht daher nur aus
   DEINEM Browser, in erlaubter Region, als Admin eingeloggt.

   So benutzt du es:
   1. Öffne https://bachatasteps.com und melde dich als Admin an.
   2. F12 → Console. Diese Datei KOMPLETT einfügen, Enter.
      -> Ab jetzt werden alle fetch()/XHR-Antworten mitgeschnitten.
   3. Navigiere durch die Seite: alle Figuren/Kategorien/Combos
      öffnen, Listen durchscrollen, Detailseiten anklicken.
      Jede geladene JSON-Antwort landet automatisch im Puffer.
   4. Wenn du fertig bist, in der Console eingeben:
         __bsDump()
      -> lädt "bachatasteps-capture.json" in deine Downloads.
   5. Schick mir die Datei – ich baue daraus den Supabase-Import.

   Rein lesend. Es wird nichts an der Seite verändert.
   ============================================================ */
(() => {
  if (window.__bsCaptureActive) {
    console.log('ℹ️ Capture läuft bereits. Zum Speichern: __bsDump()')
    return
  }
  window.__bsCaptureActive = true

  const captures = []
  const seen = new Set()

  function looksInteresting(url) {
    // Statische Assets, Analytics und Firebase-Auth-Traffic ignorieren.
    return !/\.(png|jpe?g|gif|webp|svg|css|js|woff2?|ico|mp4|webm|m3u8|ts)(\?|$)/i.test(url) &&
      !/google-analytics|googletagmanager|gstatic|identitytoolkit|firebaseio|firebasestorage|tracking\.php/i.test(url)
  }

  async function record(url, method, status, getBodyText) {
    try {
      const key = method + ' ' + url
      if (seen.has(key)) return
      const text = await getBodyText()
      if (!text) return
      const trimmed = text.trim()
      // Nur strukturierte Antworten (JSON / JSON-in-Text) behalten.
      let parsed = null
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try { parsed = JSON.parse(trimmed) } catch { /* kein reines JSON */ }
      }
      if (!parsed && !/"|:\s*\[|:\s*\{/.test(trimmed)) return // sieht nicht nach Daten aus
      seen.add(key)
      captures.push({ url, method, status, json: parsed, raw: parsed ? undefined : trimmed.slice(0, 200000) })
      console.log(`📥 [${captures.length}] ${method} ${url} (${status})`)
    } catch (e) { /* ignorieren */ }
  }

  // --- fetch() abfangen ---
  const origFetch = window.fetch
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args)
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || ''
      const method = (args[1] && args[1].method) || 'GET'
      if (url && looksInteresting(url)) {
        const clone = res.clone()
        record(url, method.toUpperCase(), res.status, () => clone.text())
      }
    } catch { /* ignorieren */ }
    return res
  }

  // --- XMLHttpRequest abfangen ---
  const origOpen = XMLHttpRequest.prototype.open
  const origSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__bsMethod = method
    this.__bsUrl = url
    return origOpen.apply(this, arguments)
  }
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', () => {
      try {
        const url = this.__bsUrl || this.responseURL || ''
        if (url && looksInteresting(url)) {
          record(url, (this.__bsMethod || 'GET').toUpperCase(), this.status, () =>
            Promise.resolve(this.responseText),
          )
        }
      } catch { /* ignorieren */ }
    })
    return origSend.apply(this, arguments)
  }

  window.__bsDump = function () {
    if (!captures.length) {
      console.warn('⚠️ Noch nichts mitgeschnitten. Navigiere erst durch die Seite (Figuren/Combos öffnen), dann erneut __bsDump().')
      return
    }
    const blob = new Blob([JSON.stringify(captures, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'bachatasteps-capture.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    console.log(`⬇️ bachatasteps-capture.json (${captures.length} Antworten) wird heruntergeladen.`)
  }

  console.log('✅ Capture aktiv. Jetzt durch die Seite navigieren (alle Figuren/Kategorien öffnen).')
  console.log('   Zum Speichern eingeben:  __bsDump()')
})()
