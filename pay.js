// Borrower payment (spec §15.3): quote (full / installment / other amount), PromptPay QR payload, SlipOK adapter (MOCK).
(function (root) {
  const C = root.Calc || (typeof require === 'function' ? require('./calc.js') : null) || root.Calc;
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const VAT = 0.07;

  // ---- fold: ledger events -> current ticket state (never stored totals, §9) ----
  function fold(ledger, today) {
    const evs = [...ledger.chain.shop, ...ledger.chain.phone].sort((a, b) => a.ts - b.ts || (a.by < b.by ? -1 : 1));
    const st = { no: ledger.tk, acked: false, paid: [], closed: null, claims: [], seenRefs: [] };
    for (const e of evs) {
      const b = e.body;
      if (e.type === 'offer') Object.assign(st, b, { principal: b.loan, paidTo: b.date, credit: 0, untaxed: 0, due: C.edate(b.date, b.months) });
      else if (e.type === 'ack') { st.acked = true; st.ackAt = e.ts; }
      else if (e.type === 'payment_claim') st.claims.push({ ...b, ts: e.ts, n: e.n, status: 'pending' });
      else if (e.type === 'payment_verified') {
        st.principal = r2(st.principal - b.principalPart); st.paidTo = b.coverTo; st.credit = b.credit; st.untaxed = b.untaxed;
        st.paid.push({ ...b, ts: e.ts }); st.seenRefs.push(b.slip && b.slip.transRef);
        const c = st.claims.find(x => x.claimNo === b.claimNo); if (c) c.status = 'verified';
      } else if (e.type === 'payment_rejected') { const c = st.claims.find(x => x.claimNo === b.claimNo); if (c) { c.status = 'rejected'; c.reason = b.reason; } }
      else if (e.type === 'closed') st.closed = b.how;
    }
    if (!st.offered && st.loan == null) { st.status = 'none'; return st; }
    st.status = st.closed || (st.principal <= 0 ? 'redeemed' : !st.acked ? 'offered' : (st.due < today ? 'overdue' : 'active'));
    return st;
  }

  // interest owed on the CURRENT principal from paidTo to `to`, less any partial credit
  function interestTo(st, to) {
    const rate = st.rate, agreed = r2(st.principal * rate / 100);
    const o = C.owed(st.principal, agreed, rate, st.paidTo, to, st.rounding);
    return Math.max(0, r2(o.amount - st.credit));
  }
  const vatEach = set => !set || set.taxPoint === 'interest';

  // mode: 'full' | 'installment' | 'other'; set = { taxPoint }
  function quote(st, mode, amount, today, set) {
    const each = vatEach(set); let q;
    if (mode === 'full') {
      const int = interestTo(st, today), base = each ? int : r2(int + st.untaxed), vat = r2(base * VAT);
      q = { int, vat, principalPart: st.principal, coverTo: today, credit: 0, untaxed: 0 };
    } else if (mode === 'installment') {
      const to = C.edate(st.paidTo, 1), int = interestTo(st, to), vat = each ? r2(int * VAT) : 0;
      q = { int, vat, principalPart: 0, coverTo: to, credit: 0, untaxed: each ? st.untaxed : r2(st.untaxed + int) };
    } else {
      const a = r2(+amount || 0), int = interestTo(st, today), vatI = each ? r2(int * VAT) : 0, need = r2(int + vatI);
      if (a <= 0) return { error: 'amount' };
      if (a <= need) {                                   // partial interest: kept as credit, paid-to date unchanged
        const i = each ? r2(a / (1 + VAT)) : a;
        q = { int: i, vat: r2(a - i), principalPart: 0, coverTo: st.paidTo, credit: r2(st.credit + i), untaxed: each ? st.untaxed : r2(st.untaxed + i) };
      } else {
        const pp = r2(a - need);
        if (pp > st.principal) return { error: 'tooMuch', max: r2(st.principal + need) };
        q = { int, vat: vatI, principalPart: pp, coverTo: today, credit: 0, untaxed: each ? st.untaxed : r2(st.untaxed + int) };
      }
    }
    q.mode = mode; q.total = r2(q.int + q.vat + q.principalPart); q.newPrincipal = r2(st.principal - q.principalPart);
    q.reissue = q.principalPart > 0 && q.newPrincipal > 0;      // §5: close + new linked ticket
    return q;
  }

  // ---- PromptPay (EMVCo merchant QR, tag 29 credit transfer, phone proxy 0066…) ----
  function crc16(s) { let c = 0xFFFF; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); }
  const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
  function promptpay(phone, amount) {
    const proxy = '0066' + phone.replace(/\D/g, '').replace(/^0/, '');
    const body = tlv('00', '01') + tlv('01', amount ? '12' : '11')
      + tlv('29', tlv('00', 'A000000677010111') + tlv('01', proxy)) + tlv('53', '764')
      + (amount ? tlv('54', Number(amount).toFixed(2)) : '') + tlv('58', 'TH') + '6304';
    return body + crc16(body);
  }

  // ---- SlipOK adapter — MOCK. ⚠ Request/response field names UNVERIFIED (spec §15.3): this adapter is the one place to correct. ----
  // Real flow ⛔: slip image/QR data -> POST to SlipOK with the shop's secret key, from a server (never from a static page).
  const SlipOK = {
    makeSlip(amount, kind, receiver, seq) {            // what the borrower's bank app would produce
      const ref = kind === 'duplicate' ? 'REF-DUP-0001' : 'REF' + String(seq).padStart(8, '0');
      return { transRef: ref, amount: kind === 'wrongAmount' ? r2(amount - 1) : r2(amount), transDate: '20250925', transTime: '10:15:00',
               sender: { displayName: 'Sample Borrower', account: 'xxx-x-x1234-x' }, receiver: { account: kind === 'wrongReceiver' ? 'xxx-x-x9999-x' : receiver } };
    },
    verify(slip, expect, seenRefs) {                   // expect = { amount, receiver }
      if (seenRefs.includes(slip.transRef)) return { success: false, code: 'DUPLICATE_SLIP', message: 'slip already used' };
      if (slip.receiver.account !== expect.receiver) return { success: false, code: 'RECEIVER_MISMATCH', message: 'paid to another account' };
      if (r2(slip.amount) !== r2(expect.amount)) return { success: false, code: 'AMOUNT_MISMATCH', message: `slip ${slip.amount} ≠ expected ${expect.amount}` };
      return { success: true, data: { transRef: slip.transRef, amount: slip.amount, transDate: slip.transDate, transTime: slip.transTime, sender: slip.sender, receiver: slip.receiver } };
    }
  };

  root.Pay = { fold, quote, interestTo, promptpay, crc16, SlipOK, r2, VAT };
  if (typeof module !== 'undefined') module.exports = root.Pay;
})(typeof window !== 'undefined' ? window : globalThis);
