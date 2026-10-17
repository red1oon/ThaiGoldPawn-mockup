// Journey view (spec §15.2-15.3): shop desk · the wire (any channel) · borrower phone.
window.Flow = (function () {
  const P = window.Pay, C = window.Calc, Net = window.Net, T = window.Token;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const CH = { web: 'cloud', qr: 'qr_code_2', link: 'link', email: 'mail', whatsapp: 'chat', line: 'forum', sms: 'sms', nfc: 'nfc' };
  const icon = n => `<span class="material-symbols-rounded">${n}</span>`;
  const sel = (k, v, opts) => `<select data-k="${k}">${opts.map(([a, b]) => `<option value="${a}" ${String(a) === String(v) ? 'selected' : ''}>${b}</option>`).join('')}</select>`;
  const chOpts = () => Object.keys(CH).map(c => [c, t('ch_' + c)]);
  const stChip = s => `<span class="chip2" style="--c:var(${{ offered: '--muted', active: '--s1', overdue: '--s8', redeemed: '--s6', forfeited: '--s2' }[s] || '--muted'})">${t('st_' + s)}</span>`;

  function qr(text) {
    try { const q = window.qrcode(0, 'L'); q.addData(text); q.make(); return `<div class="qr">${q.createSvgTag({ cellSize: 3, margin: 2, scalable: true })}</div>`; }
    catch (e) { return `<div class="note">QR: ${t('qrTooBig')} (${text.length})</div>`; }
  }
  function buildOffer() {
    const x = S.issue, ap = C.appraise(+x.weight, S.price[x.basis], C.goldTypes[x.type].pct, S.set.mode, +S.set.deduct), rate = C.rateFor(x.grp, +x.loan);
    return { name: x.name, phone: x.phone, address: 'Sample address, Bangkok 10110', cat: ['ornament', 'bar', 'silver', 'other'][x.cat], item: x.item, qty: +x.qty, weight: +x.weight,
      grp: x.grp, ceiling: ap.limit, loan: +x.loan, headroom: C.r2(ap.limit - x.loan), rate, basis: S.set.basis, rounding: S.set.rounding, date: Net.today, months: +x.months, track: x.track, safe: x.safe };
  }
  const plan = st => [1, 2, 3, 4].slice(0, st.months).map(i => ({ i, date: C.edate(st.date, i), amt: C.r2(st.principal * st.rate / 100) }));

  // ---------- shop desk ----------
  function shop() {
    const tks = Object.keys(Net.shopL), tk = S.j.tk && Net.shopL[S.j.tk] ? S.j.tk : tks[tks.length - 1];
    const on = Net.online.shop;
    let body;
    if (!tk) body = `<div class="note">${t('noLive')}</div><div class="actions" style="justify-content:flex-start"><button class="btn" data-j="issue">${t('issueOffer')}</button></div>`;
    else {
      const l = Net.shopL[tk], st = P.fold(l, Net.today), off = l.chain.shop[0].body, link = Net.share('qr', l.offerToken()).link;
      body = `<div class="row2"><b>${tk}</b>${stChip(st.status)}</div>
        <div class="kv"><span>${t('name')}</span><b>${st.name}</b><span>${t('phone')}</span><b>${st.phone}</b><span>${t('loan')}</span><b>${fmt(st.loan)}</b><span>${t('code')}</span><b>${off.code}</b></div>
        <div class="note">${t('fundNote')}</div>${qr(link)}
        <div class="note">${t('sendOffer')}</div><div class="chs">${['qr', 'link', 'email', 'whatsapp', 'line', 'sms', 'nfc', 'web'].map(c => `<button class="chbtn" data-j="send|shop|${c}|${tk}" title="${t('ch_' + c)}">${icon(CH[c])}<small>${t('ch_' + c)}</small></button>`).join('')}</div>
        <div class="sec-title">${t('claimsIn')}</div>${st.claims.length ? st.claims.map(c => `<div class="row2"><span>#${c.claimNo} ${t('m_' + c.mode)} ${fmt(c.amount)}</span><span class="chip2" style="--c:var(${c.status === 'verified' ? '--s6' : c.status === 'rejected' ? '--s8' : '--muted'})">${t('cl_' + c.status)}${c.reason ? ' · ' + c.reason : ''}</span></div>`).join('') : `<div class="note">–</div>`}
        <div class="sec-title">${t('recvHere')}</div><textarea id="recv_shop" placeholder="${t('pasteTok')}" rows="2"></textarea>
        <div class="actions" style="justify-content:flex-start"><button class="btn small" data-j="recv|shop">${t('receive')}</button>${tks.length > 1 ? sel('j.tk', tk, tks.map(k => [k, k])) : ''}<button class="btn small ghost" style="color:var(--accent)" data-j="issue">${t('issueAnother')}</button></div>`;
    }
    return `<div class="card"><div class="panel"><h2>${icon('storefront')} ${t('jShop')}</h2>
      <div class="row2"><span class="chip2" style="--c:var(${on ? '--s6' : '--muted'})">${on ? t('online') : t('offline')}</span><button class="btn small ghost" style="color:var(--accent)" data-j="online|shop">${on ? t('goOffline') : t('goOnline')}</button></div>${body}</div></div>`;
  }

  // ---------- wire ----------
  function wire() {
    const ws = [...Net.wire].reverse().slice(0, 14);
    return `<div class="card"><div class="panel"><h2>${icon('swap_horiz')} ${t('jWire')}</h2><div class="sub">${t('wireSub')}</div>
      ${ws.length ? ws.map(w => {
        const r = w.result, res = r ? (r.ok ? `+${r.accepted} ${t('events')}${r.dup ? ` · ${r.dup} ${t('dupDropped')}` : ''}${r.gap ? ` · ⚠ ${t('gap')}` : ''}${r.bad && r.bad.length ? ` · ✖ ${t('refused')} (${r.bad[0].why})` : ''}` : '✖ ' + r.why) : '';
        const link = !['web', 'qr', 'nfc'].includes(w.channel) ? `<a href="${Net.share(w.channel, w.token).href}" target="_blank" rel="noopener">${t('open')} ↗</a>` : '';
        return `<div class="wi ${w.state}"><div class="row2"><span>${icon(CH[w.channel])} ${t('ch_' + w.channel)}</span><span class="chip2" style="--c:var(${w.state === 'delivered' ? '--s6' : w.state === 'inflight' ? '--s4' : '--s8'})">${t('ws_' + w.state)}</span></div>
          <div class="note">${t('by_' + w.from)} → ${t('by_' + w.to)} · ${w.tk} · #${w.n} · ${w.size} ${t('chars')}${w.dupOf ? ' · ' + t('copy') : ''}</div>
          ${res ? `<div class="note">${res}</div>` : ''}
          <div class="actions" style="justify-content:flex-start;margin:4px 0 0">${w.state === 'inflight' ? `<button class="btn small" data-j="deliver|${w.id}">${t('deliverBtn')}</button><button class="btn small ghost" style="color:var(--s8)" data-j="lose|${w.id}">${t('loseBtn')}</button>` : ''}<button class="btn small ghost" style="color:var(--accent)" data-j="dup|${w.id}">${t('dupBtn')}</button>${link}</div></div>`;
      }).join('') : `<div class="note">${t('wireEmpty')}</div>`}</div></div>`;
  }

  // ---------- phone ----------
  function phone() {
    const l = Net.phoneL, on = Net.online.phone;
    const top = `<header class="appbar"><h1>${t('myTickets')}</h1><span class="chip">${on ? t('online') : t('offline')}</span><button class="btn small ghost" data-j="online|phone">${on ? t('goOffline') : t('goOnline')}</button></header>`;
    if (!l || !l.chain.shop.length) return `<div class="phone">${top}<div class="card" style="margin:12px"><div class="panel"><div class="note">${t('phoneEmpty')}</div>
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-j="openOffer">${t('scanBtn')}</button></div>
      <textarea id="recv_phone" placeholder="${t('pasteTok')}" rows="2"></textarea><div class="actions" style="justify-content:flex-start"><button class="btn small" data-j="recv|phone">${t('receive')}</button></div></div></div></div>`;
    const st = P.fold(l, Net.today), off = l.chain.shop[0].body;
    let main;
    if (st.status === 'offered') {
      main = `<div class="card" style="margin:12px"><div class="panel"><div class="okm">✔ ${t('shopSigOk')}</div><h2>${t('offerFor')} ${st.no}</h2>
        <div class="kv"><span>${t('phone')}</span><b>${st.phone}</b><span>${t('name')}</span><b>${st.name}</b><span>${t('address')}</span><b>${st.address}</b>
        <span>${t('collateral')}</span><b>${t('cat_' + st.cat)} · ${st.weight} g × ${st.qty}</b><span>${t('loanable')}</span><b>${fmt(st.ceiling)}</b><span>${t('headroom')}</span><b>${fmt(st.headroom)}</b>
        <span>${t('loan')}</span><b>${fmt(st.loan)}</b><span>${t('rate')}</span><b>${st.rate}% / ${t(st.basis === 'day' ? 'perDay' : 'perMonth')}</b><span>${t('due')}</span><b>${fd(st.due)}</b></div>
        <table><tr><th>${t('inst')}</th><th>${t('date')}</th><th class="n">${t('amount')}</th></tr>${plan(st).map(r => `<tr><td>${r.i}</td><td>${fd(r.date)}</td><td class="n">${fmt(r.amt)}</td></tr>`).join('')}</table>
        <label class="f">${t('codeEnter')}<input data-k="j.code" value="${S.j.code}" inputmode="numeric"></label><div class="note">${t('codeNote')}</div>
        ${S.j.codeBad ? `<div class="err">⚠ ${t('codeBad')}</div>` : ''}
        <label class="f">${t('returnVia')}${sel('j.via', S.j.via, chOpts())}</label>
        <div class="actions"><button class="btn" data-j="ack">${t('ackBtn')}</button></div></div></div>`;
    } else {
      const owed = P.interestTo(st, Net.today), q = S.j.mode === 'other' ? P.quote(st, 'other', +S.j.amt, Net.today, S.set) : P.quote(st, S.j.mode, 0, Net.today, S.set);
      const sh = Net.shopL[st.no] || Net.all()[st.no];
      const behind = sh ? (sh.head('shop').n > l.head('shop').n ? sh.head('shop').n - l.head('shop').n : 0) : 0;
      const pending = l.outbox ? 1 : 0;
      const choices = [['installment', 'm_installment'], ['full', 'm_full'], ['other', 'm_other']].map(([m, lab]) => `<label class="choice ${S.j.mode === m ? 'on' : ''}"><input type="radio" name="mode" data-k="j.mode" value="${m}" ${S.j.mode === m ? 'checked' : ''}>${t(lab)}</label>`).join('');
      main = `<div class="card" style="margin:12px"><div class="tk"><div class="row2"><b>${st.no}</b>${stChip(st.status)}</div>
        <div class="gold-ph">${t('cat_' + st.cat)} · ${st.weight} g</div>
        <div class="row"><span>${t('principalNow')}</span><b>${fmt(st.principal)}</b></div><div class="row"><span>${t('owedToday')}</span><b>${fmt(owed)}</b></div>
        <div class="row"><span>${t('due')}</span><span>${fd(st.due)}</span></div><div class="row"><span>${t('paidTo')}</span><span>${fd(st.paidTo)}</span></div></div>
        ${st.status === 'redeemed' ? `<div class="panel"><div class="okm">✔ ${t('st_redeemed')}</div></div>` : `<div class="panel"><div class="sec-title" style="margin-top:0">${t('payHow')}</div><div class="choices">${choices}</div>
        ${S.j.mode === 'other' ? `<label class="f">${t('amountToPay')}<input data-k="j.amt" type="number" value="${S.j.amt}"></label>` : ''}
        ${q.error ? `<div class="err">⚠ ${t('amt_' + q.error)}</div>` : `<table><tr><td>${t('int')}</td><td class="n">${fmt(q.int)}</td></tr><tr><td>VAT ${S.set.vat}%</td><td class="n">${fmt(q.vat)}</td></tr><tr><td>${t('principalPart')}</td><td class="n">${fmt(q.principalPart)}</td></tr></table>
        ${q.reissue ? `<div class="note">${t('reissueNote')}</div>` : ''}<div class="total"><span>${t('payTotal')}</span><span class="big">${fmt(q.total)}</span></div>
        <div class="note">${t('ppNote')}</div>${qr(P.promptpay(st.shopPhone || Net.shopPhone, q.total))}
        <label class="f">${t('slipSim')}${sel('j.slip', S.j.slip, ['ok', 'duplicate', 'wrongAmount', 'wrongReceiver'].map(k => [k, t('slip_' + k)]))}</label>
        <label class="f">${t('returnVia')}${sel('j.via', S.j.via, chOpts())}</label>
        <div class="actions"><button class="btn" data-j="pay">${t('submitSlip')}</button></div>`}</div>`}
        ${st.claims.length ? `<div class="panel"><div class="sec-title" style="margin-top:0">${t('myPayments')}</div>${st.claims.map(c => `<div class="row2"><span>#${c.claimNo} ${t('m_' + c.mode)} ${fmt(c.amount)}</span><span class="chip2" style="--c:var(${c.status === 'verified' ? '--s6' : c.status === 'rejected' ? '--s8' : '--s4'})">${t('cl_' + c.status)}${c.reason ? ' · ' + c.reason : ''}</span></div>`).join('')}</div>` : ''}
        <div class="panel"><span class="chip2" style="--c:var(${behind || pending ? '--s4' : '--s6'})">${pending ? t('queued') : behind ? t('behind') + ' ' + behind : t('inSync')}</span></div></div>`;
    }
    return `<div class="phone">${top}${main}</div>`;
  }

  function view() {
    const solo = Net.solo === 'phone';
    return `<div class="jbar"><span class="chip">${t('demoDate')}: ${fd(Net.today)}</span><button class="btn small ghost" style="color:var(--accent)" data-j="date|7">+7 ${t('days')}</button><button class="btn small ghost" style="color:var(--accent)" data-j="date|31">+1 ${t('monthU')}</button>
      <span class="note" style="flex:1;min-width:200px">${t('tokenNote')}</span></div>
      <div class="jgrid ${solo ? 'solo' : ''}">${solo ? '' : shop()}${solo ? '' : wire()}<div>${phone()}</div></div>`;
  }

  // ---------- actions ----------
  async function act(spec) {
    const [a, b, c, d] = spec.split('|');
    if (a === 'issue') { S.j.tk = await Net.issueOffer(buildOffer()); }
    else if (a === 'send') { S.j.tk = d || S.j.tk; const w = await Net.send(b, c, d || S.j.tk); if (c === 'nfc' && w) { const r = await Net.nfcWrite(Net.share('link', w.token).link); w.note = r.ok ? 'NFC written' : 'NFC ' + r.why; } }
    else if (a === 'deliver') await Net.deliver(+b);
    else if (a === 'lose') Net.lose(+b);
    else if (a === 'dup') Net.dup(+b);
    else if (a === 'openOffer') await Net.openOffer(S.j.tk || Object.keys(Net.shopL).pop());
    else if (a === 'ack') { const r = await Net.phoneAck(S.j.code, S.j.via); S.j.codeBad = !r.ok; if (r.ok) S.j.code = ''; }
    else if (a === 'pay') await Net.phoneClaim(S.j.mode, S.j.mode === 'other' ? +S.j.amt : 0, S.j.slip, S.j.via);
    else if (a === 'online') Net.setOnline(b, !Net.online[b]);
    else if (a === 'date') { Net.today = C.edate(Net.today, 0) && addDays(Net.today, +b); }
    else if (a === 'recv') {
      const v = (document.getElementById('recv_' + b).value || '').trim(), tok = v.includes('#/t/') ? v.split('#/t/')[1] : v;
      if (tok) await Net.receiveRaw(tok, b, 'paste');
    }
    Net.emit();
  }
  const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  return { bind, view, act, buildOffer, qr };
})();
