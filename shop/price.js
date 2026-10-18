// Gold price register (spec §20.3): dated board prices as signed shop-internal events; the issue form uses the latest on/before the ticket date
// and SNAPSHOTS it into the offer, so later price moves never change an issued ticket. Exposure = collateral value at today's buy price − principal out.
window.Price = (function () {
  const T = window.Token, P = window.Pay, C = window.Calc, Net = window.Net, GRAM = 15.16;
  let sampleL = null;
  const mk = (date, buy, o) => ({ date, time: o && o.time || '09:00', buy, sell: buy + 200, tax: buy - 100, source: 'manual' });
  function events() { const a = sampleL ? sampleL.chain.shop : [], l = Net.crm && Net.crm._price, b = l ? l.chain.shop : []; return [...a, ...b].filter(e => e.body && e.type === 'price'); }
  const keyOf = e => e.body.date + 'T' + (e.body.time || '00:00') + ':' + String(e.n).padStart(6, '0');
  const list = () => events().map(e => ({ ...e.body, ts: e.ts, by: e.by })).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : a.date + a.time > b.date + b.time ? 1 : a.ts - b.ts));
  const latest = on => { const L = list().filter(p => !on || p.date <= on); return L[L.length - 1] || null; };
  const prev = () => { const L = list(); return L[L.length - 2] || null; };
  async function record(p) {
    { const g = window.Auth && window.Auth.check('price'); if (g && !g.ok) return { ok: false, why: 'role' }; }
    const b = { date: p.date, time: p.time || '09:00', buy: +p.buy, sell: +p.sell, tax: +p.tax, source: 'manual' };
    if (!(b.buy > 0 && b.sell > 0 && b.tax > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return { ok: false, why: 'invalid' };
    return { ok: true, event: await Net.logInternal('_price', 'price', b) };
  }
  // sample history: a smooth walk that is exactly 100,000 on the sample ticket date (2025-07-14) and on "today" (2025-09-25), so the sample numbers stay put
  async function seed() {
    sampleL = new T.Ledger('crm:_prices', 'shop', Net.keys.shop); sampleL.live = false;
    const d0 = Date.parse('2025-07-14T00:00:00Z'), end = Date.parse(Net.today + 'T00:00:00Z');
    for (let t = -90; d0 + t * 86400000 <= end; t++) {
      const day = new Date(d0 + t * 86400000).toISOString().slice(0, 10), buy = 100000 + Math.round(2200 * Math.sin(Math.PI * t / 73) * Math.sin(2 * Math.PI * t / 19 + 0.8) / 50) * 50;
      await sampleL.append('price', mk(day, buy), d0 + t * 86400000 + 9 * 3600000);
    }
  }
  // exposure: open collateral value at today's buy price vs principal out (spec §5 A5: the % is the shop's cushion against falling prices)
  function exposure(sts, buy) {
    const open = sts.filter(s => s.status === 'active' || s.status === 'overdue'), value = C.r2(open.reduce((a, s) => a + (+s.weight || 0) / GRAM * buy, 0)), principal = C.r2(open.reduce((a, s) => a + s.principal, 0));
    const under = open.filter(s => s.principal > (+s.weight || 0) / GRAM * buy).length;
    return { n: open.length, value, principal, cushion: C.r2(value - principal), under };
  }
  const stale = (today, p) => { if (p === undefined) p = latest(); return !p || C.daysBetween(p.date, today) >= 1; };
  const snapshot = on => { const p = latest(on); return p ? { date: p.date, buy: p.buy, sell: p.sell, tax: p.tax } : null; };
  return { seed, list, latest, prev, record, exposure, stale, snapshot, events };
})();
