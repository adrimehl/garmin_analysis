// Eigenständiger Ersatz für die Dashboard-Laufzeit von claude.ai.
//
// Stellt das globale Objekt `dash` bereit, das kit.js, calcs.js und app.js erwarten:
//   dash.data(id)        -> { status, data, rows, columns, message, refreshing, meta }
//   dash.calc(id, {...}) -> abgeleiteter Datensatz aus anderen Datensätzen
//   dash.onData(fn)      -> fn wird sofort und bei jeder Daten- oder Breitenänderung aufgerufen
//   dash.colors, dash.setLink, dash.params, ... (einfache Varianten)
//
// Die Rohdaten kommen als JSON-Dateien aus ./data/ (deine eigenen, nicht im Git)
// oder, falls dort nichts liegt, aus ./demo-data/ (synthetische Beispieldaten).
// Wird die Seite direkt als Datei geöffnet (file://), können Browser keine Dateien
// nachladen; dann lassen sich die JSON-Dateien über einen Dateidialog auswählen.
(() => {
  const DATASETS = {
    activities: 'garmin_aktivitaeten.json',
    daily: 'garmin_tageswerte.json',
    fitage: 'garmin_fitnessalter.json',
    ftp: 'garmin_ftp.json',
    vo2: 'garmin_vo2max.json',
  };
  const FOLDERS = ['data', 'demo-data'];

  const store = {};
  Object.keys(DATASETS).forEach((id) => { store[id] = { status: 'loading', data: [] }; });
  const calcs = {};
  let calcCache = {};
  const listeners = [];

  const rowsOf = (json) => {
    if (Array.isArray(json)) return json;
    for (const k of ['rows', 'data', 'results']) if (json && Array.isArray(json[k])) return json[k];
    return json;
  };
  const view = (s) => {
    const rows = Array.isArray(s.data) ? s.data : [];
    return {
      status: s.status, data: s.data, rows, value: s.data,
      columns: rows.length ? Object.keys(rows[0]) : [],
      message: s.message || null, refreshing: false, meta: [],
    };
  };

  function calcData(id) {
    if (calcCache[id]) return calcCache[id];
    const c = calcs[id];
    const inputs = c.inputs.map((i) => dash.data(i));
    const notOk = inputs.find((r) => r.status !== 'ok');
    if (notOk) {
      const st = notOk.status === 'loading' ? 'loading' : 'error';
      return view({ status: st, data: [], message: notOk.message });
    }
    try {
      calcCache[id] = view({ status: 'ok', data: c.fn(...inputs.map((r) => r.data)) });
    } catch (e) {
      console.error(`Berechnung "${id}" fehlgeschlagen:`, e);
      calcCache[id] = view({ status: 'error', data: [], message: String(e && e.message || e) });
    }
    return calcCache[id];
  }

  function notify() {
    listeners.forEach((fn) => {
      try { fn(); } catch (e) { console.error('Fehler beim Zeichnen:', e); }
    });
  }
  function dataChanged() { calcCache = {}; notify(); }

  const PALETTE = ['#2a7ab9', '#e07b39', '#3f9d6a', '#c94f7c', '#8a6bbf', '#c9a227', '#3fa7a3', '#8c6d4f'];

  window.dash = {
    data(id) {
      if (calcs[id]) return calcData(id);
      if (store[id]) return view(store[id]);
      return view({ status: 'missing', data: [], message: `Unbekannter Datensatz "${id}"` });
    },
    calc(id, def) { calcs[id] = def; },
    loader() { /* Rohdaten sind bereits Zeilen; nichts umzuformen */ },
    onData(fn) {
      listeners.push(fn);
      try { fn(); } catch (e) { console.error('Fehler beim Zeichnen:', e); }
    },
    colors: PALETTE,
    refresh() { load(); },
    setLink(name) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignorieren */ } },
    params() { return {}; },
    setParams() {},
    resetParams() {},
  };

  // Neu zeichnen, wenn sich die Breite ändert (Diagramme werden nach clientWidth bemessen)
  let lastW = 0, timer = null;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; notify(); } }, 150);
  });

  async function fetchFolder(folder) {
    const out = {};
    await Promise.all(Object.entries(DATASETS).map(async ([id, file]) => {
      try {
        const res = await fetch(`${folder}/${file}`, { cache: 'no-store' });
        if (!res.ok) return;
        out[id] = rowsOf(await res.json());
      } catch (e) { /* Datei fehlt oder file:// */ }
    }));
    return out;
  }

  function apply(found) {
    Object.keys(DATASETS).forEach((id) => {
      store[id] = id in found
        ? { status: 'ok', data: found[id] }
        : { status: 'missing', data: [], message: `${DATASETS[id]} nicht gefunden` };
    });
    dataChanged();
  }

  async function load() {
    // Browser erlauben fetch() nicht für file://-Seiten: direkt die Dateiauswahl zeigen
    if (location.protocol === 'file:') { banner('pick'); return; }
    for (const folder of FOLDERS) {
      const found = await fetchFolder(folder);
      if (Object.keys(found).length) {
        apply(found);
        if (folder !== 'data') banner('demo');
        else if (Object.keys(found).length < Object.keys(DATASETS).length) banner('partial', found);
        return;
      }
    }
    banner('pick');
  }

  // ---------- Hinweisleiste & Dateiauswahl ----------
  function banner(kind, found) {
    const box = document.getElementById('dash-banner');
    if (!box) return;
    box.hidden = false;
    box.replaceChildren();
    const p = (text) => { const e = document.createElement('p'); e.textContent = text; box.appendChild(e); return e; };
    if (kind === 'demo') {
      p('Angezeigt werden synthetische Demo-Daten. Lege deine eigenen JSON-Dateien in den Ordner dashboard/data/ oder wähle sie hier aus:');
    } else if (kind === 'partial') {
      const missing = Object.keys(DATASETS).filter((id) => !(id in found)).map((id) => DATASETS[id]);
      p('Diese Dateien fehlen in dashboard/data/: ' + missing.join(', ') + '. Die betroffenen Diagramme bleiben leer.');
    } else {
      p('Keine Daten gefunden. Starte im Ordner dashboard einen lokalen Server (python -m http.server) oder wähle die JSON-Dateien hier aus:');
    }
    if (kind === 'partial') return;
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true; input.accept = '.json,application/json';
    label.append(input, document.createTextNode(Object.values(DATASETS).join(', ')));
    input.addEventListener('change', async () => {
      const found = {};
      for (const f of input.files) {
        const id = Object.keys(DATASETS).find((k) => DATASETS[k] === f.name);
        if (!id) continue;
        try { found[id] = rowsOf(JSON.parse(await f.text())); } catch (e) { console.error(f.name, e); }
      }
      if (!Object.keys(found).length) { p('Keine passenden Dateien erkannt. Die Dateinamen müssen genau so lauten wie oben.'); return; }
      apply(found);
      box.hidden = true;
    });
    const row = document.createElement('p'); row.appendChild(label); box.appendChild(row);
  }

  // erst laden, wenn die Seite (inkl. Hinweisleiste) aufgebaut ist
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
