// Borrower payment (spec §15.3): quote (full / installment / other amount), PromptPay QR payload, SlipOK adapter (MOCK).
(function (root) {
  const C = root.Calc || (typeof require === 'function' ? require('./calc.js') : null) || root.Calc;
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const VAT = 0.07;

  // ---- fold: ledger events -> current ticket state (never stored totals, §9) ----
  function fold(ledger, today) {
    const evs = [...ledger.chain.shop, ...ledger.chain.phone].sort((a, b) => a.ts - b.ts || (a.by < b.by ? -1 : 1));
    const st = { no: ledger.tk, acked: false, paid: [], closed: null, claims: [], seenRefs: [], attachments: [] };
    for (const e of evs) {
      const b = e.body;
      if (e.type === 'offer') Object.assign(st, b, { principal: b.loan, paidTo: b.date, credit: 0, untaxed: 0, due: C.edate(b.date, b.months) });
      else if (e.type === 'ack') { st.acked = true; st.ackAt = e.ts; }
      else if (e.type === 'payment_claim') st.claims.push({ ...b, ts: e.ts, n: e.n, status: 'pending' });
      else if (e.type === 'payment_verified') {
        st.principal = r2(st.principal - b.principalPart); st.paidTo = b.coverTo; st.credit = b.credit; st.untaxed = b.untaxed;
        st.paid.push({ ...b, ts: e.ts }); st.seenRefs.push(b.slip && b.slip.transRef); if (b.attachment) st.attachments.push({ ...b.attachment, claimNo: b.claimNo, ts: e.ts });
        const c = st.claims.find(x => x.claimNo === b.claimNo); if (c) c.status = 'verified';
      } else if (e.type === 'payment_wait') { const c = st.claims.find(x => x.claimNo === b.claimNo); if (c) { c.status = 'waiting'; c.reason = b.code; c.message = b.message; c.shopAlert = !!b.shopAlert; }
      } else if (e.type === 'payment_rejected') { const c = st.claims.find(x => x.claimNo === b.claimNo); if (c) { c.status = 'rejected'; c.reason = b.reason; c.message = b.message; } }
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

  // ---- SlipOK adapter — MOCK of the real API's request and response SHAPE (spec §15.3) ----
  // Shape source: third-party SDK PrakritManStudio/slipok-sdk src/types/index.ts, which mirrors SlipOK's API docs v1.8 (2024-07-30); slipok.com itself
  // returned HTTP 403 to my fetcher (2026-10-18). ⚠ re-check against the live docs + a real branch before production.
  // Real call ⛔: POST https://api.slipok.com/api/line/apikey/{branchId}, header x-authorization: <key>; body = ONE of data (QR string) | files (image) | url,
  //   plus optional amount (checks vs the slip, else code 1013) and log (true = SlipOK stores it, so a re-sent slip returns 1012). Runs on a server only.
  const BANKS = { '002': 'BBL', '004': 'KBANK', '006': 'KTB', '011': 'TTB', '014': 'SCB', '025': 'BAY', '069': 'KKP', '022': 'CIMBT', '067': 'TISCO', '024': 'UOBT', '071': 'TCD', '073': 'LHFG', '070': 'ICBCT', '098': 'SME', '034': 'BAAC', '035': 'EXIM', '030': 'GSB', '033': 'GHB' };
  const MSG = { 1000: 'QR data, files or url is required', 1001: 'branch not found', 1002: 'invalid Authorization header', 1003: 'package expired', 1004: 'package over quota',
    1005: 'not an image file', 1006: 'invalid image', 1007: 'no QR code in the image', 1008: 'not a payment-verification QR', 1009: 'bank data temporarily unavailable, retry in 15 minutes (no quota used)',
    1010: 'slip too fresh for this bank, wait before checking', 1011: 'QR expired or no such transaction', 1012: 'duplicate slip', 1013: 'amount does not match the slip', 1014: 'receiver is not the shop main account' };
  const SlipOK = {
    BANKS, MSG, WAIT_CODES: ['1003', '1004', '1009', '1010'],
    makeSlip(amount, kind, receiver, seq) {            // what the borrower's bank app would produce (mock)
      const ref = kind === 'duplicate' ? 'REF-DUP-0001' : 'REF' + String(seq).padStart(8, '0');
      return { kind: kind || 'ok', qrData: kind === 'noQR' ? '' : 'MOCKQR|' + ref + '|' + r2(amount), transRef: ref, amount: kind === 'wrongAmount' ? r2(amount - 1) : r2(amount),
        transDate: '20250925', transTime: '10:15:00', sendingBank: '004', receivingBank: '014',
        sender: { displayName: 'Sample Borrower', name: 'SAMPLE BORROWER', account: 'xxx-x-x1234-x' }, receiver: { account: kind === 'wrongReceiver' ? 'xxx-x-x9999-x' : receiver } };
    },
    // req = { data | files | url, amount?, log }, store = { refs:{transRef: iso}, attempts:{transRef: n} } (SlipOK's side), cfg = { shopAcct, package: 'ok'|'expired'|'overquota' }
    call(slip, req, store, cfg) {
      const err = (code, data) => ({ success: false, code: String(code), message: MSG[code], ...(data ? { data } : {}) });
      if (cfg.package === 'expired') return err(1003); if (cfg.package === 'overquota') return err(1004);
      if (!req.data && !req.files && !req.url) return err(1000);
      if (!slip.qrData) return err(1007);
      const n = store.attempts[slip.transRef] = (store.attempts[slip.transRef] || 0) + 1;
      if (slip.kind === 'bankDown' && n === 1) return err(1009);
      if (slip.kind === 'tooFresh' && n === 1) return { success: false, code: '1010', message: MSG[1010], data: { qrcodeData: slip.qrData, bankCode: '014', bankName: 'SCB', delay: 5 } };
      const data = { success: 'true', message: '', rqUID: 'MOCK-' + slip.transRef, language: 'TH', transRef: slip.transRef, sendingBank: slip.sendingBank, receivingBank: slip.receivingBank,
        transDate: slip.transDate, transTime: slip.transTime, transTimestamp: '2025-09-25T10:15:00+07:00',
        sender: { displayName: slip.sender.displayName, name: slip.sender.name, proxy: { type: null, value: null }, account: { type: 'BANKAC', value: slip.sender.account } },
        receiver: { displayName: 'Sample Shop', name: 'SAMPLE SHOP', proxy: { type: null, value: null }, account: { type: 'BANKAC', value: slip.receiver.account } },
        amount: slip.amount, paidLocalAmount: slip.amount, paidLocalCurrency: 'THB', countryCode: 'TH', transFeeAmount: 0, ref1: '', ref2: '', ref3: '', toMerchantId: '' };
      if (req.log && store.refs[slip.transRef]) return err(1012, data);                    // log:true -> SlipOK remembers every slip it has accepted
      if (req.amount != null && r2(req.amount) !== r2(slip.amount)) return err(1013, data);
      if (slip.receiver.account !== cfg.shopAcct) return err(1014, data);
      if (req.log) store.refs[slip.transRef] = new Date().toISOString();
      return { success: true, data };
    }
  };

  // ---- NPL / green list (spec §15.7) — all from the fold, thresholds are branch settings ----
  const open = st => st.status === 'active' || st.status === 'overdue';
  function arrears(st, today) {
    return { overdueDays: Math.max(0, C.daysBetween(st.due, today)), lateDays: Math.max(0, C.daysBetween(C.edate(st.paidTo, 1), today)) };
  }
  const ceilingNow = (st, price) => r2(st.weight / C.GRAM_PER_BAHT * price * (st.pct || 85) / 100);
  const upsell = (st, price) => Math.max(0, r2(ceilingNow(st, price) - st.principal));
  function classify(st, today, o) {
    o = o || {}; if (!open(st)) return null;
    const a = arrears(st, today), npl = o.npl == null ? 90 : o.npl;
    if (a.overdueDays > npl) return 'npl';
    if (a.overdueDays > 0 || a.lateDays > 0) return 'watch';
    return st.paid.length >= 1 && upsell(st, o.price || 0) > 0 ? 'green' : 'ok';
  }

  root.Pay = { arrears, ceilingNow, upsell, classify, fold, quote, interestTo, promptpay, crc16, SlipOK, r2, VAT };
  if (typeof module !== 'undefined') module.exports = root.Pay;
})(typeof window !== 'undefined' ? window : globalThis);
