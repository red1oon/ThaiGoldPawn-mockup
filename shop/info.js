// Infographic widgets for the main dashboard (the "big picture"): lifecycle flow, donut, gauge, vault map, quota meter.
// Pure HTML/SVG builders, no library. Colour carries meaning only for status / risk (same palette as the bars); everything else is one hue.
window.Info = (function () {
  const icon = n => `<span class="material-symbols-rounded">${n}</span>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // donut: items [{k, label, v, color, drill}], centre text
  function donut(items, top, sub, fmtv) {
    const tot = items.reduce((a, x) => a + x.v, 0) || 1; let acc = 0;
    const arcs = items.filter(x => x.v > 0).map(x => {
      const frac = x.v / tot * 100, a = `<circle class="dn-seg" r="15.9155" cx="21" cy="21" fill="none" stroke="${x.color}" stroke-width="6" stroke-dasharray="${frac.toFixed(2)} ${(100 - frac).toFixed(2)}" stroke-dashoffset="${(25 - acc).toFixed(2)}" ${x.drill ? `data-drill="${x.drill}"` : ''}><title>${esc(x.label)}: ${fmtv(x.v)}</title></circle>`;
      acc += frac; return a;
    }).join('');
    return `<div class="info-donut"><svg viewBox="0 0 42 42" role="img" aria-label="${esc(sub)}"><circle r="15.9155" cx="21" cy="21" fill="none" stroke="var(--line)" stroke-width="6"/>${arcs}
      <text x="21" y="20.5" text-anchor="middle" class="dn-top">${esc(top)}</text><text x="21" y="25.5" text-anchor="middle" class="dn-sub">${esc(sub)}</text></svg>
      <ul class="legend">${items.map(x => `<li ${x.drill ? `data-drill="${x.drill}"` : ''}><i style="background:${x.color}"></i><span>${esc(x.label)}</span><b>${fmtv(x.v)}</b></li>`).join('')}</ul></div>`;
  }

  // gauge: half circle, value 0..max, ticks at 0 / max; colour var
  function gauge(v, max, color, big, sub, note) {
    const L = Math.PI * 45, f = Math.max(0, Math.min(1, v / max)) * L;
    return `<div class="info-gauge"><svg viewBox="0 0 100 58" role="img" aria-label="${esc(sub)}"><path d="M5 50 A45 45 0 0 1 95 50" fill="none" stroke="var(--line)" stroke-width="9" stroke-linecap="round"/>
      <path d="M5 50 A45 45 0 0 1 95 50" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${f.toFixed(1)} ${L.toFixed(1)}"/>
      <text x="50" y="44" text-anchor="middle" class="g-big">${esc(big)}</text><text x="5" y="57" class="g-tick">0</text><text x="95" y="57" text-anchor="end" class="g-tick">${max}%</text></svg>
      <div class="g-sub">${esc(sub)}</div><div class="g-note">${esc(note || '')}</div></div>`;
  }

  // lifecycle flow: items [{label, icon, n, color, drill}] left to right
  function flow(items) {
    return `<div class="info-flow">${items.map((x, i) => `${i ? `<span class="fl-arrow">${icon('chevron_right')}</span>` : ''}<div class="fl-step" style="--c:${x.color}" ${x.drill ? `data-drill="${x.drill}"` : ''}>
      <span class="fl-ic">${icon(x.icon)}</span><b>${x.n}</b><small>${esc(x.label)}</small></div>`).join('')}</div>`;
  }

  // quota meter: used / included, over part red, 80 % tick
  function meter(used, inc, fmtn, lab, sub) {
    const pct = inc ? used / inc * 100 : 0, w = Math.min(100, pct), over = pct > 100 ? Math.min(100, (pct - 100)) : 0;
    return `<div class="info-meter"><div class="m-top"><b>${fmtn(used)}</b> / ${fmtn(inc)} <small>${esc(lab)}</small></div>
      <div class="m-bar" role="img" aria-label="${Math.round(pct)}%"><div class="m-fill" style="width:${w}%;background:${pct >= 100 ? 'var(--s8)' : pct >= 80 ? 'var(--s4)' : 'var(--s1)'}"></div><i class="m-tick" style="left:80%"></i></div>
      <div class="m-sub">${esc(sub)}</div></div>`;
  }
  return { donut, gauge, flow, meter, icon };
})();
