// State, i18n, adaptive shell, settings, theme editor, binding.
(function () {
  const C = window.Calc, V = window.Views, I = window.I18N;
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  const S = {
    lang: store.get('gp.lang') || 'th', tab: 'counter', action: 'a1', profile: 'c1', showTicket: false,
    set: { taxType: 'VAT', taxPoint: 'interest', incl: 'exclude', mode: 'P', deduct: 2000, defMonths: 4, rounding: 'half', basis: 'month', vat: 7, nplDays: 90, kycAt: 700000, amloAt: 2000000 },
    price: { buy: 100000, sell: 100200, tax: 99900 },   // sample board, per baht-weight (partner sketch: 100,000)
    issue: { name: 'สมชาย ตัวอย่าง', phone: '0800000001', grp: 'standard', cat: 0, item: 0, qty: 1, weight: 15.16, type: 0,
             basis: 'buy', loan: 80000, date: '2025-07-14', months: 4, agreed: '', track: 'BAG-0001', safe: 'SAFE-A1', idNo: '', idCopy: false, tender: 'cash' },
    ticket: { no: 'A100', first: 'A100', name: 'สมชาย ตัวอย่าง', date: '2025-07-14', loan: 80000, weight: 15.16, type: 0, grp: 'standard',
              paid: [true, false, false, false], lastPaid: '2025-08-14', paidInterest: 1000, chainUntaxed: 0 },
    tick: [false, true, false, false],
    j: { tk: null, mode: 'installment', amt: 5000, slip: 'ok', via: 'web', code: '', codeBad: false },
    tx: { today: '2025-09-25', newLoan: 83000, todayPrice: 102000, discount: 0, cash: 50000 },
    overdue: [{ no: 'A087', due: '2025-06-30', weight: 7.58, loan: 38000 }, { no: 'A091', due: '2025-07-15', weight: 3.79, loan: 18500 }]
  };
  const THEMES = {
    quickgold: { header: '#009688', 'header-text': '#ffffff', bg: '#f7f7f8', card: '#ffffff', text: '#22292e', label: '#ff9800', accent: '#00796b', chip: '#e0f2f1', radius: 14, font: 16 },
    gold:      { header: '#b8860b', 'header-text': '#ffffff', bg: '#fbf8f1', card: '#ffffff', text: '#3e2f12', label: '#a0522d', accent: '#8b6508', chip: '#f6ecd2', radius: 10, font: 16 },
    night:     { dark: 1, header: '#1f2933', 'header-text': '#f5d76e', bg: '#111820', card: '#1b242e', text: '#e8edf2', label: '#f5b041', accent: '#26a69a', chip: '#24343f', radius: 14, font: 16 }
  };
  let theme = (() => { try { return JSON.parse(store.get('gp.theme')) || { ...THEMES.quickgold }; } catch (e) { return { ...THEMES.quickgold }; } })();

  const t = k => (I[k] ? I[k][S.lang === 'th' ? 0 : 1] : k);
  // sample records are stored once (Thai names); shown in the language of the screen
  window.dn = n => { n = String(n == null ? '' : n); return S.lang === 'th' ? n.replace(/^Sample address(,)? ?/, 'ที่อยู่ตัวอย่าง$1 ').replace(/ ,/, ',') : n.replace(/^ลูกค้าตัวอย่าง (\d+)$/, 'Sample customer $1'); };
  t.raw = k => (I[k] ? t(k) : k);
  const DE = window.DayEndView, FF = window.ForfeitView, PR = window.PriceView, OP = window.OpeningView, BK = window.BackupView, SK = window.Stock, CV = window.ContactsView, V2 = window.Views2, F = window.Flow, D = window.Dash, St = window.Story, Net = window.Net;
  const fmt = x => Number(x || 0).toLocaleString(S.lang === 'th' ? 'th-TH' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fd = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

  function applyTheme() {
    if (!('dark' in theme)) document.documentElement.removeAttribute('data-dark');
    const r = document.documentElement.style;
    Object.entries(theme).forEach(([k, v]) => {
      if (k === 'dark') document.documentElement.toggleAttribute('data-dark', !!v);
      else if (k === 'radius') r.setProperty('--radius', v + 'px');
      else if (k === 'font') r.setProperty('--font', v + 'px');
      else r.setProperty('--' + k, v);
    });
    store.set('gp.theme', JSON.stringify(theme));
  }
  function applyProfile(p) {
    S.profile = p; Object.assign(S.set, { taxPoint: C.profiles[p].taxPoint, basis: C.profiles[p].basis, rounding: C.profiles[p].rounding });
  }

  // ---- shell ----
  const NAV = [['counter', 'storefront', 'navCounter'], ['journey', 'swap_horiz', 'navJourney'], ['dash', 'dashboard', 'navDash'], ['locator', 'inventory_2', 'navLocator'], ['slipuse', 'fact_check', 'navSlip'], ['books', 'account_balance', 'navBooks'], ['ad', 'schema', 'navAd'], ['settings', 'tune', 'navSettings'], ['theme', 'palette', 'navTheme'], ['thai', 'flag', 'navThai'], ['local', 'cloud_off', 'navLocal'], ['contacts', 'contacts', 'navContacts'], ['dayend', 'point_of_sale', 'navDayEnd'], ['forfeit', 'gavel', 'navForfeit'], ['price', 'monitoring', 'navPrice'], ['opening', 'upload_file', 'navOpening'], ['backup', 'cloud_upload', 'navBackup'], ['story', 'movie', 'navStory']];
  const ACTIONS = [
    ['grpTicket', [['a1', 'receipt_long', '#fff3e0', '#ef6c00']]],
    ['grpMoney', [['a2', 'payments', '#e8f5e9', '#2e7d32'], ['a3', 'swap_vert', '#e3f2fd', '#1565c0']]],
    ['grpClose', [['a4', 'lock_open', '#f3e5f5', '#7b1fa2'], ['a5', 'inventory_2', '#ffebee', '#c62828']]]
  ];
  const icon = (n) => `<span class="material-symbols-rounded">${n}</span>`;

  function counter() {
    const menu = ACTIONS.map(([g, list]) => `<div class="sec-title">${t(g)}</div><div class="card">${list.map(([k, ic, bg, fg]) =>
      `<div class="menu-item ${S.action === k ? 'on' : ''}" data-action="${k}"><div class="ic" style="background:${bg};color:${fg}">${icon(ic)}</div><div><div>${t(k)}</div><small style="color:var(--muted)">${t(k + 's')}</small></div></div>`).join('')}</div>`).join('');
    const body = { a1: V.issue, a2: V.pay, a3: V.change, a4: V.redeem, a5: V.forfeit }[S.action]();
    return `<div class="grid"><div>${menu}</div><div class="card">${body}</div></div>`;
  }

  function settings() {
    const { sel, inp, f, conf, L } = V, s = S.set;
    return `<div class="card"><div class="panel"><h2>${t('navSettings')}</h2><div class="sub">${t('profileNote')}</div>
      <fieldset><legend>${t('profile')}</legend><div class="fields">
        ${f(t('profile'), sel('profile', S.profile, [['c1', t('case1')], ['c2', t('case2')]]))}</div></fieldset>
      <fieldset><legend>${t('limitsHead')}</legend><div class="fields">
        ${f(t('kycAtLbl'), inp('set.kycAt', s.kycAt))}${f(t('amloAtLbl'), inp('set.amloAt', s.amloAt))}</div><div class="note">${t('limitsNote')}</div></fieldset>
      <fieldset><legend>${t('branchParams')}</legend><div class="fields">
        ${f(t('taxType'), sel('set.taxType', s.taxType, [['VAT', 'VAT'], ['SBT', 'SBT']]))}
        ${f(t('taxPoint'), sel('set.taxPoint', s.taxPoint, [['interest', t('atInterest')], ['close', t('atClose')], ['final', t('atFinal')]]))}
        ${f(t('incl'), sel('set.incl', s.incl, [['exclude', t('exclude')], ['include', t('include')]]))}
        ${f(t('interestBasis'), sel('set.basis', s.basis, [['month', t('perMonth')], ['day', t('perDay')]]))}
        ${f(t('rounding'), sel('set.rounding', s.rounding, [['month', t('rMonth')], ['half', t('rHalf')], ['week', t('rWeek')], ['day', t('rDay')]]))}
        ${f(t('deductMode'), sel('set.mode', s.mode, [['P', t('byPct')], ['A', t('byAmt')]]))}
        ${f(t('deductAmt'), inp('set.deduct', s.deduct))}
        ${f(t('defMonths'), inp('set.defMonths', s.defMonths))}
        ${f(t('nplDaysLbl'), inp('set.nplDays', s.nplDays))}
      </div>${s.rounding === 'week' ? `<div class="note">${conf('qWeek')} ${t('qWeek')}</div>` : ''}
      ${s.mode === 'A' ? `<div class="note">${conf('qA')} ${t('qA')}</div>` : ''}</fieldset>
      <fieldset><legend>${t('goldTypes')}</legend><table>${C.goldTypes.map((g, i) => `<tr><td>${L(g)}</td><td class="n">${inp('gt.' + i, g.pct)}</td></tr>`).join('')}</table></fieldset>
      <fieldset><legend>${t('rates')}</legend><table><tr><th>${t('rateGrp')}</th><th class="n">${t('from')}</th><th class="n">${t('to')}</th><th class="n">%</th><th class="n">${t('perYear')}</th></tr>
        ${C.rates.map(r => { const e = Math.min(r.rate, C.LEGAL.maxMonthly); return `<tr><td>${t('grp_' + r.grp)}</td><td class="n">${fmt(r.from)}</td><td class="n">${fmt(r.to)}</td><td class="n">${e}${e < r.rate ? ' ⚠' : ''}</td><td class="n">${(e * 12).toFixed(2)}%</td></tr>`; }).join('')}</table><div class="note">${t('legalNote')}</div></fieldset>
      <fieldset><legend>${t('ratioTbl')} ${conf('qRatio')}</legend><table>${C.ratioTerm.map(r => `<tr><td>${r.from}–${r.to}%</td><td class="n">${r.months}</td></tr>`).join('')}</table></fieldset>
    </div></div>`;
  }

  function themeView() {
    const keys = [['header', 'tHeader'], ['header-text', 'tHeaderText'], ['bg', 'tBg'], ['card', 'tCard'], ['text', 'tText'], ['label', 'tLabel'], ['accent', 'tAccent'], ['chip', 'tChip']];
    return `<div class="grid"><div class="card"><div class="panel"><h2>${t('themeTitle')}</h2><div class="sub">${t('themeSub')}</div>
      <div class="sec-title">${t('presets')}</div><div class="actions" style="justify-content:flex-start">
        ${Object.keys(THEMES).map(k => `<button class="btn small" style="background:${THEMES[k].header}" data-preset="${k}">${t('th_' + k)}</button>`).join('')}</div>
      <div class="sec-title">${t('tokens')}</div>
      ${keys.map(([k, lab]) => `<div class="tok"><span>${t(lab)}</span><input type="color" data-tok="${k}" value="${theme[k]}"></div>`).join('')}
      <div class="tok"><span>${t('radius')} (${theme.radius}px)</span><input type="range" min="0" max="24" data-tok="radius" value="${theme.radius}"></div>
      <div class="tok"><span>${t('fontSize')} (${theme.font}px)</span><input type="range" min="13" max="20" data-tok="font" value="${theme.font}"></div>
      <div class="sec-title">${t('json')}</div><textarea readonly>${JSON.stringify(theme, null, 2)}</textarea></div></div>
      <div>${V.borrower()}</div></div>`;
  }

  function thaiView() {
    const rows = [['th1', 'ok'], ['th2', 'sim'], ['th3', 'ok'], ['th4', 'ok'], ['th5', 'ok'], ['th6', 'open'], ['th7', 'open'], ['th8', 'open'], ['th9', 'legal'], ['th10', 'sim']].filter(r => !window.__film || (r[1] === 'ok' && r[0] !== 'th4'));
    const col = { ok: '--s6', sim: '--s4', open: '--s8', legal: '--s2' };
    return `<div class="card"><div class="panel"><h2>${t('thaiHead')}</h2><div class="sub">${t('thaiSub')}</div>
      <table>${rows.map(([k, s]) => `<tr><td>${t(k)}</td><td><span class="chip2" style="--c:var(${col[s]})">${t('th_' + s)}</span></td></tr>`).join('')}</table></div></div>`;
  }
  function localView() {
    const rows = [['lo1', 'ok'], ['lo2', 'ok'], ['lo3', 'ok'], ['lo4', 'ok'], ['lo5', 'ok'], ['lo6', 'ok'], ['lo7', 'open'], ['lo8', 'open'], ['lo9', 'open']].filter(r => !window.__film || r[1] === 'ok');
    const col = { ok: '--s6', open: '--s8' };
    return `<div class="card"><div class="panel"><h2>${t('loHead')}</h2><div class="sub">${t('loSub')}</div>
      <table>${rows.map(([k, s]) => `<tr><td>${t(k)}</td><td><span class="chip2" style="--c:var(${col[s]})">${t(s === 'ok' ? 'lo_ok' : 'lo_open')}</span></td></tr>`).join('')}</table></div></div>`;
  }
  function storyView() {
    return `<div class="card"><div class="panel"><h2>${t('navStory')}</h2><div class="sub">${t('storyHelp')}</div>
      <div class="fields"><label class="f">${t('cardSecs')}<input data-k="story.cardSecs" data-num="1" type="text" inputmode="decimal" value="${St.st.cardSecs}"></label><label class="f">${t('pace')}<input data-k="story.pace" data-num="1" type="text" inputmode="decimal" value="${St.st.pace}"></label></div>
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-story="all">${t('playAll')}</button></div>
      <table>${Array.from({ length: St.count }, (_, i) => `<tr><td>${t('chapter')} ${i + 1}</td><td><b>${t('ch' + (i + 1) + 't')}</b><br><small style="color:var(--muted)">${t('ch' + (i + 1) + 's')}</small></td><td><button class="btn small" data-story="${i}">${t('playOne')}</button></td></tr>`).join('')}</table></div></div>`;
  }

  function render() {
    V.bind(S, t, fmt, fd); F.bind(S, t, fmt, fd); D.bind(S, t, fmt, fd); V2.bind(S, t, fmt, fd); CV.bind(S, t, fmt, fd); SK.bind(S, t, fmt, fd); BK.bind(S, t, fmt, fd); OP.bind(S, t, fmt, fd); PR.bind(S, t, fmt, fd); FF.bind(S, t, fmt, fd); DE.bind(S, t, fmt, fd); { const pl = window.Price.latest(S.issue.date), pn = window.Price.latest(Net.today); if (pl) S.price = { buy: pl.buy, sell: pl.sell, tax: pl.tax }; if (pn) Net.price = pn.buy; } Net.set = S.set; if (!window.Price.latest()) Net.price = +S.price.buy; Net.nplDays = +S.set.nplDays || 90;
    document.documentElement.lang = S.lang;
    document.querySelectorAll('[data-t]').forEach(e => e.textContent = t(e.dataset.t));
    document.getElementById('langBtn').textContent = S.lang === 'th' ? 'EN' : 'ไทย';
    document.getElementById('profileChip').textContent = t(S.profile === 'c1' ? 'case1s' : 'case2s') + ' · ' + S.set.taxType;
    document.body.classList.toggle('solo', Net.solo === 'phone'); document.body.classList.toggle('film', !!window.__film);
    document.getElementById('rail').innerHTML = NAV.map(([k, ic, lab]) =>
      `<button class="${S.tab === k ? 'on' : ''}" data-tab="${k}"><span class="pill">${icon(ic)}</span>${t(lab)}</button>`).join('');
    const v = document.getElementById('view');
    v.innerHTML = { counter, journey: () => F.view(), dash: () => D.view(), books: () => V2.books(), ad: () => V2.ad(), settings, theme: themeView, thai: thaiView, local: localView, contacts: () => CV.view(), locator: () => SK.view(), slipuse: () => SK.slipView(), backup: () => BK.view(), opening: () => OP.view(), price: () => PR.view(), forfeit: () => FF.view(), dayend: () => DE.view(), story: storyView }[S.tab]();
    const ov = document.getElementById('overlay');
    const c = St.st.card, cp = St.st.caption;
    ov.innerHTML = (c ? `<div class="chcard house">${c.n || c.kick ? `<div class="chn">${c.n ? t('chapter') + ' ' + c.n : t(c.kick)}</div>` : ''}<h1>${c.t ? t(c.t) : ''}${c.l1 ? `<span class="w">${t(c.l1)}</span>` : ''}${c.l2 ? `<span class="b">${t(c.l2)}</span>` : ''}</h1>${c.s ? `<p>${t(c.s)}</p>` : ''}</div>` : '')
      + (cp ? `<div class="caption">${t(cp)}</div>` : '') + (St.st.playing ? `<button class="btn small stopbtn" data-story="stop">${t('stop')}</button>` : '');
    ov.className = c ? 'full' : '';
  }

  // ---- binding ----
  function setPath(path, val) {
    if (path === 'profile') return applyProfile(val);
    if (path.startsWith('story.')) { St.st[path.slice(6)] = +val; return; }
    if (path.startsWith('gt.')) { C.goldTypes[+path.slice(3)].pct = +val; return; }
    const ks = path.split('.'); let o = S; ks.slice(0, -1).forEach(k => o = o[k]);
    const last = ks[ks.length - 1], old = o[last];
    o[last] = typeof old === 'number' && val !== '' ? +val : val;
  }
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.de) { DE.input(el); if (el.dataset.de === 'date') { render(); return; } const k = el.dataset.de, pos = el.selectionStart; render(); const again = document.querySelector('[data-de="' + k + '"]'); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (x) {} } return; }
    if (el.dataset.ffIn) { FF.input(el); if (el.tagName === 'SELECT') { render(); return; } const k = el.dataset.ffIn, pos = el.selectionStart; render(); const again = document.querySelector('[data-ff-in="' + k + '"]'); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (x) {} } return; }
    if (el.dataset.pr) { PR.input(el); return; }
    if (el.dataset.opPaste) { OP.input(el); return; }
    if (el.dataset.bkIn) { const r = BK.input(el); if (r === 'change') render(); return; }
    if (el.dataset.stkIn || el.dataset.stkCnt || el.dataset.slipIn) {
      const r = SK.input(el);
      if (r === 'type' && (el.dataset.stkIn === 'filter' || el.dataset.slipIn === 'over' || el.dataset.stkCnt)) {
        const sel = el.dataset.stkCnt ? '[data-stk-cnt="' + el.dataset.stkCnt + '"]' : el.dataset.stkIn ? '[data-stk-in="filter"]' : '[data-slip-in="over"]', pos = el.selectionStart; render(); const again = document.querySelector(sel); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (x) {} }
      }
      return;
    }
    if (el.dataset.ctFilter || el.dataset.ctBc) { if (CV.input(el)) { const k = el.dataset.ctFilter ? 'data-ct-filter' : 'data-ct-bc', pos = el.selectionStart; render(); const again = document.querySelector('[' + k + ']'); if (again && el.dataset.ctFilter) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (x) {} } } return; }
    if (el.dataset.bool) return;
    if (el.dataset.k) {
      if (el.dataset.num) { const c = el.value.replace(/[^0-9.]/g, ''); if (c !== el.value) el.value = c; }
      const k = el.dataset.k, pos = el.selectionStart;
      setPath(k, el.value); render();
      const again = document.querySelector(`[data-k="${k}"]`);
      if (again && el.tagName === 'INPUT') { again.focus(); try { again.setSelectionRange(pos, pos); } catch (x) {} }
    } else if (el.dataset.tok) {
      const k = el.dataset.tok; theme[k] = (k === 'radius' || k === 'font') ? +el.value : el.value; applyTheme();
      const ta = document.querySelector('textarea'); if (ta) ta.value = JSON.stringify(theme, null, 2);
    }
  });
  document.addEventListener('change', async e => {
    const el = e.target;
    if (el.dataset.ffIn) { FF.input(el); return; }       // state only: a re-render on blur would swallow the click on the button the user is pressing
    if (el.dataset.opFile) { await OP.file(el); return render(); }
    if (el.dataset.bkFile) { await BK.file(el); return render(); }
    if (el.dataset.bkIn) { BK.input(el); if (el.type === 'checkbox') render(); return; }
    if (el.dataset.stkIn || el.dataset.stkCnt || el.dataset.slipIn) { SK.input(el); if (el.tagName === 'SELECT') render(); return; }      // text boxes: state only (a re-render on blur would swallow the click on the button being pressed)
    if (el.dataset.ctFile) { await CV.file(el); await CV.refreshVerify(); return render(); }
    if (el.dataset.ctBc) { if (CV.input(el)) render(); return; }
    if (el.dataset.tick != null) { S.tick[+el.dataset.tick] = el.checked; render(); }
    else if (el.dataset.k && el.dataset.bool) { setPath(el.dataset.k, el.checked); render(); }
    else if (el.dataset.k && el.tagName === 'SELECT') { setPath(el.dataset.k, el.value); render(); }
    else if (el.dataset.tok) render();
  });
  document.addEventListener('click', async e => {
    if (S.tab === 'locator' && e.target.closest('[data-stk],[data-stk-wh],[data-stk-cell],[data-stk-pick]')) { if (await SK.click(e.target)) return render(); return; }
    if (S.tab === 'dayend' && e.target.closest('[data-de-act]')) { if (await DE.click(e.target)) return render(); return; }
    if (S.tab === 'forfeit' && e.target.closest('[data-ff]')) { if (await FF.click(e.target)) return render(); return; }
    if (S.tab === 'price' && e.target.closest('[data-pr-act]')) { if (await PR.click(e.target)) return render(); return; }
    if (S.tab === 'opening' && e.target.closest('[data-op]')) { if (await OP.click(e.target)) return render(); return; }
    if (S.tab === 'backup' && e.target.closest('[data-bk]')) { if (await BK.click(e.target)) return render(); return; }
    const jb = e.target.closest('[data-j]');
    if (jb) { await F.act(jb.dataset.j); if (jb.dataset.j === 'issue') S.tab = 'journey'; return render(); }
    const sb = e.target.closest('[data-story]');
    if (sb) { const v = sb.dataset.story; if (v === 'stop') St.stop(); else if (v === 'all') St.play(0, St.count - 1); else St.play(+v, +v); return; }
    if (S.tab === 'dash' && D.click(e.target)) return render();
    if (S.tab === 'contacts' && e.target.closest('[data-ct],[data-ct-consent]') && !e.target.closest('label.src')) { if (CV.click(e.target)) return render(); return; }
    const b = e.target.closest('[data-tab],[data-action],[data-preset],[data-act],#langBtn');
    if (!b) return;
    if (b.id === 'langBtn') { S.lang = S.lang === 'th' ? 'en' : 'th'; store.set('gp.lang', S.lang); }
    else if (b.dataset.tab) S.tab = b.dataset.tab;
    else if (b.dataset.action) S.action = b.dataset.action;
    else if (b.dataset.preset) { theme = { ...THEMES[b.dataset.preset] }; applyTheme(); }
    else if (b.dataset.act === 'ticket') S.showTicket = !S.showTicket;
    else if (b.dataset.act === 'rcpt') S.showRcpt = !S.showRcpt;
    else if (b.dataset.act === 'print') { document.body.classList.add('print-rcpt'); window.print(); setTimeout(() => document.body.classList.remove('print-rcpt'), 500); }
    render();
  });

  Net.on(() => { render(); BK.kick(); }); window.addEventListener('gp-render', () => render());
  St.init({ S, render, setTab: k => { S.tab = k; }, preset: k => { theme = { ...THEMES[k] }; applyTheme(); } });
  window.__app = { S, render, Net, St, D, setTab: k => { S.tab = k; render(); } };
  (async () => {
    applyTheme(); render();
    await Net.init(); Net.sample = await window.Sample.build(48); await SK.seed(); await window.Price.seed();
    const h = location.hash;
    if (h.startsWith('#/t/')) { Net.solo = 'phone'; S.tab = 'journey'; await Net.receiveRaw(h.slice(4), 'phone', 'link'); }
    window.__ready = true; render();
  })();
})();
