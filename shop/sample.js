// Sample portfolio for the dashboard (spec §15.4). SAMPLE DATA ONLY: seeded generator, real signed ledgers, no real customers.
(function (root) {
  const T = root.Token, P = root.Pay, C = root.Calc, Net = root.Net;
  function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const CATS = [['ornament', 'necklace'], ['ornament', 'ring'], ['ornament', 'pendant'], ['ornament', 'bangle'], ['bar', 'bar'], ['silver', 'silver'], ['other', 'other']];
  const GRPS = ['standard', 'standard', 'standard', 'vip', 'vip', 'supervip', 'relative'];
  async function build(n) {
    const xr = rng(31), r = rng(20251004), today = Net.today, key = await T.newKey(), out = {};
    const price = 100000;
    for (let i = 0; i < n; i++) {
      const no = 'S' + String(i + 1).padStart(3, '0');
      const [cat, item] = CATS[Math.floor(r() * CATS.length)], grp = GRPS[Math.floor(r() * GRPS.length)];
      const weight = [3.79, 7.58, 15.16, 22.74, 30.32, 45.48][Math.floor(r() * 6)];
      const value = C.r2(weight / 15.16 * price), ceiling = C.r2(value * 0.85);
      const loan = Math.round(ceiling * (0.6 + r() * 0.4) / 500) * 500;
      const ageDays = r() < 0.25 ? 190 + Math.floor(r() * 90) : 6 + Math.floor(r() * 160), date = isoMinus(today, ageDays);
      const months = [3, 4, 4, 4][Math.floor(r() * 4)], rate = C.rateFor(grp, loan);
      const l = new T.Ledger(no, 'shop', Net.keys.shop), pl = new T.Ledger(no, 'phone', key);
      const t0 = Date.parse(date + 'T09:00:00Z');
      await l.append('offer', { name: 'ลูกค้าตัวอย่าง ' + (i + 1), phone: '08' + String(10000000 + i * 7919).slice(0, 8), address: 'Sample address ' + (i + 1), cat, item, qty: 1, weight, grp,
        ceiling, pct: 85, loan, headroom: C.r2(ceiling - loan), rate, basis: 'day', rounding: 'day', date, months, pub: Net.keys.shop.pub, code: '000000', shopAcct: Net.shopAcct }, t0);
      const pending = ageDays < 30 && r() < 0.5;
      if (!pending) {
        await pl.receive(l.makeToken(), 'seed'); await pl.append('ack', { pub: key.pub }, t0 + 600000); await l.receive(pl.makeToken(), 'seed');
        // monthly installments while due and in the past; some customers stop paying
        const keep = 0.55 + r() * 0.45; let k = 1, ref = 0;
        for (;;) {
          const st = P.fold(l, today); const cover = C.edate(st.paidTo, 1);
          if (C.D(cover) > C.D(today) || r() > keep) break;
          const q = P.quote(st, 'installment', 0, cover, { taxPoint: 'interest' }), ts = Date.parse(cover + 'T10:00:00Z');
          await pl.append('payment_claim', { claimNo: k, mode: 'installment', amount: q.total, ask: 0, slip: { transRef: no + '-' + k } }, ts);
          await l.receive(pl.makeToken(), 'seed');
          await l.append('payment_verified', { claimNo: k, mode: 'installment', amt: q.total, int: q.int, vat: q.vat, principalPart: 0, coverTo: q.coverTo, credit: 0, untaxed: 0, tender: 'transfer', slip: { transRef: no + '-' + k } }, ts + 60000);
          await pl.receive(l.makeToken(), 'seed'); k++;
        }
        const st = P.fold(l, today), roll = r();
        if (C.D(st.due) <= C.D(today) && roll < 0.45) {       // due and redeemed in full
          const q = P.quote(st, 'full', 0, st.due, { taxPoint: 'interest' }), ts = Date.parse(st.due + 'T11:00:00Z');
          await l.append('payment_verified', { claimNo: k, mode: 'full', amt: q.total, int: q.int, vat: q.vat, principalPart: q.principalPart, coverTo: q.coverTo, credit: 0, untaxed: 0, ...(Number(no.slice(1)) % 2 === 1 ? { tender: 'cash' } : { tender: 'transfer', slip: { transRef: no + '-F' } }) }, ts);   // paid at the counter in cash, or by transfer with a slip
        } else if (C.D(st.due) < C.D(today) && C.daysBetween(st.due, today) > 110 && roll < 0.6)
          await l.append('closed', { how: 'forfeited' }, Date.parse(C.edate(st.due, 1) + 'T11:00:00Z'));
      }
      // follow-up history for tickets that need chasing, and a few offers to good customers
      const fin = P.fold(l, today), cls = P.classify(fin, today, { npl: Net.nplDays, price: Net.price });
      if (cls === 'watch' || cls === 'npl' || (cls === 'green' && r() < 0.25)) {
        const k = cls === 'green' ? 1 : 1 + Math.floor(r() * 3), base = cls === 'green' ? isoMinus(today, 20) : fin.due, ch = ['call', 'line', 'sms', 'visit'];
        for (let j = 0; j < k; j++) {
          const d = isoPlus(base, 3 + j * 9 + Math.floor(r() * 5)); if (C.D(d) > C.D(today)) break;
          const last = j === k - 1, oc = cls === 'green' ? 'upsell' : (last && r() < 0.4 ? 'noanswer' : ['promised', 'noanswer', 'promised'][Math.floor(r() * 3)]);
          await Net.logFollowup(no, { DateContact: d, Channel: ch[Math.floor(r() * 4)], Outcome: oc, Note: cls === 'green' ? 'Sample note' : 'Sample note', DateNext: last ? isoPlus(today, Math.floor(r() * 12) - 4) : '' }, Date.parse(d + 'T14:00:00Z'));
        }
      }
      if (xr() < 0.1) {                                          // a duplicate slip re-sent by the borrower: SlipOK 1012 (counted as a check)
        const v = l.chain.shop.filter(e => e.type === 'payment_verified').pop();
        if (v) await l.append('payment_rejected', { claimNo: (v.body.claimNo || 0) + 100, reason: '1012', message: 'duplicate slip' }, v.ts + 120000);
      }
      l.sample = true; out[no] = l;
    }
    return out;
  }
  function isoPlus(d, n) { return new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
  function isoMinus(d, n) { const t = new Date(Date.parse(d + 'T00:00:00Z') - n * 86400000); return t.toISOString().slice(0, 10); }
  root.Sample = { build };
})(window);
