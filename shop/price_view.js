// Gold price tab (spec §20.3): record a dated board price, see the history and the exposure.
window.PriceView = (function () {
  const Pr = window.Price, Net = window.Net, P = window.Pay;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const icon = n => `<span class="material-symbols-rounded">${n}</span>`;
  const F = { date: '', time: '09:00', buy: '', sell: '', tax: '', msg: '' };
  const sts = () => Object.values(Net.all()).map(l => P.fold(l, Net.today));
  function view() {
    const L = Pr.list().slice(-15).reverse(), cur = Pr.latest(Net.today), pv = Pr.prev(), ex = Pr.exposure(sts(), cur ? cur.buy : 0), st = Pr.stale(Net.today, cur);
    const d = cur && pv ? cur.buy - pv.buy : 0;
    if (!F.date) F.date = Net.today;
    return `<div class="card"><div class="panel"><h2>${t('navPrice')}</h2><div class="sub">${t('prSub')}</div>
      ${st ? `<div class="note slipwarn warn">${icon('warning')} ${t('prStale')}</div>` : ''}
      <div class="chips"><div class="kchip" style="--c:--s1">${icon('sell')}<b>${cur ? fmt(cur.buy) : '–'}</b><span>${t('prBuy')} · ${cur ? fd(cur.date) : ''}</span></div>
        <div class="kchip" style="--c:${d < 0 ? '--s8' : '--s6'}">${icon(d < 0 ? 'trending_down' : 'trending_up')}<b>${d > 0 ? '+' : ''}${fmt(d)}</b><span>${t('prChange')}</span></div></div>
      <div class="sec-title">${t('prRecord')}</div>
      <div class="fields"><label class="f">${t('date')}<input data-pr="date" type="date" value="${F.date}"></label><label class="f">${t('prTime')}<input data-pr="time" type="time" value="${F.time}"></label>
        <label class="f">${t('prBuy')}<input data-pr="buy" type="text" inputmode="decimal" value="${F.buy}" placeholder="${cur ? cur.buy : ''}"></label><label class="f">${t('prSell')}<input data-pr="sell" type="text" inputmode="decimal" value="${F.sell}" placeholder="${cur ? cur.sell : ''}"></label>
        <label class="f">${t('prTax')}<input data-pr="tax" type="text" inputmode="decimal" value="${F.tax}" placeholder="${cur ? cur.tax : ''}"></label></div>
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-pr-act="record">${t('prSave')}</button></div>${F.msg ? `<div class="note">${F.msg}</div>` : ''}
      <div class="sec-title">${t('prExposure')}</div>
      <div class="tablewrap"><table><tr><td>${t('prOpenN')}</td><td class="n">${ex.n}</td></tr><tr><td>${t('prValue')}</td><td class="n">${fmt(ex.value)}</td></tr><tr><td>${t('prPrincipal')}</td><td class="n">${fmt(ex.principal)}</td></tr>
        <tr><td><b>${t('prCushion')}</b></td><td class="n" style="color:var(${ex.cushion < 0 ? '--s8' : '--s6'})"><b>${fmt(ex.cushion)}</b></td></tr><tr><td>${t('prUnder')}</td><td class="n" style="color:var(${ex.under ? '--s8' : '--s6'})">${ex.under}</td></tr></table></div><div class="note">${t('prExpNote')}</div>
      <div class="sec-title">${t('prHistory')}</div>
      <div class="tablewrap"><table><tr><th>${t('date')}</th><th>${t('prTime')}</th><th class="n">${t('prBuy')}</th><th class="n">${t('prSell')}</th><th class="n">${t('prTax')}</th></tr>${L.map(p => `<tr><td>${fd(p.date)}</td><td>${p.time}</td><td class="n">${fmt(p.buy)}</td><td class="n">${fmt(p.sell)}</td><td class="n">${fmt(p.tax)}</td></tr>`).join('')}</table></div>
      <div class="note">${t('prLimits')}</div></div></div>`;
  }
  async function click(el) {
    const n = el.closest('[data-pr-act]'); if (!n) return false;
    const r = await Pr.record({ date: F.date, time: F.time, buy: F.buy || (Pr.latest() || {}).buy, sell: F.sell || (F.buy ? +F.buy + 200 : (Pr.latest() || {}).sell), tax: F.tax || (F.buy ? +F.buy - 100 : (Pr.latest() || {}).tax) });
    F.msg = r.ok ? '✔ ' + t('prSaved') : '⚠ ' + t('prInvalid'); if (r.ok) { F.buy = F.sell = F.tax = ''; } return true;
  }
  function input(el) { F[el.dataset.pr] = el.value; }
  return { bind, view, click, input, state: F };
})();
