// Due-date reminders (spec §20.6): open tickets due within N days or overdue, a prepared per-person message in the chosen channel,
// consented contacts only, the shop presses send. Preparing a reminder is logged as a follow-up event (CRM chain).
window.Reminders = (function () {
  const P = window.Pay, C = window.Calc, Net = window.Net, K = { normPhone: x => window.Contacts.normPhone(x), link: (a, b, c) => window.Contacts.link(a, b, c) };
  const isOpen = r => r.status === 'active' || r.status === 'overdue';
  // rows: Dash.rows(); returns open tickets with dueIn (days until due; negative = overdue), sorted: overdue first (most overdue first), then soonest
  function list(rows, today, n) {
    return rows.filter(isOpen).map(r => ({ r, dueIn: C.daysBetween(today, r.st.due) })).filter(x => x.dueIn <= n).sort((a, b) => a.dueIn - b.dueIn);
  }
  const contactFor = (contacts, phone) => { const p = K.normPhone(phone); return p ? contacts.find(c => c.phone === p.n) || null : null; };
  const consented = c => !!c && c.consent === 'Y';
  // the message carries THIS ticket's own figures (interest to date, redeem total, next installment) and the legal-rate line
  function message(lang, x, shop, set) {
    const st = x.r.st, s = set || {}, fq = P.quote(st, 'full', 0, Net.today, s), iq = P.quote(st, 'installment', 0, Net.today, s), f = n => Math.round(n).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US'), nm = lang === 'en' ? String(st.name || 'customer').replace(/^ลูกค้าตัวอย่าง (\d+)$/, 'Sample customer $1') : (st.name || 'ลูกค้า');
    const when = x.dueIn < 0 ? (lang === 'th' ? `เกินกำหนดมา ${-x.dueIn} วัน` : `${-x.dueIn} days overdue`) : x.dueIn === 0 ? (lang === 'th' ? 'ครบกำหนดวันนี้' : 'due today') : (lang === 'th' ? `ครบกำหนดอีก ${x.dueIn} วัน` : `due in ${x.dueIn} days`);
    const dd = st.due;
    return lang === 'th'
      ? `เรียนคุณ${nm} ตั๋วขายฝาก ${st.no} ของ ${shop} ครบกำหนด ${dd} (${when}) ดอกเบี้ยค้างถึงวันนี้ ${f(fq.int)} บาท ไถ่ถอนทั้งหมด ${f(fq.total)} บาท หรือส่งดอกเบี้ยงวดถัดไป ${f(iq.total)} บาท อัตราดอกเบี้ยไม่เกินกฎหมายกำหนด 15% ต่อปี ติดต่อร้านได้เลย`
      : `Dear ${nm}, your pawn ticket ${st.no} at ${shop} is due on ${dd} (${when}). Interest owed to date: ${f(fq.int)} baht. To redeem in full: ${f(fq.total)} baht, or pay the next installment: ${f(iq.total)} baht. The rate is held to the legal limit of 15% a year. Please contact the shop.`;
  }
  function prepare(items, channel, lang, contacts, shop, set) {
    const msgs = [], noConsent = [], noWay = [];
    for (const x of items) {
      const c = contactFor(contacts, x.r.st.phone);
      if (!consented(c)) { noConsent.push(x); continue; }
      const text = message(lang, x, shop, set), href = K.link(channel, c, text);
      (href ? msgs : noWay).push({ x, c, text, href });
    }
    return { msgs, noConsent, noWay };
  }
  async function log(tk, channel, note) { return Net.logFollowup(tk, { DateContact: Net.today, Channel: channel, Outcome: 'reminder', Note: note || 'reminder prepared', DateNext: '' }); }
  return { list, message, prepare, contactFor, consented, log };
})();
