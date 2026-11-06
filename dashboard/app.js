// Darstellung des Dashboards. Daten kommen ausschliesslich über dash.data().
(() => {
  const GK = window.GK;
  const C = dash.colors;
  const MUTED = 'var(--cds-chart-muted)';
  const BAD = 'var(--cds-chart-status-critical)';

  const LBL = {
    sleep_h: 'Schlafdauer', deep_h: 'Tiefschlaf', rem_h: 'REM-Schlaf', sleep_score: 'Schlafscore', sleep_stress: 'Stress im Schlaf',
    bedtime: 'Einschlafzeit', awakenings: 'Aufwachphasen', rhr: 'Ruhepuls', hrv: 'HRV', bb_wake: 'Body Battery morgens',
    stress_awake: 'Stress wach', stress_high_min: 'Min. hoher Stress', steps: 'Schritte', floors_m: 'Höhenmeter Alltag',
    im_mod: 'Moderate Int.-Min.', im_vig: 'Intensive Minuten', train_min: 'Trainingsminuten', kcal_active: 'Aktive kcal', readiness: 'Readiness', waketime: 'Aufwachzeit',
  };
  const UNIT = { sleep_h: 'h', deep_h: 'h', rem_h: 'h', rhr: 'bpm', hrv: 'ms', steps: '', train_min: 'min', im_vig: 'min', im_mod: 'min', kcal_active: 'kcal', floors_m: 'm', stress_high_min: 'min' };
  const FMT = (k) => (k === 'bedtime' || k === 'waketime' ? GK.clock : ['sleep_h', 'deep_h', 'rem_h'].includes(k) ? GK.f2 : ['steps', 'kcal_active', 'floors_m', 'train_min', 'im_mod', 'im_vig', 'stress_high_min'].includes(k) ? GK.f0 : GK.f1);
  const PHR = {
    sleep_h: ['mehr Schlaf', 'weniger Schlaf'], deep_h: ['mehr Tiefschlaf', 'weniger Tiefschlaf'], rem_h: ['mehr REM-Schlaf', 'weniger REM-Schlaf'],
    sleep_score: ['höherer Schlafscore', 'tieferer Schlafscore'], sleep_stress: ['mehr Stress im Schlaf', 'weniger Stress im Schlaf'],
    bedtime: ['späteres Einschlafen', 'früheres Einschlafen'], awakenings: ['mehr Aufwachphasen', 'weniger Aufwachphasen'],
    rhr: ['höherer Ruhepuls', 'tieferer Ruhepuls'], hrv: ['höhere HRV', 'tiefere HRV'], bb_wake: ['vollere Body Battery', 'leerere Body Battery'],
    stress_awake: ['mehr Stress tagsüber', 'weniger Stress tagsüber'], stress_high_min: ['mehr Minuten mit hohem Stress', 'weniger Minuten mit hohem Stress'],
    steps: ['mehr Schritte', 'weniger Schritte'], floors_m: ['mehr Höhenmeter im Alltag', 'weniger Höhenmeter im Alltag'],
    im_mod: ['mehr moderate Intensität', 'weniger moderate Intensität'], im_vig: ['mehr intensive Minuten', 'weniger intensive Minuten'],
    train_min: ['mehr Training', 'weniger Training'], kcal_active: ['mehr aktive Kalorien', 'weniger aktive Kalorien'], readiness: ['höhere Readiness', 'tiefere Readiness'],
  };
  const WHEN = (k) => (['sleep_h', 'deep_h', 'rem_h', 'sleep_score', 'sleep_stress', 'bedtime', 'awakenings'].includes(k) ? 'in der Nacht danach' : ['rhr', 'hrv', 'bb_wake', 'readiness'].includes(k) ? 'am Morgen danach' : 'am Tag danach');
  const FAM = [['im_vig', 'im_mod', 'train_min', 'kcal_active', 'steps', 'floors_m'], ['sleep_score', 'sleep_h', 'deep_h', 'rem_h', 'awakenings'], ['stress_awake', 'stress_high_min']];
  const sameFam = (a, b) => FAM.some((f) => f.includes(a) && f.includes(b));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------- Zustand ----------
  const S = { page: 'ueberblick', after: 'sleep_score', curve: 'sleep_score', lag: 1, x: 'im_vig', y: 'sleep_score', week: 'sleep_score', hrv: 'hrv', seA: 'steps', seB: 'rhr', sort: ['date', -1], q: '' };
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, text) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const mark = (tag, src, field, where, text, cls) => el(tag, { 'data-source': src, 'data-field': field, 'data-where': where, class: cls }, text);
  const enc = (v) => String(v).replace(/%/g, '%25').replace(/&/g, '%26').replace(/=/g, '%3D');
  const W = (o) => Object.entries(o).map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&');

  document.querySelectorAll('.gx-chart').forEach((c) => c.classList.add('dash-skeleton'));

  function data(id, targets) {
    const d = dash.data(id);
    if (d.status === 'ok') return d.data;
    if (d.status === 'error' || d.status === 'missing') (targets || []).forEach((t) => { const e = $(t); if (e) { e.classList.remove('dash-skeleton'); e.replaceChildren(el('div', { class: 'gx-fail' }, 'Failed to load')); } });
    return null;
  }
  const done = (...ids) => ids.forEach((i) => $(i) && $(i).classList.remove('dash-skeleton'));
  const series = (rows, key, dateKey = 'date') => rows.map((r) => ({ x: GK.pd(r[dateKey]), y: r[key] }));
  const firstWith = (rows, key) => rows.find((r) => r[key] != null);

  function chips(id, opts, cur, onPick) {
    const box = $(id); box.replaceChildren();
    opts.forEach(([k, label]) => { const b = el('button', { class: 'gx-chip', type: 'button', 'aria-pressed': String(k === cur), id: `${id}-${k}` }, label); b.addEventListener('click', () => onPick(k)); box.appendChild(b); });
  }
  function legend(id, items) { const box = $(id); box.replaceChildren(...items.map(([c, n]) => { const s = el('span'); const i = el('i'); i.style.background = c; s.append(i, document.createTextNode(n)); return s; })); }

  // ---------- Tabs ----------
  const pages = ['ueberblick', 'schlaf', 'training', 'alltag', 'zusammenhaenge', 'kalender'];
  function show(p, link = true) {
    if (!pages.includes(p)) return;
    S.page = p;
    pages.forEach((q) => { $(q).hidden = q !== p; $('tab-' + q).setAttribute('aria-selected', String(q === p)); });
    if (link) dash.setLink(p);
    draw();
  }
  document.querySelectorAll('.gx-tab').forEach((b) => b.addEventListener('click', () => show(b.dataset.page)));

  // ---------- Kopf & Kennzahlen ----------
  const KPI = [
    ['rhr', 'Ruhepuls', 'bpm', GK.f1, -1], ['sleep_score', 'Schlafscore', '', GK.f1, 1], ['sleep_h', 'Schlafdauer', 'h', GK.f2, 0],
    ['stress_awake', 'Stress wach', '', GK.f1, -1], ['steps', 'Schritte', '/Tag', GK.f0, 1], ['train_h_week', 'Training', 'h/Woche', GK.f1, 0],
  ];
  function drawHead() {
    const kpi = data('kpi'), at = data('after_training');
    const take = $('takeaway');
    if (kpi && at) {
      const g = (m) => kpi.find((r) => r.metric === m);
      const a = (bin, m) => at.find((r) => r.bin === bin && r.metric === m);
      const sgn = (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v));
      const r = g('rhr'), s = g('sleep_score'), hi = a('über 60 min', 'sleep_score'), lo = a('0 min', 'sleep_score');
      take.replaceChildren(
        'In den letzten 90 Tagen lag der Ruhepuls bei ', mark('b', 'kpi', 'cur', W({ metric: 'rhr' }), GK.f1(r.cur)), ' bpm (',
        mark('span', 'kpi', 'delta', W({ metric: 'rhr' }), sgn(r.delta, GK.f1)), ' gegenüber dem Vorjahr) und der Schlafscore bei ',
        mark('b', 'kpi', 'cur', W({ metric: 'sleep_score' }), GK.f1(s.cur)), ' (', mark('span', 'kpi', 'delta', W({ metric: 'sleep_score' }), sgn(s.delta, GK.f1)),
        '). Der deutlichste Zusammenhang: Nach Tagen mit über 60 intensiven Minuten liegt der Schlafscore der folgenden Nacht im Schnitt bei ',
        mark('b', 'after_training', 'mean', W({ bin: 'über 60 min', metric: 'sleep_score' }), GK.f1(hi.mean)), ' statt ',
        mark('b', 'after_training', 'mean', W({ bin: '0 min', metric: 'sleep_score' }), GK.f1(lo.mean)), ' an Tagen ohne intensive Belastung.');
    } else if (dash.data('kpi').status === 'error') take.textContent = '';
    if (S.page !== 'ueberblick') return;
    const box = $('kpis'); box.replaceChildren();
    KPI.forEach(([m, label, unit, f, dir]) => {
      const card = el('div', { class: 'gx-kpi', id: 'kpi-' + m });
      card.appendChild(el('div', { class: 'gx-kpi-l' }, label));
      const r = kpi && kpi.find((x) => x.metric === m);
      const v = el('div', { class: 'gx-kpi-v' });
      v.appendChild(mark('span', 'kpi', 'cur', W({ metric: m }), r && r.cur != null ? f(r.cur) : '—', kpi ? null : 'dash-skeleton'));
      if (unit) v.appendChild(el('span', { class: 'gx-kpi-u' }, unit));
      card.appendChild(v);
      const d = el('div', { class: 'gx-kpi-d' });
      if (r && r.delta != null) {
        const good = dir === 0 ? null : r.delta * dir > 0;
        const sp = mark('span', 'kpi', 'delta', W({ metric: m }), (r.delta > 0 ? '+' : r.delta < 0 ? '−' : '±') + f(Math.abs(r.delta)), good == null ? null : good ? 'gx-good' : 'gx-bad');
        d.append(sp, ' vs. Vorjahr (', mark('span', 'kpi', 'prev', W({ metric: m }), f(r.prev)), ')');
      } else d.textContent = kpi ? 'kein Vorjahreswert' : '';
      card.appendChild(d);
      box.appendChild(card);
    });
    if (kpi) {
      const r = kpi[0]; const n = $('kpi-window');
      n.replaceChildren('Mittelwerte vom ', mark('span', 'kpi', 'from', W({ metric: 'rhr' }), GK.dfmt(GK.pd(r.from))), ' bis ', mark('span', 'kpi', 'to', W({ metric: 'rhr' }), GK.dfmt(GK.pd(r.to))),
        ', verglichen mit denselben 90 Tagen im Vorjahr. Grün heisst: Veränderung in die günstige Richtung.');
    }
  }

  // ---------- Überblick ----------
  function trend(id, key, color, fmt, opts = {}) {
    const roll = data('rolling', [id]); const daily = opts.noDaily ? [] : data('daily', [id]);
    if (!roll || !daily) return;
    const start = firstWith(roll, key); if (!start) return;
    const xd = [GK.pd(start.date), GK.pd(roll[roll.length - 1].date)];
    const s = [];
    if (!opts.noDaily) s.push({ name: 'Tag', color, data: series(daily, key), line: false, dots: true, label: false, tipFmt: fmt });
    s.push({ name: '28-Tage-Mittel', color, data: series(roll, key), tipFmt: fmt });
    GK.line($(id), { series: s, yFmt: fmt, xDomain: xd, height: opts.h || 160, yDomain: opts.yDomain, snap: 30 });
    done(id);
  }
  function clip(lo, hi) { return [lo, hi]; }
  function drawOverview() {
    trend('tr-rhr', 'rhr', C[0], GK.f0, { yDomain: clip(46, 63) });
    trend('tr-sleep', 'sleep_score', C[1], GK.f0, { yDomain: clip(40, 100) });
    trend('tr-stress', 'stress_awake', C[2], GK.f0, { yDomain: clip(15, 60) });
    trend('tr-steps', 'steps', C[3], GK.f0, { yDomain: clip(0, 25000) });
    trend('tr-sleeph', 'sleep_h', C[4], GK.f1, { yDomain: clip(5, 11) });
    trend('tr-train', 'train_min', C[5], GK.f0, { noDaily: true });
    const corr = data('corr', ['finds']); if (!corr) return;
    const top = corr.filter((r) => r.lag === 1 && r.r != null && r.x !== r.y && !sameFam(r.x, r.y) && r.n >= 100)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 8);
    const box = $('finds'); box.replaceChildren();
    top.forEach((r) => {
      const f = el('div', { class: 'gx-find ' + (r.r > 0 ? 'pos' : 'neg'), id: `find-${r.x}-${r.y}` });
      const line = el('span'); line.textContent = `${cap(PHR[r.x][0])} → ${r.r > 0 ? PHR[r.y][0] : PHR[r.y][1]} ${WHEN(r.y)}`;
      const sm = el('small'); sm.append('Spearman r = ', mark('b', 'corr', 'r', W({ lag: 1, x: r.x, y: r.y }), GK.f2(r.r)), ' · ', mark('span', 'corr', 'n', W({ lag: 1, x: r.x, y: r.y }), String(r.n)), ' Tagespaare');
      f.append(line, sm); box.appendChild(f);
    });
  }

  // ---------- Schlaf ----------
  const monthRows = (m, keys) => m.map((r) => ({ label: r.month, tick: r.month.slice(0, 4), tipLabel: GK.mfmt(GK.pd(r.month)), values: Object.fromEntries(keys.map((k) => [k, r[k]])) }));
  const janTick = (r, i) => r.label.endsWith('-01') || i === 0;
  function drawSleep() {
    const m = data('monthly', ['sleep-comp']);
    if (m) {
      const rows = monthRows(m.filter((r) => r.sleep_h != null), ['deep_h', 'rem_h', 'light_h']);
      legend('lg-sleep', [[C[0], 'Tiefschlaf'], [C[1], 'REM'], [C[2], 'Leichtschlaf']]);
      GK.bars($('sleep-comp'), { rows, stacks: [{ key: 'deep_h', name: 'Tiefschlaf', color: C[0] }, { key: 'rem_h', name: 'REM', color: C[1] }, { key: 'light_h', name: 'Leichtschlaf', color: C[2] }], yFmt: GK.f1, xLabel: janTick, height: 210 });
      done('sleep-comp');
    }
    const roll = data('rolling', ['sleep-bed', 'sleep-wake']);
    if (roll) {
      GK.line($('sleep-bed'), { series: [{ name: 'Einschlafen', color: C[3], data: series(roll, 'bedtime') }], yFmt: GK.clock, height: 130 });
      GK.line($('sleep-wake'), { series: [{ name: 'Aufwachen', color: C[4], data: series(roll, 'waketime') }], yFmt: GK.clock, height: 130 });
      done('sleep-bed', 'sleep-wake');
    }
    const wk = data('weekday', ['sleep-week']);
    chips('chips-week', [['sleep_score', 'Schlafscore'], ['sleep_h', 'Dauer'], ['bedtime', 'Einschlafzeit'], ['waketime', 'Aufwachzeit']], S.week, (k) => { S.week = k; draw(); });
    if (wk) {
      const k = S.week; const f = FMT(k);
      GK.errbars($('sleep-week'), { items: wk.map((r) => ({ label: r.weekday, mean: r[k], color: r.order >= 5 ? C[1] : MUTED })), yFmt: f, tipName: LBL[k] });
      done('sleep-week');
    }
    const daily = data('daily', ['hrv']), roll2 = data('rolling', ['hrv']);
    chips('chips-hrv', [['hrv', 'HRV'], ['readiness', 'Readiness']], S.hrv, (k) => { S.hrv = k; draw(); });
    if (daily && roll2) {
      const k = S.hrv; const st = firstWith(daily, k);
      if (st) {
        const xd = [GK.pd(st.date), GK.pd(daily[daily.length - 1].date)];
        GK.line($('hrv'), { series: [{ name: 'Tag', color: C[5], data: series(daily, k), line: false, dots: true, label: false, dotOpacity: 0.45, r: 2 }, { name: '28-Tage-Mittel', color: C[5], data: series(roll2, k) }], xDomain: xd, yFmt: GK.f0, height: 200, xFmt: (d) => GK.months[d.getUTCMonth()] });
      }
      done('hrv');
    }
    trend('bb', 'bb_wake', C[6], GK.f0, { h: 150 });
  }

  // ---------- Training ----------
  const SPORT = [['h_velo', 'Velo (inkl. indoor)', 0], ['h_laufen', 'Laufen', 1], ['h_kraft', 'Kraft', 2], ['h_racket', 'Tennis/Squash', 3], ['h_wandern', 'Wandern', 4], ['h_winter', 'Wintersport', 5], ['h_andere', 'Andere', 6]];
  const ACOLS = [['date', 'Datum', 'l'], ['name', 'Name', 'l'], ['cat', 'Sportart', 'l'], ['dur_min', 'Dauer min'], ['dist_km', 'km'], ['elev_m', 'Hm'], ['avg_hr', 'Puls Ø'], ['max_hr', 'Puls max'], ['load', 'Last'], ['te_aer', 'Aerob TE'], ['kcal', 'kcal'], ['device', 'Gerät', 'l']];
  function drawTraining() {
    const m = data('monthly', ['hours', 'vol-h', 'vol-rhr']);
    if (m) {
      legend('lg-hours', SPORT.map(([, n, i]) => [C[i], n]));
      GK.bars($('hours'), { rows: monthRows(m, SPORT.map((s) => s[0])), stacks: SPORT.map(([k, n, i]) => ({ key: k, name: n, color: C[i] })), yFmt: GK.f0, xLabel: janTick, height: 260 });
      GK.bars($('vol-h'), { rows: monthRows(m, ['h_total']), stacks: [{ key: 'h_total', name: 'Trainingsstunden', color: MUTED }], yFmt: GK.f0, xLabel: janTick, height: 150 });
      GK.line($('vol-rhr'), { series: [{ name: 'Ruhepuls', color: C[0], data: series(m.filter((r) => r.days >= 15), 'rhr', 'month'), dots: true, dotOpacity: 1, r: 2.2 }], yFmt: GK.f1, height: 140, tipDate: GK.mfmt });
      done('hours', 'vol-h', 'vol-rhr');
    }
    const sm = data('sport_month', ['sportmonth']);
    if (sm) { sportMonthBars($('sportmonth'), sm); done('sportmonth'); }
    const ytd = data('sport_ytd', ['ytd']);
    if (ytd && ytd.length) {
      const until = ytd[0].until_label; $('ytd-until').textContent = until;
      const yrs = [...new Set(ytd.map((r) => r.year))].sort();
      legend('lg-ytd', SM_CATS.map(([c, i]) => [C[i], c]));
      GK.bars($('ytd'), { rows: yrs.map((y) => ({ label: y, tipLabel: `${y}, 1. Jan – ${until}`, values: Object.fromEntries(ytd.filter((r) => r.year === y).map((r) => [r.cat, r.hours])) })),
        stacks: SM_CATS.map(([c, i]) => ({ key: c, name: c, color: C[i] })), yFmt: (v) => GK.f0(v) + ' h', height: 260 });
      done('ytd');
    }
    const pr = data('sport_profile', ['pr-n', 'pr-dur', 'pr-km']);
    if (pr) {
      const avail = SM_CATS.filter(([c]) => pr.some((r) => r.cat === c));
      if (!avail.some(([c]) => c === S.prof)) S.prof = avail[0][0];
      chips('chips-prof', avail.map(([c]) => [c, c]), S.prof, (k) => { S.prof = k; draw(); });
      const ci = avail.find(([c]) => c === S.prof)[1];
      const rr = pr.filter((r) => r.cat === S.prof).sort((a, b) => a.year.localeCompare(b.year));
      [['pr-n', 'sessions', GK.f0, 'Einheiten'], ['pr-dur', 'avg_min', GK.f0, 'Ø Dauer (min)'], ['pr-km', 'avg_km', GK.f1, 'Ø Distanz (km)']].forEach(([id, k, f, n]) => {
        const items = rr.map((r) => ({ label: r.year, mean: r[k], color: C[ci] }));
        if (items.every((i) => i.mean == null)) $(id).replaceChildren(el('p', { class: 'gx-note' }, 'Für diese Sportart wird keine Distanz erfasst.'));
        else GK.errbars($(id), { items, yFmt: f, tipName: n, height: 150, zero: true });
        done(id);
      });
    }
    const v = data('vo2', ['vo2']);
    if (v) {
      GK.line($('vo2'), { series: [
        { name: 'Laufen', color: C[1], data: series(v.filter((r) => r.sport === 'RUNNING'), 'vo2max'), dots: true, dotOpacity: 0.9, r: 2.4 },
        { name: 'Gehen', color: MUTED, data: series(v.filter((r) => r.sport === 'WALKING'), 'vo2max'), dots: true, dotOpacity: 0.9, r: 2.4, width: 1 }], yFmt: GK.f1, height: 200 });
      done('vo2');
    }
    const fa = data('fitage', ['fitage']);
    if (fa) {
      GK.line($('fitage'), { series: [{ name: 'Fitnessalter', color: C[0], data: series(fa, 'fit_age') }, { name: 'Alter', color: MUTED, data: series(fa, 'age'), dash: '4 4', width: 1.5 }], yFmt: GK.f1, height: 200 });
      done('fitage');
    }
    const fd = data('fit_drivers');
    if (fd) {
      const t = $('drivers'); t.replaceChildren();
      const hd = el('tr'); ['', 'gleicher Monat', '+1 Monat', '+2 Monate'].forEach((h, i) => hd.appendChild(el('th', { class: i ? null : 'l' }, h))); const th = el('thead'); th.appendChild(hd); t.appendChild(th);
      const tb = el('tbody');
      [['rhr', 'Ruhepuls'], ['vo2max', 'VO₂max (Lauf)'], ['sleep_score', 'Schlafscore']].forEach(([k, n]) => {
        const tr = el('tr'); tr.appendChild(el('td', { class: 'l' }, n));
        [0, 1, 2].forEach((lag) => { const r = fd.find((x) => x.target === k && x.lag === lag); const td = el('td'); td.appendChild(mark('span', 'fit_drivers', 'r', W({ target: k, lag }), r && r.r != null ? GK.f2(r.r) : '—')); tr.appendChild(td); });
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      const g = (k, l) => fd.find((x) => x.target === k && x.lag === l);
      const r2 = g('rhr', 2), v0 = g('vo2max', 0);
      $('drivers-note').replaceChildren('Mehr Trainingsstunden gehen mit einem ', r2.r < 0 ? 'tieferen' : 'höheren', ' Ruhepuls zwei Monate später einher (r = ', mark('b', 'fit_drivers', 'r', W({ target: 'rhr', lag: 2 }), GK.f2(r2.r)),
        '). Die VO₂max fällt in umfangreichen Monaten eher ', v0.r < 0 ? 'tiefer' : 'höher', ' aus (r = ', mark('b', 'fit_drivers', 'r', W({ target: 'vo2max', lag: 0 }), GK.f2(v0.r)),
        '). Eine plausible Erklärung: Viel Umfang heisst vor allem viel Velo, die VO₂max wird aber nur aus Läufen geschätzt.');
    }
    const ftp = data('ftp', ['ftp']);
    if (ftp) { GK.line($('ftp'), { series: [{ name: 'FTP', color: C[0], data: series(ftp, 'ftp_w'), dots: true, dotOpacity: 1, r: 3 }], yFmt: (v) => GK.f0(v) + ' W', height: 140, xFmt: (d) => GK.months[d.getUTCMonth()] }); done('ftp'); }
    const sy = data('sport_year');
    if (sy) {
      const t = $('sportyear'); t.replaceChildren();
      const cols = [['year', 'Jahr', 'l'], ['cat', 'Sportart', 'l'], ['hours', 'Stunden'], ['sessions', 'Einheiten'], ['km', 'km']];
      const hd = el('tr'); cols.forEach(([k, n, c]) => hd.appendChild(el('th', { 'data-field': k, class: c }, n))); const th = el('thead'); th.appendChild(hd); t.appendChild(th);
      const tb = el('tbody');
      [...sy].sort((a, b) => b.year.localeCompare(a.year) || b.hours - a.hours).forEach((r) => {
        const tr = el('tr'); tr.append(el('td', { class: 'l' }, r.year), el('td', { class: 'l' }, r.cat), el('td', {}, GK.f1(r.hours)), el('td', {}, GK.f0(r.sessions)), el('td', {}, GK.f0(r.km)));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
    }
    drawActs();
  }
  // Gestapelte Balken: Kalendermonat × Sportart, Segment = Ø Stunden pro Monat
  const SM_CATS = [['Velo', 0], ['Laufen', 1], ['Kraft', 2], ['Tennis/Squash', 3], ['Wandern', 4], ['Wintersport', 5], ['Andere', 6]];
  S.smOff = new Set();
  S.prof = 'Velo';
  function sportMonthBars(box, rows) {
    const cats = SM_CATS.filter(([c]) => rows.some((r) => r.cat === c));
    const cb = $('chips-sportmonth'); cb.replaceChildren();
    cats.forEach(([c, ci]) => {
      const b = el('button', { class: 'gx-chip', type: 'button', 'aria-pressed': String(!S.smOff.has(c)) });
      const i = el('i'); i.style.background = C[ci]; b.append(i, document.createTextNode(c));
      b.addEventListener('click', () => { S.smOff.has(c) ? S.smOff.delete(c) : S.smOff.add(c); sportMonthBars(box, rows); });
      cb.appendChild(b);
    });
    box.replaceChildren(); box.style.position = 'relative';
    const vis = cats.filter(([c]) => !S.smOff.has(c));
    if (!vis.length) { box.appendChild(el('div', { class: 'gx-fail' }, 'Keine Sportart ausgewählt')); return; }
    const get = (c, m) => rows.find((r) => r.cat === c && r.month === m);
    const avail = Math.max(240, box.clientWidth || 600);
    const w = avail;
    const H = 260;
    const svg = d3.select(box).append('svg').attr('width', w > avail ? w : '100%').attr('viewBox', `0 0 ${w} ${H}`).attr('height', H).style('display', 'block').style('overflow', 'visible').attr('font-family', 'var(--font-anthropic-sans)');
    const tip = d3.select(box).append('div').attr('class', 'gk-tip').style('opacity', 0);
    const max = d3.max(d3.range(1, 13), (mo) => d3.sum(vis, ([c]) => (get(c, mo) || {}).hours || 0)) || 1;
    const y0 = d3.scaleLinear([0, max], [H - 24, 8]).nice(4);
    const ticks = y0.ticks(4);
    const ml = 10 + d3.max(ticks, (t) => { const tt = svg.append('text').attr('font-size', 11).text(GK.f0(t)); const n = tt.node().getComputedTextLength(); tt.remove(); return n; });
    const m = { l: ml, r: 8, t: 8, b: 24 };
    const y = y0.range([H - m.b, m.t]);
    const x0 = d3.scaleBand(d3.range(1, 13), [m.l, w - m.r]).paddingInner(0.28).paddingOuter(0.05);
    const g = svg.append('g');
    g.selectAll('line').data(ticks).join('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y).attr('y2', y).attr('stroke', 'var(--cds-chart-grid)');
    g.selectAll('text').data(ticks).join('text').attr('x', m.l - 6).attr('y', (d) => y(d) + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(GK.f0);
    svg.append('text').attr('x', m.l).attr('y', m.t - 0).attr('dy', -2).attr('font-size', 10).attr('fill', 'var(--color-fg-muted)').text('h');
    for (let mo = 1; mo <= 12; mo++) {
      const gx = x0(mo);
      svg.append('text').attr('x', gx + x0.bandwidth() / 2).attr('y', H - 6).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(GK.months[mo - 1]);
      const bw = Math.min(40, x0.bandwidth()), off = (x0.bandwidth() - bw) / 2;
      let acc = 0;
      vis.forEach(([c, ci]) => {
        const r = get(c, mo); if (!r) return;
        svg.append('rect').attr('x', gx + off).attr('width', bw).attr('y', y(acc + r.hours)).attr('height', Math.max(0.5, y(acc) - y(acc + r.hours) - 1))
          .attr('fill', C[ci]);
        acc += r.hours;
      });
      svg.append('rect').attr('x', gx).attr('width', x0.bandwidth()).attr('y', m.t).attr('height', H - m.b - m.t).attr('fill', 'transparent')
        .on('pointermove', (ev) => {
          const [px, py] = d3.pointer(ev, box);
          const lines = vis.map(([c, ci]) => [c, ci, get(c, mo)]).filter((v) => v[2]);
          const yrs = lines.length ? lines[0][2].month_years : null;
          tip.html(`<div class="gk-tip-h">${GK.months[mo - 1]} · Ø Stunden pro Monat</div>` + (lines.length ? lines.map(([c, ci, r]) =>
            `<div class="gk-tip-r"><i style="background:${C[ci]}"></i><span>${GK.esc(c)}</span><b>${GK.f1(r.hours)} h</b></div>`).join('') +
            `<div class="gk-tip-r"><span>Total</span><b>${GK.f1(d3.sum(lines, (v) => v[2].hours))} h</b></div><div class="gk-tip-h" style="margin-top:4px">Mittel aus ${GK.f1(yrs)} Jahren</div>` : '<div class="gk-tip-r"><span>Keine Einheiten</span></div>')).style('opacity', 1);
          const tw = tip.node().offsetWidth, th = tip.node().offsetHeight; let left = px + 14; if (left + tw > box.clientWidth) left = px - tw - 14; if (left < 0) left = 0;
          tip.style('left', left + 'px').style('top', Math.max(0, py - th / 2) + 'px');
        }).on('pointerleave', () => tip.style('opacity', 0));
    }
  }
  function drawActs() {
    const a = data('activities'); if (!a) return;
    const t = $('acts'); t.replaceChildren();
    const hd = el('tr');
    ACOLS.forEach(([k, n, c]) => {
      const th = el('th', { 'data-field': k, class: c, 'aria-sort': S.sort[0] === k ? (S.sort[1] > 0 ? 'ascending' : 'descending') : 'none' });
      const b = el('button', { class: 'gx-th', type: 'button' }, n + (S.sort[0] === k ? (S.sort[1] > 0 ? ' ↑' : ' ↓') : ''));
      b.addEventListener('click', () => { S.sort = [k, S.sort[0] === k ? -S.sort[1] : (c ? 1 : -1)]; drawActs(); });
      th.appendChild(b); hd.appendChild(th);
    });
    const thead = el('thead'); thead.appendChild(hd); t.appendChild(thead);
    const q = S.q.trim().toLowerCase();
    const rows = a.filter((r) => !q || `${r.date} ${r.name} ${r.cat} ${r.type} ${r.device}`.toLowerCase().includes(q));
    const [k, dir] = S.sort;
    rows.sort((x, y) => { const u = x[k], v = y[k]; if (u == null) return 1; if (v == null) return -1; return (typeof u === 'number' ? u - v : String(u).localeCompare(String(v))) * dir; });
    const tb = el('tbody');
    const fmt = { dur_min: GK.f0, dist_km: GK.f1, elev_m: GK.f0, avg_hr: GK.f0, max_hr: GK.f0, load: GK.f0, te_aer: GK.f1, kcal: GK.f0 };
    rows.forEach((r) => {
      const tr = el('tr', { 'data-key': r.activity_id });
      ACOLS.forEach(([c, , cl]) => { const v = r[c]; tr.appendChild(el('td', { class: (cl || '') + (c === 'name' ? ' name' : '') || null }, v == null ? '–' : fmt[c] ? fmt[c](v) : String(v))); });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    $('act-count').textContent = `${rows.length} von ${a.length} Aktivitäten`;
  }
  $('act-search').addEventListener('input', (e) => { S.q = e.target.value; drawActs(); });

  // ---------- Alltag ----------
  const SEASON = [['steps', 'Schritte'], ['sleep_h', 'Schlafdauer'], ['sleep_score', 'Schlafscore'], ['rhr', 'Ruhepuls'], ['stress_awake', 'Stress'], ['train_min', 'Training'], ['bedtime', 'Einschlafzeit']];
  function drawDaily() {
    const m = data('monthly', ['steps-m', 'stress-m']);
    if (m) {
      GK.bars($('steps-m'), { rows: monthRows(m.filter((r) => r.steps != null), ['steps']), stacks: [{ key: 'steps', name: 'Schritte pro Tag', color: C[3] }], yFmt: GK.f0, xLabel: janTick, height: 200 });
      GK.line($('stress-m'), { series: [{ name: 'Stress wach', color: C[2], data: series(m.filter((r) => r.days >= 15), 'stress_awake', 'month'), dots: true, dotOpacity: 1, r: 2.2 }], yFmt: GK.f0, height: 150, tipDate: GK.mfmt });
      done('steps-m', 'stress-m');
    }
    const wk = data('weekday', ['wk-steps', 'wk-train', 'wk-stress']);
    if (wk) {
      [['wk-steps', 'steps', C[3]], ['wk-train', 'train_min', C[5]], ['wk-stress', 'stress_awake', C[2]]].forEach(([id, k, c]) => {
        GK.errbars($(id), { items: wk.map((r) => ({ label: r.weekday, mean: r[k], color: r.order >= 5 ? c : MUTED })), yFmt: FMT(k), tipName: LBL[k], height: 160, zero: k !== 'stress_awake' });
        done(id);
      });
    }
    const se = data('season', ['se-a', 'se-b']);
    chips('chips-season-a', SEASON, S.seA, (k) => { S.seA = k; draw(); });
    chips('chips-season-b', SEASON, S.seB, (k) => { S.seB = k; draw(); });
    if (se) {
      [['se-a', S.seA, C[0]], ['se-b', S.seB, C[1]]].forEach(([id, k, c]) => {
        const items = se.map((r) => ({ label: GK.months[r.month - 1], mean: r[k], color: c }));
        GK.errbars($(id), { items, yFmt: FMT(k), tipName: LBL[k] || 'Training', height: 170, zero: ['steps', 'train_min'].includes(k) });
        done(id);
      });
    }
  }

  // ---------- Zusammenhänge ----------
  const AFTER = [['sleep_score', 'Schlafscore', 1], ['deep_h', 'Tiefschlaf', 1], ['rem_h', 'REM', 1], ['sleep_h', 'Schlafdauer', 0], ['sleep_stress', 'Schlafstress', -1], ['rhr', 'Ruhepuls', -1], ['bb_wake', 'Body Battery', 1], ['hrv', 'HRV', 1], ['readiness', 'Readiness', 1]];
  const CURVE = [['sleep_score', 'Schlafscore', 1], ['rhr', 'Ruhepuls', -1], ['stress_awake', 'Stress wach', -1], ['bb_wake', 'Body Battery', 1]];
  const HEATKEYS = ['im_vig', 'im_mod', 'train_min', 'kcal_active', 'steps', 'floors_m', 'stress_awake', 'stress_high_min', 'bedtime', 'sleep_h', 'deep_h', 'rem_h', 'awakenings', 'sleep_score', 'sleep_stress', 'bb_wake', 'rhr', 'hrv', 'readiness'];
  // ---------- Weitere Zusammenhänge ----------
  const SR = [['sleep_score', 'Schlafscore', 1, GK.f1], ['deep_h', 'Tiefschlaf', 1, GK.f2], ['sleep_stress', 'Schlafstress', -1, GK.f1], ['rhr', 'Ruhepuls', -1, GK.f1], ['bb_wake', 'Body Battery', 1, GK.f1], ['hrv', 'HRV', 1, GK.f1]];
  const SRG = { Ruhetag: ['Ruhetag', MUTED], Velo: ['Velo', 0], Laufen: ['Laufen', 1], Kraft: ['Kraft', 2], 'Tennis/Squash': ['Squash', 3], Wandern: ['Wandern', 4] };
  const REG = [['sleep_score', 'Schlafscore', GK.f1], ['sleep_h', 'Schlafdauer', GK.f2], ['deep_h', 'Tiefschlaf', GK.f2], ['rhr', 'Ruhepuls', GK.f1], ['bb_wake', 'Body Battery', GK.f1], ['stress_awake', 'Stress wach', GK.f1]];
  const BEV = [['Ruhepuls hoch', 'Ruhepuls hoch'], ['Body Battery tief', 'Body Battery tief'], ['Schlafscore tief', 'Schlafscore tief']];
  const BPR = { train_min: ['Training', 'Trainingsminuten', 'min', GK.f0], im_vig: ['Intensiv', 'Intensive Minuten', 'min', GK.f0], stress_awake: ['Stress', 'Stress wach', '', GK.f1], steps: ['Schritte', 'Schritte', '', GK.f0], sleep_h: ['Schlaf', 'Schlafdauer', 'h', GK.f2], sleep_score: ['Score', 'Schlafscore', '', GK.f1], bedtime: ['Bettzeit', 'Einschlafzeit (später = +)', 'h', GK.f2] };
  Object.assign(S, { sr: 'sleep_score', reg: 'sleep_score', bev: 'Ruhepuls hoch', eff: 'Laufen' });
  function drawMore() {
    const sr = data('sport_recovery', ['sportrec']);
    chips('chips-sportrec', SR.map(([k, n]) => [k, n]), S.sr, (k) => { S.sr = k; draw(); });
    if (sr) {
      const [, nm, dir, f] = SR.find((x) => x[0] === S.sr);
      $('sportrec-dir').textContent = `${nm}: ${dir > 0 ? 'höher' : 'tiefer'} ist besser.`;
      const rows = sr.filter((r) => r.metric === S.sr).sort((a, b) => a.order - b.order);
      GK.errbars($('sportrec'), { items: rows.filter((r) => r.n >= 5).map((r) => ({ label: SRG[r.group][0], tipLabel: r.group, mean: r.dev, se: r.se, n: r.n, color: SRG[r.group][1] === MUTED ? MUTED : C[SRG[r.group][1]] })), yFmt: f, tipName: 'Abweichung', zeroLine: true, height: 220 });
      const parts = ['Ø Dauer an diesen Tagen: '];
      rows.filter((r) => r.group !== 'Ruhetag').forEach((r, i) => { if (i) parts.push(', '); parts.push(r.group + ' ', mark('b', 'sport_recovery', 'dur_min', W({ group: r.group, metric: S.sr }), GK.f0(r.dur_min)), ' min'); });
      parts.push('.'); $('sportrec-dur').replaceChildren(...parts);
      done('sportrec');
    }
    const be = data('before_events', ['before']);
    chips('chips-before', BEV, S.bev, (k) => { S.bev = k; draw(); });
    if (be) {
      const rows = be.filter((r) => r.event === S.bev);
      $('before-n').replaceChildren(mark('b', 'before_events', 'n_events', W({ event: S.bev, predictor: 'train_min' }), GK.f0(rows[0].n_events)), ' auffällige Tage (höchstens einer pro 4 Tage).');
      GK.errbars($('before'), { items: rows.map((r) => ({ label: BPR[r.predictor][0], tipLabel: BPR[r.predictor][1], mean: r.z, se: r.se, color: Math.abs(r.z) >= 0.4 && Math.abs(r.z) > 2 * (r.se || 0) ? C[1] : MUTED })), yFmt: GK.f2, tipName: 'Std.-Abw.', zeroLine: true, height: 210 });
      const t = $('before-t'); t.replaceChildren();
      const hd = el('tr'); [['predictor', 'Kennzahl', 'l'], ['dev_events', 'vor auffälligen Tagen'], ['dev_other', 'sonst'], ['z', 'Std.-Abw.']].forEach(([k, n, c]) => hd.appendChild(el('th', { 'data-field': k, class: c }, n)));
      const th = el('thead'); th.appendChild(hd); t.appendChild(th);
      const tb = el('tbody');
      rows.forEach((r) => {
        const [, full, u, f] = BPR[r.predictor]; const sg = (v) => (v > 0 ? '+' : '') + f(v) + (u ? ' ' + u : '');
        const tr = el('tr', { 'data-key': `${enc(r.event)},${enc(r.predictor)}` });
        tr.append(el('td', { class: 'l' }, full), el('td', {}, r.dev_events == null ? '–' : sg(r.dev_events)), el('td', {}, sg(r.dev_other)), el('td', {}, r.z == null ? '–' : (r.z > 0 ? '+' : '') + GK.f2(r.z)));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      done('before');
    }
    const ef = data('efficiency', ['eff']);
    chips('chips-eff', [['Laufen', 'Laufen'], ['Velo flach', 'Velo flach']], S.eff, (k) => { S.eff = k; draw(); });
    if (ef) {
      const rr = ef.filter((r) => r.sport === S.eff); const c = S.eff === 'Laufen' ? C[1] : C[0];
      GK.line($('eff'), { series: [
        { name: 'Einheit', color: c, data: rr.map((r) => ({ x: GK.pd(r.date), y: r.eff })), dots: true, dotOpacity: 0.45, r: 2.6, line: false, label: false },
        { name: 'Median ±60 T.', color: c, data: rr.map((r) => ({ x: GK.pd(r.date), y: r.trend })), width: 2.5 }], yFmt: GK.f2, height: 220, tipFmt: GK.f2 });
      done('eff');
    }
    const sg = data('sleep_reg', ['sleepreg']);
    chips('chips-sleepreg', REG.map(([k, n]) => [k, n]), S.reg, (k) => { S.reg = k; draw(); });
    if (sg) {
      const [, nm, f] = REG.find((x) => x[0] === S.reg);
      const rows = sg.filter((r) => r.metric === S.reg).sort((a, b) => a.order - b.order);
      GK.errbars($('sleepreg'), { items: rows.map((r) => ({ label: r.bin, mean: r.mean, se: r.se, n: r.n, color: C[6] })), yFmt: f, tipName: nm, nName: 'Wochen', height: 210 });
      const r = rows[0].r;
      $('sleepreg-r').replaceChildren('Rangkorrelation über alle Wochen zwischen Streuung und ', nm, ': r = ', mark('b', 'sleep_reg', 'r', W({ metric: S.reg, bin: rows[0].bin }), r == null ? '—' : GK.f2(r)), r == null ? '' : Math.abs(r) < 0.1 ? ' (kein Muster).' : Math.abs(r) < 0.2 ? ' (schwach).' : ' (merklich).');
      done('sleepreg');
    }
  }
  function drawLinks() {
    const at = data('after_training', ['after']);
    chips('chips-after', AFTER.map(([k, n]) => [k, n]), S.after, (k) => { S.after = k; draw(); });
    if (at) {
      const k = S.after; const rows = at.filter((r) => r.metric === k).sort((a, b) => a.order - b.order);
      GK.errbars($('after'), { items: rows.map((r, i) => ({ label: r.bin, mean: r.mean, se: r.se, n: r.n, color: i === rows.length - 1 ? C[0] : MUTED })), yFmt: FMT(k), tipName: LBL[k] });
      done('after');
      const g = (b, m) => at.find((r) => r.bin === b && r.metric === m);
      const part = (m, f, u) => [mark('b', 'after_training', 'mean', W({ bin: 'über 60 min', metric: m }), f(g('über 60 min', m).mean) + u), ' statt ', mark('b', 'after_training', 'mean', W({ bin: '0 min', metric: m }), f(g('0 min', m).mean) + u)];
      $('ts-take').replaceChildren('Nach Tagen mit über 60 intensiven Minuten: Schlafscore ', ...part('sleep_score', GK.f1, ''), ', Tiefschlaf ', ...part('deep_h', GK.f2, ' h'), ', Training Readiness am Morgen ', ...part('readiness', GK.f0, ''),
        '. Bis 20 intensive Minuten ändert sich wenig. Die Schlafdauer bleibt fast gleich; es leidet die Qualität.');
    }
    const cv = data('recovery_curve', ['curve']);
    chips('chips-curve', CURVE.map(([k, n]) => [k, n]), S.curve, (k) => { S.curve = k; draw(); });
    if (cv) {
      const [k, , dir] = CURVE.find((c) => c[0] === S.curve);
      const rows = cv.filter((r) => r.metric === k).sort((a, b) => a.lag - b.lag);
      const f = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + GK.f1(Math.abs(v));
      GK.errbars($('curve'), { items: rows.map((r) => ({ label: r.lag === 0 ? 'Tag 0' : `+${r.lag}`, tipLabel: r.lag === 0 ? 'Trainingstag' : `${r.lag} Tag${r.lag > 1 ? 'e' : ''} danach`, mean: r.dev, se: r.se, n: r.n, color: r.dev * dir < 0 && Math.abs(r.dev) > 1.5 * (r.se || 0) ? BAD : MUTED })), yFmt: f, zeroLine: true, tipName: 'Abweichung' });
      done('curve');
    }
    const ev = data('evening');
    if (ev) {
      const t = $('evening'); t.replaceChildren();
      const cols = [['group', 'Ende letzte Einheit', 'l'], ['n', 'Nächte'], ['sleep_score', 'Schlafscore'], ['deep_h', 'Tiefschlaf h'], ['sleep_stress', 'Schlafstress'], ['sleep_h', 'Schlafdauer h']];
      const hd = el('tr'); cols.forEach(([k, n, c]) => hd.appendChild(el('th', { 'data-field': k, class: c }, n))); const th = el('thead'); th.appendChild(hd); t.appendChild(th);
      const tb = el('tbody');
      ev.forEach((r) => { const tr = el('tr'); tr.append(el('td', { class: 'l' }, r.group), el('td', {}, GK.f0(r.n)), el('td', {}, GK.f1(r.sleep_score)), el('td', {}, GK.f2(r.deep_h)), el('td', {}, GK.f1(r.sleep_stress)), el('td', {}, GK.f2(r.sleep_h))); tb.appendChild(tr); });
      t.appendChild(tb);
      const a = ev.find((r) => r.group === 'vor 19 Uhr'), b = ev.find((r) => r.group === 'ab 19 Uhr');
      const dS = b.sleep_score - a.sleep_score;
      $('evening-note').replaceChildren(Math.abs(dS) < 2 ? 'Kaum ein Unterschied im Schlafscore (' : 'Ein spürbarer Unterschied im Schlafscore (',
        mark('b', 'evening', 'sleep_score', W({ group: 'ab 19 Uhr' }), GK.f1(b.sleep_score)), ' vs. ', mark('b', 'evening', 'sleep_score', W({ group: 'vor 19 Uhr' }), GK.f1(a.sleep_score)),
        '). Der Tiefschlaf ist nach spätem Training etwas kürzer. Wie hart trainiert wird, zählt offenbar mehr als wann.');
    }
    const corr = data('corr', ['heat']);
    chips('chips-lag', [[0, 'Gleicher Tag'], [1, 'Tag → Folgetag']], S.lag, (k) => { S.lag = k; draw(); });
    $('lag-note').textContent = S.lag === 1 ? 'Spalte = Wert an einem Tag, Zeile = Wert am Folgetag. Schlafwerte gehören zum Tag des Aufwachens; «Trainingsminuten → Schlafscore» heisst also: Training heute, Schlaf in der Nacht danach.' : 'Beide Werte vom selben Kalendertag. Schlafwerte gehören zum Tag des Aufwachens, also zur Nacht davor.';
    legend('lg-heat', [[C[1], 'negativ (−0.7)'], ['var(--color-panel)', '0'], [C[0], 'positiv (+0.7)']]);
    if (corr) {
      const idx = new Map(corr.map((r) => [`${r.lag}|${r.x}|${r.y}`, r]));
      GK.heat($('heat'), { keys: HEATKEYS, label: (k) => LBL[k], get: (x, y) => idx.get(`${S.lag}|${x}|${y}`), pos: C[0], neg: C[1], selected: [S.x, S.y], onPick: (x, y) => { S.x = x; S.y = y; draw(); } });
      done('heat');
    }
    const sx = $('sel-x'), sy = $('sel-y');
    if (!sx.options.length) {
      HEATKEYS.forEach((k) => { sx.appendChild(new Option(LBL[k], k)); sy.appendChild(new Option(LBL[k], k)); });
      sx.addEventListener('change', () => { S.x = sx.value; draw(); }); sy.addEventListener('change', () => { S.y = sy.value; draw(); });
    }
    sx.value = S.x; sy.value = S.y;
    const daily = data('daily', ['scatter']);
    if (daily && corr) {
      const pts = [];
      for (let i = 0; i + S.lag < daily.length; i++) { const a = daily[i][S.x], b = daily[i + S.lag][S.y]; if (a != null && b != null) pts.push({ x: a, y: b }); }
      GK.scatter($('scatter'), { pts, xFmt: FMT(S.x), yFmt: FMT(S.y), xLabel: LBL[S.x], yLabel: LBL[S.y], color: MUTED, accent: C[0] });
      done('scatter');
      const r = corr.find((c) => c.lag === S.lag && c.x === S.x && c.y === S.y);
      const rEl = $('sc-r'); rEl.setAttribute('data-field', 'r'); rEl.setAttribute('data-where', W({ lag: S.lag, x: S.x, y: S.y }));
      rEl.textContent = r && r.r != null ? 'r = ' + GK.f2(r.r) : 'r = —';
      $('sc-desc').textContent = `${LBL[S.x]} ${S.lag ? 'an einem Tag' : ''} gegen ${LBL[S.y]} ${S.lag ? 'am Folgetag' : 'am selben Tag'} · ${pts.length} Tage` + (S.x === S.y && S.lag === 0 ? ' (identisch)' : '');
    }
  }

  // ---------- Kalender ----------
  const CAL = [
    ['train_min', 'Trainingsminuten', GK.f0, 0], ['dist_km', 'Distanz (km)', GK.f1, 0], ['kcal', 'Kalorien Training', GK.f0, 1],
    ['max_hr', 'Max. Puls', GK.f0, 3], ['steps', 'Schritte', GK.f0, 3], ['rhr', 'Ruhepuls', GK.f0, 3],
    ['sleep_h', 'Schlafdauer (h)', GK.f1, 4], ['sleep_score', 'Schlafscore', GK.f0, 4], ['sleep_stress', 'Stress im Schlaf', GK.f0, 2],
    ['restless', 'Unruhige Momente', GK.f0, 2], ['stress_awake', 'Stress wach', GK.f0, 2], ['bb_wake', 'Body Battery', GK.f0, 6], ['hrv', 'HRV', GK.f0, 5],
  ];
  Object.assign(S, { cal: 'train_min', wgYear: null });
  function drawCalendar() {
    const rows = data('calendar', ['cal', 'weekgrid']); if (!rows) return;
    const avail = CAL.filter(([k]) => rows.some((r) => r[k] != null));
    if (!avail.length) { done('cal', 'weekgrid'); return; }
    if (!avail.some(([k]) => k === S.cal)) S.cal = avail[0][0];
    chips('chips-cal', avail.map(([k, n]) => [k, n]), S.cal, (k) => { S.cal = k; draw(); });
    const [k, label, f, ci] = avail.find((c) => c[0] === S.cal);
    const pts = rows.filter((r) => r[k] != null).map((r) => ({ date: r.date, v: r[k] }));
    const vals = pts.map((p) => p.v).sort(d3.ascending);
    const lo = d3.quantileSorted(vals, 0.02), hi = d3.quantileSorted(vals, 0.98);
    const top = GK.resolve(C[ci]), low = d3.interpolateRgb(GK.resolve('var(--color-panel)'), top)(0.12);
    const color = (v) => d3.interpolateRgb(low, top)(hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 1);
    legend('lg-cal', [[color(lo), `${f(lo)} oder weniger`], [color((lo + hi) / 2), f((lo + hi) / 2)], [color(hi), `${f(hi)} oder mehr`], ['var(--color-border-line)', 'keine Daten']]);
    const years = [...new Set(pts.map((p) => +p.date.slice(0, 4)))].sort((a, b) => a - b);
    GK.calendar($('cal'), { rows: pts, years, color, fmt: f, label });
    if (!years.includes(S.wgYear)) S.wgYear = years[years.length - 1];
    chips('chips-wg-year', years.map((y) => [y, String(y)]), S.wgYear, (y) => { S.wgYear = y; draw(); });
    GK.weekgrid($('weekgrid'), { rows: pts, year: S.wgYear, color, fmt: f, label });
    done('cal', 'weekgrid');
  }

  function draw() {
    drawHead();
    if (S.page === 'ueberblick') drawOverview();
    if (S.page === 'schlaf') drawSleep();
    if (S.page === 'training') drawTraining();
    if (S.page === 'alltag') drawDaily();
    if (S.page === 'zusammenhaenge') { drawLinks(); drawMore(); }
    if (S.page === 'kalender') drawCalendar();
  }

  const h = location.hash.slice(1);
  if (pages.includes(h)) show(h, false);
  dash.onData(draw);
})();
