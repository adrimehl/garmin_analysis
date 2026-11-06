// Berechnungen über die Garmin-Datensätze. Jede Funktion arbeitet nur mit ihren Eingaben.

dash.calc('kpi', {
  inputs: ['daily'],
  title: 'Letzte 90 Tage vs. Vorjahr',
  description: 'Mittelwerte der letzten 90 Tage mit Daten, verglichen mit denselben 90 Kalendertagen ein Jahr zuvor.',
  fn: (daily) => {
    const rows = daily.filter((r) => r.wear_h >= 12);
    const last = rows[rows.length - 1].date;
    const day = (s, k) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
    const win = (end) => { const start = day(end, -89); return daily.filter((r) => r.date >= start && r.date <= end); };
    const cur = win(last), prev = win(day(last, -365));
    const mean = (rs, k) => { const v = rs.map((r) => r[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const weekly = (rs) => { const v = rs.filter((r) => r.wear_h != null); return v.length ? v.reduce((a, r) => a + (r.train_min || 0), 0) / 60 / (v.length / 7) : null; };
    const out = [];
    for (const k of ['rhr', 'sleep_score', 'sleep_h', 'hrv', 'stress_awake', 'steps']) {
      const c = mean(cur, k), p = mean(prev, k);
      out.push({ metric: k, cur: c, prev: p, delta: c != null && p != null ? c - p : null, from: day(last, -89), to: last });
    }
    const c = weekly(cur), p = weekly(prev);
    out.push({ metric: 'train_h_week', cur: c, prev: p, delta: c != null && p != null ? c - p : null, from: day(last, -89), to: last });
    return out;
  },
});

dash.calc('rolling', {
  inputs: ['daily'],
  title: 'Gleitende 28-Tage-Mittel',
  description: 'Für jeden Tag das Mittel der letzten 28 Tage (mindestens 10 Messwerte), damit Trends trotz Tagesrauschen sichtbar werden.',
  fn: (daily) => {
    const keys = ['rhr', 'sleep_score', 'sleep_h', 'deep_h', 'rem_h', 'hrv', 'stress_awake', 'steps', 'bb_wake', 'bedtime', 'waketime', 'readiness', 'sleep_stress', 'train_min'];
    return daily.map((r, i) => {
      const o = { date: r.date };
      const w = daily.slice(Math.max(0, i - 27), i + 1);
      for (const k of keys) {
        const v = w.map((x) => x[k]).filter((x) => x != null);
        o[k] = v.length >= 10 ? v.reduce((a, b) => a + b, 0) / v.length : null;
      }
      return o;
    });
  },
});

dash.calc('monthly', {
  inputs: ['daily', 'activities', 'vo2'],
  title: 'Monatswerte',
  description: 'Monatsmittel der Tageswerte, Trainingsstunden pro Sportart (ohne Gehen) und mittlere VO₂max pro Monat.',
  fn: (daily, activities, vo2) => {
    const by = new Map();
    const get = (m) => { if (!by.has(m)) by.set(m, { month: m, d: [], a: [], v: [] }); return by.get(m); };
    daily.forEach((r) => get(r.date.slice(0, 7)).d.push(r));
    activities.forEach((r) => get(r.date.slice(0, 7)).a.push(r));
    vo2.forEach((r) => get(r.date.slice(0, 7)).v.push(r.vo2max));
    const mean = (v) => { v = v.filter((x) => x != null); return v.length >= 5 ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const cats = { Velo: 'h_velo', 'Velo indoor': 'h_velo', Laufen: 'h_laufen', Kraft: 'h_kraft', 'Tennis/Squash': 'h_racket', Wandern: 'h_wandern', Wintersport: 'h_winter', Andere: 'h_andere' };
    return [...by.values()].sort((a, b) => a.month.localeCompare(b.month)).map((g) => {
      const o = { month: g.month, days: g.d.filter((r) => r.wear_h != null).length };
      for (const k of ['rhr', 'sleep_h', 'deep_h', 'rem_h', 'sleep_score', 'stress_awake', 'steps', 'hrv', 'bb_wake', 'bedtime']) o[k] = mean(g.d.map((r) => r[k]));
      for (const h of new Set(Object.values(cats))) o[h] = 0;
      g.a.forEach((r) => { if (cats[r.cat]) o[cats[r.cat]] += r.dur_min / 60; });
      o.h_total = Object.values(cats).filter((v, i, s) => s.indexOf(v) === i).reduce((a, h) => a + o[h], 0);
      o.h_walk = g.a.filter((r) => r.cat === 'Gehen').reduce((a, r) => a + r.dur_min / 60, 0);
      o.light_h = o.sleep_h != null && o.deep_h != null && o.rem_h != null ? o.sleep_h - o.deep_h - o.rem_h : null;
      o.vo2max = g.v.length ? g.v.reduce((a, b) => a + b, 0) / g.v.length : null;
      return o;
    });
  },
});

dash.calc('after_training', {
  inputs: ['daily'],
  title: 'Nacht nach dem Training',
  description: 'Tage mit mind. 12 h Tragezeit, gruppiert nach intensiven Minuten (Garmin «vigorous») am Tag; Werte der folgenden Nacht bzw. des nächsten Morgens, mit Standardfehler.',
  fn: (daily) => {
    const keys = ['sleep_score', 'deep_h', 'rem_h', 'sleep_h', 'sleep_stress', 'rhr', 'bb_wake', 'hrv', 'readiness'];
    const bins = [['0 min', 0, 0], ['1–20 min', 1, 20], ['21–60 min', 21, 60], ['über 60 min', 61, 1e9]];
    const out = [];
    bins.forEach(([bin, lo, hi], order) => {
      const pairs = [];
      for (let i = 0; i < daily.length - 1; i++) {
        const r = daily[i];
        if (r.wear_h >= 12 && r.im_vig != null && r.im_vig >= lo && r.im_vig <= hi) pairs.push(daily[i + 1]);
      }
      for (const k of keys) {
        const v = pairs.map((x) => x[k]).filter((x) => x != null);
        const n = v.length; const m = n ? v.reduce((a, b) => a + b, 0) / n : null;
        const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : null;
        out.push({ bin, order, metric: k, mean: m, se: sd != null ? sd / Math.sqrt(n) : null, n });
      }
    });
    return out;
  },
});

dash.calc('recovery_curve', {
  inputs: ['daily'],
  title: 'Erholungskurve nach harten Tagen',
  description: 'Nach Tagen mit über 60 intensiven Minuten: Abweichung von Schlafscore, Ruhepuls und Stress vom persönlichen 28-Tage-Mittel, für die Nächte/Tage +1 bis +4.',
  fn: (daily) => {
    const keys = ['sleep_score', 'rhr', 'stress_awake', 'bb_wake'];
    const base = (i, k) => { const v = daily.slice(Math.max(0, i - 28), i).map((x) => x[k]).filter((x) => x != null); return v.length >= 10 ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const hard = []; daily.forEach((r, i) => { if (r.wear_h >= 12 && r.im_vig > 60) hard.push(i); });
    const out = [];
    for (const k of keys) for (let lag = 0; lag <= 4; lag++) {
      const v = [];
      hard.forEach((i) => { const j = i + lag; if (j < daily.length && daily[j][k] != null) { const b = base(i, k); if (b != null) v.push(daily[j][k] - b); } });
      const n = v.length; const m = n ? v.reduce((a, b) => a + b, 0) / n : null;
      const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : null;
      out.push({ metric: k, lag, dev: m, se: sd != null ? sd / Math.sqrt(n) : null, n });
    }
    return out;
  },
});

dash.calc('evening', {
  inputs: ['daily'],
  title: 'Spätes vs. frühes Training',
  description: 'Trainingstage, aufgeteilt nach Ende der letzten Einheit vor oder ab 19 Uhr; Werte der folgenden Nacht.',
  fn: (daily) => {
    const out = [];
    for (const grp of ['vor 19 Uhr', 'ab 19 Uhr']) {
      const nights = [];
      for (let i = 0; i < daily.length - 1; i++) {
        const r = daily[i];
        if (r.train_end_h == null || !(r.train_min > 0)) continue;
        if ((r.train_end_h >= 19) === (grp === 'ab 19 Uhr')) nights.push(daily[i + 1]);
      }
      const row = { group: grp, n: nights.filter((x) => x.sleep_score != null).length };
      for (const k of ['sleep_score', 'deep_h', 'sleep_stress', 'sleep_h', 'bedtime']) {
        const v = nights.map((x) => x[k]).filter((x) => x != null);
        row[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      }
      out.push(row);
    }
    return out;
  },
});

dash.calc('corr', {
  inputs: ['daily'],
  title: 'Korrelationsmatrix (Spearman)',
  description: 'Rangkorrelation zwischen Tageswerten. lag 0: gleicher Kalendertag; lag 1: Wert X an Tag D gegen Wert Y an Tag D+1. Schlafwerte zählen zum Tag des Aufwachens. Mindestens 30 Paare.',
  fn: (daily) => {
    const keys = ['sleep_h', 'deep_h', 'rem_h', 'sleep_score', 'sleep_stress', 'bedtime', 'awakenings', 'rhr', 'hrv', 'bb_wake', 'stress_awake', 'stress_high_min', 'steps', 'floors_m', 'im_mod', 'im_vig', 'train_min', 'kcal_active', 'readiness'];
    const rank = (v) => {
      const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(v.length);
      for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; }
      return r;
    };
    const pearson = (a, b) => { const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return saa && sbb ? sab / Math.sqrt(saa * sbb) : null; };
    const out = [];
    for (const lag of [0, 1]) for (const x of keys) for (const y of keys) {
      const a = [], b = [];
      for (let i = 0; i + lag < daily.length; i++) { const vx = daily[i][x], vy = daily[i + lag][y]; if (vx != null && vy != null) { a.push(vx); b.push(vy); } }
      const r = a.length >= 30 ? pearson(rank(a), rank(b)) : null;
      out.push({ lag, x, y, r: r == null ? null : Math.round(r * 1000) / 1000, n: a.length });
    }
    return out;
  },
});

dash.calc('weekday', {
  inputs: ['daily'],
  title: 'Wochentagsmuster',
  description: 'Mittelwerte pro Wochentag über alle Jahre. Schlafwerte gehören zum Morgen des Aufwachens (Montag = Nacht So→Mo).',
  fn: (daily) => {
    const names = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const g = names.map((n) => ({ weekday: n, rs: [] }));
    daily.forEach((r) => { const d = new Date(r.date + 'T00:00:00Z').getUTCDay(); g[(d + 6) % 7].rs.push(r); });
    return g.map((x, i) => {
      const o = { weekday: x.weekday, order: i };
      for (const k of ['sleep_h', 'bedtime', 'waketime', 'sleep_score', 'steps', 'stress_awake', 'train_min', 'rhr']) {
        const v = x.rs.map((r) => r[k]).filter((v) => v != null); o[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      }
      return o;
    });
  },
});

dash.calc('season', {
  inputs: ['daily'],
  title: 'Jahreszeitenmuster',
  description: 'Mittelwerte pro Kalendermonat über alle Jahre.',
  fn: (daily) => {
    const g = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, rs: [] }));
    daily.forEach((r) => g[+r.date.slice(5, 7) - 1].rs.push(r));
    return g.map((x) => {
      const o = { month: x.m };
      for (const k of ['sleep_h', 'sleep_score', 'rhr', 'steps', 'stress_awake', 'train_min', 'bedtime']) {
        const v = x.rs.map((r) => r[k]).filter((v) => v != null); o[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      }
      return o;
    });
  },
});

dash.calc('sport_year', {
  inputs: ['activities'],
  title: 'Stunden pro Sportart und Jahr',
  description: 'Summe der Aktivitätsdauer pro Kategorie und Jahr, mit Anzahl Einheiten.',
  fn: (activities) => {
    const m = new Map();
    activities.forEach((r) => { const k = r.date.slice(0, 4) + '|' + r.cat; const o = m.get(k) || { year: r.date.slice(0, 4), cat: r.cat, hours: 0, sessions: 0, km: 0 }; o.hours += r.dur_min / 60; o.sessions += 1; o.km += r.dist_km || 0; m.set(k, o); });
    return [...m.values()].sort((a, b) => a.year.localeCompare(b.year) || b.hours - a.hours);
  },
});

dash.calc('fit_drivers', {
  inputs: ['monthly'],
  title: 'Trainingsumfang vs. Fitness (Monate)',
  description: 'Spearman-Korrelation zwischen monatlichen Trainingsstunden (ohne Gehen) und Ruhepuls bzw. VO₂max im selben, nächsten und übernächsten Monat.',
  fn: (monthly) => {
    const rank = (v) => { const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = []; for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };
    const cor = (a, b) => { const ra = rank(a), rb = rank(b), n = a.length, m = (n + 1) / 2; let s = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { s += (ra[i] - m) * (rb[i] - m); sa += (ra[i] - m) ** 2; sb += (rb[i] - m) ** 2; } return s / Math.sqrt(sa * sb); };
    const ms = monthly.filter((r) => r.days >= 15);
    const out = [];
    for (const target of ['rhr', 'vo2max', 'sleep_score']) for (const lag of [0, 1, 2]) {
      const a = [], b = [];
      for (let i = 0; i + lag < ms.length; i++) if (ms[i + lag][target] != null) { a.push(ms[i].h_total); b.push(ms[i + lag][target]); }
      out.push({ target, lag, r: a.length >= 8 ? Math.round(cor(a, b) * 100) / 100 : null, n: a.length });
    }
    return out;
  },
});

dash.calc('sport_month', {
  inputs: ['activities', 'daily'],
  title: 'Ø Trainingsstunden pro Kalendermonat',
  description: 'Gesamtdauer je Sportart (ohne Gehen, Velo inkl. indoor) pro Kalendermonat, gemittelt über die Jahre; angebrochene oder lückenhafte Monate zählen anteilig nach Tagen mit Uhrdaten.',
  fn: (activities, daily) => {
    const cats = { Velo: 'Velo', 'Velo indoor': 'Velo', Laufen: 'Laufen', Kraft: 'Kraft', 'Tennis/Squash': 'Tennis/Squash', Wandern: 'Wandern', Wintersport: 'Wintersport', Andere: 'Andere' };
    const days = new Set(daily.filter((r) => r.wear_h != null).map((r) => r.date));
    activities.forEach((r) => days.add(r.date));
    const cover = Array(13).fill(0);
    days.forEach((d) => { const y = +d.slice(0, 4), mo = +d.slice(5, 7); cover[mo] += 1 / new Date(Date.UTC(y, mo, 0)).getUTCDate(); });
    const m = new Map();
    activities.forEach((r) => {
      const cat = cats[r.cat]; if (!cat || r.dur_min == null) return;
      const month = +r.date.slice(5, 7); const k = cat + '|' + month;
      const o = m.get(k) || { cat, month, min: 0, sessions: 0 };
      o.min += r.dur_min; o.sessions += 1; m.set(k, o);
    });
    return [...m.values()].map((o) => ({ cat: o.cat, month: o.month, hours: o.min / 60 / cover[o.month], total_h: o.min / 60, sessions: o.sessions, month_years: cover[o.month] }))
      .sort((a, b) => a.cat.localeCompare(b.cat) || a.month - b.month);
  },
});

dash.calc('sport_ytd', {
  inputs: ['activities', 'daily'],
  title: 'Stunden pro Jahr, gleicher Zeitraum',
  description: 'Trainingsstunden je Sportart (ohne Gehen, Velo inkl. indoor), jedes Jahr vom 1. Januar bis zum Kalendertag des letzten Datentags.',
  fn: (activities, daily) => {
    const last = daily.reduce((m, r) => (r.date > m ? r.date : m), '');
    const first = daily.reduce((m, r) => (!m || r.date < m ? r.date : m), '');
    const cut = last.slice(5);
    const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const label = `${+last.slice(8, 10)}. ${MON[+last.slice(5, 7) - 1]}`;
    const cats = { Velo: 'Velo', 'Velo indoor': 'Velo', Laufen: 'Laufen', Kraft: 'Kraft', 'Tennis/Squash': 'Tennis/Squash', Wandern: 'Wandern', Wintersport: 'Wintersport', Andere: 'Andere' };
    const years = [];
    for (let y = +first.slice(0, 4); y <= +last.slice(0, 4); y++) if (first <= `${y}-01-15`) years.push(String(y));
    const out = [];
    years.forEach((year) => Object.values(cats).filter((v, i, s) => s.indexOf(v) === i).forEach((cat) => {
      const h = activities.filter((r) => cats[r.cat] === cat && r.date.slice(0, 4) === year && r.date.slice(5) <= cut).reduce((a, r) => a + r.dur_min / 60, 0);
      out.push({ year, cat, hours: h, until_label: label });
    }));
    return out;
  },
});

dash.calc('sport_profile', {
  inputs: ['activities', 'daily'],
  title: 'Profil pro Sportart und Jahr',
  description: 'Je Sportart und Jahr: Anzahl Einheiten, Ø Dauer pro Einheit und Ø Distanz (nur wo meist eine Distanz erfasst ist). Jahre mit mind. 180 Tagen Daten.',
  fn: (activities, daily) => {
    const cats = { Velo: 'Velo', 'Velo indoor': 'Velo', Laufen: 'Laufen', Kraft: 'Kraft', 'Tennis/Squash': 'Tennis/Squash', Wandern: 'Wandern', Wintersport: 'Wintersport', Andere: 'Andere' };
    const dy = new Map(); daily.forEach((r) => dy.set(r.date.slice(0, 4), (dy.get(r.date.slice(0, 4)) || 0) + 1));
    const m = new Map();
    activities.forEach((r) => {
      const cat = cats[r.cat]; const year = r.date.slice(0, 4); if (!cat || (dy.get(year) || 0) < 180) return;
      const k = year + '|' + cat; const o = m.get(k) || { year, cat, n: 0, min: 0, kmN: 0, km: 0 };
      o.n += 1; o.min += r.dur_min || 0; if (r.dist_km > 0.5) { o.kmN += 1; o.km += r.dist_km; } m.set(k, o);
    });
    return [...m.values()].map((o) => ({ year: o.year, cat: o.cat, sessions: o.n, avg_min: o.min / o.n, avg_km: o.kmN >= o.n / 2 ? o.km / o.kmN : null }))
      .sort((a, b) => a.cat.localeCompare(b.cat) || a.year.localeCompare(b.year));
  },
});

// ---------- Zusätzliche Zusammenhänge ----------
dash.calc('sport_recovery', {
  inputs: ['daily'],
  title: 'Erholung nach Sportart',
  description: 'Tage mit einer klar dominierenden Sportart (mind. 20 min und 70 % der Trainingszeit) und Ruhetage; Abweichung der folgenden Nacht bzw. des nächsten Morgens vom eigenen 28-Tage-Mittel, mit Standardfehler.',
  fn: (daily) => {
    const SP = [['Ruhetag', null], ['Velo', 'min_Velo'], ['Laufen', 'min_Laufen'], ['Kraft', 'min_Kraft'], ['Tennis/Squash', 'min_Racket'], ['Wandern', 'min_Wandern']];
    const keys = ['sleep_score', 'deep_h', 'sleep_stress', 'rhr', 'bb_wake', 'hrv'];
    const base = (i, k) => { const v = daily.slice(Math.max(0, i - 28), i).map((x) => x[k]).filter((x) => x != null); return v.length >= 10 ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const grp = (r) => {
      if (!(r.wear_h >= 12)) return null;
      if (r.train_min === 0) return 'Ruhetag';
      for (const [g, f] of SP) if (f && r[f] >= 20 && r[f] >= 0.7 * r.train_min) return g;
      return null;
    };
    const days = new Map(SP.map(([g]) => [g, []]));
    for (let i = 0; i < daily.length - 1; i++) { const g = grp(daily[i]); if (g) days.get(g).push(i); }
    const out = [];
    SP.forEach(([g, f], order) => {
      const idx = days.get(g);
      const dur = f && idx.length ? idx.reduce((a, i) => a + daily[i][f], 0) / idx.length : 0;
      for (const k of keys) {
        const v = [];
        idx.forEach((i) => { const x = daily[i + 1][k]; const b = base(i + 1, k); if (x != null && b != null) v.push(x - b); });
        const n = v.length; const m = n ? v.reduce((a, b) => a + b, 0) / n : null;
        const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : null;
        out.push({ group: g, order, metric: k, dev: m, se: sd != null ? sd / Math.sqrt(n) : null, n, dur_min: dur });
      }
    });
    return out;
  },
});

dash.calc('efficiency', {
  inputs: ['activities'],
  title: 'Effizienz: Meter pro Herzschlag',
  description: 'Pro Lauf und pro flacher Velofahrt (draussen, mind. 15 km, höchstens 8 Hm/km): Durchschnittstempo geteilt durch Durchschnittspuls, in Metern pro Herzschlag; dazu der gleitende Median ±60 Tage.',
  fn: (activities) => {
    const rows = [];
    activities.forEach((r) => {
      if (!r.avg_hr || r.avg_hr < 90 || !r.speed_kmh || !(r.dur_min >= 15)) return;
      let sport = null;
      if (r.cat === 'Laufen' && r.speed_kmh > 5 && r.speed_kmh < 25) sport = 'Laufen';
      if (r.cat === 'Velo' && r.dist_km >= 15 && (r.elev_m || 0) / r.dist_km <= 8) sport = 'Velo flach';
      if (sport) rows.push({ activity_id: r.activity_id, date: r.date, sport, eff: (r.speed_kmh * 1000 / 60) / r.avg_hr, speed_kmh: r.speed_kmh, avg_hr: r.avg_hr });
    });
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const t = (s) => new Date(s + 'T00:00:00Z').getTime() / 864e5;
    rows.forEach((r) => {
      const w = rows.filter((x) => x.sport === r.sport && Math.abs(t(x.date) - t(r.date)) <= 60).map((x) => x.eff).sort((a, b) => a - b);
      r.trend = w.length >= 5 ? (w.length % 2 ? w[(w.length - 1) / 2] : (w[w.length / 2 - 1] + w[w.length / 2]) / 2) : null;
    });
    return rows;
  },
});

dash.calc('sleep_reg', {
  inputs: ['daily'],
  title: 'Regelmässigkeit der Einschlafzeit',
  description: 'Kalenderwochen mit mind. 5 Nächten, gruppiert nach der Streuung (Standardabweichung) der Einschlafzeit; Wochenmittel von Schlaf, Ruhepuls und Stress, mit Standardfehler und Spearman-r über alle Wochen.',
  fn: (daily) => {
    const keys = ['sleep_score', 'sleep_h', 'deep_h', 'rhr', 'bb_wake', 'stress_awake'];
    const wk = new Map();
    daily.forEach((r) => {
      const d = new Date(r.date + 'T00:00:00Z'); const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      const k = mon.toISOString().slice(0, 10); if (!wk.has(k)) wk.set(k, []); wk.get(k).push(r);
    });
    const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
    const weeks = [];
    wk.forEach((rs) => {
      const b = rs.map((r) => r.bedtime).filter((x) => x != null); if (b.length < 5) return;
      const m = mean(b); const sd = Math.sqrt(b.reduce((a, x) => a + (x - m) ** 2, 0) / (b.length - 1)) * 60;
      const o = { sd }; keys.forEach((k) => { o[k] = mean(rs.map((r) => r[k]).filter((x) => x != null)); }); weeks.push(o);
    });
    const rank = (v) => { const s = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = Array(v.length); let i = 0; while (i < s.length) { let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++; for (let q = i; q <= j; q++) r[s[q][1]] = (i + j) / 2; i = j + 1; } return r; };
    const spear = (a, b) => { const p = a.map((x, i) => [x, b[i]]).filter((x) => x[1] != null); if (p.length < 10) return null; const ra = rank(p.map((x) => x[0])), rb = rank(p.map((x) => x[1])); const ma = mean(ra), mb = mean(rb); let n = 0, da = 0, db = 0; ra.forEach((x, i) => { n += (x - ma) * (rb[i] - mb); da += (x - ma) ** 2; db += (rb[i] - mb) ** 2; }); return n / Math.sqrt(da * db); };
    const bins = [['unter 30 min', 0, 30], ['30–60 min', 30, 60], ['60–90 min', 60, 90], ['über 90 min', 90, 1e9]];
    const out = [];
    keys.forEach((k) => {
      const r = spear(weeks.map((w) => w.sd), weeks.map((w) => w[k]));
      bins.forEach(([bin, lo, hi], order) => {
        const v = weeks.filter((w) => w.sd >= lo && w.sd < hi).map((w) => w[k]).filter((x) => x != null);
        const n = v.length, m = mean(v); const sd = n > 1 ? Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)) : null;
        out.push({ metric: k, bin, order, mean: m, se: sd != null ? sd / Math.sqrt(n) : null, n, r });
      });
    });
    return out;
  },
});

dash.calc('before_events', {
  inputs: ['daily'],
  title: 'Was vor auffälligen Tagen passiert',
  description: 'Auffällige Tage: Ruhepuls mind. 3 bpm über, Body Battery morgens mind. 20 unter oder Schlafscore mind. 15 unter dem eigenen 28-Tage-Mittel (höchstens ein Ereignis pro 4 Tage). Für die drei Tage davor: Abweichung vom eigenen 28-Tage-Mittel, verglichen mit allen anderen 3-Tage-Fenstern, in Standardabweichungen.',
  fn: (daily) => {
    const EV = [['rhr', 'Ruhepuls hoch', (v, b) => v >= b + 3], ['bb_wake', 'Body Battery tief', (v, b) => v <= b - 20], ['sleep_score', 'Schlafscore tief', (v, b) => v <= b - 15]];
    const PR = ['train_min', 'im_vig', 'stress_awake', 'steps', 'sleep_h', 'sleep_score', 'bedtime'];
    const SLEEP = ['sleep_h', 'sleep_score', 'bedtime'];
    const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
    const base = (i, k) => { const v = daily.slice(Math.max(0, i - 28), i).map((x) => x[k]).filter((x) => x != null); return v.length >= 10 ? mean(v) : null; };
    const win = (i, k, shift) => { const v = daily.slice(i - 3 + shift, i + shift).map((x) => x[k]).filter((x) => x != null); return v.length >= 2 ? mean(v) : null; };
    const dev = (i, k, evk) => { const shift = SLEEP.includes(k) && evk !== 'sleep_score' ? 1 : 0; const w = win(i, k, shift), b = base(i - 3, k); return w != null && b != null ? w - b : null; };
    const out = [];
    EV.forEach(([evk, evName, test]) => {
      const ev = []; let lastEv = -99;
      for (let i = 31; i < daily.length; i++) {
        const v = daily[i][evk], b = base(i, evk);
        if (v != null && b != null && test(v, b) && i - lastEv >= 4) { ev.push(i); lastEv = i; }
      }
      const evSet = new Set(ev);
      PR.forEach((k) => {
        const all = []; for (let i = 31; i < daily.length; i++) if (!evSet.has(i)) { const d = dev(i, k, evk); if (d != null) all.push(d); }
        const ma = mean(all); const sdA = Math.sqrt(all.reduce((a, x) => a + (x - ma) ** 2, 0) / (all.length - 1));
        const e = ev.map((i) => dev(i, k, evk)).filter((x) => x != null);
        const me = mean(e); const sdE = e.length > 1 ? Math.sqrt(e.reduce((a, x) => a + (x - me) ** 2, 0) / (e.length - 1)) : null;
        out.push({ event: evName, predictor: k, z: me != null ? (me - ma) / sdA : null, se: sdE != null ? sdE / Math.sqrt(e.length) / sdA : null, dev_events: me, dev_other: ma, n_events: ev.length });
      });
    });
    return out;
  },
});

// ---------- Kalender ----------
dash.calc('calendar', {
  inputs: ['daily', 'activities'],
  title: 'Kalenderwerte pro Tag',
  description: 'Ein Eintrag pro Tag für die Kalender-Heatmaps: Tageswerte und Schlaf aus den Tageswerten, Distanz, Kalorien und max. Puls aus den Trainings des Tages (ohne Gehen).',
  fn: (daily, activities) => {
    const acts = new Map();
    activities.forEach((a) => {
      if (a.cat === 'Gehen') return;
      const o = acts.get(a.date) || { dist_km: 0, kcal: 0, max_hr: null };
      o.dist_km += a.dist_km || 0; o.kcal += a.kcal || 0;
      if (a.max_hr != null) o.max_hr = Math.max(o.max_hr || 0, a.max_hr);
      acts.set(a.date, o);
    });
    const keys = ['train_min', 'steps', 'rhr', 'sleep_h', 'sleep_score', 'sleep_stress', 'restless', 'stress_awake', 'bb_wake', 'hrv'];
    return daily.map((r) => {
      const o = { date: r.date };
      keys.forEach((k) => { o[k] = r[k] ?? null; });
      const a = acts.get(r.date);
      const trained = r.train_min != null;
      o.dist_km = a ? a.dist_km : trained ? 0 : null;
      o.kcal = a ? a.kcal : trained ? 0 : null;
      o.max_hr = a ? a.max_hr : null;
      return o;
    });
  },
});
