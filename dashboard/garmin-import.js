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

  // ---------- Umwandlung ins Dashboard-Format ----------
  // Einheiten im Garmin-Export (an echten Daten geprüft):
  //   summarizedActivities: duration ms, distance cm, elevationGain cm, avgSpeed ×36 = km/h,
  //                         calories in kJ, startTimeLocal = Ortszeit als ms-Zeitstempel
  //   sleepData: Zeitstempel in GMT, Dauern in Sekunden, calendarDate = Tag des Aufwachens
  //   UDSFile: ein Eintrag pro Tag; wellnessStartTimeGmt/-Local liefern den Zeitzonen-Versatz
  const CAT = [
    [/^(indoor_cycling|virtual_ride|indoor_rowing_bike)$/, 'Velo indoor'],
    [/cycl|biking|ride|bmx|gravel/, 'Velo'],
    [/run/, 'Laufen'],
    [/strength|hiit|crossfit|fitness_equipment|indoor_cardio|yoga|pilates|bouldering|climbing/, 'Kraft'],
    [/tennis|squash|padel|badminton|pickleball|racquet|table_tennis/, 'Tennis/Squash'],
    [/hiking|mountaineering/, 'Wandern'],
    [/ski|snowboard|snowshoe|skating|winter/, 'Wintersport'],
    [/walk/, 'Gehen'],
  ];
  const SPORT_FIELD = { Velo: 'min_Velo', 'Velo indoor': 'min_Velo', Laufen: 'min_Laufen', Kraft: 'min_Kraft', 'Tennis/Squash': 'min_Racket', Wandern: 'min_Wandern' };
  const category = (type) => { const t = String(type || '').toLowerCase(); const hit = CAT.find(([re]) => re.test(t)); return hit ? hit[1] : 'Andere'; };

  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const pos = (v) => { const n = num(v); return n != null && n >= 0 ? n : null; }; // Garmin: -1/-2 = kein Wert
  const round = (v, d = 0) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
  const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
  const hourOf = (ms) => { const d = new Date(ms); return d.getUTCHours() + d.getUTCMinutes() / 60; };
  const parseGmt = (s) => (s ? Date.parse(String(s).replace(' ', 'T').replace(/(\.\d+)?$/, '') + 'Z') : NaN);

  function pick(index, re) {
    return Object.keys(index).filter((p) => re.test(p.split('/').pop())).sort();
  }
  // Mehrere Dateien (je ein Zeitabschnitt) zu einer Liste je Kalendertag zusammenführen
  function byDate(index, re, dateKey = 'calendarDate') {
    const m = new Map();
    pick(index, re).forEach((p) => {
      const rows = Array.isArray(index[p]) ? index[p] : [];
      rows.forEach((r) => {
        const d = r && r[dateKey] && String(r[dateKey]).slice(0, 10);
        if (!d) return;
        const prev = m.get(d);
        if (!prev || Object.keys(r).length >= Object.keys(prev).length) m.set(d, r);
      });
    });
    return m;
  }

  function readActivities(index, report) {
    const raw = [];
    pick(index, /summarizedActivities\.json$/i).forEach((p) => {
      const d = index[p];
      (Array.isArray(d) ? d : [d]).forEach((block) => {
        if (block && Array.isArray(block.summarizedActivitiesExport)) raw.push(...block.summarizedActivitiesExport);
        else if (block && block.activityId) raw.push(block);
      });
    });
    const seen = new Set();
    let acts = raw.filter((a) => a && a.activityId && !a.parent && !seen.has(a.activityId) && seen.add(a.activityId) && a.startTimeLocal);
    // Doppelaufzeichnungen (z.B. Velocomputer + Uhr): das häufigste Gerät gilt als Uhr; Aufzeichnungen
    // anderer Geräte, die sich zeitlich mit einer Uhr-Aufzeichnung überschneiden, werden entfernt.
    const devCount = new Map(); acts.forEach((a) => devCount.set(a.deviceId, (devCount.get(a.deviceId) || 0) + 1));
    const main = [...devCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const span = (a) => [a.startTimeGmt || a.beginTimestamp, (a.startTimeGmt || a.beginTimestamp) + (a.duration || 0)];
    const mainActs = acts.filter((a) => a.deviceId === main).map(span);
    const before = acts.length;
    acts = acts.filter((a) => {
      if (a.deviceId === main) return true;
      const [s, e] = span(a);
      return !mainActs.some(([ms, me]) => Math.min(e, me) - Math.max(s, ms) > 0.5 * Math.min(e - s, me - ms));
    });
    report.push(`${acts.length} Aktivitäten` + (before > acts.length ? ` (${before - acts.length} Doppelaufzeichnungen anderer Geräte entfernt)` : ''));
    return acts.sort((a, b) => a.startTimeLocal - b.startTimeLocal).map((a) => {
      const durMin = num(a.duration) != null ? a.duration / 60000 : null;
      const distKm = num(a.distance) > 0 ? a.distance / 100000 : null;
      const speed = distKm != null && num(a.avgSpeed) > 0 ? a.avgSpeed * 36 : null;
      return {
        activity_id: String(a.activityId),
        date: isoDay(a.startTimeLocal),
        name: a.name || '',
        cat: category(a.activityType),
        type: a.activityType || '',
        dur_min: round(durMin, 1),
        dist_km: round(distKm, 2),
        elev_m: num(a.elevationGain) != null ? round(a.elevationGain / 100) : null,
        avg_hr: round(num(a.avgHr)),
        load: round(num(a.activityTrainingLoad)),
        te_aer: round(num(a.aerobicTrainingEffect), 1),
        kcal: num(a.calories) != null ? round(a.calories / 4.184) : null,
        device: a.deviceId === main ? 'Uhr' : String(a.deviceId ?? ''),
        speed_kmh: round(speed, 2),
        _end_h: hourOf(a.startTimeLocal) + (durMin || 0) / 60,
        _tz: num(a.startTimeGmt) != null ? Math.round((a.startTimeLocal - a.startTimeGmt) / 900000) / 4 : null,
      };
    });
  }

  function readDaily(index, acts, report) {
    const uds = byDate(index, /UDSFile.*\.json$/i);
    const sleep = byDate(index, /sleepData\.json$/i);
    const health = byDate(index, /healthStatusData\.json$/i);
    const ready = byDate(index, /TrainingReadiness.*\.json$/i);
    report.push(`${uds.size} Tage mit Tageswerten, ${sleep.size} Nächte`);
    if (!health.size) report.push('keine HRV-Daten (healthStatusData) gefunden');
    if (!ready.size) report.push('keine Training-Readiness-Daten gefunden');

    // Zeitzonen-Versatz pro Tag (Stunden), für die GMT-Zeitstempel des Schlafs
    const offsets = new Map();
    uds.forEach((u, d) => {
      const g = parseGmt(u.wellnessStartTimeGmt), l = parseGmt(u.wellnessStartTimeLocal);
      if (isFinite(g) && isFinite(l)) offsets.set(d, (l - g) / 3600000);
    });
    // zweite Quelle: Aktivitäten haben Start in Ortszeit und GMT
    const actOffsets = new Map();
    acts.forEach((a) => { if (a._tz != null && !actOffsets.has(a.date)) actOffsets.set(a.date, a._tz); });
    const offsetFor = (d) => {
      const prev = new Date(Date.parse(d + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
      for (const m of [offsets, actOffsets]) for (const day of [d, prev]) if (m.has(day)) return m.get(day);
      // zuletzt: Zeitzone dieses Browsers an genau diesem Datum (berücksichtigt Sommer-/Winterzeit)
      return -new Date(Date.parse(d + 'T03:00:00Z')).getTimezoneOffset() / 60;
    };

    const actByDay = new Map();
    acts.forEach((a) => { if (!actByDay.has(a.date)) actByDay.set(a.date, []); actByDay.get(a.date).push(a); });

    const all = [...new Set([...uds.keys(), ...sleep.keys(), ...actByDay.keys(), ...health.keys(), ...ready.keys()])].sort();
    if (!all.length) return [];
    // lückenlos von erstem bis letztem Tag (Berechnungen wie "Folgetag" setzen das voraus)
    const days = [];
    for (let t = Date.parse(all[0] + 'T00:00:00Z'); t <= Date.parse(all[all.length - 1] + 'T00:00:00Z'); t += 864e5) days.push(isoDay(t));

    return days.map((date) => {
      const u = uds.get(date) || {}; const s = sleep.get(date); const h = health.get(date); const r = ready.get(date);
      const stress = (u.allDayStress && u.allDayStress.aggregatorList) || [];
      const tot = stress.find((x) => x.type === 'TOTAL'); const awake = stress.find((x) => x.type === 'AWAKE');
      const wear = tot && num(tot.totalStressCount) != null ? (tot.totalStressCount - (tot.stressOffWristCount || 0)) / 60 : null;
      const worn = wear != null && wear >= 12;
      const bb = u.bodyBattery && u.bodyBattery.bodyBatteryStatList || [];
      const bbHigh = bb.find((x) => x.bodyBatteryStatType === 'HIGHEST');
      const hrv = h && Array.isArray(h.metrics) ? h.metrics.find((m) => m.type === 'HRV') : null;
      const row = {
        date,
        wear_h: round(wear, 1),
        steps: pos(u.totalSteps),
        floors_m: round(pos(u.floorsAscendedInMeters)),
        rhr: worn ? pos(u.restingHeartRate) : null,
        stress_awake: worn && awake ? pos(awake.averageStressLevel) : null,
        stress_high_min: worn && awake && pos(awake.highDuration) != null ? round(awake.highDuration / 60) : null,
        bb_wake: bbHigh ? pos(bbHigh.statsValue) : null,
        hrv: hrv ? pos(hrv.value) : null,
        readiness: r ? pos(r.score ?? r.trainingReadinessScore ?? r.level) : null,
        im_mod: pos(u.moderateIntensityMinutes),
        im_vig: pos(u.vigorousIntensityMinutes),
        kcal_active: pos(u.activeKilocalories),
        sleep_h: null, deep_h: null, rem_h: null, sleep_score: null, sleep_stress: null, awakenings: null, bedtime: null, waketime: null,
      };
      if (s) {
        const deep = pos(s.deepSleepSeconds) || 0, light = pos(s.lightSleepSeconds) || 0, rem = pos(s.remSleepSeconds) || 0;
        const off = offsetFor(date);
        const st = parseGmt(s.sleepStartTimestampGMT), en = parseGmt(s.sleepEndTimestampGMT);
        Object.assign(row, {
          sleep_h: deep + light + rem > 0 ? round((deep + light + rem) / 3600, 2) : null,
          deep_h: s.deepSleepSeconds != null ? round(deep / 3600, 2) : null,
          rem_h: s.remSleepSeconds != null ? round(rem / 3600, 2) : null,
          sleep_score: s.sleepScores ? pos(s.sleepScores.overallScore) : null,
          sleep_stress: round(pos(s.avgSleepStress), 1),
          awakenings: pos(s.awakeCount),
        });
        if (isFinite(st)) { let b = hourOf(st + off * 3600000); if (b < 12) b += 24; row.bedtime = round(b, 2); }
        if (isFinite(en)) row.waketime = round(hourOf(en + off * 3600000), 2);
      }
      // Training aus den Aktivitäten (ohne Gehen)
      const da = (actByDay.get(date) || []).filter((a) => a.cat !== 'Gehen');
      row.train_min = round(da.reduce((x, a) => x + (a.dur_min || 0), 0));
      row.train_end_h = da.length ? round(Math.max(...da.map((a) => a._end_h)), 2) : null;
      for (const f of new Set(Object.values(SPORT_FIELD))) row[f] = 0;
      da.forEach((a) => { const f = SPORT_FIELD[a.cat]; if (f) row[f] += a.dur_min || 0; });
      for (const f of new Set(Object.values(SPORT_FIELD))) row[f] = round(row[f]);
      if (row.wear_h == null && !s) row.train_min = da.length ? row.train_min : null;
      return row;
    });
  }

  function readVo2(index, report) {
    const out = [];
    pick(index, /MetricsMaxMetData.*\.json$/i).forEach((p) => (Array.isArray(index[p]) ? index[p] : []).forEach((r) => {
      if (r && r.calendarDate && pos(r.vo2MaxValue)) out.push({ date: String(r.calendarDate).slice(0, 10), sport: r.sport || 'RUNNING', vo2max: r.vo2MaxValue });
    }));
    if (!out.length) report.push('keine VO₂max-Daten gefunden');
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Fitnessalter und FTP: Dateiformat noch nicht an echten Daten geprüft, daher tolerant gelesen
  function readFitAge(index, report) {
    const out = [];
    pick(index, /fitness.?age/i).forEach((p) => (Array.isArray(index[p]) ? index[p] : [index[p]]).forEach((r) => {
      const d = r && (r.calendarDate || r.asOfDateGmt || r.date);
      const fa = r && pos(r.fitnessAge ?? r.achievableFitnessAge);
      const age = r && pos(r.chronologicalAge ?? r.age);
      if (d && fa != null) out.push({ date: String(d).slice(0, 10), fit_age: fa, age });
    }));
    if (!out.length) report.push('kein Fitnessalter gefunden');
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  function readFtp(index, report) {
    const out = [];
    pick(index, /bio.?metric/i).forEach((p) => (Array.isArray(index[p]) ? index[p] : [index[p]]).forEach((r) => {
      const ftp = r && pos(r.functionalThresholdPower ?? r.ftp ?? (r.metaData && r.metaData.functionalThresholdPower));
      const d = r && (r.calendarDate || r.date || (r.metaData && r.metaData.calendarDate));
      if (d && ftp) out.push({ date: String(d).slice(0, 10), ftp_w: ftp });
    }));
    if (!out.length) report.push('keine FTP-Werte gefunden');
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  function convert(index, onProgress = () => {}) {
    const report = [];
    onProgress('Wandle um …');
    const activities = readActivities(index, report);
    const daily = readDaily(index, activities, report);
    if (!daily.length) throw new Error('Im Export wurden keine Tageswerte, Schlafdaten oder Aktivitäten gefunden.');
    activities.forEach((a) => { delete a._end_h; delete a._tz; });
    const out = { activities, daily, vo2: readVo2(index, report), fitage: readFitAge(index, report), ftp: readFtp(index, report) };
    out.report = report;
    return out;
  }

  return { read, describe, convert };
})();
