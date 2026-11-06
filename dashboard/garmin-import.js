// Liest einen Garmin-Datenexport direkt im Browser (nichts wird hochgeladen).
//
// Eingabe: die ZIP-Datei des Exports, der entpackte Ordner oder einzelne JSON-Dateien.
// GarminImport.read(files)     -> { files: {pfad: json}, skipped: [...] }
// GarminImport.describe(index) -> Text mit Dateinamen und Feldnamen, ohne Werte
//                                 (zum Weitergeben des Formats ohne persönliche Daten)
// GarminImport.convert(index)  -> { activities, daily, vo2, fitage, ftp } im Dashboard-Format
window.GarminImport = (() => {
  const isJson = (name) => /\.json$/i.test(name) && !/(^|\/)__MACOSX\//.test(name);
  const MAX_JSON_BYTES = 200 * 1024 * 1024;

  function unzip(u8) {
    return new Promise((resolve, reject) => {
      fflate.unzip(u8, { filter: (f) => isJson(f.name) && f.originalSize < MAX_JSON_BYTES }, (err, out) => (err ? reject(err) : resolve(out)));
    });
  }
  const decoder = new TextDecoder('utf-8');
  function parse(name, text, index, skipped) {
    try { index[name] = JSON.parse(text); } catch (e) { skipped.push(`${name}: kein gültiges JSON`); }
  }

  async function read(fileList, onProgress = () => {}) {
    const index = {}; const skipped = [];
    const files = [...fileList];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const name = f.webkitRelativePath || f.name;
      onProgress(`Lese ${name} (${i + 1}/${files.length}) …`);
      if (/\.zip$/i.test(name)) {
        const entries = await unzip(new Uint8Array(await f.arrayBuffer()));
        for (const [path, data] of Object.entries(entries)) parse(path, decoder.decode(data), index, skipped);
      } else if (isJson(name)) {
        parse(name, await f.text(), index, skipped);
      }
    }
    return { files: index, skipped };
  }

  // ---------- Struktur ohne Werte ----------
  function shape(v, depth = 0) {
    if (v === null) return 'null';
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      // Felder aller (bis zu 200) Elemente zusammenführen, damit seltene Felder sichtbar werden
      if (v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
        const merged = {};
        v.slice(0, 200).forEach((x) => Object.keys(x).forEach((k) => { if (!(k in merged) || merged[k] === null) merged[k] = x[k]; }));
        return [`${v.length} ×`, shape(merged, depth)];
      }
      return [`${v.length} ×`, shape(v[0], depth)];
    }
    if (typeof v === 'object') {
      if (depth > 6) return '{…}';
      const o = {};
      Object.keys(v).sort().forEach((k) => { o[k] = shape(v[k], depth + 1); });
      return o;
    }
    if (typeof v === 'string') {
      if (/^\d{4}-\d{2}-\d{2}([T ][\d:.]+)?Z?$/.test(v)) return `datum-text (${v.length})`;
      return 'text';
    }
    return typeof v === 'number' ? (Number.isInteger(v) ? (v > 1e11 ? 'zahl (evtl. Zeitstempel ms)' : 'ganzzahl') : 'kommazahl') : typeof v;
  }
  function describe(index) {
    const lines = [];
    const paths = Object.keys(index).sort();
    lines.push(`${paths.length} JSON-Dateien`);
    // gleich aufgebaute Dateien (z.B. ein File pro Zeitraum) zusammenfassen
    const groups = new Map();
    paths.forEach((p) => {
      // Datumsangaben, lange Nummern (z.B. Benutzer-ID) und E-Mail-Adressen im Dateinamen unkenntlich machen
      const key = p.replace(/[^/\s]+@[^/\s_]+/g, '<email>').replace(/\d{4}-\d{2}-\d{2}|\d{6,}/g, '#').replace(/_\d+(?=\.json$)/, '_#');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    const size = (v) => (Array.isArray(v) ? v.length + v.reduce((a, x) => a + (x && typeof x === 'object' ? Object.keys(x).length : 0), 0) : 1);
    groups.forEach((ps, key) => {
      lines.push('', `=== ${key}  (${ps.length} Datei${ps.length > 1 ? 'en' : ''})`);
      const sample = ps.reduce((best, p) => (size(index[p]) > size(index[best]) ? p : best), ps[0]);
      lines.push(JSON.stringify(shape(index[sample]), null, 1));
    });
    return lines.join('\n');
  }

  function convert() {
    throw new Error('Die Umwandlung des Garmin-Exports ist noch nicht eingebaut.');
  }

  return { read, describe, convert };
})();
