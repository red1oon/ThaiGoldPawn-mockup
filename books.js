// Books preview (spec §15.7): the journals the kernel ERP posts for each pawn event, folded from the SAME signed events.
// ⚠ PREVIEW — the pawn document type + real Fact_Acct posting on the kernel is NOT built (W-PAWN-BOOKS). Sample chart of accounts.
(function (root) {
  const P = root.Pay || require('./pay.js'), C = root.Calc;
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const ACCT = { cash: ['1100', 'Cash / bank', 'เงินสด / ธนาคาร'], rec: ['1310', 'Pawn receivable', 'ลูกหนี้ขายฝาก'], stock: ['1410', 'Used-gold stock', 'สต็อกทองเก่า'],
    vat: ['2210', 'Output VAT', 'ภาษีขาย'], inc: ['4100', 'Pawn interest income', 'รายได้ผลประโยชน์ขายฝาก'], gl: ['4900', 'Gain / loss on forfeit', 'กำไร/ขาดทุนจากหลุดจำนำ'] };
  const line = (a, dr, cr) => ({ acct: a, dr: r2(dr), cr: r2(cr) });
  const iso = ts => new Date(ts).toISOString().slice(0, 10);

  function journals(ledger, price) {
    const st = P.fold(ledger, '9999-12-31'), out = [];
    const evs = [...ledger.chain.shop, ...ledger.chain.phone].sort((a, b) => a.ts - b.ts || (a.by < b.by ? -1 : 1));
    let principal = 0;
    for (const e of evs) {
      const b = e.body, base = { tk: ledger.tk, ts: e.ts, date: iso(e.ts), event: e.type, hash: e.hash.slice(0, 8) };
      if (e.type === 'offer') { principal = b.loan; out.push({ ...base, desc: 'issue', lines: [line('rec', b.loan, 0), line('cash', 0, b.loan)] }); }
      else if (e.type === 'payment_verified') {
        principal = r2(principal - b.principalPart);
        out.push({ ...base, desc: b.mode, lines: [line('cash', b.amt, 0), line('inc', 0, b.int), line('vat', 0, b.vat), line('rec', 0, b.principalPart)].filter(l => l.dr || l.cr) });
      } else if (e.type === 'closed' && b.how === 'forfeited') {
        const val = r2(st.weight / C.GRAM_PER_BAHT * price), d = r2(val - principal);
        out.push({ ...base, desc: 'forfeit', lines: [line('stock', val, 0), line('rec', 0, principal), d >= 0 ? line('gl', 0, d) : line('gl', -d, 0)].filter(l => l.dr || l.cr) });
        principal = 0;
      }
    }
    return out;
  }
  const all = (ledgers, price) => ledgers.flatMap(l => journals(l, price)).sort((a, b) => a.ts - b.ts);
  function trial(entries) {
    const tb = {}; for (const k of Object.keys(ACCT)) tb[k] = { dr: 0, cr: 0 };
    for (const e of entries) for (const l of e.lines) { tb[l.acct].dr = r2(tb[l.acct].dr + l.dr); tb[l.acct].cr = r2(tb[l.acct].cr + l.cr); }
    return tb;
  }
  const balanced = e => Math.abs(e.lines.reduce((a, l) => a + l.dr - l.cr, 0)) < 0.005;
  root.Books = { ACCT, journals, all, trial, balanced };
  if (typeof module !== 'undefined') module.exports = root.Books;
})(typeof window !== 'undefined' ? window : globalThis);
