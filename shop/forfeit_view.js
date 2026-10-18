// Forfeit and sale tab (spec §20.4).
window.ForfeitView = (function () {
  const F = window.Forfeit, Net = window.Net, P = window.Pay, Books = window.Books;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const icon = n => `<span class="material-symbols-rounded">${n}</span>`;
  const V = { sel: '', appr: '', salePrice: '', buyer: '', tender: 'cash', msg: '', saleSel: '' };
  const sts = () => Object.values(Net.all()).map(l => P.fold(l, Net.today));
  function view() {
    const all = sts(), elig = all.filter(s => F.canForfeit(s).ok).sort((a, b) => (a.due < b.due ? -1 : 1)), forf = all.filter(s => s.status === 'forfeited'), sold = all.filter(s => s.status === 'sold'), bal = F.balances();
    const pick = V.sel && elig.find(s => s.no === V.sel), sp = V.saleSel && forf.find(s => s.no === V.saleSel);
    const dflt = pick ? F.appraise(pick) : 0, appr = V.appr !== '' ? +V.appr : dflt;
    return `<div class="card"><div class="panel"><h2>${t('navForfeit')}</h2><div class="sub">${t('ffSub')}</div>
      <div class="chips"><div class="kchip" style="--c:--s8">${icon('schedule')}<b>${elig.length}</b><span>${t('ffEligible')}</span></div><div class="kchip" style="--c:--s2">${icon('sell')}<b>${forf.length}</b><span>${t('ffForfeited')}</span></div>
        <div class="kchip" style="--c:--s7">${icon('paid')}<b>${sold.length}</b><span>${t('ffSold')}</span></div><div class="kchip" style="--c:--s1">${icon('inventory')}<b>${fmt(bal.P)}</b><span>${t('ffStockP')}</span></div></div>
      ${V.msg ? `<div class="note">${V.msg}</div>` : ''}
      <div class="sec-title">${t('ffEligibleHead')}</div>
      ${elig.length ? `<div class="tablewrap"><table><tr><th>${t('ticketNo')}</th><th>${t('name')}</th><th>${t('due')}</th><th class="n">${t('ffPrincipal')}</th><th class="n">${t('ffAppraised')}</th><th></th></tr>${elig.map(s => `<tr><td>${s.no}</td><td>${dn(s.name)}</td><td>${fd(s.due)}</td><td class="n">${fmt(s.principal)}</td><td class="n">${fmt(F.appraise(s))}</td><td><button class="btn small ${V.sel === s.no ? '' : 'ghost'}" data-ff="pick|${s.no}">${t('ffSelect')}</button></td></tr>`).join('')}</table></div>` : `<div class="note">${t('none')}</div>`}
      ${pick ? `<div class="fields"><label class="f">${t('ffAppraised')} (${t('baht')})<input data-ff-in="appr" type="text" inputmode="decimal" value="${V.appr !== '' ? V.appr : dflt}"></label></div>
        <table><tr><td>${t('ffPrincipal')}</td><td class="n">${fmt(pick.principal)}</td></tr><tr><td>${t('ffGainLoss')}</td><td class="n" style="color:var(${appr - pick.principal < 0 ? '--s8' : '--s6'})">${fmt(appr - pick.principal)}</td></tr><tr><td>${t('ffInterestOff')}</td><td class="n">${fmt(P.interestTo(pick, Net.today))}</td></tr></table>
        <div class="note">${t('ffForfeitNote')}</div><div class="actions" style="justify-content:flex-start"><button class="btn" data-ff="forfeit|${pick.no}">${t('ffDo')}</button></div>` : ''}
      <div class="sec-title">${t('ffStockHead')}</div>
      ${forf.length ? `<div class="tablewrap"><table><tr><th>${t('ticketNo')}</th><th>${t('name')}</th><th class="n">${t('ffAppraised')}</th><th>${t('stkLocator')}</th><th></th></tr>${forf.map(s => { const loc = window.Stock.fold()[s.no]; return `<tr><td>${s.no}</td><td>${dn(s.name)}</td><td class="n">${fmt(s.appraised || 0)}</td><td>${loc && loc.loc || '–'}</td><td><button class="btn small ${V.saleSel === s.no ? '' : 'ghost'}" data-ff="salepick|${s.no}">${t('ffSell')}</button></td></tr>`; }).join('')}</table></div>` : `<div class="note">${t('none')}</div>`}
      ${sp ? `<div class="fields"><label class="f">${t('ffSalePrice')} (${t('baht')})<input data-ff-in="salePrice" type="text" inputmode="decimal" value="${V.salePrice}" placeholder="${sp.appraised}"></label><label class="f">${t('ffBuyer')}<input data-ff-in="buyer" type="text" value="${V.buyer}"></label>
        <label class="f">${t('lim_tender')}<select data-ff-in="tender"><option value="cash" ${V.tender === 'cash' ? 'selected' : ''}>${t('tender_cash')}</option><option value="transfer" ${V.tender === 'transfer' ? 'selected' : ''}>${t('tender_transfer')}</option></select></label></div>
        <table><tr><td>${t('ffGainLoss')}</td><td class="n">${fmt((+V.salePrice || sp.appraised) - sp.appraised)}</td></tr></table><div class="note">${t('ffSaleNote')}</div>
        <div class="actions" style="justify-content:flex-start"><button class="btn" data-ff="sale|${sp.no}">${t('ffSaleDo')}</button></div>` : ''}
      ${sold.length ? `<div class="sec-title">${t('ffSoldHead')}</div><div class="tablewrap"><table>${sold.map(s => `<tr><td>${s.no}</td><td>${dn(s.name)}</td><td class="n">${fmt(s.sold.price)}</td><td class="n">${fmt(s.sold.price - (s.appraised || 0))}</td></tr>`).join('')}</table></div>` : ''}
      <div class="note">${t('ffBalances')}: N ${fmt(bal.N)} · O ${fmt(bal.O)} · P ${fmt(bal.P)}</div></div></div>`;
  }
  async function click(el) {
    const n = el.closest('[data-ff]'); if (!n) return false; const [a, tk] = n.dataset.ff.split('|');
    if (a === 'pick') { V.sel = V.sel === tk ? '' : tk; V.appr = ''; V.msg = ''; return true; }
    if (a === 'salepick') { V.saleSel = V.saleSel === tk ? '' : tk; V.salePrice = ''; V.msg = ''; return true; }
    if (a === 'forfeit') { const r = await F.forfeit(tk, V.appr); V.msg = r.ok ? '✔ ' + t('ffDone') + ' ' + tk + ' → ' + fmt(r.appraised) : '⚠ ' + t('ffwhy_' + r.why); V.sel = ''; V.appr = ''; return true; }
    if (a === 'sale') { const r = await F.sale(tk, { price: V.salePrice || (F.fold(tk) || {}).appraised, buyer: V.buyer, tender: V.tender }); V.msg = r.ok ? '✔ ' + t('ffSaleDone') + ' ' + tk + ' · ' + t('ffGainLoss') + ' ' + fmt(r.gainLoss) : '⚠ ' + t('ffwhy_' + r.why); V.saleSel = ''; V.salePrice = ''; V.buyer = ''; return true; }
    return false;
  }
  const input = el => { V[el.dataset.ffIn] = el.value; };
  return { bind, view, click, input, state: V };
})();
