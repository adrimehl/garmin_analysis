// Kleine Chart-Bibliothek für dieses Dashboard (d3 v7). Alles hängt an window.GK.
(() => {
  const GK = {};
  const css = (v) => `var(${v})`;
  GK.de = d3.formatLocale({ decimal: '.', thousands: '’', grouping: [3], currency: ['CHF ', ''] });
  GK.f0 = GK.de.format(',.0f');
  GK.f1 = GK.de.format(',.1f');
  GK.f2 = GK.de.format(',.2f');
  GK.clock = (h) => { if (h == null || isNaN(h)) return '—'; let m = Math.round(((h % 24) + 24) % 24 * 60); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  GK.months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  GK.dfmt = (d) => `${d.getUTCDate()}. ${GK.months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  GK.mfmt = (d) => `${GK.months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  GK.pd = (s) => new Date((s.length === 7 ? s + '-01' : s) + 'T00:00:00Z');

  const resolveCache = new Map();
  GK.resolve = (c) => {
    const probe = document.createElement('span'); probe.style.color = c; probe.style.display = 'none';
    document.getElementById('dash-root').appendChild(probe);
    const v = getComputedStyle(probe).color; probe.remove(); return v;
  };

  function frame(el, height) {
    el.replaceChildren();
    el.style.position = 'relative';
    const w = Math.max(240, el.clientWidth || 600);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${height}`).attr('height', height)
      .style('display', 'block').style('overflow', 'visible').attr('font-family', 'var(--font-anthropic-sans)');
    const tip = d3.select(el).append('div').attr('class', 'gk-tip').style('opacity', 0);
    return { svg, tip, w };
  }
  function textW(svg, s, size = 12) {
    const t = svg.append('text').attr('font-size', size).text(s); const n = t.node().getComputedTextLength(); t.remove(); return n;
  }
  function showTip(tip, el, x, y, html) {
    tip.html(html).style('opacity', 1);
    const tw = tip.node().offsetWidth, th = tip.node().offsetHeight, W = el.clientWidth;
    let left = x + 14; if (left + tw > W) left = x - tw - 14; if (left < 0) left = 0;
    let top = y - th / 2; if (top < 0) top = 0;
    tip.style('left', left + 'px').style('top', top + 'px');
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  GK.esc = esc;
  function tipRows(head, rows) {
    return `<div class="gk-tip-h">${esc(head)}</div>` + rows.map((r) => `<div class="gk-tip-r">${r.color ? `<i style="background:${r.color}"></i>` : ''}<span>${esc(r.name)}</span><b>${esc(r.value)}</b></div>`).join('');
  }
  function yAxis(svg, y, m, w, fmt, ticks) {
    const tv = y.ticks(ticks);
    const g = svg.append('g');
    g.selectAll('line').data(tv).join('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y).attr('y2', y).attr('stroke', css('--cds-chart-grid')).attr('stroke-width', 1);
    g.selectAll('text').data(tv).join('text').attr('x', m.l - 6).attr('y', (d) => y(d) + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', css('--color-fg-muted')).text(fmt);
  }
  function yMargin(svg, y, fmt, ticks) { return Math.max(...y.ticks(ticks).map((t) => textW(svg, fmt(t), 11))) + 10; }

  // Liniendiagramm über Zeit. series: [{name,color,data:[{x:Date,y}],dots,width,label}]
  GK.line = (el, o) => {
    const H = o.height || 190;
    const { svg, tip, w } = frame(el, H);
    const all = o.series.flatMap((s) => s.data.filter((d) => d.y != null && !isNaN(d.y)));
    if (!all.length) { el.replaceChildren(); return; }
    const fmt = o.yFmt || GK.f0;
    const ext = o.yDomain || d3.extent(all, (d) => d.y);
    const pad = (ext[1] - ext[0]) * 0.08 || 1;
    const y0 = d3.scaleLinear([o.yDomain ? ext[0] : ext[0] - pad, o.yDomain ? ext[1] : ext[1] + pad], [H - 24, 8]).nice(4);
    const m = { l: yMargin(svg, y0, fmt, 4), t: 8, b: 24 };
    const endLabels = o.series.filter((s) => s.label !== false).map((s) => { const last = [...s.data].reverse().find((d) => d.y != null); return last ? { s, last, text: `${s.name} ${fmt(last.y)}` } : null; }).filter(Boolean);
    m.r = o.endLabels === false || !endLabels.length ? 10 : Math.min(w * 0.4, Math.max(...endLabels.map((e) => textW(svg, e.text, 11))) + 12);
    const xd = o.xDomain || d3.extent(all, (d) => d.x);
    const x = d3.scaleUtc(xd, [m.l, w - m.r]);
    const y = y0.range([H - m.b, m.t]);
    yAxis(svg, y, m, w, fmt, 4);
    const nt = Math.max(2, Math.floor((w - m.l - m.r) / 80));
    const ticks = x.ticks(nt);
    const xf = o.xFmt || ((d) => (d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : GK.months[d.getUTCMonth()]));
    svg.append('g').selectAll('text').data(ticks).join('text').attr('x', x).attr('y', H - 6).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', css('--color-fg-muted')).text(xf);
    if (o.refY != null) svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(o.refY)).attr('y2', y(o.refY)).attr('stroke', css('--cds-chart-reference')).attr('stroke-dasharray', '4 4');
    o.series.forEach((s) => {
      const d = s.data.filter((p) => p.x >= xd[0] && p.x <= xd[1]);
      if (s.dots) svg.append('g').selectAll('circle').data(d.filter((p) => p.y != null)).join('circle').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', s.r || 1.6).attr('fill', s.color).attr('opacity', s.dotOpacity ?? 0.35);
      if (s.line !== false) svg.append('path').datum(d).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', s.width || 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')
        .attr('stroke-dasharray', s.dash || null).attr('d', d3.line().defined((p) => p.y != null && !isNaN(p.y)).x((p) => x(p.x)).y((p) => y(p.y)));
    });
    if (o.endLabels !== false) {
      const placed = endLabels.map((e) => ({ ...e, yy: y(e.last.y) })).sort((a, b) => a.yy - b.yy);
      for (let i = 1; i < placed.length; i++) if (placed[i].yy - placed[i - 1].yy < 13) placed[i].yy = placed[i - 1].yy + 13;
      placed.forEach((e) => {
        svg.append('circle').attr('cx', x(e.last.x)).attr('cy', y(e.last.y)).attr('r', 3).attr('fill', e.s.color);
        svg.append('text').attr('x', w - m.r + 8).attr('y', Math.min(H - m.b, e.yy) + 4).attr('font-size', 11).attr('fill', css('--color-fg-muted')).text(e.text);
      });
    }
    const rule = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('stroke', css('--cds-chart-axis')).attr('opacity', 0);
    const hov = svg.append('g');
    const tipSeries = o.series.filter((s) => s.tip !== false);
    svg.append('rect').attr('x', m.l).attr('y', 0).attr('width', Math.max(0, w - m.l - m.r)).attr('height', H).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px, py] = d3.pointer(ev); const t = x.invert(px);
        const rows = []; hov.selectAll('*').remove(); let rx = null;
        tipSeries.forEach((s) => {
          const d = s.data.filter((p) => p.y != null); if (!d.length) return;
          const i = d3.bisector((p) => p.x).center(d, t); const p = d[i];
          if (Math.abs(x(p.x) - px) > (o.snap || 40)) return;
          rx = rx ?? x(p.x);
          rows.push({ name: s.name, value: (s.tipFmt || fmt)(p.y), color: tipSeries.length > 1 ? s.color : null, date: p.x });
          hov.append('circle').attr('cx', x(p.x)).attr('cy', y(p.y)).attr('r', 4).attr('fill', s.color);
        });
        if (!rows.length) { tip.style('opacity', 0); rule.attr('opacity', 0); return; }
        rule.attr('x1', rx).attr('x2', rx).attr('opacity', 1);
        const sw = el.clientWidth / w;
        showTip(tip, el, rx * sw, py * sw, tipRows((o.tipDate || GK.dfmt)(rows[0].date), rows));
      })
      .on('pointerleave', () => { tip.style('opacity', 0); rule.attr('opacity', 0); hov.selectAll('*').remove(); });
  };

  // Gestapelte Balken. rows: [{label, date?, values:{key:v}}], stacks: [{key,name,color}]
  GK.bars = (el, o) => {
    const H = o.height || 200;
    const { svg, tip, w } = frame(el, H);
    const fmt = o.yFmt || GK.f0;
    const tot = o.rows.map((r) => d3.sum(o.stacks, (s) => Math.max(0, r.values[s.key] || 0)));
    const y0 = d3.scaleLinear([0, d3.max(tot) || 1], [H - 24, 8]).nice(4);
    const m = { l: yMargin(svg, y0, fmt, 4), r: 8, t: 8, b: 24 };
    const x = d3.scaleBand(o.rows.map((r) => r.label), [m.l, w - m.r]).paddingInner(o.rows.length > 30 ? 0.18 : 0.3);
    const y = y0.range([H - m.b, m.t]);
    yAxis(svg, y, m, w, fmt, 4);
    const every = Math.max(1, Math.ceil(o.rows.length / Math.floor((w - m.l) / (o.labelW || 46))));
    svg.append('g').selectAll('text').data(o.rows.filter((r, i) => (o.xLabel ? o.xLabel(r, i) : i % every === 0))).join('text')
      .attr('x', (r) => x(r.label) + x.bandwidth() / 2).attr('y', H - 6).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', css('--color-fg-muted')).text((r) => r.tick ?? r.label);
    const bw = Math.min(32, x.bandwidth()); const off = (x.bandwidth() - bw) / 2;
    o.rows.forEach((r, i) => {
      let acc = 0; const g = svg.append('g');
      o.stacks.forEach((s, j) => {
        const v = Math.max(0, r.values[s.key] || 0); if (!v) return;
        const top = j === o.stacks.length - 1 || o.stacks.slice(j + 1).every((t) => !(r.values[t.key] > 0));
        g.append('rect').attr('x', x(r.label) + off).attr('width', bw).attr('y', y(acc + v)).attr('height', Math.max(0.5, y(acc) - y(acc + v)))
          .attr('fill', s.color).attr('rx', top && bw > 6 ? Math.min(3, bw / 2) : 0);
        acc += v;
      });
      g.append('rect').attr('x', x(r.label)).attr('width', x.bandwidth()).attr('y', m.t).attr('height', H - m.b - m.t).attr('fill', 'transparent')
        .on('pointermove', (ev) => {
          const [px, py] = d3.pointer(ev, svg.node()); const sw = el.clientWidth / w;
          const rows = o.stacks.filter((s) => r.values[s.key] > 0).map((s) => ({ name: s.name, value: fmt(r.values[s.key]), color: o.stacks.length > 1 ? s.color : null }));
          if (o.stacks.length > 1) rows.push({ name: 'Total', value: fmt(tot[i]) });
          showTip(tip, el, px * sw, py * sw, tipRows(r.tipLabel || r.label, rows));
        }).on('pointerleave', () => tip.style('opacity', 0));
    });
  };

  // Balken mit Fehlerbalken (±1 Standardfehler). items: [{label, mean, se, n, color}]
  GK.errbars = (el, o) => {
    const H = o.height || 210;
    const { svg, tip, w } = frame(el, H);
    const fmt = o.yFmt || GK.f1;
    const it = o.items.filter((d) => d.mean != null);
    if (!it.length) { el.replaceChildren(); return; }
    const lo = d3.min(it, (d) => d.mean - (d.se || 0)), hi = d3.max(it, (d) => d.mean + (d.se || 0));
    const span = hi - lo || 1;
    const hasN = it.some((d) => d.n != null);
    const bot = hasN ? 40 : 26;
    const dom = o.zeroLine ? [Math.min(0, lo) - span * 0.15, Math.max(0, hi) + span * 0.15] : o.zero ? [0, hi * 1.08] : [lo - span * 0.6, hi + span * 0.25];
    const y0 = d3.scaleLinear(dom, [H - bot, 8]).nice(4);
    const m = { l: yMargin(svg, y0, fmt, 4), r: 8, t: 8, b: bot };
    const x = d3.scaleBand(it.map((d) => d.label), [m.l, w - m.r]).padding(0.35);
    const y = y0.range([H - m.b, m.t]);
    yAxis(svg, y, m, w, fmt, 4);
    const bw = Math.min(56, x.bandwidth()); const off = (x.bandwidth() - bw) / 2;
    const base = o.zeroLine ? 0 : y.domain()[0];
    if (o.zeroLine) svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', css('--cds-chart-axis'));
    it.forEach((d) => {
      const cx = x(d.label) + x.bandwidth() / 2;
      svg.append('rect').attr('x', x(d.label) + off).attr('width', bw).attr('y', Math.min(y(d.mean), y(base))).attr('height', Math.max(1, Math.abs(y(base) - y(d.mean)))).attr('fill', d.color).attr('rx', 4);
      if (d.se) svg.append('path').attr('d', `M${cx},${y(d.mean - d.se)}V${y(d.mean + d.se)}M${cx - 6},${y(d.mean - d.se)}h12M${cx - 6},${y(d.mean + d.se)}h12`).attr('stroke', css('--color-fg')).attr('stroke-width', 1.5).attr('fill', 'none');
      svg.append('text').attr('x', cx).attr('y', H - (hasN ? 22 : 8)).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', css('--color-fg')).text(d.label);
      if (hasN) svg.append('text').attr('x', cx).attr('y', H - 7).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', css('--color-fg-muted')).text(`n = ${d.n}`);
      const rows = [{ name: o.tipName || 'Mittel', value: (o.tipFmt || fmt)(d.mean) }];
      if (d.se) rows.push({ name: '± Std.-Fehler', value: fmt(d.se) });
      if (d.n != null) rows.push({ name: o.nName || 'Tage', value: String(d.n) });
      svg.append('rect').attr('x', x(d.label)).attr('width', x.bandwidth()).attr('y', 0).attr('height', H - m.b).attr('fill', 'transparent')
        .on('pointermove', (ev) => { const [px, py] = d3.pointer(ev, svg.node()); const sw = el.clientWidth / w; showTip(tip, el, px * sw, py * sw, tipRows(d.tipLabel || d.label, rows)); })
        .on('pointerleave', () => tip.style('opacity', 0));
    });
  };

  // Korrelations-Heatmap. keys, label(k), get(x,y) -> {r,n}
  GK.heat = (el, o) => {
    const n = o.keys.length;
    const tmp = frame(el, 10);
    const lw = Math.max(...o.keys.map((k) => textW(tmp.svg, o.label(k), 11))) + 8;
    const w = tmp.w;
    const cell = Math.max(12, Math.min(30, (w - lw - 4) / n));
    const H = lw + cell * n + 4;
    const { svg, tip } = frame(el, H);
    const pos = GK.resolve(o.pos), neg = GK.resolve(o.neg), mid = GK.resolve('var(--color-panel)');
    const col = (r) => (r == null ? 'transparent' : r >= 0 ? d3.interpolateRgb(mid, pos)(Math.min(1, r / 0.7)) : d3.interpolateRgb(mid, neg)(Math.min(1, -r / 0.7)));
    const g = svg.append('g').attr('transform', `translate(${lw},${lw})`);
    o.keys.forEach((k, i) => {
      svg.append('text').attr('x', lw - 6).attr('y', lw + i * cell + cell / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', css('--color-fg-muted')).text(o.label(k));
      svg.append('text').attr('transform', `translate(${lw + i * cell + cell / 2 + 4},${lw - 6}) rotate(-90)`).attr('font-size', 11).attr('fill', css('--color-fg-muted')).text(o.label(k));
    });
    o.keys.forEach((ky, i) => o.keys.forEach((kx, j) => {
      const c = o.get(kx, ky); const sel = o.selected && o.selected[0] === kx && o.selected[1] === ky;
      g.append('rect').attr('x', j * cell + 1).attr('y', i * cell + 1).attr('width', cell - 2).attr('height', cell - 2).attr('rx', 2)
        .attr('fill', col(c && c.r)).attr('stroke', sel ? css('--color-fg') : 'none').attr('stroke-width', 2).style('cursor', 'pointer')
        .on('pointermove', (ev) => { const [px, py] = d3.pointer(ev, svg.node()); const sw = el.clientWidth / w; showTip(tip, el, px * sw, py * sw, tipRows(`${o.label(kx)} → ${o.label(ky)}`, [{ name: 'Spearman r', value: c && c.r != null ? GK.f2(c.r) : '—' }, { name: 'Paare', value: c ? String(c.n) : '0' }])); })
        .on('pointerleave', () => tip.style('opacity', 0))
        .on('click', () => o.onPick(kx, ky));
    }));
  };

  // Streudiagramm mit Mittelwerten pro Quintil
  GK.scatter = (el, o) => {
    const H = o.height || 260;
    const { svg, tip, w } = frame(el, H);
    const p = o.pts; if (p.length < 5) { el.replaceChildren(); return; }
    const xf = o.xFmt || GK.f1, yf = o.yFmt || GK.f1;
    const qx = (a, q) => d3.quantileSorted(a, q);
    const xs = p.map((d) => d.x).sort(d3.ascending), ys = p.map((d) => d.y).sort(d3.ascending);
    const y0 = d3.scaleLinear([qx(ys, 0.005), qx(ys, 0.995)], [H - 36, 8]).nice(4);
    const m = { l: yMargin(svg, y0, yf, 4) + 4, r: 12, t: 8, b: 36 };
    const x = d3.scaleLinear([qx(xs, 0.005), qx(xs, 0.995)], [m.l, w - m.r]).nice(5);
    const y = y0.range([H - m.b, m.t]);
    yAxis(svg, y, m, w, yf, 4);
    svg.append('g').selectAll('text').data(x.ticks(Math.max(3, Math.floor(w / 90)))).join('text').attr('x', x).attr('y', H - 20).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', css('--color-fg-muted')).text(xf);
    svg.append('text').attr('x', w - m.r).attr('y', H - 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', css('--color-fg-muted')).text(o.xLabel + ' →');
    const inside = p.filter((d) => d.x >= x.domain()[0] && d.x <= x.domain()[1] && d.y >= y.domain()[0] && d.y <= y.domain()[1]);
    svg.append('g').selectAll('circle').data(inside).join('circle').attr('cx', (d) => x(d.x)).attr('cy', (d) => y(d.y)).attr('r', 2.4).attr('fill', o.color).attr('opacity', 0.28);
    const sorted = [...p].sort((a, b) => a.x - b.x); const k = 5; const bins = [];
    for (let i = 0; i < k; i++) { const s = sorted.slice(Math.floor(i * sorted.length / k), Math.floor((i + 1) * sorted.length / k)); if (s.length) bins.push({ x: d3.median(s, (d) => d.x), y: d3.mean(s, (d) => d.y), lo: s[0].x, hi: s[s.length - 1].x, n: s.length }); }
    svg.append('path').datum(bins).attr('fill', 'none').attr('stroke', o.accent).attr('stroke-width', 2.5).attr('stroke-linecap', 'round').attr('d', d3.line().x((d) => x(Math.max(x.domain()[0], Math.min(x.domain()[1], d.x)))).y((d) => y(d.y)));
    bins.forEach((b) => {
      svg.append('circle').attr('cx', x(Math.max(x.domain()[0], Math.min(x.domain()[1], b.x)))).attr('cy', y(b.y)).attr('r', 5).attr('fill', o.accent).attr('stroke', css('--color-panel')).attr('stroke-width', 1.5)
        .on('pointermove', (ev) => { const [px, py] = d3.pointer(ev, svg.node()); const sw = el.clientWidth / w; showTip(tip, el, px * sw, py * sw, tipRows(`${o.xLabel}: ${xf(b.lo)} – ${xf(b.hi)}`, [{ name: 'Mittel ' + o.yLabel, value: yf(b.y) }, { name: 'Tage', value: String(b.n) }])); })
        .on('pointerleave', () => tip.style('opacity', 0));
    });
    o.bins = bins;
    return bins;
  };

  window.GK = GK;
})();
