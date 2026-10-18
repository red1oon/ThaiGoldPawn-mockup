// Opening balances import (spec §20.2): live tickets from the shop's existing records. No history is invented: one signed `offer`
// (marked opening) + one `opening` event carrying paidTo/principal per ticket. Validation first; nothing partial is applied.
(function (root) {
  const C = root.Calc, T = root.Token, P = root.Pay, K = root.Contacts, Net = root.Net;
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9฀-๿]/g, '');
  const ALIAS = { ticketNo: ['ticketno', 'ticket', 'no', 'เลขที่ตั๋ว', 'เลขที่', 'เลขตั๋ว'], date: ['date', 'issuedate', 'วันที่', 'วันที่ออก'], name: ['name', 'customer', 'ชื่อ', 'ชื่อลูกค้า', 'ชื่อสกุล'], phone: ['phone', 'tel', 'mobile', 'โทรศัพท์', 'เบอร์', 'เบอร์โทร'],
    loan: ['loan', 'principal', 'amount', 'เงินต้น', 'มูลค่าขายฝาก', 'ยอดขายฝาก', 'ยอด'], months: ['months', 'term', 'เดือน', 'จำนวนเดือน'], rate: ['rate', 'อัตรา'], grp: ['group', 'rategroup', 'กลุ่มอัตรา', 'กลุ่ม'],
    paidTo: ['paidto', 'interestpaidto', 'ชำระดอกเบี้ยถึง', 'ชำระถึง'], category: ['category', 'collateral', 'ประเภท', 'ประเภททรัพย์'], weightG: ['weight', 'weightg', 'น้ำหนัก', 'กรัม'], locator: ['locator', 'location', 'ที่เก็บ', 'ช่องเก็บ'] };
  const CAT = { ornament: ['ornament', 'ทองรูปพรรณ', 'รูปพรรณ'], bar: ['bar', 'ทองแท่ง', 'แท่ง'], silver: ['silver', 'เงิน'], other: ['other', 'อื่นๆ', 'อื่น'] };
  const catOf = v => { const k = norm(v); if (!k) return 'other'; for (const c of Object.keys(CAT)) if (CAT[c].map(norm).includes(k)) return c; return null; };
  function mapHeader(h) { const k = norm(h); for (const f of Object.keys(ALIAS)) if (ALIAS[f].map(norm).includes(k)) return f; return null; }
  function parseDate(s) {                                               // YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY (Buddhist year 25xx accepted)
    s = String(s == null ? '' : s).trim(); let y, m, d, x;
    if ((x = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) { y = +x[1]; m = +x[2]; d = +x[3]; } else if ((x = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s))) { d = +x[1]; m = +x[2]; y = +x[3]; } else return null;
    if (y > 2400) y -= 543; const dt = new Date(Date.UTC(y, m - 1, d)); if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt.toISOString().slice(0, 10);
  }
  function fromRows(rows) {                                             // rows: array of arrays, first row = header
    const hdr = (rows[0] || []).map(mapHeader), items = [];
    for (let i = 1; i < rows.length; i++) { const r = rows[i]; if (!r || r.every(c => String(c == null ? '' : c).trim() === '')) continue; const o = { _row: i + 1 }; hdr.forEach((f, j) => { if (f) o[f] = r[j]; }); items.push(o); }
    return { items, mapping: hdr, missingCols: ['ticketNo', 'date', 'loan'].filter(f => !hdr.includes(f)) };
  }
  // validate every row; returns {ok:[normalised], bad:[{row, tk, why}]}
  function validate(items, ctx) {
    ctx = ctx || {}; const today = ctx.today || Net.today, existing = new Set(ctx.existing || Object.keys(Net.all())), seen = new Set(), ok = [], bad = [], set = ctx.set || Net.set || {};
    for (const it of items) {
      const tk = String(it.ticketNo == null ? '' : it.ticketNo).trim(), why = [];
      if (!tk) why.push('ticketNo'); else if (existing.has(tk)) why.push('duplicate-existing'); else if (seen.has(tk)) why.push('duplicate-in-file');
      const date = parseDate(it.date); if (!date) why.push('date'); else if (date > today) why.push('date-future');
      const loan = Number(String(it.loan == null ? '' : it.loan).replace(/,/g, '')); if (!(loan > 0)) why.push('loan');
      let months = it.months === undefined || it.months === '' ? (+set.defMonths || 4) : Number(it.months); if (!(months >= 1 && months <= 36)) why.push('months');
      const paidTo = it.paidTo === undefined || it.paidTo === '' ? date : parseDate(it.paidTo); if (!paidTo) { if (date) why.push('paidTo'); } else if (date && date <= today && (paidTo < date || paidTo > today)) why.push('paidTo-range');
      const cat = catOf(it.category); if (!cat) why.push('category');
      const weight = it.weightG === undefined || it.weightG === '' ? 0 : Number(it.weightG); if (isNaN(weight) || weight < 0) why.push('weight');
      let rate = null; if (it.rate !== undefined && it.rate !== '') { rate = Number(it.rate); if (!(rate > 0)) why.push('rate'); }
      if (why.length) { bad.push({ row: it._row, tk, why }); continue; }
      seen.add(tk);
      const grp = ['standard', 'vip', 'supervip', 'relative'].includes(String(it.grp || '').trim()) ? String(it.grp).trim() : 'standard';
      const legal = C.LEGAL.maxMonthly, r = rate == null ? C.rateFor(grp, loan) : Math.min(rate, legal);
      const np = K && it.phone ? K.normPhone(it.phone) : null, phone = np && np.n ? np.n : String(it.phone || '');
      ok.push({ row: it._row, tk, date, name: String(it.name || '').trim(), phone, loan, months, rate: r, rateCapped: rate != null && rate > legal, grp, paidTo, cat, weight, locator: String(it.locator || '').trim(), kycMissing: loan >= (+set.kycAt || C.LIMITS.kycAt) });
    }
    return { ok, bad };
  }
  // one signed offer (opening) + one opening event per valid row, on a fresh ledger; then ONE signed import event (file, sha256, counts)
  async function commit(valid, meta) {
    { const g = root.Auth && root.Auth.check('openingImport'); if (g && !g.ok) return { added: 0, principal: 0, denied: true }; }
    const set = Net.set || {}; let n = 0, principal = 0;
    for (const v of valid) {
      const l = new T.Ledger(v.tk, 'shop', Net.keys.shop); l.live = true, t0 = Date.parse(v.date + 'T09:00:00Z');
      await l.append('offer', { name: v.name, phone: v.phone, address: '', cat: v.cat, item: v.cat, qty: 1, weight: v.weight, grp: v.grp, ceiling: v.loan, pct: 85, loan: v.loan, headroom: 0, rate: v.rate, basis: set.basis || 'month', rounding: set.rounding || 'half', date: v.date, months: v.months,
        tender: 'cash', opening: true, pub: T.pubOf(Net.keys.shop.pub), code: '000000', shopAcct: Net.shopAcct, shopPhone: Net.shopPhone }, t0);
      await l.append('opening', { paidTo: v.paidTo, principal: v.loan, source: meta && meta.file || '' }, t0 + 1000);
      Net.shopL[v.tk] = l; n++; principal += v.loan;
    }
    Net.persist(); const e = await Net.logInternal('_open', 'opening_import', { file: meta && meta.file || '', sha256: meta && meta.sha || '', read: meta && meta.read || valid.length, added: n, invalid: meta && meta.invalid || 0, principal }); Net.emit();
    return { added: n, principal, event: e };
  }
  const TEMPLATE = 'ticketNo,date,name,phone,loan,months,rate,group,paidTo,category,weightG,locator\nA9001,2025-08-01,Sample customer,0810000001,50000,4,1.25,standard,2025-09-01,ornament,7.58,A-01-1\nA9002,01/09/2025,Sample customer 2,0810000002,120000,4,,vip,01/09/2025,bar,22.74,\n';
  root.Opening = { ALIAS, fromRows, validate, commit, parseDate, catOf, TEMPLATE };
})(typeof window !== 'undefined' ? window : globalThis);
