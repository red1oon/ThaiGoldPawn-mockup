// State, i18n, adaptive shell, settings, theme editor, binding.
(function () {
  const C = window.Calc, V = window.Views, I = window.I18N;
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  const S = {
    lang: store.get('gp.lang') || 'th', tab: 'counter', action: 'a1', profile: 'c1', showTicket: false,
    set: { taxType: 'VAT', taxPoint: 'close', incl: 'exclude', mode: 'P', deduct: 2000, defMonths: 4, rounding: 'half', basis: 'month', vat: 7 },
    price: { buy: 100000, sell: 100200, tax: 99900 },   // sample board, per baht-weight (partner sketch: 100,000)
    issue: { name: 'สมชาย ตัวอย่าง', phone: '08x-xxx-xxxx', grp: 'standard', cat: 0, item: 0, qty: 1, weight: 15.16, type: 0,
             basis: 'buy', loan: 80000, date: '2025-07-14', months: 4, agreed: '', track: 'BAG-0001', safe: 'SAFE-A1' },
    ticket: { no: 'A100', first: 'A100', name: 'สมชาย ตัวอย่าง', date: '2025-07-14', loan: 80000, weight: 15.16, type: 0, grp: 'standard',
              paid: [true, false, false, false], lastPaid: '2025-08-14', paidInterest: 1000 },
    tick: [false, true, false, false],
    tx: { today: '2025-09-25', newLoan: 83000, todayPrice: 102000, discount: 0, cash: 50000 },
    overdue: [{ no: 'A087', due: '2025-06-30', weight: 7.58, loan: 38000 }, { no: 'A091', due: '2025-07-15', weight: 3.79, loan: 18500 }]
  };
  const THEMES = {
    quickgold: { header: '#009688', 'header-text': '#ffffff', bg: '#f7f7f8', card: '#ffffff', text: '#22292e', label: '#ff9800', accent: '#00796b', chip: '#e0f2f1', radius: 14, font: 16 },
    gold:      { header: '#b8860b', 'header-text': '#ffffff', bg: '#fbf8f1', card: '#ffffff', text: '#3e2f12', label: '#a0522d', accent: '#8b6508', chip: '#f6ecd2', radius: 10, font: 16 },
    night:     { header: '#1f2933', 'header-text': '#f5d76e', bg: '#111820', card: '#1b242e', text: '#e8edf2', label: '#f5b041', accent: '#26a69a', chip: '#24343f', radius: 14, font: 16 }
  };
  let theme = (() => { try { return JSON.parse(store.get('gp.theme')) || { ...THEMES.quickgold }; } catch (e) { return { ...THEMES.quickgold }; } })();

  const t = k => (I[k] ? I[k][S.lang === 'th' ? 0 : 1] : k);
  const fmt = x => Number(x || 0).toLocaleString(S.lang === 'th' ? 'th-TH' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fd = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

  function applyTheme() {
    const r = document.documentElement.style;
    Object.entries(theme).forEach(([k, v]) => {
      if (k === 'radius') r.setProperty('--radius', v + 'px');
      else if (k === 'font') r.setProperty('--font', v + 'px');
      else r.setProperty('--' + k, v);
    });
    store.set('gp.theme', JSON.stringify(theme));
  }
  function applyProfile(p) {
    S.profile = p; Object.assign(S.set, { taxPoint: C.profiles[p].taxPoint, basis: C.profiles[p].basis, rounding: C.profiles[p].rounding });
  }

  // ---- shell ----
  const NAV = [['counter', 'storefront', 'navCounter'], ['app', 'smartphone', 'navApp'], ['settings', 'tune', 'navSettings'], ['theme', 'palette', 'navTheme']];
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
      <fieldset><legend>${t('branchParams')}</legend><div class="fields">
        ${f(t('taxType'), sel('set.taxType', s.taxType, [['VAT', 'VAT'], ['SBT', 'SBT']]))}
        ${f(t('taxPoint'), sel('set.taxPoint', s.taxPoint, [['close', t('atClose')], ['interest', t('atInterest')]]))}
        ${f(t('incl'), sel('set.incl', s.incl, [['exclude', t('exclude')], ['include', t('include')]]))}
        ${f(t('interestBasis'), sel('set.basis', s.basis, [['month', t('perMonth')], ['day', t('perDay')]]))}
        ${f(t('rounding'), sel('set.rounding', s.rounding, [['month', t('rMonth')], ['half', t('rHalf')], ['week', t('rWeek')], ['day', t('rDay')]]))}
        ${f(t('deductMode'), sel('set.mode', s.mode, [['P', t('byPct')], ['A', t('byAmt')]]))}
        ${f(t('deductAmt'), inp('set.deduct', s.deduct))}
        ${f(t('defMonths'), inp('set.defMonths', s.defMonths))}
      </div>${s.rounding === 'week' ? `<div class="note">${conf('qWeek')} ${t('qWeek')}</div>` : ''}
      ${s.mode === 'A' ? `<div class="note">${conf('qA')} ${t('qA')}</div>` : ''}</fieldset>
      <fieldset><legend>${t('goldTypes')}</legend><table>${C.goldTypes.map((g, i) => `<tr><td>${L(g)}</td><td class="n">${inp('gt.' + i, g.pct)}</td></tr>`).join('')}</table></fieldset>
      <fieldset><legend>${t('rates')}</legend><table><tr><th>${t('rateGrp')}</th><th class="n">${t('from')}</th><th class="n">${t('to')}</th><th class="n">%</th></tr>
        ${C.rates.map(r => `<tr><td>${r.grp}</td><td class="n">${fmt(r.from)}</td><td class="n">${fmt(r.to)}</td><td class="n">${r.rate}</td></tr>`).join('')}</table></fieldset>
      <fieldset><legend>${t('ratioTbl')} ${conf('qRatio')}</legend><table>${C.ratioTerm.map(r => `<tr><td>${r.from}–${r.to}%</td><td class="n">${r.months}</td></tr>`).join('')}</table></fieldset>
    </div></div>`;
  }

  function themeView() {
    const keys = [['header', 'tHeader'], ['header-text', 'tHeaderText'], ['bg', 'tBg'], ['card', 'tCard'], ['text', 'tText'], ['label', 'tLabel'], ['accent', 'tAccent'], ['chip', 'tChip']];
    return `<div class="grid"><div class="card"><div class="panel"><h2>${t('themeTitle')}</h2><div class="sub">${t('themeSub')}</div>
      <div class="sec-title">${t('presets')}</div><div class="actions" style="justify-content:flex-start">
        ${Object.keys(THEMES).map(k => `<button class="btn small" style="background:${THEMES[k].header}" data-preset="${k}">${k}</button>`).join('')}</div>
      <div class="sec-title">${t('tokens')}</div>
      ${keys.map(([k, lab]) => `<div class="tok"><span>${t(lab)}</span><input type="color" data-tok="${k}" value="${theme[k]}"></div>`).join('')}
      <div class="tok"><span>${t('radius')} (${theme.radius}px)</span><input type="range" min="0" max="24" data-tok="radius" value="${theme.radius}"></div>
      <div class="tok"><span>${t('fontSize')} (${theme.font}px)</span><input type="range" min="13" max="20" data-tok="font" value="${theme.font}"></div>
      <div class="sec-title">${t('json')}</div><textarea readonly>${JSON.stringify(theme, null, 2)}</textarea></div></div>
      <div>${V.borrower()}</div></div>`;
  }

  function render() {
    V.bind(S, t, fmt, fd);
    document.documentElement.lang = S.lang;
    document.querySelectorAll('[data-t]').forEach(e => e.textContent = t(e.dataset.t));
    document.getElementById('langBtn').textContent = S.lang === 'th' ? 'EN' : 'ไทย';
    document.getElementById('profileChip').textContent = t(S.profile === 'c1' ? 'case1s' : 'case2s') + ' · ' + S.set.taxType;
    document.getElementById('rail').innerHTML = NAV.map(([k, ic, lab]) =>
      `<button class="${S.tab === k ? 'on' : ''}" data-tab="${k}"><span class="pill">${icon(ic)}</span>${t(lab)}</button>`).join('');
    const v = document.getElementById('view');
    v.innerHTML = { counter, app: () => V.borrower(), settings, theme: themeView }[S.tab]();
  }

  // ---- binding ----
  function setPath(path, val) {
    if (path === 'profile') return applyProfile(val);
    if (path.startsWith('gt.')) { C.goldTypes[+path.slice(3)].pct = +val; return; }
    const ks = path.split('.'); let o = S; ks.slice(0, -1).forEach(k => o = o[k]);
    const last = ks[ks.length - 1], old = o[last];
    o[last] = typeof old === 'number' && val !== '' ? +val : val;
  }
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.k) {
      const k = el.dataset.k, pos = el.selectionStart;
      setPath(k, el.value); render();
      const again = document.querySelector(`[data-k="${k}"]`);
      if (again && el.tagName === 'INPUT') { again.focus(); try { again.setSelectionRange(pos, pos); } catch (x) {} }
    } else if (el.dataset.tok) {
      const k = el.dataset.tok; theme[k] = (k === 'radius' || k === 'font') ? +el.value : el.value; applyTheme();
      const ta = document.querySelector('textarea'); if (ta) ta.value = JSON.stringify(theme, null, 2);
    }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.tick != null) { S.tick[+el.dataset.tick] = el.checked; render(); }
    else if (el.dataset.k && el.tagName === 'SELECT') { setPath(el.dataset.k, el.value); render(); }
    else if (el.dataset.tok) render();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tab],[data-action],[data-preset],[data-act],#langBtn');
    if (!b) return;
    if (b.id === 'langBtn') { S.lang = S.lang === 'th' ? 'en' : 'th'; store.set('gp.lang', S.lang); }
    else if (b.dataset.tab) S.tab = b.dataset.tab;
    else if (b.dataset.action) S.action = b.dataset.action;
    else if (b.dataset.preset) { theme = { ...THEMES[b.dataset.preset] }; applyTheme(); }
    else if (b.dataset.act === 'ticket') S.showTicket = !S.showTicket;
    render();
  });

  applyTheme(); render();
})();
