window.DayEndView = (function () {
  const D = window.DayEnd, Net = window.Net;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const icon = n => `<span class="material-symbols-rounded">${n}</span>`;
  const V = { date: '', counted: '', note: '', msg: '', opening: '' };
  function view() {
    if (!V.date) V.date = Net.today; const x = D.expected(V.date, V.opening), hasC = V.counted !== '', vr = hasC ? D.variance(+V.counted, x.expected) : null;
    const vaultVar = window.Stock.state.counted ? Object.keys(window.Stock.byLoc('VAULT')).reduce((a, v) => a + ((window.Stock.state.counted[v] != null && window.Stock.state.counted[v] !== '' ? +window.Stock.state.counted[v] : window.Stock.byLoc('VAULT')[v].length) - window.Stock.byLoc('VAULT')[v].length), 0) : 0;
    const H = D.history().slice(0, 8);
    return `<div class="card"><div class="panel"><h2>${t('navDayEnd')}</h2><div class="sub">${t('deSub')}</div>
      <div class="fields"><label class="f">${t('date')}<input data-de="date" type="date" value="${V.date}"></label><label class="f">${t('deOpening')}<input data-de="opening" type="text" inputmode="decimal" value="${V.opening}" placeholder="${D.openingFor(V.date)}"></label></div>
      <div class="chips"><div class="kchip" style="--c:--s6">${icon('south_west')}<b>${fmt(x.in)}</b><span>${t('deIn')}</span></div><div class="kchip" style="--c:--s8">${icon('north_east')}<b>${fmt(x.out)}</b><span>${t('deOut')}</span></div>
        <div class="kchip" style="--c:--s1">${icon('account_balance_wallet')}<b>${fmt(x.expected)}</b><span>${t('deExpected')} (${fmt(x.opening)} + ${fmt(x.net)})</span></div></div>
      <div class="note">${t('deTransfers')}: ${x.transfers}</div>
      ${x.legs.length ? `<div class="tablewrap"><table><tr><th>${t('deTime')}</th><th>${t('ticketNo')}</th><th>${t('event')}</th><th class="n">${t('amount')}</th></tr>${x.legs.map(l => `<tr><td>${new Date(l.ts).toISOString().slice(11, 16)}</td><td>${l.tk}</td><td>${t('de_' + l.kind)}</td><td class="n" style="color:var(${l.amt < 0 ? '--s8' : '--s6'})">${fmt(l.amt)}</td></tr>`).join('')}</table></div>` : `<div class="note">${t('deNoLegs')}</div>`}
      <div class="sec-title">${t('deCount')}</div>
      <div class="fields"><label class="f">${t('deCounted')}<input data-de="counted" type="text" inputmode="decimal" value="${V.counted}" placeholder="${x.expected}"></label><label class="f">${t('deNote')}<input data-de="note" type="text" value="${V.note}"></label></div>
      ${hasC ? `<div class="chips"><div class="kchip" style="--c:${vr ? '--s8' : '--s6'}">${icon(vr ? 'error' : 'check_circle')}<b>${vr > 0 ? '+' : ''}${fmt(vr)}</b><span>${t('stkVariance')} (${t('deCashVar')})</span></div>
        <div class="kchip" style="--c:${vaultVar ? '--s8' : '--s6'}">${icon('inventory_2')}<b>${vaultVar}</b><span>${t('stkVariance')} (${t('stkInVault')})</span></div></div>` : ''}
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-de-act="save" ${hasC ? '' : 'disabled'}>${t('deSave')}</button></div>${V.msg ? `<div class="note">${V.msg}</div>` : ''}
      <div class="sec-title">${t('deHistory')}</div>
      ${H.length ? `<div class="tablewrap"><table><tr><th>${t('date')}</th><th class="n">${t('deExpected')}</th><th class="n">${t('deCounted')}</th><th class="n">${t('stkVariance')}</th><th>${t('stkInVault')}</th><th>${t('deNote')}</th></tr>${H.map(h => `<tr><td>${fd(h.date)}</td><td class="n">${fmt(h.expectedCash)}</td><td class="n">${fmt(h.countedCash)}</td><td class="n" style="color:var(${h.variance ? '--s8' : '--s6'})">${fmt(h.variance)}</td><td>${h.vaultVariance}</td><td>${h.note}</td></tr>`).join('')}</table></div>` : `<div class="note">${t('none')}</div>`}
      <div class="note">${t('deLimits')}</div></div></div>`;
  }
  async function click(el) {
    if (!el.closest('[data-de-act]')) return false; const vv = window.Stock.state.counted ? Object.keys(window.Stock.byLoc('VAULT')).reduce((a, v) => a + ((window.Stock.state.counted[v] != null && window.Stock.state.counted[v] !== '' ? +window.Stock.state.counted[v] : window.Stock.byLoc('VAULT')[v].length) - window.Stock.byLoc('VAULT')[v].length), 0) : 0;
    const r = await D.save(V.date, V.counted, V.note, vv, V.opening); V.msg = r.ok ? '✔ ' + t('stkSaved') + ' (' + fmt(r.variance) + ')' : '⚠ ' + t('deBad'); if (r.ok) { V.counted = ''; V.note = ''; } return true;
  }
  const input = el => { V[el.dataset.de] = el.value; };
  return { bind, view, click, input, state: V };
})();
