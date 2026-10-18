// Admin dashboard (spec §15.4, §15.6, §15.7): every widget is a declarative JSON config; drag to reorder, resize, hide, add — saved per shop.
// Group-by choices, grid columns, labels and the follow-up form are GENERATED from the AD rows in ad_pawn.js (spec §15.8).
window.Dash = (function () {
  const P = window.Pay, C = window.Calc, Net = window.Net, AD = window.AD, Books = window.Books;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  const COL = { status: { offered: '--muted', active: '--s1', overdue: '--s8', redeemed: '--s6', forfeited: '--s2', sold: '--s7' }, risk: { npl: '--s8', watch: '--s4', ok: '--muted', green: '--s6' } };
  const ORDER = { status: ['offered', 'active', 'overdue', 'redeemed', 'forfeited', 'sold'], risk: ['npl', 'watch', 'ok', 'green'], ageing: ['over30', 'over0', 'd30', 'd60', 'later'] };
  const LISTNAME = { status: 'PAWN_Status', cat: 'PAWN_Category', grp: 'PAWN_RateGroup', risk: 'PAWN_Risk', ageing: 'PAWN_Ageing' };
  const dims = () => [...AD.dimensions().map(d => d.dim), 'none'];
  const METRICS = ['count', 'principal', 'owed', 'collected', 'upsell', 'nplratio'];
  const SCOPES = ['open', 'all', 'overdue', 'offered', 'npl', 'watch', 'green', 'fudue', 'unlocated', 'amlo', 'remind'];

  const DEFAULT = [
    // big picture first: lifecycle, loan book, NPL gauge, SlipOK meter, vault map, cash collected
    { id: 'h_flow', title: 'wt_flow', metric: 'count', scope: 'all', groupBy: 'status', chart: 'flow', size: 'l' },
    { id: 'h_book', title: 'wt_book', metric: 'principal', scope: 'open', groupBy: 'risk', chart: 'donut', size: 'm' },
    { id: 'h_npl', title: 'wt_nplg', metric: 'nplratio', scope: 'open', groupBy: 'none', chart: 'gauge', size: 's' },
    { id: 'h_slip', title: 'wt_slipm', metric: 'count', scope: 'all', groupBy: 'none', chart: 'slip', size: 's' },
    { id: 'h_vault', title: 'wt_vault', metric: 'count', scope: 'open', groupBy: 'aisle', chart: 'vault', size: 'm' },
    { id: 'w_month', title: 'wt_month', metric: 'collected', scope: 'all', groupBy: 'month', chart: 'columns', size: 'm' },
    { id: 'h_safe', title: 'wt_safe', metric: 'count', scope: 'all', groupBy: 'none', chart: 'safe', size: 's' },
    { id: 'h_price', title: 'wt_price', metric: 'count', scope: 'all', groupBy: 'none', chart: 'price', size: 's' },
    { id: 'h_expo', title: 'wt_expo', metric: 'count', scope: 'all', groupBy: 'none', chart: 'expo', size: 'm' },
    { id: 'k_open', title: 'wt_open', metric: 'count', scope: 'open', groupBy: 'none', chart: 'tile', size: 's', icon: 'receipt_long' },
    { id: 'k_prin', title: 'wt_prin', metric: 'principal', scope: 'open', groupBy: 'none', chart: 'tile', size: 's', icon: 'payments' },
    { id: 'k_owed', title: 'wt_owed', metric: 'owed', scope: 'open', groupBy: 'none', chart: 'tile', size: 's', icon: 'trending_up' },
    { id: 'k_over', title: 'wt_over', metric: 'principal', scope: 'overdue', groupBy: 'none', chart: 'tile', size: 's', icon: 'schedule' },
    { id: 'k_npl', title: 'wt_npl', metric: 'principal', scope: 'npl', groupBy: 'none', chart: 'tile', size: 's', icon: 'warning' },
    { id: 'k_green', title: 'wt_green', metric: 'count', scope: 'green', groupBy: 'none', chart: 'tile', size: 's', icon: 'verified' },
    { id: 'k_upsell', title: 'wt_upsell', metric: 'upsell', scope: 'green', groupBy: 'none', chart: 'tile', size: 's', icon: 'add_card' },
    { id: 'k_unloc', title: 'wt_unloc', metric: 'count', scope: 'unlocated', groupBy: 'none', chart: 'tile', size: 's', icon: 'location_off' },
    { id: 'k_remind', title: 'wt_remind', metric: 'count', scope: 'remind', groupBy: 'none', chart: 'tile', size: 's', icon: 'notifications_active' },
    { id: 'k_amlo', title: 'wt_amlo', metric: 'count', scope: 'amlo', groupBy: 'none', chart: 'tile', size: 's', icon: 'policy' },
    { id: 'l_npl', title: 'wt_nplist', metric: 'principal', scope: 'npl', groupBy: 'none', chart: 'list', size: 'm' },
    { id: 'l_green', title: 'wt_greenlist', metric: 'upsell', scope: 'green', groupBy: 'none', chart: 'list', size: 'm' },
    { id: 'l_fu', title: 'wt_fulist', metric: 'principal', scope: 'fudue', groupBy: 'none', chart: 'list', size: 'm' },
    { id: 'w_risk', title: 'wt_risk', metric: 'principal', scope: 'open', groupBy: 'risk', chart: 'bars', size: 'm' },
    { id: 'w_status', title: 'wt_status', metric: 'count', scope: 'all', groupBy: 'status', chart: 'bars', size: 'm' },
    { id: 'w_cat', title: 'wt_cat', metric: 'principal', scope: 'open', groupBy: 'cat', chart: 'bars', size: 'm' },
    { id: 'w_age', title: 'wt_age', metric: 'principal', scope: 'open', groupBy: 'ageing', chart: 'bars', size: 'm' }
  ];

  // extensions the shop can switch on (same JSON shape — no code)
  const CATALOG = [
    { id: 'x_grp', title: 'wt_grp', metric: 'principal', scope: 'open', groupBy: 'grp', chart: 'bars', size: 'm' },
    { id: 'x_grpcnt', title: 'wt_grpcnt', metric: 'count', scope: 'all', groupBy: 'grp', chart: 'columns', size: 'm' },
    { id: 'x_owedcat', title: 'wt_owedcat', metric: 'owed', scope: 'open', groupBy: 'cat', chart: 'bars', size: 'm' },
    { id: 'x_issued', title: 'wt_issued', metric: 'principal', scope: 'all', groupBy: 'month', chart: 'columns', size: 'm' },
    { id: 'x_pending', title: 'wt_pending', metric: 'count', scope: 'offered', groupBy: 'none', chart: 'tile', size: 's' },
    { id: 'x_aisle', title: 'wt_aisle', metric: 'principal', scope: 'open', groupBy: 'aisle', chart: 'bars', size: 'm' },
    { id: 'x_donutcat', title: 'wt_donutcat', metric: 'principal', scope: 'open', groupBy: 'cat', chart: 'donut', size: 'm' },
    { id: 'x_upcat', title: 'wt_upcat', metric: 'upsell', scope: 'green', groupBy: 'cat', chart: 'bars', size: 'm' }
  ];
  const D = { layout: null, edit: false, drill: null, hist: null, dragId: null, msg: '', fuMsg: '' };
  try { D.layout = JSON.parse(store.get('gp.dash3')); } catch (e) {}
  if (!Array.isArray(D.layout)) D.layout = DEFAULT.map(w => ({ ...w }));
  const save = () => store.set('gp.dash3', JSON.stringify(D.layout));
  const lang = () => S.lang;
  const label = (dim, k) => LISTNAME[dim] ? AD.label(LISTNAME[dim], k, lang()) : k;

  // ---- data: one derived row per ticket (fold, never stored totals) ----
  function rows() {
    const LOC = {}; if (window.Stock) window.Stock.view360().forEach(x => { LOC[x.tk] = x; });
    return Object.values(Net.all()).map(l => {
      const st = P.fold(l, Net.today), open = st.status === 'active' || st.status === 'overdue';
      const owed = open ? P.interestTo(st, Net.today) : 0, dd = C.daysBetween(Net.today, st.due || Net.today);
      const ageing = !open ? null : dd < -30 ? 'over30' : dd < 0 ? 'over0' : dd <= 30 ? 'd30' : dd <= 60 ? 'd60' : 'later';
      const fu = Net.followups(st.no), last = fu[fu.length - 1], next = last && last.DateNext;
      const risk = P.classify(st, Net.today, { npl: Net.nplDays, price: Net.price });
      return { tk: st.no, st, open, owed, ageing, status: st.status, cat: st.cat || 'other', grp: st.grp || 'standard', risk,
        month: (st.date || Net.today).slice(0, 7), principal: open ? st.principal : 0, collected: st.paid.reduce((a, p) => a + p.amt, 0), live: !!l.live,
        upsell: risk === 'green' ? P.upsell(st, Net.price) : 0, last, lastDate: last && last.DateContact, next,
        fuDue: open && !!next && C.D(next) <= C.D(Net.today), aisle: LOC[st.no] ? LOC[st.no].aisle : null, loc: LOC[st.no] ? LOC[st.no].loc : null, unlocated: !!(LOC[st.no] && LOC[st.no].unlocated), remind: open && C.daysBetween(Net.today, st.due) <= 7, amlo: st.loan >= (+Net.set.amloAt || C.LIMITS.amloAt) && ((l.chain.shop[0].body && l.chain.shop[0].body.tender) || 'cash') === 'cash', overdueDays: open ? P.arrears(st, Net.today).overdueDays : 0 };
    });
  }
  const inScope = (r, w) => ({ all: true, open: r.open, overdue: r.status === 'overdue', offered: r.status === 'offered', npl: r.risk === 'npl', watch: r.risk === 'watch', green: r.risk === 'green', fudue: r.fuDue, unlocated: r.unlocated, amlo: r.amlo, remind: r.remind }[w.scope]);
  const valueOf = (r, m) => m === 'count' ? 1 : m === 'principal' || m === 'nplratio' ? r.principal : m === 'owed' ? r.owed : m === 'upsell' ? r.upsell : r.collected;
  const keyOf = (r, g) => g === 'none' ? 'all' : r[g];
  const monthOf = ts => new Date(ts).toISOString().slice(0, 7);
  function group(w, rs) {
    const out = {};
    rs.filter(r => inScope(r, w)).forEach(r => {
      if (w.metric === 'collected' && w.groupBy === 'month') {                 // collected is dated by the payment, not the loan
        r.st.paid.forEach(p => { const m = monthOf(p.ts); (out[m] = out[m] || { v: 0, rows: [] }).v += p.amt; if (!out[m].rows.includes(r)) out[m].rows.push(r); });
        return;
      }
      const k = keyOf(r, w.groupBy); if (k == null) return; (out[k] = out[k] || { v: 0, rows: [] }); out[k].v += valueOf(r, w.metric); out[k].rows.push(r);
    });
    const order = ORDER[w.groupBy] || (w.groupBy === 'cat' ? AD.list('PAWN_Category').map(x => x.Value) : w.groupBy === 'grp' ? AD.list('PAWN_RateGroup').map(x => x.Value) : null);
    const keys = order ? order.filter(k => out[k] || ORDER[w.groupBy]) : Object.keys(out).sort();
    return keys.map(k => ({ k, v: C.r2(out[k] ? out[k].v : 0), rows: out[k] ? out[k].rows : [] }));
  }
  const money = w => w.metric !== 'count' && w.metric !== 'nplratio';
  const colOf = (g, k) => (COL[g] && COL[g][k]) ? `var(${COL[g][k]})` : 'var(--s1)';      // one measure = one hue; only status/risk carry meaning
  const fv = (w, v) => w.metric === 'nplratio' ? v.toFixed(1) + '%' : money(w) ? fmt(v) : String(v);
  const chip = (dim, k) => `<span class="chip2" style="--c:${colOf(dim, k)}">${label(dim, k)}</span>`;
  const gl = c => lang() === 'th' ? c.th : c.Name;

  // ---- widgets ----
  function listWidget(w, rs) {
    const sel = rs.filter(r => inScope(r, w)).sort((a, b) => w.scope === 'green' ? b.upsell - a.upsell : w.scope === 'fudue' ? C.D(a.next) - C.D(b.next) : b.overdueDays - a.overdueDays).slice(0, 6);
    const extra = r => w.scope === 'green' ? `<b>+${fmt(r.upsell)}</b>` : w.scope === 'fudue' ? `<b>${fd(r.next)}</b>` : `<b>${r.overdueDays} ${t('days')}</b>`;
    return sel.length ? sel.map(r => `<div class="li clk" data-hist="${r.tk}"><span>${r.tk} · ${dn(r.st.name)}</span><span>${extra(r)}</span><small>${fmt(r.st.principal)} · ${r.last ? t('lastContact') + ' ' + fd(r.lastDate) + ' · ' + AD.label('PAWN_Outcome', r.last.Outcome, lang()) : t('noContact')}</small></div>`).join('')
      : `<div class="note">${t('none')}</div>`;
  }
  function widget(w, rs) {
    const g = group(w, rs), max = Math.max(1, ...g.map(x => x.v)), title = t.raw(w.title);
    let body;
    if (w.chart === 'list') body = listWidget(w, rs);
    else if (w.chart === 'flow') {
      const IC = { offered: 'outgoing_mail', active: 'verified', overdue: 'schedule', redeemed: 'lock_open', forfeited: 'sell', sold: 'paid' };
      body = Info.flow(ORDER.status.map(k => ({ label: label('status', k), icon: IC[k], n: rs.filter(r => r.status === k).length, color: `var(${COL.status[k]})`, drill: `${w.id}|status|${k}` })));
    } else if (w.chart === 'donut') {
      const tot = g.reduce((a, x) => a + x.v, 0), short = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : String(Math.round(v));
      body = Info.donut(g.map(x => ({ k: x.k, label: label(w.groupBy, x.k), v: x.v, color: colOf(w.groupBy, x.k), drill: `${w.id}|${w.groupBy}|${x.k}` })), money(w) ? short(tot) : String(tot), money(w) ? t('baht') : t('tickets'), v => fv(w, v));
    } else if (w.chart === 'gauge') {
      const np = rs.filter(r => r.risk === 'npl').reduce((a, r) => a + r.principal, 0), op = rs.filter(r => r.open).reduce((a, r) => a + r.principal, 0), v = C.r2(op ? np / op * 100 : 0);
      body = `<div data-drill="${w.id}|none|all" class="clk">${Info.gauge(v, 50, 'var(--s8)', v.toFixed(1) + '%', t('wt_nplr'), t('nplRule') + ' ' + Net.nplDays + ' ' + t('days'))}</div>`;
    } else if (w.chart === 'slip') {
      const Sk = window.Stock, u = Sk.usage(Sk.curMonth());
      body = `<div data-tab="slipuse" class="clk">${Info.meter(u.used, u.inc, String, t('slipChecks'), t('slipCost') + ' ' + fmt(u.cost) + ' ' + t('baht') + ' · ' + u.plan + ' · ' + u.month)}</div>`;
    } else if (w.chart === 'price') {
      const Pr = window.Price, cur = Pr.latest(Net.today), pv = Pr.prev(), L = Pr.list().slice(-30).map(p => p.buy), d = cur && pv ? cur.buy - pv.buy : 0, st = Pr.stale(Net.today, cur);
      body = `<div data-tab="price" class="clk"><div class="safe-row" style="--c:${st ? 'var(--s4)' : 'var(--s1)'}"><span class="fl-ic">${Info.icon('sell')}</span><div><b>${cur ? fmt(cur.buy) : '–'}</b><small>${t('prBuy')} · ${cur ? fd(cur.date) : ''}</small></div></div>
        ${Info.spark(L, 'var(--s1)')}<div class="note" style="color:var(${d < 0 ? '--s8' : '--s6'})">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : ''}${fmt(d)} ${t('prChange')}${st ? ' · ⚠ ' + t('prStaleShort') : ''}</div></div>`;
    } else if (w.chart === 'expo') {
      const Pr = window.Price, cur = Pr.latest(Net.today), ex = Pr.exposure(rs.map(r => r.st), cur ? cur.buy : 0), pct = ex.value ? Math.min(100, ex.principal / ex.value * 100) : 0;
      body = `<div data-tab="price" class="clk"><div class="m-top"><b>${fmt(ex.cushion)}</b> <small>${t('prCushion')}</small></div>
        <div class="m-bar" role="img" aria-label="${pct.toFixed(0)}%"><div class="m-fill" style="width:${pct}%;background:${ex.cushion < 0 ? 'var(--s8)' : 'var(--s1)'}"></div></div>
        <div class="m-sub">${t('prPrincipal')} ${fmt(ex.principal)} / ${t('prValue')} ${fmt(ex.value)} · ${t('prUnder')}: <b style="color:var(${ex.under ? '--s8' : '--s6'})">${ex.under}</b></div></div>`;
    } else if (w.chart === 'safe') {
      const BK = window.BackupView, last = BK.last(), st = BK.stale(), st2 = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } } }, JN = window.Journal, tot = JN.allEvents(st2).length, pend = JN.pending(st2).length, on = st2.get('gp.journal.on') === '1';
      const bad = !last || (st && st.why === 'days'), col = !last ? 'var(--s8)' : (st && st.why) ? 'var(--s4)' : 'var(--s6)';
      body = `<div data-tab="backup" class="clk"><div class="safe-row" style="--c:${col}"><span class="fl-ic">${Info.icon(bad ? 'gpp_maybe' : 'verified_user')}</span><div><b>${last ? new Date(last.ts).toISOString().slice(0, 10) : t('bkNone')}</b><small>${t('bkLast')}${last ? ' · ' + t('bkch_' + last.channel) : ''}</small></div></div>
        ${on ? Info.meter(tot - pend, tot || 1, String, t('bkJSynced'), pend ? pend + ' ' + t('bkJPending') : t('bkAGood')) : `<div class="note">${t('bkJOff')}</div>`}</div>`;
    } else if (w.chart === 'vault') {
      const un = rs.filter(r => r.unlocated).length, inV = rs.filter(r => r.loc && window.Stock.whOf(r.loc) === 'VAULT').length;
      body = `<div data-tab="locator" class="clk">${window.Stock.mapHtml('VAULT', false)}<div class="vfoot"><span>${t('stkInVault')}: <b>${inV}</b></span><span style="color:var(${un ? '--s8' : '--s6'})">${t('stkUnlocated')}: <b>${un}</b></span></div></div>`;
    }
    else if (w.chart === 'tile' || w.groupBy === 'none') {
      let v = g.reduce((a, x) => a + x.v, 0);
      if (w.metric === 'nplratio') { const np = rs.filter(r => r.risk === 'npl').reduce((a, r) => a + r.principal, 0), op = rs.filter(r => r.open).reduce((a, r) => a + r.principal, 0); v = op ? np / op * 100 : 0; }
      body = `<div class="tile" data-drill="${w.id}|none|all">${w.icon ? `<span class="ti"><span class="material-symbols-rounded">${w.icon}</span></span>` : ''}<div class="big">${fv(w, C.r2(v))}</div><div class="unit">${w.metric === 'nplratio' ? t('ofOpen') : money(w) ? t('baht') : t('tickets')}</div></div>`;
    } else if (w.chart === 'columns') {
      body = `<div class="cols">${g.map(x => `<div class="col" data-drill="${w.id}|${w.groupBy}|${x.k}" title="${w.groupBy === 'month' ? x.k : label(w.groupBy, x.k)}: ${fv(w, x.v)}">
        <span class="cv">${money(w) ? Math.round(x.v).toLocaleString() : x.v}</span><div class="cb" style="height:${Math.max(2, x.v / max * 100)}%;background:${colOf(w.groupBy, x.k)}"></div><span class="cl">${w.groupBy === 'month' ? x.k.slice(5) + '/' + x.k.slice(2, 4) : label(w.groupBy, x.k)}</span></div>`).join('')}</div>`;
    } else {
      body = g.map(x => `<div class="bar" data-drill="${w.id}|${w.groupBy}|${x.k}" title="${w.groupBy === 'month' ? x.k : label(w.groupBy, x.k)}: ${fv(w, x.v)}">
        <span class="bl">${w.groupBy === 'month' ? x.k : label(w.groupBy, x.k)}</span><div class="bt"><div class="bf" style="width:${x.v / max * 100}%;background:${colOf(w.groupBy, x.k)}"></div></div><span class="bv">${fv(w, x.v)}</span></div>`).join('');
    }
    const ctl = D.edit ? `<div class="wctl"><button data-wmove="${w.id}|-1" title="${t('moveUp')}">▲</button><button data-wmove="${w.id}|1" title="${t('moveDown')}">▼</button>
      ${['s', 'm', 'l'].map(z => `<button class="${w.size === z ? 'on' : ''}" data-wsize="${w.id}|${z}">${z.toUpperCase()}</button>`).join('')}<button data-wdel="${w.id}" title="${t('hide')}">✕</button></div>` : '';
    return `<section class="wg sz-${w.size} ${D.edit ? 'editing' : ''}" ${D.edit ? 'draggable="true"' : ''} data-wid="${w.id}"><header><span class="grip">${D.edit ? '⠿' : ''}</span><h3>${title}</h3>${ctl}</header>${body}</section>`;
  }

  function cpanel() {
    const inLayout = new Set(D.layout.map(w => w.id)), avail = CATALOG.filter(w => !inLayout.has(w.id));
    const sel = (id, arr, f) => `<select id="${id}">${arr.map(x => `<option value="${x}">${f(x)}</option>`).join('')}</select>`;
    const gname = d => d === 'none' ? t('g_none') : gl(AD.cols('PAWN_Ticket').find(c => AD.ROWKEY[c.ColumnName] === d));
    return `<div class="card cpanel"><div class="panel"><h2>${t('cpanel')}</h2><div class="sub">${t('cpanelSub')}</div>
      <div class="sec-title">${t('extAvail')}</div>
      ${avail.length ? avail.map(w => `<div class="ext"><span>${t.raw(w.title)}</span><button class="btn small" data-wadd="${w.id}">${t('add')}</button></div>`).join('') : `<div class="note">${t('extNone')}</div>`}
      <div class="sec-title">${t('extNew')}</div><div class="note">${t('groupFromAD')}</div>
      <div class="fields"><label class="f">${t('wTitle')}<input id="nwT" value=""></label><label class="f">${t('wMetric')}${sel('nwM', METRICS, x => t('m_' + x))}</label><label class="f">${t('wGroup')}${sel('nwG', dims(), gname)}</label>
        <label class="f">${t('wScope')}${sel('nwS', SCOPES, x => t('sc_' + x))}</label>
        <label class="f">${t('wChart')}<select id="nwC"><option value="bars">${t('c_bars')}</option><option value="columns">${t('c_columns')}</option><option value="tile">${t('c_tile')}</option><option value="list">${t('c_list')}</option><option value="donut">${t('c_donut')}</option></select></label></div>
      <div class="actions" style="justify-content:flex-start"><button class="btn small" data-wnew="1">${t('add')}</button></div>
      <div class="sec-title">${t('layoutJson')}</div>
      <textarea id="layoutJson">${JSON.stringify(D.layout, null, 1)}</textarea>
      <div class="actions" style="justify-content:flex-start"><button class="btn small" data-wjson="apply">${t('apply')}</button><button class="btn small ghost" style="color:var(--accent)" data-wjson="reset">${t('reset')}</button></div>
      <div class="note">${D.msg}</div></div></div>`;
  }

  // listing columns come from the AD (IsDisplayedGrid, SeqNo) — spec §15.8
  const FIELD = { DocumentNo: r => r.tk + (r.live ? ' ★' : ''), Name: r => dn(r.st.name), Category: r => r.cat, LoanAmt: r => r.st.loan, PrincipalAmt: r => r.st.principal, DateDue: r => r.st.due, Status: r => r.status, Risk: r => r.risk || '' };
  const LISTOF = { Category: 'cat', Status: 'status', Risk: 'risk' };
  function cell(c, r) {
    const v = FIELD[c.ColumnName](r);
    if (c.AD_Reference_ID === 17) return v ? chip(LISTOF[c.ColumnName], v) : '–';
    if (c.AD_Reference_ID === 12) return fmt(v);
    if (c.AD_Reference_ID === 15) return fd(v);
    return v;
  }
  function listing(rs) {
    if (!D.drill) return '';
    const [wid, dim, key] = D.drill, w = [...D.layout, ...CATALOG].find(x => x.id === wid) || { scope: 'all', metric: 'count' };
    let sel = rs.filter(r => inScope(r, w));
    if (dim !== 'none') sel = dim === 'month' && w.metric === 'collected' ? sel.filter(r => r.st.paid.some(p => monthOf(p.ts) === key)) : sel.filter(r => keyOf(r, dim) === key);
    sel.sort((a, b) => b.st.principal - a.st.principal);
    const cols = AD.cols('PAWN_Ticket').filter(c => c.IsDisplayedGrid === 'Y'), num = c => c.AD_Reference_ID === 12;
    return `<div class="card"><div class="panel"><h2>${t('listing')}: ${t.raw(w.title)}${dim !== 'none' ? ' · ' + (dim === 'month' ? key : label(dim, key)) : ''} <button class="btn small ghost" style="color:var(--accent)" data-drill-clear="1">${t('close')}</button></h2>
      <div class="tablewrap"><table><tr>${cols.map(c => `<th class="${num(c) ? 'n' : ''}">${gl(c)}</th>`).join('')}<th>${t('lastContact')}</th></tr>
      ${sel.map(r => `<tr class="clk" data-hist="${r.tk}">${cols.map(c => `<td class="${num(c) ? 'n' : ''}">${cell(c, r)}</td>`).join('')}<td>${r.last ? fd(r.lastDate) + ' · ' + AD.label('PAWN_Outcome', r.last.Outcome, lang()) : '–'}</td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}">${t('none')}</td></tr>`}</table></div>${history()}</div></div>`;
  }

  // follow-up form generated from the PAWN_FollowUp AD columns (type from AD_Reference_ID, options from the reference list)
  function fuForm(tk) {
    const field = c => {
      const id = 'fu_' + c.ColumnName, def = c.DefaultValue === '@#Date@' ? Net.today : (c.DefaultValue || '');
      const ctl = c.AD_Reference_ID === 17 ? `<select id="${id}">${AD.list(c.AD_Reference_Value_ID).map(o => `<option value="${o.Value}" ${o.Value === def ? 'selected' : ''}>${lang() === 'th' ? o.th : o.Name}</option>`).join('')}</select>`
        : c.AD_Reference_ID === 15 ? `<input id="${id}" type="date" value="${def}">` : `<input id="${id}" type="text" value="">`;
      return `<label class="f">${gl(c)}${c.IsMandatory === 'Y' ? ' *' : ''}${ctl}</label>`;
    };
    return `<div class="fields">${AD.cols('PAWN_FollowUp').filter(c => c.IsDisplayed === 'Y').map(field).join('')}</div>
      <div class="actions" style="justify-content:flex-start"><button class="btn small" data-fu="${tk}">${t('logFu')}</button></div><div class="note">${D.fuMsg}</div>`;
  }
  const jlines = e => e.lines.map(l => `${l.dr ? 'Dr' : 'Cr'} ${lang() === 'th' ? Books.ACCT[l.acct][2] : Books.ACCT[l.acct][1]} ${fmt(l.dr || l.cr)}`).join(' · ');

  // AD_Attachment: the SlipOK JSON response kept with the payment record; sha256 is inside the signed event, so a swapped file is detected
  const bankName = c => (window.Pay.SlipOK.BANKS[c] || c || '');
  function atts(st, l) {
    const all = [...l.chain.shop].filter(e => e.body && e.body.attachment).map(e => ({ ...e.body.attachment, ts: e.ts, type: e.type, hash: e.hash }));
    if (!all.length) return '';
    return `<h3 style="margin-top:14px">${t('attachHead')}</h3><div class="note">${t('attachNote')}</div><div class="tablewrap"><table><tr><th>AD_Attachment</th><th>${t('detail')}</th><th>sha256</th><th>${t('check')}</th><th></th></tr>
      ${all.map(a => { const d = a.json.data || {}, ok = true; const href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(a.json, null, 2));
        return `<tr><td>${a.AD_Table} · ${a.title}</td><td>${a.json.success ? 'SlipOK ✔' : 'SlipOK ' + a.json.code} · ${bankName(d.sendingBank)} → ${bankName(d.receivingBank)} · ${d.transDate || ''} ${d.transTime || ''} · ${fmt(d.amount || 0)} · ${d.transRef || ''}</td><td><code>${a.sha256.slice(0, 10)}</code></td><td>${D.hist && D.hist.att && a.sha256 in D.hist.att ? (D.hist.att[a.sha256] ? '<span class="okm">✔ ' + t('verified') + '</span>' : '<span class="badm">✖ ' + t('broken') + '</span>') : '…'}</td><td><a href="${href}" download="${a.title}">${t('download')}</a></td></tr>`; }).join('')}</table></div>`;
  }
  function history() {
    if (!D.hist) return '';
    const l = Net.all()[D.hist.tk]; if (!l) return '';
    const st = P.fold(l, Net.today), v = D.hist.verify || [], cv = D.hist.crmVerify || [];
    const evs = [...l.chain.shop, ...l.chain.phone].sort((a, b) => a.ts - b.ts || (a.by < b.by ? -1 : 1));
    const mk = (arr, e) => { const x = arr.find(y => y.by === e.by && y.n === e.n); return x ? (x.ok ? `<span class="okm">✔ ${t('verified')}</span>` : `<span class="badm">✖ ${t('broken')} (${x.why})</span>`) : '…'; };
    const sum = e => { const b = e.body; return { offer: `${t('loan')} ${fmt(b.loan)} · ${b.rate}%`, ack: t('ackd'), payment_claim: `${AD.label('PAWN_PayMode', b.mode, lang())} ${fmt(b.amount)}`,
      payment_verified: `${AD.label('PAWN_PayMode', b.mode, lang())} ${fmt(b.amt)} (${t('int')} ${fmt(b.int)} + VAT ${fmt(b.vat)} + ${t('principalPart')} ${fmt(b.principalPart)})${b.reissue ? ' → ' + b.reissue.no : ''}`,
      payment_rejected: `${b.reason} ${t.raw('code_' + b.reason)}${b.attachment ? ' · ' + t('attached') : ''}`, payment_wait: `${b.code} ${t.raw('code_' + b.code)}`, closed: b.how + (b.appraised != null ? ' · ' + fmt(b.appraised) : ''), sale: `${fmt(b.price)} · ${b.buyer || ''}` }[e.type] || ''; };
    const allOk = v.length && v.every(x => x.ok), crmL = Net.crm[st.no], fu = crmL ? crmL.chain.shop : [];
    const risk = P.classify(st, Net.today, { npl: Net.nplDays, price: Net.price }), ar = P.arrears(st, Net.today), fcols = AD.cols('PAWN_FollowUp').filter(c => c.IsDisplayed === 'Y');
    return `<div class="hist"><h3>${t('history')}: ${st.no} · ${dn(st.name)} <span class="${allOk ? 'okm' : 'badm'}">${v.length ? (allOk ? '✔ ' + t('chainOk') : '✖ ' + t('chainBroken')) : ''}</span> ${risk ? chip('risk', risk) : ''}</h3>
      <div class="note">${st.phone} · ${dn(st.address || '')} · ${label('cat', st.cat)} ${st.weight} g · ${t('loan')} ${fmt(st.loan)} · ${t('principalNow')} ${fmt(st.principal)}${risk ? ` · ${t('overdueDays')} ${ar.overdueDays} · ${t('lateDays')} ${ar.lateDays}` : ''}${risk === 'green' ? ` · ${t('headroomNow')} ${fmt(P.upsell(st, Net.price))}` : ''}</div>
      <div class="tablewrap"><table><tr><th>#</th><th>${t('by')}</th><th>${t('event')}</th><th>${t('date')}</th><th>${t('detail')}</th><th>${t('hash')}</th><th>${t('check')}</th></tr>
      ${evs.map(e => `<tr><td>${e.n}</td><td>${t('by_' + e.by)}</td><td>${t.raw('ev_' + e.type)}</td><td>${new Date(e.ts).toISOString().slice(0, 10)}</td><td>${sum(e)}</td><td><code>${e.hash.slice(0, 8)}</code></td><td>${mk(v, e)}</td></tr>`).join('')}</table></div>
      <div class="actions" style="justify-content:flex-start">${st.paid.length ? (l.tamper ? `<button class="btn small" data-repair="${st.no}">${t('repair')}</button>` : `<button class="btn small" style="background:var(--s8)" data-tamper="${st.no}">${t('tamper')}</button>`) : ''}</div>
      <div class="note">${t('tamperNote')}</div>
      ${(() => { const fe = l.chain.shop.filter(e => e.type === 'payment_verified' && e.body.mode === 'full').pop(); if (!fe) return ''; const ctx = { t, fmt, fd, no: 'R-' + st.no, date: new Date(fe.ts).toISOString().slice(0, 10), shop: { name: t('rcShopName'), addr: t('rcShopAddr'), taxId: '1 2345 6789 10 1' }, cust: { name: dn(st.name), addr: dn(st.address || ''), taxId: '' } };
        return `<div class="actions" style="justify-content:flex-start"><button class="btn small" data-rcpt="${st.no}">${t('rcShow')}</button>${D.rcpt === st.no ? `<button class="btn small" data-act="print">${t('rcPrint')}</button>` : ''}</div>${D.rcpt === st.no ? window.Receipt.html(window.Receipt.fromEvent(st, fe), ctx) : ''}`; })()}
      ${atts(st, l)}
      <h3 style="margin-top:14px">${t('crmHead')}</h3><div class="note">${t('crmNote')}</div>
      ${fu.length ? `<div class="tablewrap"><table><tr><th>#</th>${fcols.map(c => `<th>${gl(c)}</th>`).join('')}<th>${t('check')}</th></tr>
      ${fu.map(e => `<tr><td>${e.n}</td>${fcols.map(c => `<td>${c.AD_Reference_ID === 17 ? AD.label(c.AD_Reference_Value_ID, e.body[c.ColumnName], lang()) : c.AD_Reference_ID === 15 && e.body[c.ColumnName] ? fd(e.body[c.ColumnName]) : (e.body[c.ColumnName] || '')}</td>`).join('')}<td>${mk(cv, e)}</td></tr>`).join('')}</table></div>` : `<div class="note">${t('noContact')}</div>`}
      ${fuForm(st.no)}
      <h3 style="margin-top:14px">${t('journalHead')}</h3><div class="note">${t('previewNote')}</div>
      <div class="tablewrap"><table><tr><th>${t('date')}</th><th>${t('event')}</th><th>${t('journal')}</th></tr>${Books.journals(l, Net.price).map(e => `<tr><td>${fd(e.date)}</td><td>${e.desc}</td><td>${jlines(e)}</td></tr>`).join('')}</table></div>
      <div class="actions" style="justify-content:flex-start"><button class="btn small ghost" style="color:var(--accent)" data-hist-close="1">${t('close')}</button></div></div>`;
  }

  function view() {
    const rs = rows();
    return `<div class="dashbar"><h2 style="margin:0;flex:1">${t('navDash')}</h2><span class="chip">${t('sampleData')}</span><span class="chip">${t('nplRule')} ${Net.nplDays} ${t('days')}</span>
      <button class="btn small ${D.edit ? '' : 'ghost'}" style="${D.edit ? '' : 'color:var(--accent)'}" data-dedit="1">${D.edit ? t('doneEdit') : t('customize')}</button></div>
      <div class="note" style="margin-bottom:8px">${t('greenRule')}</div>
      ${D.edit ? `<div class="note" style="margin-bottom:8px">${t('dragHint')}</div>` : ''}
      <div class="dgrid">${D.layout.map(w => widget(w, rs)).join('')}</div>${D.edit ? cpanel() : ''}${listing(rs)}`;
  }

  // ---- actions (wired from app.js) ----
  function moveTo(id, beforeId) {
    const a = D.layout.findIndex(w => w.id === id); if (a < 0) return; const [w] = D.layout.splice(a, 1);
    const b = beforeId ? D.layout.findIndex(x => x.id === beforeId) : D.layout.length; D.layout.splice(b < 0 ? D.layout.length : b, 0, w); save();
  }
  async function showHist(tk) {
    D.hist = { tk, verify: null, crmVerify: null, att: {} }; const l = Net.all()[tk];
    D.hist.verify = await l.verifyAll(); D.hist.crmVerify = Net.crm[tk] ? await Net.crm[tk].verifyAll() : [];
    for (const e of l.chain.shop) if (e.body && e.body.attachment) D.hist.att[e.body.attachment.sha256] = (await window.Token.sha(window.Token.canon(e.body.attachment.json))) === e.body.attachment.sha256;
  }
  async function logFu(tk) {
    const f = {}; let bad = false;
    AD.cols('PAWN_FollowUp').filter(c => c.IsDisplayed === 'Y').forEach(c => { const v = document.getElementById('fu_' + c.ColumnName).value; if (c.IsMandatory === 'Y' && !v) bad = true; f[c.ColumnName] = v; });
    if (bad) { D.fuMsg = '⚠ ' + t('mandatory'); return; }
    await Net.logFollowup(tk, f); D.fuMsg = t('fuSaved'); await showHist(tk);
  }
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
      D.layout.push({ id: 'u_' + Date.now().toString(36), title, metric: v('nwM'), scope: v('nwS'), groupBy: v('nwG'), chart: v('nwC'), size: 'm' }); save(); return true;
    }
    if ((n = q('data-wjson'))) {
      if (n.dataset.wjson === 'reset') { D.layout = DEFAULT.map(w => ({ ...w })); D.msg = ''; save(); return true; }
      try {
        const j = JSON.parse(document.getElementById('layoutJson').value);
        if (!Array.isArray(j) || j.some(w => !w.id || !METRICS.includes(w.metric) || !dims().includes(w.groupBy))) throw new Error(t('jsonBad'));
        D.layout = j.map(w => ({ scope: 'all', chart: 'bars', size: 'm', title: w.id, ...w })); D.msg = t('jsonOk'); save();
      } catch (e) { D.msg = '⚠ ' + e.message; }
      return true;
    }
    if ((n = q('data-hist-close'))) { D.hist = null; return true; }
    if ((n = q('data-fu'))) { logFu(n.dataset.fu).then(() => window.dispatchEvent(new Event('gp-render'))); return false; }
    if ((n = q('data-tamper'))) { Net.tamper(n.dataset.tamper); showHist(n.dataset.tamper).then(() => window.dispatchEvent(new Event('gp-render'))); return true; }
    if ((n = q('data-rcpt'))) { D.rcpt = D.rcpt === n.dataset.rcpt ? null : n.dataset.rcpt; return true; }
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
