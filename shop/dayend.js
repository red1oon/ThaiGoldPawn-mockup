// Day-end cash + vault reconciliation (spec §20.5). Expected cash = cash legs received − cash legs paid out that day, folded from the events
// (transfers excluded). The shop types the counted cash; the signed `dayend` event records expected, counted, variance, vault variance and a note.
window.DayEnd = (function () {
  const P = window.Pay, C = window.Calc, Net = window.Net;
  const day = ts => new Date(ts).toISOString().slice(0, 10);
  // every cash leg: payout at issue (not for imported opening balances), counter receipts, forfeited-gold sales
  function legs(d) {
    const out = [];
    Object.values(Net.all()).forEach(l => l.chain.shop.forEach(e => {
      const b = e.body || {}; if (day(e.ts) !== d) return;
      if (e.type === 'offer' && !b.opening && (b.tender || 'cash') === 'cash') out.push({ ts: e.ts, tk: l.tk, kind: 'payout', amt: -b.loan });
      else if (e.type === 'payment_verified' && (b.tender || 'transfer') === 'cash') out.push({ ts: e.ts, tk: l.tk, kind: 'receipt', amt: b.amt });
      else if (e.type === 'sale' && (b.tender || 'cash') === 'cash') out.push({ ts: e.ts, tk: l.tk, kind: 'sale', amt: b.price });
    }));
    return out.sort((a, b) => a.ts - b.ts);
  }
  const transfers = d => { let n = 0; Object.values(Net.all()).forEach(l => l.chain.shop.forEach(e => { const b = e.body || {}; if (day(e.ts) !== d) return; if ((e.type === 'payment_verified' && (b.tender || 'transfer') !== 'cash') || (e.type === 'offer' && !b.opening && b.tender === 'transfer') || (e.type === 'sale' && b.tender === 'transfer')) n++; })); return n; };
  // opening float = cash counted at the previous saved day-end (0 if none); expected closing cash = opening + net movement of the day
  const openingFor = d => { const H = history().filter(h => h.date < d).sort((a, b) => (a.date < b.date ? -1 : 1)); return H.length ? H[H.length - 1].countedCash : 0; };
  function expected(d, opening) {
    const L = legs(d), inn = C.r2(L.filter(x => x.amt > 0).reduce((a, x) => a + x.amt, 0)), outt = C.r2(-L.filter(x => x.amt < 0).reduce((a, x) => a + x.amt, 0)), op = opening != null && opening !== '' ? C.r2(+opening) : openingFor(d);
    return { legs: L, in: inn, out: outt, net: C.r2(inn - outt), opening: op, expected: C.r2(op + inn - outt), transfers: transfers(d) };
  }
  const variance = (counted, exp) => C.r2(counted - exp);                 // counted − expected: negative = cash short
  function history() { return histFn(); }
  const histFn = () => { const l = Net.crm && Net.crm._dayend; return l ? l.chain.shop.filter(e => e.type === 'dayend').map(e => ({ ...e.body, ts: e.ts, n: e.n })).reverse() : []; };
  async function save(d, counted, note, vaultVar, opening) {
    const x = expected(d, opening), c = +counted; if (isNaN(c) || c < 0) return { ok: false, why: 'counted' };
    const e = await Net.logInternal('_dayend', 'dayend', { date: d, openingFloat: x.opening, netMovement: x.net, expectedCash: x.expected, countedCash: c, variance: variance(c, x.expected), vaultVariance: +vaultVar || 0, note: String(note || '').trim() });
    return { ok: true, event: e, variance: variance(c, x.expected) };
  }
  return { legs, expected, variance, save, history, day, openingFor };
})();
