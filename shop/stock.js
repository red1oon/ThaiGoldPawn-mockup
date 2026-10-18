// Collateral location (warehouse / locator / lot, spec §18.1) and SlipOK usage (spec §18.2).
// Locations are signed, shop-internal `locate` events (never in a token); every screen is a FOLD of them. SAMPLE DATA ONLY.
// Model follows the legacy ERP: M_Warehouse -> M_Locator (X aisle, Y bin, Z level, Value "A-03-2") -> M_Lot (one per ticket chain).
window.Stock = (function () {
  const T = window.Token, P = window.Pay, C = window.Calc, Net = window.Net;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const lang = () => (S && S.lang) || 'en';

  // ---- warehouses and locators (a branch setting in production; fixed list in the sample) ----
  const WH = [
    { id: 'VAULT', th: 'ห้องนิรภัย (หลักประกันของลูกค้า)', en: 'Vault (customer collateral)', aisles: ['A', 'B', 'C', 'D'], bins: 8, levels: 3 },
    { id: 'FORFEIT', th: 'สต็อกทองหลุด (ของร้าน)', en: 'Forfeited stock (shop-owned)', aisles: ['F'], bins: 4, levels: 2 }
  ];
  const BAND = [[50000, 'A'], [150000, 'B'], [300000, 'C'], [Infinity, 'D']];            // default aisle by loan value (xlsx T57 "SafeLocation default by value band")
  const val = (a, b, l) => a + '-' + String(b).padStart(2, '0') + '-' + l;
  const parse = v => { const m = /^([A-Z])-(\d+)-(\d+)$/.exec(v || ''); return m ? { aisle: m[1], bin: +m[2], level: +m[3] } : null; };
  const whOf = v => { const p = parse(v); return p ? (p.aisle === 'F' ? 'FORFEIT' : 'VAULT') : null; };
  const wh = id => WH.find(w => w.id === id);
  const whName = id => wh(id)[lang() === 'th' ? 'th' : 'en'];
  const locsOf = id => { const w = wh(id), o = []; w.aisles.forEach(a => { for (let b = 1; b <= w.bins; b++) for (let l = 1; l <= w.levels; l++) o.push(val(a, b, l)); }); return o; };

  // ---- the signed event log: sample chain (not persisted, rebuilt each load) + the shop's own live chain ----
  let sampleL = null;
  function events() {
    const a = sampleL ? sampleL.chain.shop : [], l = Net.crm && Net.crm._loc, b = l ? l.chain.shop : [];
    return [...a, ...b].filter(e => e.body).sort((x, y) => x.ts - y.ts || x.n - y.n);
  }
  async function log(type, body, ts) {
    { const g = window.Auth && window.Auth.check(type === 'count' ? 'count' : 'locate'); if (g && !g.ok) return null; }
    const l = Net.crmL('_loc'), b = { ...body }; l.live = true; if (!l.chain.shop.length) b.pub = T.pubOf(Net.keys.shop.pub);
    const e = await l.append(type, b, ts || Net.ts()); Net.persist(); Net.emit(); return e;
  }
  function fold() {
    const m = {};
    events().filter(e => e.type === 'locate').forEach(e => {
      const b = e.body, x = m[b.tk] = m[b.tk] || { tk: b.tk, loc: null, bag: null, lot: null, moves: [] };
      if (b.how === 'out') x.loc = null; else { x.loc = b.loc; if (b.bag) x.bag = b.bag; if (b.lot) x.lot = b.lot; }
      x.moves.push({ ts: e.ts, how: b.how, from: b.from || null, to: b.loc || null, by: b.by || 'shop' });
    });
    return m;
  }
  const holds = st => st.status === 'forfeited' ? 'FORFEIT' : (st.status === 'redeemed' || st.status === 'sold') ? null : 'VAULT';
  const tickets = () => Object.values(Net.all()).map(l => P.fold(l, Net.today));
  function view360() {
    const f = fold(), rows = tickets().map(st => {
      const x = f[st.no], h = holds(st), loc = x && x.loc && whOf(x.loc) === h ? x.loc : null;
      return { tk: st.no, st, hold: h, loc, bag: x && x.bag, lot: x && x.lot, aisle: loc ? parse(loc).aisle : null, unlocated: !!h && !loc, moves: x ? x.moves : [] };
    });
    return rows;
  }
  const aisleMap = () => { const m = {}; view360().forEach(r => { m[r.tk] = r.aisle; }); return m; };
  const defaultLoc = (loan, whId) => {
    const taken = {}; view360().forEach(r => { if (r.loc) taken[r.loc] = (taken[r.loc] || 0) + 1; });
    const aisle = whId === 'FORFEIT' ? 'F' : BAND.find(b => loan < b[0])[1];
    return locsOf(whId).filter(v => parse(v).aisle === aisle).sort((a, b) => (taken[a] || 0) - (taken[b] || 0))[0];
  };
  async function putAway(tk, loc, bag, how) {
    const st = tickets().find(s => s.no === tk); if (!st || !parse(loc)) return null;
    const cur = fold()[tk], first = st.first || tk;
    return log('locate', { tk, how: how || (cur && cur.loc ? 'move' : 'in'), whs: whOf(loc), loc, from: cur && cur.loc || null, bag: bag || (cur && cur.bag) || 'BAG-' + tk, lot: (cur && cur.lot) || 'LOT-' + first });
  }

  // ---- sample seed (spec §18.1): every sample ticket gets a place; redeemed ones left, forfeited ones moved to the forfeit stock ----
  function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  async function seed() {
    sampleL = new T.Ledger('crm:_locs', 'shop', Net.keys.shop); sampleL.live = false;
    const r = rng(4242), used = {};
    const pick = (aisle, w) => { for (let i = 0; i < 60; i++) { const v = val(aisle, 1 + Math.floor(r() * w.bins), 1 + Math.floor(r() * w.levels)); if (!used[v] || i > 50) { used[v] = (used[v] || 0) + 1; return v; } } };
    const list = Object.values(Net.sample).sort((a, b) => a.tk < b.tk ? -1 : 1);
    for (const l of list) {
      const st = P.fold(l, Net.today), t0 = l.chain.shop[0].ts, lot = 'LOT-' + st.no, bag = 'BAG-' + st.no, aisle = BAND.find(b => st.loan < b[0])[1];
      const loc = pick(aisle, wh('VAULT')), put = { tk: st.no, whs: 'VAULT', loc, bag, lot, by: 'shop' };
      await sampleL.append('locate', { ...put, how: 'in' }, t0 + 3600000);
      const end = l.chain.shop[l.chain.shop.length - 1].ts;
      if (st.status === 'redeemed') await sampleL.append('locate', { tk: st.no, how: 'out', from: loc, by: 'shop' }, end + 600000);
      else if (st.status === 'forfeited') await sampleL.append('locate', { tk: st.no, how: 'forfeit', whs: 'FORFEIT', loc: pick('F', wh('FORFEIT')), from: loc, bag, lot, by: 'shop' }, end + 600000);
      else if (r() < 0.18) await sampleL.append('locate', { tk: st.no, how: 'move', whs: 'VAULT', loc: pick(aisle, wh('VAULT')), from: loc, bag, lot, by: 'shop' }, t0 + 12 * 86400000);
    }
  }

  // ---- SlipOK usage (spec §18.2): every shop-side check is one fold over the payment events; 1009/1010/1003/1004 use no quota ----
  const PLANS = { BASIC: { fee: 0, inc: 100, over: 1.00 }, START: { fee: 350, inc: 500, over: 0.70 }, SME: { fee: 600, inc: 1000, over: 0.60 }, ENTERPRISE: { fee: 1000, inc: 2000, over: null }, GOLD: { fee: 2580, inc: 6000, over: null } };
  const NO_QUOTA = ['1003', '1004', '1009', '1010'];
  const U = { plan: store.get('gp.slip.plan') || 'START', over: store.get('gp.slip.over') || '', month: '' };
  const monthOf = ts => new Date(ts).toISOString().slice(0, 7);
  function checks() {
    const out = [];
    Object.values(Net.all()).forEach(l => l.chain.shop.forEach(e => {
      const b = e.body || {};
      if (e.type === 'payment_verified' && b.slip && b.slip.transRef) out.push({ ts: e.ts, tk: l.tk, code: '1000', ok: true, ref: b.slip && b.slip.transRef, amt: b.amt });
      else if (e.type === 'payment_rejected' && /^10\d\d$/.test(String(b.reason)) && !NO_QUOTA.includes(String(b.reason))) out.push({ ts: e.ts, tk: l.tk, code: String(b.reason), ok: false, ref: b.attachment && b.attachment.title, amt: 0 });
    }));
    return out.sort((a, b) => b.ts - a.ts);
  }
  const overRate = () => { const p = PLANS[U.plan]; return p.over != null ? p.over : (U.over !== '' && !isNaN(+U.over) ? +U.over : null); };
  const costOf = (plan, used, rate) => { const p = PLANS[plan], over = Math.max(0, used - p.inc); return { over, known: over === 0 || rate != null, cost: p.fee + (rate != null ? over * rate : 0) }; };
  function usage(month) {
    const p = PLANS[U.plan], cs = checks().filter(c => monthOf(c.ts) === month), used = cs.length, ver = cs.filter(c => c.ok).length, over = Math.max(0, used - p.inc), rate = overRate();
    const { known, cost } = costOf(U.plan, used, rate);
    return { month, plan: U.plan, fee: p.fee, inc: p.inc, used, ver, rej: used - ver, over, rate, known, cost, perVer: ver ? cost / ver : 0, pct: p.inc ? used / p.inc * 100 : 0, list: cs };
  }
  const months = () => { const s = new Set(checks().map(c => monthOf(c.ts))); s.add(Net.today.slice(0, 7)); return [...s].sort(); };
  const curMonth = () => U.month || Net.today.slice(0, 7);

  // ---- state for the two screens ----
  const K = { wh: 'VAULT', cell: null, sel: '', to: '', bag: '', counted: {}, msg: '', filter: '' };
  const icon = n => `<span class="material-symbols-rounded">${n}</span>`;
  const rowsOf = id => view360().filter(r => r.loc && whOf(r.loc) === id);
  const byLoc = id => { const m = {}; rowsOf(id).forEach(r => (m[r.loc] = m[r.loc] || []).push(r)); return m; };

  function mapHtml(id, clickable) {
    const w = wh(id), m = byLoc(id), cnt = {}; Object.keys(m).forEach(v => { const p = parse(v), k = p.aisle + '|' + p.bin; cnt[k] = (cnt[k] || 0) + m[v].length; });
    const max = Math.max(1, ...Object.values(cnt)), tot = w.bins;
    return `<div class="vmap" style="--cols:${tot}">${w.aisles.map(a => `<div class="vrow"><b class="va">${a}</b>${Array.from({ length: tot }, (_, i) => {
      const n = cnt[a + '|' + (i + 1)] || 0, sel = K.cell === a + '|' + (i + 1);
      return `<${clickable ? 'button' : 'span'} class="vc ${n ? 'on' : ''} ${sel ? 'sel' : ''}" style="--p:${(n / max).toFixed(2)}" ${clickable ? `data-stk-cell="${a}|${i + 1}"` : ''} title="${a}-${String(i + 1).padStart(2, '0')}: ${n}">${n || ''}</${clickable ? 'button' : 'span'}>`;
    }).join('')}</div>`).join('')}<div class="vrow vax"><b class="va"></b>${Array.from({ length: tot }, (_, i) => `<i>${i + 1}</i>`).join('')}</div></div>`;
  }

  function locatorView() {
    const rows = view360(), inV = rows.filter(r => r.loc && whOf(r.loc) === 'VAULT'), inF = rows.filter(r => r.loc && whOf(r.loc) === 'FORFEIT'), un = rows.filter(r => r.unlocated);
    const open = rows.filter(r => r.hold === 'VAULT' || r.hold === 'FORFEIT');
    let list = rows.filter(r => r.loc && whOf(r.loc) === K.wh);
    if (K.cell) { const [a, b] = K.cell.split('|'); list = list.filter(r => { const p = parse(r.loc); return p.aisle === a && p.bin === +b; }); }
    if (K.filter) { const q = K.filter.toLowerCase(); list = list.filter(r => (r.tk + ' ' + r.st.name + ' ' + r.loc + ' ' + (r.bag || '')).toLowerCase().includes(q)); }
    list.sort((a, b) => a.loc < b.loc ? -1 : 1);
    const target = K.to || (K.sel ? defaultLoc((tickets().find(s => s.no === K.sel) || { loan: 0 }).loan, holds(tickets().find(s => s.no === K.sel) || { status: 'active' }) || 'VAULT') : '');
    const mv = K.sel && target ? `<div class="note">${t('stkWillMove')}: <b>${K.sel}</b> → <b>${target}</b></div>` : '';
    const optT = open.map(r => `<option value="${r.tk}" ${K.sel === r.tk ? 'selected' : ''}>${r.tk} · ${dn(r.st.name)}${r.loc ? ' · ' + r.loc : ' · ' + t('stkNone')}</option>`).join('');
    const hh = holds(tickets().find(s => s.no === K.sel) || { status: 'active' }) || 'VAULT';
    const optL = locsOf(hh).map(v => `<option value="${v}" ${target === v ? 'selected' : ''}>${v}</option>`).join('');
    // day-end count: expected per occupied locator in the vault, counted typed by the shop
    const exp = byLoc('VAULT'), occ = Object.keys(exp).sort();
    const varTotal = occ.reduce((a, v) => a + ((K.counted[v] != null && K.counted[v] !== '' ? +K.counted[v] : exp[v].length) - exp[v].length), 0);
    const counts = events().filter(e => e.type === 'count').slice(-3).reverse();
    const movesLog = events().filter(e => e.type === 'locate').slice(-12).reverse();
    return `<div class="card"><div class="panel"><h2>${t('navLocator')}</h2><div class="sub">${t('stkSub')}</div>
      <div class="chips">${chip('inventory_2', t('stkInVault'), inV.length)}${chip('sell', t('stkForfeit'), inF.length)}${chip('location_off', t('stkUnlocated'), un.length, un.length ? '--s8' : '--s6')}</div>
      <div class="seg">${WH.map(w => `<button class="btn small ${K.wh === w.id ? '' : 'ghost'}" data-stk-wh="${w.id}">${whName(w.id)}</button>`).join('')}</div>
      <div class="sec-title">${t('stkMap')} <small style="color:var(--muted)">${t('stkMapHint')}</small></div>${mapHtml(K.wh, true)}
      <div class="sec-title">${t('stkPutMove')}</div>
      <div class="fields"><label class="f">${t('ticketNo')}<select id="stkSel" data-stk-in="sel"><option value="">–</option>${optT}</select></label>
        <label class="f">${t('stkLocator')}<select id="stkTo" data-stk-in="to">${optL}</select></label>
        <label class="f">${t('stkBag')}<input id="stkBag" data-stk-in="bag" type="text" value="${K.bag}" placeholder="BAG-…"></label></div>
      ${mv}<div class="actions" style="justify-content:flex-start"><button class="btn" data-stk="put" ${K.sel ? '' : 'disabled'}>${t('stkApply')}</button></div>
      ${K.msg ? `<div class="note">${K.msg}</div>` : ''}
      ${un.length ? `<div class="sec-title">${t('stkUnlocated')} (${un.length})</div><div class="tablewrap"><table>${un.map(r => `<tr><td>${r.tk}</td><td>${dn(r.st.name)}</td><td class="n">${fmt(r.st.loan)}</td><td><button class="btn small" data-stk="auto|${r.tk}">${t('stkAuto')}</button></td></tr>`).join('')}</table></div>` : `<div class="note">${t('stkAllLocated')}</div>`}
      <div class="sec-title">${t('stkList')} · ${whName(K.wh)}${K.cell ? ' · ' + K.cell.replace('|', '-') : ''} (${list.length}) ${K.cell ? `<button class="btn small ghost" data-stk="clear">${t('stkClear')}</button>` : ''}</div>
      <div class="fields"><label class="f">${t('ctFilter')}<input data-stk-in="filter" type="text" value="${K.filter}"></label></div>
      <div class="tablewrap"><table><tr><th>${t('stkLocator')}</th><th>${t('ticketNo')}</th><th>${t('name')}</th><th>${t('stkBag')}</th><th>${t('stkLot')}</th><th class="n">${t('loan')}</th></tr>
        ${list.slice(0, 60).map(r => `<tr class="clk" data-stk-pick="${r.tk}"><td><b>${r.loc}</b></td><td>${r.tk}</td><td>${dn(r.st.name)}</td><td>${r.bag || ''}</td><td>${r.lot || ''}</td><td class="n">${fmt(r.st.loan)}</td></tr>`).join('') || `<tr><td colspan="6">${t('none')}</td></tr>`}</table></div>
      <div class="sec-title">${t('stkCount')} <small style="color:var(--muted)">${t('stkCountHint')}</small></div>
      <div class="tablewrap"><table><tr><th>${t('stkLocator')}</th><th class="n">${t('stkExpected')}</th><th class="n">${t('stkCounted')}</th><th class="n">${t('stkVariance')}</th></tr>
        ${occ.map(v => { const c = K.counted[v] != null && K.counted[v] !== '' ? +K.counted[v] : exp[v].length, d = c - exp[v].length; return `<tr><td>${v}</td><td class="n">${exp[v].length}</td><td class="n"><input class="cnt" data-stk-cnt="${v}" type="text" inputmode="numeric" value="${K.counted[v] != null ? K.counted[v] : exp[v].length}"></td><td class="n" style="color:var(${d ? '--s8' : '--s6'})">${d > 0 ? '+' + d : d}</td></tr>`; }).join('')}
        <tr><td><b>${t('total')}</b></td><td class="n"><b>${inV.length}</b></td><td></td><td class="n"><b>${varTotal}</b></td></tr></table></div>
      <div class="actions" style="justify-content:flex-start"><button class="btn small" data-stk="count">${t('stkSaveCount')}</button></div>
      ${counts.length ? `<div class="note">${counts.map(e => `${fd(e.body.date)} · ${t('stkVariance')} ${e.body.variance}`).join(' · ')}</div>` : ''}
      <div class="sec-title">${t('stkMoves')}</div><div class="tablewrap"><table>${movesLog.map(e => `<tr><td>${new Date(e.ts).toISOString().slice(0, 10)}</td><td>${e.body.tk || ''}</td><td>${t('stkhow_' + e.body.how) || e.body.how}</td><td>${e.body.from || '–'} → ${e.body.loc || '–'}</td></tr>`).join('') || `<tr><td>${t('none')}</td></tr>`}</table></div>
    </div></div>`;
  }
  const chip = (ic, lab, n, c) => `<div class="kchip" style="--c:var(${c || '--s1'})">${icon(ic)}<b>${n}</b><span>${lab}</span></div>`;

  function slipView() {
    const m = curMonth(), u = usage(m), p = PLANS[U.plan], ms = months(), warn = u.pct >= 100 ? 'err' : u.pct >= 80 ? 'warn' : '';
    const six = ms.slice(-6).map(x => usage(x));
    const max = Math.max(1, ...six.map(x => x.used));
    return `<div class="card"><div class="panel"><h2>${t('navSlip')}</h2><div class="sub">${t('slipSub')}</div>
      <div class="fields"><label class="f">${t('slipPlan')}<select data-slip-in="plan">${Object.keys(PLANS).map(k => `<option value="${k}" ${U.plan === k ? 'selected' : ''}>${k} · ${fmt(PLANS[k].fee)} / ${PLANS[k].inc}</option>`).join('')}</select></label>
        <label class="f">${t('slipMonth')}<select data-slip-in="month">${ms.map(x => `<option value="${x}" ${m === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        ${p.over == null ? `<label class="f">${t('slipOverRate')}<input data-slip-in="over" type="text" inputmode="decimal" value="${U.over}" placeholder="THB"></label>` : ''}</div>
      ${warn ? `<div class="note slipwarn ${warn}">${icon('warning')} ${t(warn === 'err' ? 'slipWarn100' : 'slipWarn80')}</div>` : ''}
      <div class="dgrid">
        <section class="wg sz-s"><header><h3>${t('slipUsed')}</h3></header><div class="tile"><div class="big">${u.used} / ${u.inc}</div><div class="unit">${t('slipChecks')}</div></div></section>
        <section class="wg sz-s"><header><h3>${t('slipOver')}</h3></header><div class="tile"><div class="big">${u.over}</div><div class="unit">${t('slipChecks')}</div></div></section>
        <section class="wg sz-s"><header><h3>${t('slipCost')}</h3></header><div class="tile"><div class="big">${fmt(u.cost)}</div><div class="unit">${t('baht')}${u.known ? '' : ' · ' + t('slipRateMissing')}</div></div></section>
        <section class="wg sz-s"><header><h3>${t('slipPerPay')}</h3></header><div class="tile"><div class="big">${fmt(u.perVer)}</div><div class="unit">${t('baht')} · ${t('slipRej')} ${u.used ? Math.round(u.rej / u.used * 100) : 0}%</div></div></section></div>
      <div class="sec-title">${t('slipMonthly')}</div>
      <div class="cols">${six.map(x => `<div class="col" title="${x.month}: ${x.used}"><span class="cv">${x.used}</span><div class="cb" style="height:${Math.max(2, x.used / max * 100)}%;background:${x.pct >= 100 ? 'var(--s8)' : 'var(--s1)'}"></div><span class="cl">${x.month.slice(5)}/${x.month.slice(2, 4)}</span></div>`).join('')}</div>
      <div class="sec-title">${t('slipLast')} · ${m}</div>
      <div class="tablewrap"><table><tr><th>${t('date')}</th><th>${t('ticketNo')}</th><th>${t('slipResult')}</th><th>${t('slipRef')}</th></tr>
        ${u.list.slice(0, 15).map(c => `<tr><td>${new Date(c.ts).toISOString().slice(0, 10)}</td><td>${c.tk}</td><td>${c.ok ? '✔ ' + t('slipOk') : '✖ ' + c.code + ' ' + t.raw('code_' + c.code)}</td><td><small>${c.ref || ''}</small></td></tr>`).join('') || `<tr><td colspan="4">${t('none')}</td></tr>`}</table></div>
      <div class="note">${t('slipNote')}</div></div></div>`;
  }

  // ---- events from the screens ----
  async function click(el) {
    const q = a => el.closest('[' + a + ']'); let n;
    if ((n = q('data-stk-wh'))) { K.wh = n.dataset.stkWh; K.cell = null; return true; }
    if ((n = q('data-stk-cell'))) { K.cell = K.cell === n.dataset.stkCell ? null : n.dataset.stkCell; return true; }
    if ((n = q('data-stk-pick'))) { K.sel = n.dataset.stkPick; K.to = ''; return true; }
    if ((n = q('data-stk'))) {
      const [a, b] = n.dataset.stk.split('|');
      if (a === 'clear') { K.cell = null; return true; }
      if (a === 'put') { const st = tickets().find(s => s.no === K.sel), loc = K.to || defaultLoc(st.loan, holds(st) || 'VAULT'); await putAway(K.sel, loc, K.bag); K.msg = '✔ ' + K.sel + ' → ' + loc; K.sel = ''; K.to = ''; K.bag = ''; return true; }
      if (a === 'auto') { const st = tickets().find(s => s.no === b), loc = defaultLoc(st.loan, holds(st) || 'VAULT'); await putAway(b, loc); K.msg = '✔ ' + b + ' → ' + loc; return true; }
      if (a === 'count') {
        const exp = byLoc('VAULT'), rows = Object.keys(exp).sort().map(v => ({ loc: v, exp: exp[v].length, cnt: K.counted[v] != null && K.counted[v] !== '' ? +K.counted[v] : exp[v].length }));
        const variance = rows.reduce((a, r) => a + r.cnt - r.exp, 0);
        await log('count', { whs: 'VAULT', date: Net.today, rows, variance }); K.counted = {}; K.msg = '✔ ' + t('stkSaved') + ' (' + variance + ')'; return true;
      }
    }
    return false;
  }
  function input(el) {
    if (el.dataset.stkIn) { K[el.dataset.stkIn] = el.value; if (el.dataset.stkIn === 'sel') K.to = ''; return el.dataset.stkIn !== 'bag' && el.dataset.stkIn !== 'filter' ? 'change' : 'type'; }
    if (el.dataset.stkCnt) { K.counted[el.dataset.stkCnt] = el.value.replace(/[^0-9]/g, ''); return 'type'; }
    if (el.dataset.slipIn) {
      const k = el.dataset.slipIn; if (k === 'plan') { U.plan = el.value; store.set('gp.slip.plan', U.plan); } else if (k === 'month') U.month = el.value; else { U.over = el.value.replace(/[^0-9.]/g, ''); store.set('gp.slip.over', U.over); }
      return k === 'over' ? 'type' : 'change';
    }
    return false;
  }
  return { bind, WH, PLANS, seed, view: locatorView, slipView, click, input, putAway, defaultLoc, view360, fold, aisleMap, byLoc, mapHtml, usage, costOf, checks, months, curMonth, parse, whOf, locsOf, log, events, state: K, slipState: U };
})();
