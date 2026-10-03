// Counter + borrower-app views. Pure HTML builders; app.js owns state, binding, render.
window.Views = (function () {
  const C = window.Calc;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };

  // ---- small builders ----
  const inp = (k, v, type = 'number', extra = '') => `<input data-k="${k}" type="${type}" value="${v}" ${type === 'number' ? 'step="any"' : ''} ${extra}>`;
  const sel = (k, v, opts) => `<select data-k="${k}">${opts.map(([val, lab]) => `<option value="${val}" ${String(val) === String(v) ? 'selected' : ''}>${lab}</option>`).join('')}</select>`;
  const f = (lab, ctl) => `<label class="f">${lab}${ctl}</label>`;
  const o = (lab, val) => `<label class="f">${lab}<span class="out">${val}</span></label>`;
  const conf = q => `<span class="confirm" title="${t(q)}">❓ ${t('toConfirm')}</span>`;
  const L = obj => S.lang === 'th' ? obj.th : obj.en;
  const vatPct = () => S.set.vat / 100;
  // taxPoint 'interest' = VAT on every interest payment (partner default); 'close' = VAT only at ticket close (xlsx At_Redeem, some shops)
  const vatEachPay = () => S.set.taxPoint === 'interest';
  const whoPays = net => net >= 0
    ? `<span class="who out">${t('cashOut')}</span>` : `<span class="who in">${t('cashIn')}</span>`;
  const price = basis => S.price[basis];
  const pctOf = i => C.goldTypes[i].pct;
  const agreedOf = tk => C.r2(tk.loan * C.rateFor(tk.grp, tk.loan) / 100);

  // ---- 1. Issue ticket (§3) ----
  function issue() {
    const x = S.issue;
    const ap = C.appraise(+x.weight, price(x.basis), pctOf(x.type), S.set.mode, +S.set.deduct);
    const ratio = ap.limit ? x.loan / ap.limit * 100 : 0;
    const rate = C.rateFor(x.grp, +x.loan);
    const perMonth = C.r2(x.loan * rate / 100);
    const perDay = C.r2(x.loan * rate / 100 * 12 / 365);
    const agreed = x.agreed === '' || x.agreed == null ? perMonth : +x.agreed;
    const due = C.edate(x.date, +x.months);
    const rt = C.termByRatio(ratio);
    const cats = S.lang === 'th' ? ['ทองรูปพรรณ', 'ทองแท่ง', 'เงิน', 'อื่นๆ'] : ['Ornament gold', 'Gold bar', 'Silver', 'Other'];
    const items = S.lang === 'th' ? ['สร้อย', 'แหวน', 'จี้', 'สร้อยข้อมือ/กำไล', 'อื่นๆ'] : ['Necklace', 'Ring', 'Pendant', 'Bracelet/bangle', 'Other'];
    return `<div class="panel"><h2>${t('a1')}</h2><div class="sub">${t('a1s')}</div>
    <fieldset><legend>${t('customer')}</legend><div class="fields">
      ${f(t('name'), inp('issue.name', x.name, 'text'))}${f(t('phone'), inp('issue.phone', x.phone, 'text'))}
      ${f(t('rateGrp'), sel('issue.grp', x.grp, ['standard', 'vip', 'supervip', 'relative'].map(g => [g, g])))}
    </div></fieldset>
    <fieldset><legend>${t('asset')}</legend><div class="fields">
      ${f(t('category'), sel('issue.cat', x.cat, cats.map((c, i) => [i, c])))}
      ${f(t('item'), sel('issue.item', x.item, items.map((c, i) => [i, c])))}
      ${f(t('qty'), inp('issue.qty', x.qty))}${f(t('weight'), inp('issue.weight', x.weight))}
      ${f(t('goldType'), sel('issue.type', x.type, C.goldTypes.map((g, i) => [i, `${L(g)} · ${g.pct}%`])))}
      ${f(t('priceBasis'), sel('issue.basis', x.basis, [['buy', t('pBuy')], ['sell', t('pSell')], ['tax', t('pTax')]]))}
      ${o(t('pricePerBaht'), fmt(price(x.basis)))}
      ${f(t('trackNo'), inp('issue.track', x.track, 'text'))}${f(t('safe'), inp('issue.safe', x.safe, 'text'))}
    </div><div class="note">📷 ${t('photos')}</div></fieldset>
    <fieldset><legend>${t('valuation')}</legend><div class="fields">
      ${o(t('marketValue'), fmt(ap.value))}
      ${o(t('ceiling') + (S.set.mode === 'A' ? conf('qA') : ''), fmt(ap.limit))}
      ${f(t('loan'), inp('issue.loan', x.loan))}
      ${o(t('headroom'), fmt(ap.limit - x.loan))}
      ${o(t('ratio'), ratio.toFixed(1) + '%')}
    </div>${x.loan > ap.limit ? `<div class="err">⚠ ${t('overLimit')}</div>` : ''}</fieldset>
    <fieldset><legend>${t('terms')}</legend><div class="fields">
      ${o(t('ticketNo'), 'A100')}${f(t('date'), inp('issue.date', x.date, 'date'))}
      ${f(t('months'), inp('issue.months', x.months))}${o(t('due'), fd(due))}
      ${o(t('rate'), rate + '%')}
      ${S.set.basis === 'day' ? o(t('intDay'), fmt(perDay)) : o(t('intMonth'), fmt(perMonth))}
      ${f(t('agreed'), inp('issue.agreed', agreed))}
      ${o(t('discount'), fmt(perMonth - agreed))}
    </div><div class="note">${t('ratioTerm')} ${rt ?? '-'} ${t('monthsU')} ${conf('qRatio')}</div></fieldset>
    <div class="total"><span>${t('cashOut')}</span><span class="big">${fmt(+x.loan)} ${t('baht')}</span></div>
    <div class="actions"><button class="btn ghost" data-act="ticket">${t('preview')}</button><button class="btn">${t('save')}</button></div>
    <div id="ticketBox">${S.showTicket ? printed(x, due, items[x.item], agreed) : ''}</div></div>`;
  }

  // Printed ticket, layout after the partner's current card (xlsx image2). Sample shop only.
  function printed(x, due, item, agreed) {
    return `<div class="ticket" style="margin-top:14px">
      <div class="hd"><div class="logo">G</div><div style="flex:1"><b>${t('ticketHead')}</b><br><small>${S.lang === 'th' ? 'ที่อยู่ร้าน · โทร · เลขประจำตัวผู้เสียภาษี' : 'Shop address · phone · tax ID'}</small></div><b>${t('keepCard')}</b></div>
      <div style="display:flex;justify-content:space-between"><span>${t('ticketNo')}: A100</span><span>${t('date')}: ${fd(x.date)}</span></div>
      <p>${t('tkLine1')} ${x.name} ${t('tkLine2')} ${item} × ${x.qty} · ${x.weight} g · ${t('months')} ${x.months} · ${t('due')} ${fd(due)}<br>
      <b>${t('loan')}: ${fmt(+x.loan)} ${t('baht')}</b></p>
      <p>${t('tkLate')}</p><p><b>${t('tkCert')}</b></p>
      <table><tr><th>${t('inst')}</th><th>${t('date')}</th><th class="n">${t('amount')}</th></tr>
      ${[1, 2, 3, 4].slice(0, +x.months || 4).map(i => `<tr><td>${i}</td><td>${fd(C.edate(x.date, i))}</td><td class="n">${fmt(agreed)}</td></tr>`).join('')}</table></div>`;
  }

  // ---- 2. Pay interest (§4) ----
  function pay() {
    const tk = S.ticket, ag = agreedOf(tk);
    const rows = [1, 2, 3, 4].map(i => ({ i, date: C.edate(tk.date, i), paid: tk.paid[i - 1], tick: S.tick[i - 1] }));
    const payNow = C.r2(rows.filter(r => !r.paid && r.tick).length * ag);
    const vat = vatEachPay() ? C.r2(payNow * vatPct()) : 0;
    return `<div class="panel"><h2>${t('a2')}</h2><div class="sub">${tk.no} · ${tk.name} · ${t('loan')} ${fmt(tk.loan)}</div>
    <fieldset><legend>${t('sched')}</legend>
    <table><tr><th></th><th>${t('inst')}</th><th>${t('date')}</th><th class="n">${t('agreed')}</th><th>${t('status')}</th></tr>
    ${rows.map(r => `<tr><td>${r.paid ? '✔' : `<input type="checkbox" data-tick="${r.i - 1}" ${r.tick ? 'checked' : ''}>`}</td><td>${r.i}</td><td>${fd(r.date)}</td><td class="n">${fmt(ag)}</td><td>${r.paid ? t('paid') : t('open')}</td></tr>`).join('')}
    </table><div class="note">${t('keyOrTick')}</div></fieldset>
    <div class="total"><span>${t('payNow')}</span><span>${fmt(payNow)}</span></div>
    <div class="total"><span>${t('vat')} ${S.set.vat}%</span><span>${fmt(vat)}</span></div>
    <div class="note">${vatEachPay() ? t('vatEvery') : finalOnly() ? t('vatFinal') : t('vatAtClose')}</div>
    <div class="total"><span>${t('cashIn')}</span><span class="big">${fmt(payNow + vat)} ${t('baht')}</span></div></div>`;
  }

  // shared: interest owed on the sample ticket up to the transaction date
  function owedNow() {
    const tk = S.ticket, ag = agreedOf(tk);
    return C.owed(tk.loan, ag, C.rateFor(tk.grp, tk.loan), tk.lastPaid, S.tx.today, S.set.rounding);
  }
  // VAT base = the interest collected in THIS transaction only (client answer 3; user correction 2026-10-03)
  // VAT base at a close: interest received now; At_Redeem shops also tax earlier installments not yet taxed
  const finalOnly = () => S.set.taxPoint === 'final';      // VAT once, at the final real redeem (user 2026-10-03, partner to confirm)
  const untaxedPaid = () => vatEachPay() ? 0 : S.ticket.paidInterest + (finalOnly() ? S.ticket.chainUntaxed : 0);
  const vatBaseAtClose = air => untaxedPaid() + air;

  // ---- 3. Top-up / reduce (§5, §5a, answers 5-7) ----
  function change() {
    const tk = S.ticket, w = S.tx, ow = owedNow();
    const ap = C.appraise(tk.weight, +w.todayPrice, pctOf(tk.type), S.set.mode, +S.set.deduct);
    const vat = finalOnly() ? 0 : C.r2(vatBaseAtClose(ow.amount) * vatPct());
    const diff = +w.newLoan - tk.loan;
    const net = C.r2(diff - ow.amount - vat);
    const kind = diff >= 0 ? t('topup') : t('reduce');
    return `<div class="panel"><h2>${t('a3')}</h2><div class="sub">${t('a3s')}</div>
    <fieldset><legend>${t('oldTicket')}</legend><div class="fields">
      ${o(t('ticketNo'), tk.no)}${o(t('loan'), fmt(tk.loan))}${o(t('lastPaid'), fd(tk.lastPaid))}
      ${f(t('today'), inp('tx.today', w.today, 'date'))}
      ${o(t('periods'), ow.unit === 'day' ? ow.days + ' ' + t('days') : ow.periods)}${o(t('air'), fmt(ow.amount))}
    </div></fieldset>
    <fieldset><legend>${t('newLoan')}</legend><div class="fields">
      ${f(t('todayPrice'), inp('tx.todayPrice', w.todayPrice))}${o(t('newCeiling'), fmt(ap.limit))}
      ${f(t('newLoan') + ` (${kind})`, inp('tx.newLoan', w.newLoan))}
    </div>${+w.newLoan > ap.limit ? `<div class="err">⚠ ${t('overLimit')}</div>` : ''}</fieldset>
    <div class="flow">
      <div class="step"><b>${t('s1')}</b>${tk.no} · −${fmt(tk.loan)}<br><small>${t('s1b')}</small></div>
      <div class="step"><b>${t('s2')}</b>A160 · ${fmt(+w.newLoan)}<br><small>${t('ref')} ${tk.no} · ${t('first')} ${tk.first}</small></div>
      <div class="step"><b>${t('s3')}</b>${fmt(Math.abs(net))}</div>
    </div>
    <table><tr><td>${kind}</td><td class="n">${fmt(diff)}</td></tr>
      <tr><td>− ${t('air')}</td><td class="n">${fmt(ow.amount)}</td></tr>
      ${finalOnly()
        ? `<tr><td>− ${t('vat')}: ${t('vatDeferred')}</td><td class="n">${fmt(0)}</td></tr><tr><td>${t('carryFwd')}</td><td class="n">${fmt(vatBaseAtClose(ow.amount))}</td></tr>`
        : `<tr><td>− ${t('vatOnInt')} (${fmt(vatBaseAtClose(ow.amount))}${untaxedPaid() ? ' = ' + fmt(ow.amount) + ' + ' + t('untaxed') + ' ' + fmt(untaxedPaid()) : ''})</td><td class="n">${fmt(vat)}</td></tr>`}</table>
    <div class="total"><span>${t('net')} ${whoPays(net)}</span><span class="big">${fmt(Math.abs(net))} ${t('baht')}</span></div></div>`;
  }

  // ---- 4. Redeem (§6) ----
  function redeem() {
    const tk = S.ticket, w = S.tx, ow = owedNow();
    const disc = +w.discount || 0;
    const base = Math.max(0, vatBaseAtClose(ow.amount) - disc);
    const incl = S.set.incl === 'include';
    const vat = C.r2(incl ? base * S.set.vat / (100 + S.set.vat) : base * vatPct());
    const total = C.r2(tk.loan + ow.amount - disc + (incl ? 0 : vat));
    return `<div class="panel"><h2>${t('a4')}</h2><div class="sub">${tk.no} · ${tk.name}</div>
    <fieldset><legend>${t('oldTicket')}</legend><div class="fields">
      ${o(t('loan'), fmt(tk.loan))}${o(t('lastPaid'), fd(tk.lastPaid))}${f(t('today'), inp('tx.today', w.today, 'date'))}
      ${o(t('intPaid'), fmt(tk.paidInterest))}${o(t('air'), fmt(ow.amount))}${f(t('discount'), inp('tx.discount', disc))}
    </div></fieldset>
    <table><tr><td>${t('loan')}</td><td class="n">${fmt(tk.loan)}</td></tr>
      <tr><td>+ ${t('air')}</td><td class="n">${fmt(ow.amount)}</td></tr>
      ${untaxedPaid() ? `<tr><td>${t('untaxed')}</td><td class="n">${fmt(untaxedPaid())}</td></tr>` : ''}
      <tr><td>− ${t('discount')}</td><td class="n">${fmt(disc)}</td></tr>
      <tr><td>${t('vatBase')}</td><td class="n">${fmt(base)}</td></tr>
      <tr><td>${t('vat')} ${S.set.vat}% ${incl ? '(' + t('include') + ')' : ''}</td><td class="n">${fmt(vat)}</td></tr></table>
    <div class="total"><span>${t('redeemTotal')} ${whoPays(-1)}</span><span class="big">${fmt(total)} ${t('baht')}</span></div>
    <fieldset style="margin-top:12px"><legend>${t('tender')}</legend><div class="fields">
      ${f(t('cash'), inp('tx.cash', w.cash))}${o(t('transfer'), fmt(Math.max(0, total - (+w.cash || 0))))}</div></fieldset></div>`;
  }

  // ---- 5. Forfeit (§7) ----
  function forfeit() {
    const list = S.overdue.map(r => {
      const ap = C.appraise(r.weight, +S.tx.todayPrice, 100, 'P', 0);
      return { ...r, reval: ap.value, gl: C.r2(ap.value - r.loan) };
    });
    return `<div class="panel"><h2>${t('a5')}</h2><div class="sub">${t('a5s')}</div>
    <table><tr><th>${t('ticketNo')}</th><th>${t('due')}</th><th class="n">${t('weight')}</th><th class="n">${t('loan')}</th><th class="n">${t('reval')}</th><th class="n">${t('gainLoss')}</th></tr>
    ${list.map(r => `<tr><td>${r.no}</td><td>${fd(r.due)}</td><td class="n">${r.weight}</td><td class="n">${fmt(r.loan)}</td><td class="n">${fmt(r.reval)}</td><td class="n">${fmt(r.gl)}</td></tr>`).join('')}</table>
    <div class="note">${t('todayPrice')}: ${fmt(+S.tx.todayPrice)}</div>
    <div class="actions"><button class="btn">${t('forfeitBtn')}</button></div></div>`;
  }

  // ---- Borrower app (§13, Case 2) ----
  function borrower() {
    const tk = S.ticket, rate = C.rateFor(tk.grp, tk.loan);
    const ow = C.owed(tk.loan, agreedOf(tk), rate, tk.lastPaid, S.tx.today, 'day');
    const vat = C.r2(ow.amount * vatPct());
    const due = C.edate(tk.date, 4);
    const left = C.daysBetween(S.tx.today, due);
    return `<div class="phone"><header class="appbar"><h1>${t('myTickets')}</h1></header>
      <div class="card" style="margin:12px"><div class="tk">
        <div class="row"><b>${tk.no}</b><span class="badge">${t('due')} ${fd(due)}</span></div>
        <div class="gold-ph">${S.lang === 'th' ? 'สร้อย 1 เส้น' : 'Necklace × 1'} · ${tk.weight} g</div>
        <div class="row"><span>${t('loan')}</span><b>${fmt(tk.loan)}</b></div>
        <div class="row"><span>${t('rate')}</span><span>${rate}% · ${t('perDay')}</span></div>
        <div class="row"><span>${t('owedToday')}</span><b>${fmt(ow.amount)}</b></div>
        <div class="row"><span>${t('vat')} ${S.set.vat}%</span><span>${fmt(vat)}</span></div>
        <div class="row"><span>${t('toRedeem')}</span><b>${fmt(tk.loan + ow.amount + vat)}</b></div>
        <div class="note">${t('daysLeft')} ${left} ${t('days')}</div>
      </div>
      <div class="actions" style="padding:0 14px 14px"><button class="btn small">${t('appPay')}</button><button class="btn small ghost" style="color:var(--accent)">${t('appTop')}</button><button class="btn small ghost" style="color:var(--accent)">${t('appReduce')}</button></div></div>
      <div class="note" style="padding:0 14px 14px">${conf('appQ')} ${t('appQ')}</div></div>`;
  }

  return { bind, issue, pay, change, redeem, forfeit, borrower, sel, inp, f, o, conf, L };
})();
