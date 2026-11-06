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
  const el = (tag, attrs = {}, text) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k in e) e[k] = v; else e.setAttribute(k, v); });
    if (text != null) e.textContent = text;
    return e;
  };

  function banner(kind, found) {
    const box = document.getElementById('dash-banner');
    if (!box) return;
    box.hidden = false;
    box.replaceChildren();
    const p = (text) => box.appendChild(el('p', {}, text));
    if (kind === 'demo') {
      p('Angezeigt werden synthetische Demo-Daten. Lade deinen Garmin-Export, um deine eigenen Daten zu sehen. Er wird nur hier im Browser ausgewertet und nirgends hochgeladen.');
    } else if (kind === 'partial') {
      const missing = Object.keys(DATASETS).filter((id) => !(id in found)).map((id) => DATASETS[id]);
      p('Diese Dateien fehlen in dashboard/data/: ' + missing.join(', ') + '. Die betroffenen Diagramme bleiben leer.');
      return;
    } else {
      p('Keine Daten gefunden. Lade deinen Garmin-Export (ZIP oder entpackter Ordner) oder die fünf aufbereiteten JSON-Dateien. Alles bleibt in deinem Browser.');
    }
    const status = el('p', { className: 'dash-status' });
    const zip = el('input', { type: 'file', multiple: true, accept: '.zip,.json,application/zip,application/json' });
    const dir = el('input', { type: 'file', webkitdirectory: true, multiple: true });
    const row = el('p', { className: 'dash-pick' });
    const l1 = el('label', {}, 'ZIP oder JSON-Dateien: '); l1.appendChild(zip);
    const l2 = el('label', {}, 'Entpackter Ordner: '); l2.appendChild(dir);
    row.append(l1, l2);
    box.append(row, el('p', {}, 'Tipp: Du kannst die ZIP-Datei auch einfach in diesen Kasten ziehen.'), status);
    const go = (files) => handleFiles(files, box, status);
    zip.addEventListener('change', () => go(zip.files));
    dir.addEventListener('change', () => go(dir.files));
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('drag'); });
    box.addEventListener('dragleave', () => box.classList.remove('drag'));
    box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('drag'); go(e.dataTransfer.files); });
  }

  async function handleFiles(fileList, box, status) {
    const files = [...fileList];
    if (!files.length) return;
    const say = (t) => { status.textContent = t; };
    try {
      // 1) bereits aufbereitete Dashboard-Dateien?
      const ready = {};
      for (const f of files) {
        const id = Object.keys(DATASETS).find((k) => DATASETS[k] === f.name);
        if (id) ready[id] = rowsOf(JSON.parse(await f.text()));
      }
      if (Object.keys(ready).length && Object.keys(ready).length === files.length) { apply(ready); box.hidden = true; return; }

      // 2) sonst: Garmin-Export lesen und umwandeln
      const { files: index, skipped } = await window.GarminImport.read(files, say);
      if (!Object.keys(index).length) { say('In der Auswahl wurden keine JSON-Dateien gefunden.'); return; }
      try {
        const out = window.GarminImport.convert(index, say);
        apply(out);
        box.hidden = true;
      } catch (e) {
        console.error(e);
        say(`${e.message} Die Struktur deines Exports (nur Datei- und Feldnamen, keine Werte) kannst du unten ansehen und weitergeben.`);
        showStructure(box, index, skipped);
      }
    } catch (e) {
      console.error(e);
      say('Fehler beim Lesen: ' + (e && e.message || e));
    }
  }

  function showStructure(box, index, skipped) {
    const text = window.GarminImport.describe(index) + (skipped.length ? '\n\nÜbersprungen:\n' + skipped.join('\n') : '');
    const area = el('textarea', { readOnly: true, rows: 14, className: 'dash-structure' });
    area.value = text;
    const copy = el('button', { type: 'button' }, 'Kopieren');
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(text); copy.textContent = 'Kopiert'; } catch (e) { area.select(); } });
    const dl = el('button', { type: 'button' }, 'Als Datei speichern');
    dl.addEventListener('click', () => {
      const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: 'garmin-export-struktur.txt' });
      document.body.appendChild(a); a.click(); a.remove();
    });
    const row = el('p', { className: 'dash-pick' }); row.append(copy, dl);
    box.append(area, row);
  }

  // erst laden, wenn die Seite (inkl. Hinweisleiste) aufgebaut ist
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
