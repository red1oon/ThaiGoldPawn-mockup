// Redemption receipt / tax invoice (spec §20.1, xlsx AO173-BB208). Pure build + HTML; the numbers are the sheet's own formulas.
(function (root) {
  const C = root.Calc, r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  // lines: [{no, tk, item, weightG, qty, redeem, pawn}]; pay: {lastInterest, cash, transfer}; opt: {vat}
  function build(lines, pay, opt) {
    const vatPct = (opt && opt.vat != null ? opt.vat : 7) / 100;
    const L = lines.map((l, i) => { const base = l.base != null ? r2(l.base) : r2(l.redeem - l.pawn), vat = l.vat != null ? r2(l.vat) : r2(base * vatPct); return { ...l, no: l.no || i + 1, base, vat, inclVat: l.inclVat != null ? r2(l.inclVat) : r2(l.redeem + vat) }; });   // explicit base/vat/inclVat (the screen's own figures) win over the sheet formulas
    const sum = k => r2(L.reduce((a, l) => a + (+l[k] || 0), 0));
    const tot = { weightG: sum('weightG'), qty: sum('qty'), inclVat: sum('inclVat'), redeem: sum('redeem'), pawn: sum('pawn'), base: sum('base'), vat: sum('vat') };
    const p = pay || {}, lastInterest = +p.lastInterest || 0, net = r2(tot.pawn + lastInterest), tender = r2((+p.cash || 0) + (+p.transfer || 0));
    return { lines: L, totals: tot, lastInterest, net, discountLine: r2(tot.redeem - tot.inclVat), cash: +p.cash || 0, transfer: +p.transfer || 0,
      tenderOk: Math.abs(tender - net) < 0.005, tenderDiff: r2(tender - net) };
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  // ctx: {t, fmt, fd, shop:{name,addr,taxId}, cust:{name,addr,taxId}, no, date}
  function html(r, ctx) {
    const t = ctx.t, fmt = ctx.fmt, s = ctx.shop || {}, c = ctx.cust || {};
    return `<div class="rcpt"><div class="rc-hd"><b>${esc(s.name)}</b><br><small>${esc(s.addr)} · ${t('rcTaxId')} ${esc(s.taxId)}</small></div>
      <h3>${t('rcTitle')}</h3>
      <div class="rc-meta"><span>${t('rcNo')}: ${esc(ctx.no)}</span><span>${t('date')}: ${ctx.fd(ctx.date)}</span></div>
      <div class="rc-meta"><span>${t('rcName')}: ${esc(c.name)}</span><span>${t('rcTaxId')}: ${esc(c.taxId)}</span></div>
      <div class="rc-meta"><span>${t('address')}: ${esc(c.addr)}</span></div>
      <table><tr><th>${t('rcSeq')}</th><th>${t('ticketNo')}</th><th>${t('rcItem')}</th><th class="n">${t('rcWeight')}</th><th class="n">${t('qty')}</th><th class="n">${t('rcInclVat')}</th><th class="n">${t('rcRedeem')}</th><th class="n">${t('rcPawn')}</th><th class="n">${t('rcBase')}</th><th class="n">${t('rcVat')}</th></tr>
      ${r.lines.map(l => `<tr><td>${l.no}</td><td>${esc(l.tk)}</td><td>${esc(l.item)}</td><td class="n">${l.weightG}</td><td class="n">${l.qty}</td><td class="n">${fmt(l.inclVat)}</td><td class="n">${fmt(l.redeem)}</td><td class="n">${fmt(l.pawn)}</td><td class="n">${fmt(l.base)}</td><td class="n">${fmt(l.vat)}</td></tr>`).join('')}
      <tr class="rc-tot"><td colspan="3">${t('total')}</td><td class="n">${r.totals.weightG}</td><td class="n">${r.totals.qty}</td><td class="n">${fmt(r.totals.inclVat)}</td><td class="n">${fmt(r.totals.redeem)}</td><td class="n">${fmt(r.totals.pawn)}</td><td class="n">${fmt(r.totals.base)}</td><td class="n">${fmt(r.totals.vat)}</td></tr></table>
      <div class="rc-note">${t('rcComplete')}</div>
      <table class="rc-pay"><tr><td>${t('rcLastInt')}</td><td class="n">${fmt(r.lastInterest)}</td><td>${t('rcDiscount')}</td><td class="n">${fmt(r.discountLine)}</td></tr>
        <tr><td>${t('rcNet')} (${fmt(r.totals.pawn)} + ${fmt(r.lastInterest)})</td><td class="n"><b>${fmt(r.net)}</b></td><td>${t('cash')}</td><td class="n">${fmt(r.cash)}</td></tr>
        <tr><td></td><td></td><td>${t('transfer')}</td><td class="n">${fmt(r.transfer)}</td></tr></table>
      ${r.tenderOk ? '' : `<div class="err">⚠ ${t('rcTenderBad')} (${fmt(r.tenderDiff)})</div>`}
      <div class="rc-sign"><span>${t('rcRedeemer')}<br>${esc(c.name)}</span><span>${t('rcReceiver')}<br>${esc(s.name)}</span></div></div>`;
  }
  // a payment_verified 'full' event -> receipt (history print)
  function fromEvent(st, e) {
    const b = e.body, base = b.int + 0, vat = b.vat || 0;
    return build([{ tk: st.no, item: st.cat || '', weightG: st.weight || 0, qty: st.qty || 1, redeem: b.principalPart + b.int, pawn: b.principalPart, base, vat, inclVat: b.principalPart + b.int + vat }], { lastInterest: b.int + vat, cash: b.amt, transfer: 0 });
  }
  root.Receipt = { build, html, fromEvent };
})(typeof window !== 'undefined' ? window : globalThis);
