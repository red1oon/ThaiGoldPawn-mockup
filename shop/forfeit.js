// Forfeit + sale of forfeited gold (spec §20.4, §7, §8 case 3). Signed events on the ticket's own chain; balances N/O/P and gain/loss are folds (Books).
// Guards: forfeit only an overdue ticket; sale only a forfeited, unsold one. Forfeit moves the item to the FORFEIT locator; sale takes it out.
window.Forfeit = (function () {
  const P = window.Pay, C = window.Calc, Net = window.Net, Pr = () => window.Price, SK = () => window.Stock, GRAM = 15.16;
  const buyNow = () => { const p = Pr() && Pr().latest(Net.today); return p ? p.buy : Net.price; };
  const fold = tk => { const l = Net.all()[tk]; return l ? P.fold(l, Net.today) : null; };
  // appraisal of a forfeited item: weight / 15.16 × today's buy price (editable by the shop)
  const appraise = st => C.r2((+st.weight || 0) / GRAM * buyNow());
  function canForfeit(st) { if (!st) return { ok: false, why: 'none' }; if (st.status === 'forfeited') return { ok: false, why: 'already' }; if (st.status === 'sold') return { ok: false, why: 'sold' }; if (st.status === 'redeemed') return { ok: false, why: 'redeemed' };
    if (st.status !== 'overdue') return { ok: false, why: 'not-due' }; return { ok: true }; }
  function canSell(st) { if (!st) return { ok: false, why: 'none' }; if (st.status === 'sold') return { ok: false, why: 'already-sold' }; if (st.status !== 'forfeited') return { ok: false, why: 'not-forfeited' }; return { ok: true }; }
  const own = tk => { let l = Net.shopL[tk]; if (!l && Net.sample[tk]) { l = Net.sample[tk]; l.live = true; Net.shopL[tk] = l; } return l; };   // a sample ticket worked on becomes the shop's own (persisted) record
  async function forfeit(tk, appraised) {
    { const g = window.Auth && window.Auth.check('forfeit'); if (g && !g.ok) return { ok: false, why: 'role' }; }
    const st = fold(tk), g = canForfeit(st); if (!g.ok) return g;
    const l = own(tk), val = appraised != null && appraised !== '' ? C.r2(+appraised) : appraise(st);
    if (!(val > 0)) return { ok: false, why: 'appraisal' };
    const interestUnpaid = P.interestTo(st, Net.today), e = await l.append('closed', { how: 'forfeited', appraised: val, principal: st.principal, interestWrittenOff: interestUnpaid, priceRef: Pr() && Pr().snapshot(Net.today) }, Net.ts());
    if (SK()) await SK().putAway(tk, SK().defaultLoc(st.loan, 'FORFEIT'), null, 'forfeit');
    Net.persist(); Net.emit(); return { ok: true, appraised: val, gainLoss: C.r2(val - st.principal), event: e };
  }
  async function sale(tk, o) {
    { const g = window.Auth && window.Auth.check('sale'); if (g && !g.ok) return { ok: false, why: 'role' }; }
    const st = fold(tk), g = canSell(st); if (!g.ok) return g;
    const price = C.r2(+o.price); if (!(price > 0)) return { ok: false, why: 'price' };
    const l = own(tk), e = await l.append('sale', { price, buyer: String(o.buyer || '').trim(), tender: o.tender || 'cash', appraised: st.appraised }, Net.ts());
    if (SK()) { const cur = SK().fold()[tk]; await SK().log('locate', { tk, how: 'out', from: cur && cur.loc || null, by: 'shop' }); }
    Net.persist(); Net.emit(); return { ok: true, gainLoss: C.r2(price - (st.appraised || 0)), event: e };
  }
  // balances (xlsx §8): N receivable, O collateral held for customers (memo), P forfeited stock held by the shop — all folds
  function balances() {
    const sts = Object.values(Net.all()).map(l => P.fold(l, Net.today)), open = sts.filter(s => s.status === 'active' || s.status === 'overdue' || s.status === 'offered');
    const forf = sts.filter(s => s.status === 'forfeited');
    return { N: C.r2(open.reduce((a, s) => a + s.principal, 0)), O: C.r2(open.reduce((a, s) => a + s.principal, 0)), P: C.r2(forf.reduce((a, s) => a + (s.appraised || 0), 0)), nForfeited: forf.length, nSold: sts.filter(s => s.status === 'sold').length };
  }
  return { appraise, canForfeit, canSell, forfeit, sale, balances, fold, buyNow };
})();
