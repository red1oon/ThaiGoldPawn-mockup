// Admin dashboard (spec §15.4, §15.6): every widget is a declarative JSON config; drag to reorder, resize, hide, add — saved per shop.
window.Dash = (function () {
  const P = window.Pay, C = window.Calc, Net = window.Net;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  const STATUS = ['offered', 'active', 'overdue', 'redeemed', 'forfeited'];
  const STATUS_COL = { offered: '--muted', active: '--s1', overdue: '--s8', redeemed: '--s6', forfeited: '--s2' };
  const CATS = ['ornament', 'bar', 'silver', 'other'], GRPS = ['standard', 'vip', 'supervip', 'relative'];
  const AGE = ['over30', 'over0', 'd30', 'd60', 'later'];
  const DIMS = ['status', 'cat', 'grp', 'ageing', 'month', 'none'], METRICS = ['count', 'principal', 'owed', 'collected'];

  const DEFAULT = [
    { id: 'k_open', title: 'wt_open', metric: 'count', scope: 'open', groupBy: 'none', chart: 'tile', size: 's' },
    { id: 'k_prin', title: 'wt_prin', metric: 'principal', scope: 'open', groupBy: 'none', chart: 'tile', size: 's' },
    { id: 'k_owed', title: 'wt_owed', metric: 'owed', scope: 'open', groupBy: 'none', chart: 'tile', size: 's' },
    { id: 'k_over', title: 'wt_over', metric: 'principal', scope: 'overdue', groupBy: 'none', chart: 'tile', size: 's' },
    { id: 'w_status', title: 'wt_status', metric: 'count', scope: 'all', groupBy: 'status', chart: 'bars', size: 'm' },
    { id: 'w_cat', title: 'wt_cat', metric: 'principal', scope: 'open', groupBy: 'cat', chart: 'bars', size: 'm' },
    { id: 'w_month', title: 'wt_month', metric: 'collected', scope: 'all', groupBy: 'month', chart: 'columns', size: 'm' },
    { id: 'w_age', title: 'wt_age', metric: 'principal', scope: 'open', groupBy: 'ageing', chart: 'bars', size: 'm' }
  ];
  // extensions the shop can switch on (same JSON shape — no code)
  const CATALOG = [
    { id: 'x_grp', title: 'wt_grp', metric: 'principal', scope: 'open', groupBy: 'grp', chart: 'bars', size: 'm' },
    { id: 'x_grpcnt', title: 'wt_grpcnt', metric: 'count', scope: 'all', groupBy: 'grp', chart: 'columns', size: 'm' },
    { id: 'x_owedcat', title: 'wt_owedcat', metric: 'owed', scope: 'open', groupBy: 'cat', chart: 'bars', size: 'm' },
    { id: 'x_issued', title: 'wt_issued', metric: 'principal', scope: 'all', groupBy: 'month', chart: 'columns', size: 'm' },
    { id: 'x_pending', title: 'wt_pending', metric: 'count', scope: 'offered', groupBy: 'none', chart: 'tile', size: 's' }
  ];
  const D = { layout: null, edit: false, drill: null, hist: null, dragId: null, msg: '' };
  try { D.layout = JSON.parse(store.get('gp.dash')); } catch (e) {}
  if (!Array.isArray(D.layout)) D.layout = DEFAULT.map(w => ({ ...w }));
  const save = () => store.set('gp.dash', JSON.stringify(D.layout));

  // ---- data: one derived row per ticket (fold, never stored totals) ----
  function rows() {
    return Object.values(Net.all()).map(l => {
      const st = P.fold(l, Net.today), open = st.status === 'active' || st.status === 'overdue';
      const owed = open ? P.interestTo(st, Net.today) : 0, dd = C.daysBetween(Net.today, st.due || Net.today);
      const ageing = !open ? null : dd < -30 ? 'over30' : dd < 0 ? 'over0' : dd <= 30 ? 'd30' : dd <= 60 ? 'd60' : 'later';
      return { tk: st.no, st, open, owed, ageing, status: st.status, cat: st.cat || 'other', grp: st.grp || 'standard',
        month: (st.date || Net.today).slice(0, 7), principal: open ? st.principal : 0, collected: st.paid.reduce((a, p) => a + p.amt, 0), live: !!l.live };
    });
  }
  const inScope = (r, w) => w.scope === 'all' || (w.scope === 'open' && r.open) || (w.scope === 'overdue' && r.status === 'overdue') || (w.scope === 'offered' && r.status === 'offered');
  const valueOf = (r, m) => m === 'count' ? 1 : m === 'principal' ? r.principal : m === 'owed' ? r.owed : r.collected;
  const keyOf = (r, g) => g === 'none' ? 'all' : g === 'month' ? r.month : r[g];
  function group(w, rs) {
    const out = {};
    rs.filter(r => inScope(r, w)).forEach(r => {
      if (w.metric === 'collected' && w.groupBy === 'month') {                 // collected is dated by the payment, not the loan
        r.st.paid.forEach(p => { const m = new Date(p.ts).toISOString().slice(0, 7); (out[m] = out[m] || { v: 0, rows: [] }).v += p.amt; if (!out[m].rows.includes(r)) out[m].rows.push(r); });
        return;
      }
      const k = keyOf(r, w.groupBy); if (k == null) return; (out[k] = out[k] || { v: 0, rows: [] }); out[k].v += valueOf(r, w.metric); out[k].rows.push(r);
    });
    const order = { status: STATUS, cat: CATS, grp: GRPS, ageing: AGE }[w.groupBy];
    const keys = order ? order.filter(k => out[k] || w.groupBy === 'status' || w.groupBy === 'ageing') : Object.keys(out).sort();
    return keys.map(k => ({ k, v: C.r2(out[k] ? out[k].v : 0), rows: out[k] ? out[k].rows : [] }));
  }
  const money = w => w.metric !== 'count';
  const labelOf = (g, k) => g === 'status' ? t('st_' + k) : g === 'cat' ? t('cat_' + k) : g === 'ageing' ? t('age_' + k) : k;
  const colOf = (g, k) => g === 'status' ? `var(${STATUS_COL[k]})` : 'var(--s1)';   // one measure = one hue; only status carries meaning
  const fv = (w, v) => money(w) ? fmt(v) : String(v);

  // ---- widgets ----
  function widget(w, rs, i) {
    const g = group(w, rs), max = Math.max(1, ...g.map(x => x.v)), title = t.raw(w.title);
    let body;
    if (w.chart === 'tile' || w.groupBy === 'none') {
      const v = g.reduce((a, x) => a + x.v, 0);
      body = `<div class="tile" data-drill="${w.id}|none|all"><div class="big">${fv(w, C.r2(v))}</div><div class="unit">${money(w) ? t('baht') : t('tickets')}</div></div>`;
    } else if (w.chart === 'columns') {
      body = `<div class="cols">${g.map((x, j) => `<div class="col" data-drill="${w.id}|${w.groupBy}|${x.k}" title="${labelOf(w.groupBy, x.k)}: ${fv(w, x.v)}">
        <span class="cv">${money(w) ? Math.round(x.v).toLocaleString() : x.v}</span><div class="cb" style="height:${Math.max(2, x.v / max * 100)}%;background:${colOf(w.groupBy, x.k, j)}"></div><span class="cl">${w.groupBy === 'month' ? x.k.slice(5) + '/' + x.k.slice(2, 4) : labelOf(w.groupBy, x.k)}</span></div>`).join('')}</div>`;
    } else {
      body = g.map((x, j) => `<div class="bar" data-drill="${w.id}|${w.groupBy}|${x.k}" title="${labelOf(w.groupBy, x.k)}: ${fv(w, x.v)}">
        <span class="bl">${labelOf(w.groupBy, x.k)}</span><div class="bt"><div class="bf" style="width:${x.v / max * 100}%;background:${colOf(w.groupBy, x.k, j)}"></div></div><span class="bv">${fv(w, x.v)}</span></div>`).join('');
    }
    const ctl = D.edit ? `<div class="wctl"><button data-wmove="${w.id}|-1" title="${t('moveUp')}">▲</button><button data-wmove="${w.id}|1" title="${t('moveDown')}">▼</button>
      ${['s', 'm', 'l'].map(z => `<button class="${w.size === z ? 'on' : ''}" data-wsize="${w.id}|${z}">${z.toUpperCase()}</button>`).join('')}<button data-wdel="${w.id}" title="${t('hide')}">✕</button></div>` : '';
    return `<section class="wg sz-${w.size} ${D.edit ? 'editing' : ''}" ${D.edit ? 'draggable="true"' : ''} data-wid="${w.id}"><header><span class="grip">${D.edit ? '⠿' : ''}</span><h3>${title}</h3>${ctl}</header>${body}</section>`;
  }

  function cpanel() {
    const inLayout = new Set(D.layout.map(w => w.id)), avail = CATALOG.filter(w => !inLayout.has(w.id));
    const sel = (id, arr, lab) => `<label class="f">${t(lab)}<select id="${id}">${arr.map(x => `<option value="${x}">${id === 'nwM' ? t('m_' + x) : id === 'nwG' ? t('g_' + x) : x}</option>`).join('')}</select></label>`;
    return `<div class="card cpanel"><div class="panel"><h2>${t('cpanel')}</h2><div class="sub">${t('cpanelSub')}</div>
      <div class="sec-title">${t('extAvail')}</div>
      ${avail.length ? avail.map(w => `<div class="ext"><span>${t.raw(w.title)}</span><button class="btn small" data-wadd="${w.id}">${t('add')}</button></div>`).join('') : `<div class="note">${t('extNone')}</div>`}
      <div class="sec-title">${t('extNew')}</div>
      <div class="fields"><label class="f">${t('wTitle')}<input id="nwT" value=""></label>${sel('nwM', METRICS, 'wMetric')}${sel('nwG', DIMS, 'wGroup')}
        <label class="f">${t('wChart')}<select id="nwC"><option value="bars">${t('c_bars')}</option><option value="columns">${t('c_columns')}</option><option value="tile">${t('c_tile')}</option></select></label></div>
      <div class="actions" style="justify-content:flex-start"><button class="btn small" data-wnew="1">${t('add')}</button></div>
      <div class="sec-title">${t('layoutJson')}</div>
      <textarea id="layoutJson">${JSON.stringify(D.layout, null, 1)}</textarea>
      <div class="actions" style="justify-content:flex-start"><button class="btn small" data-wjson="apply">${t('apply')}</button><button class="btn small ghost" style="color:var(--accent)" data-wjson="reset">${t('reset')}</button></div>
      <div class="note">${D.msg}</div></div></div>`;
  }

  function listing(rs) {
    if (!D.drill) return '';
    const [wid, dim, key] = D.drill, w = [...D.layout, ...CATALOG].find(x => x.id === wid) || { scope: 'all', metric: 'count' };
    let sel = rs.filter(r => inScope(r, w));
    if (dim !== 'none') sel = dim === 'month' && w.metric === 'collected' ? sel.filter(r => r.st.paid.some(p => new Date(p.ts).toISOString().slice(0, 7) === key)) : sel.filter(r => keyOf(r, dim) === key);
    sel.sort((a, b) => b.st.principal - a.st.principal);
    return `<div class="card"><div class="panel"><h2>${t('listing')}: ${t.raw(w.title)}${dim !== 'none' ? ' · ' + labelOf(dim, key) : ''} <button class="btn small ghost" style="color:var(--accent)" data-drill-clear="1">${t('close')}</button></h2>
      <div class="tablewrap"><table><tr><th>${t('ticketNo')}</th><th>${t('name')}</th><th>${t('category')}</th><th class="n">${t('loan')}</th><th class="n">${t('principalNow')}</th><th>${t('due')}</th><th>${t('status')}</th></tr>
      ${sel.map(r => `<tr class="clk" data-hist="${r.tk}"><td>${r.tk}${r.live ? ' ★' : ''}</td><td>${r.st.name}</td><td>${t('cat_' + r.cat)}</td><td class="n">${fmt(r.st.loan)}</td><td class="n">${fmt(r.st.principal)}</td><td>${fd(r.st.due)}</td><td><span class="chip2" style="--c:var(${STATUS_COL[r.status]})">${t('st_' + r.status)}</span></td></tr>`).join('') || `<tr><td colspan="7">${t('none')}</td></tr>`}</table></div>${history()}</div></div>`;
  }

  function history() {
    if (!D.hist) return '';
    const l = Net.all()[D.hist.tk]; if (!l) return '';
    const st = P.fold(l, Net.today), v = D.hist.verify || [];
    const evs = [...l.chain.shop, ...l.chain.phone].sort((a, b) => a.ts - b.ts || (a.by < b.by ? -1 : 1));
    const mark = e => { const x = v.find(y => y.by === e.by && y.n === e.n); return x ? (x.ok ? `<span class="okm">✔ ${t('verified')}</span>` : `<span class="badm">✖ ${t('broken')} (${x.why})</span>`) : '…'; };
    const sum = e => { const b = e.body; return { offer: `${t('loan')} ${fmt(b.loan)} · ${b.rate}%`, ack: t('ackd'), payment_claim: `${t('m_' + b.mode)} ${fmt(b.amount)}`,
      payment_verified: `${t('m_' + b.mode)} ${fmt(b.amt)} (${t('int')} ${fmt(b.int)} + VAT ${fmt(b.vat)} + ${t('principalPart')} ${fmt(b.principalPart)})${b.reissue ? ' → ' + b.reissue.no : ''}`,
      payment_rejected: b.reason, closed: b.how }[e.type] || ''; };
    const allOk = v.length && v.every(x => x.ok);
    return `<div class="hist"><h3>${t('history')}: ${st.no} · ${st.name} <span class="${allOk ? 'okm' : 'badm'}">${v.length ? (allOk ? '✔ ' + t('chainOk') : '✖ ' + t('chainBroken')) : ''}</span></h3>
      <div class="note">${st.phone} · ${st.address || ''} · ${t('cat_' + st.cat)} ${st.weight} g · ${t('loan')} ${fmt(st.loan)} · ${t('principalNow')} ${fmt(st.principal)}</div>
      <div class="tablewrap"><table><tr><th>#</th><th>${t('by')}</th><th>${t('event')}</th><th>${t('date')}</th><th>${t('detail')}</th><th>${t('hash')}</th><th>${t('check')}</th></tr>
      ${evs.map(e => `<tr><td>${e.n}</td><td>${t('by_' + e.by)}</td><td>${e.type}</td><td>${new Date(e.ts).toISOString().slice(0, 10)}</td><td>${sum(e)}</td><td><code>${e.hash.slice(0, 8)}</code></td><td>${mark(e)}</td></tr>`).join('')}</table></div>
      <div class="actions" style="justify-content:flex-start">${st.paid.length ? (l.tamper ? `<button class="btn small" data-repair="${st.no}">${t('repair')}</button>` : `<button class="btn small" style="background:var(--s8)" data-tamper="${st.no}">${t('tamper')}</button>`) : ''}<button class="btn small ghost" style="color:var(--accent)" data-hist-close="1">${t('close')}</button></div>
      <div class="note">${t('tamperNote')}</div></div>`;
  }

  function view() {
    const rs = rows();
    return `<div class="dashbar"><h2 style="margin:0;flex:1">${t('navDash')}</h2><span class="chip">${t('sampleData')}</span>
      <button class="btn small ${D.edit ? '' : 'ghost'}" style="${D.edit ? '' : 'color:var(--accent)'}" data-dedit="1">${D.edit ? t('doneEdit') : t('customize')}</button></div>
      ${D.edit ? `<div class="note" style="margin-bottom:8px">${t('dragHint')}</div>` : ''}
      <div class="dgrid">${D.layout.map((w, i) => widget(w, rs, i)).join('')}</div>${D.edit ? cpanel() : ''}${listing(rs)}`;
  }

  // ---- actions (wired from app.js) ----
  function moveTo(id, beforeId) {
    const a = D.layout.findIndex(w => w.id === id); if (a < 0) return; const [w] = D.layout.splice(a, 1);
    const b = beforeId ? D.layout.findIndex(x => x.id === beforeId) : D.layout.length; D.layout.splice(b < 0 ? D.layout.length : b, 0, w); save();
  }
  async function showHist(tk) { D.hist = { tk, verify: null }; D.hist.verify = await Net.all()[tk].verifyAll(); }
  function click(el) {
    const q = k => el.closest(`[${k}]`);
    let n;
    if ((n = q('data-drill-clear'))) { D.drill = null; D.hist = null; return true; }
    if ((n = q('data-dedit'))) { D.edit = !D.edit; return true; }
    if ((n = q('data-wmove'))) { const [id, d] = n.dataset.wmove.split('|'); const i = D.layout.findIndex(w => w.id === id), j = i + +d; if (j >= 0 && j < D.layout.length) { [D.layout[i], D.layout[j]] = [D.layout[j], D.layout[i]]; save(); } return true; }
    if ((n = q('data-wsize'))) { const [id, z] = n.dataset.wsize.split('|'); D.layout.find(w => w.id === id).size = z; save(); return true; }
    if ((n = q('data-wdel'))) { D.layout = D.layout.filter(w => w.id !== n.dataset.wdel); save(); return true; }
    if ((n = q('data-wadd'))) { const w = CATALOG.find(x => x.id === n.dataset.wadd); if (w) { D.layout.push({ ...w }); save(); } return true; }
    if ((n = q('data-wnew'))) {
      const v = id => document.getElementById(id).value, title = v('nwT').trim() || 'Custom';
      D.layout.push({ id: 'u_' + Date.now().toString(36), title, metric: v('nwM'), scope: v('nwM') === 'count' || v('nwM') === 'collected' ? 'all' : 'open', groupBy: v('nwG'), chart: v('nwC'), size: 'm' }); save(); return true;
    }
    if ((n = q('data-wjson'))) {
      if (n.dataset.wjson === 'reset') { D.layout = DEFAULT.map(w => ({ ...w })); D.msg = ''; save(); return true; }
      try {
        const j = JSON.parse(document.getElementById('layoutJson').value);
        if (!Array.isArray(j) || j.some(w => !w.id || !METRICS.includes(w.metric) || !DIMS.includes(w.groupBy))) throw new Error(t('jsonBad'));
        D.layout = j.map(w => ({ scope: 'all', chart: 'bars', size: 'm', title: w.id, ...w })); D.msg = t('jsonOk'); save();
      } catch (e) { D.msg = '⚠ ' + e.message; }
      return true;
    }
    if ((n = q('data-hist-close'))) { D.hist = null; return true; }
    if ((n = q('data-tamper'))) { Net.tamper(n.dataset.tamper); showHist(n.dataset.tamper).then(() => window.dispatchEvent(new Event('gp-render'))); return true; }
    if ((n = q('data-repair'))) { Net.repair(n.dataset.repair); showHist(n.dataset.repair).then(() => window.dispatchEvent(new Event('gp-render'))); return true; }
    if ((n = q('data-hist'))) { showHist(n.dataset.hist).then(() => window.dispatchEvent(new Event('gp-render'))); return false; }
    if ((n = q('data-drill'))) { D.drill = n.dataset.drill.split('|'); D.hist = null; return true; }
    return false;
  }
  // drag and drop (HTML5, desktop); touch uses ▲▼
  document.addEventListener('dragstart', e => { const w = e.target.closest && e.target.closest('[data-wid]'); if (w && D.edit) { D.dragId = w.dataset.wid; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', D.dragId); } catch (x) {} } });
  document.addEventListener('dragover', e => { if (D.dragId && e.target.closest && e.target.closest('[data-wid]')) e.preventDefault(); });
  document.addEventListener('drop', e => { const w = e.target.closest && e.target.closest('[data-wid]'); if (D.dragId && w) { e.preventDefault(); moveTo(D.dragId, w.dataset.wid); D.dragId = null; window.dispatchEvent(new Event('gp-render')); } });

  return { bind, view, click, moveTo, showHist, state: D, group, rows, DEFAULT, CATALOG };
})();
