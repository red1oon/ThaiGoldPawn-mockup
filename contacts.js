// Contacts: import from Excel / CSV / vCard / Google CSV / LINE / phone picker, de-duplicate, then prepare an offer or news for an audience (spec §15.13).
// Logic here is pure (tested in node); the view + file handling is at the bottom. Data model = AD rows PAWN_Contact / PAWN_Broadcast (ad_pawn.js).
(function (root) {
  // ---------- phone numbers (Thailand) ----------
  // Accepts 0812345678, 081-234-5678, +66 81 234 5678, 0066812345678, 66812345678. Returns { n: '0812345678', mobile: bool } or null.
  function normPhone(s) {
    let d = String(s == null ? '' : s).replace(/[^\d+]/g, '');
    if (d.startsWith('+66')) d = '0' + d.slice(3); else if (d.startsWith('0066')) d = '0' + d.slice(4); else if (/^66\d{9}$/.test(d)) d = '0' + d.slice(2);
    d = d.replace(/\D/g, '');
    if (/^0[689]\d{8}$/.test(d)) return { n: d, mobile: true };          // mobile: 10 digits, 06/08/09
    if (/^0\d{8}$/.test(d)) return { n: d, mobile: false };              // landline: 9 digits
    return null;
  }
  const intl = n => '66' + n.slice(1);                                    // for wa.me

  // ---------- table parsing ----------
  function parseDelimited(text) {
    text = String(text).replace(/^﻿/, '');
    const first = text.split(/\r?\n/).find(l => l.trim()) || '', cnt = c => (first.match(new RegExp(c === '\t' ? '\t' : '\\' + c, 'g')) || []).length;
    const delim = cnt('\t') >= cnt(',') && cnt('\t') >= cnt(';') ? '\t' : cnt(';') > cnt(',') ? ';' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
      else cur += c;
    }
    row.push(cur); if (row.some(x => x.trim() !== '')) rows.push(row);
    return rows;
  }
  const norm = s => String(s || '').toLowerCase().replace(/[\s_\-.:()]/g, '');
  const ALIAS = {
    name: ['name', 'fullname', 'customer', 'customername', 'displayname', 'contact', 'ชื่อ', 'ชื่อนามสกุล', 'ชื่อลูกค้า', 'ลูกค้า'],
    first: ['firstname', 'givenname', 'ชื่อจริง'], last: ['lastname', 'familyname', 'surname', 'นามสกุล'],
    phone: ['phone', 'mobile', 'tel', 'telephone', 'phonenumber', 'mobilephone', 'cell', 'phone1value', 'mobilenumber', 'เบอร์', 'เบอร์โทร', 'โทร', 'โทรศัพท์', 'มือถือ'],
    email: ['email', 'emailaddress', 'e-mail', 'email1value', 'อีเมล'], line: ['line', 'lineid', 'lineuserid', 'userid'],
    address: ['address', 'ที่อยู่'], consent: ['consent', 'marketing', 'marketingconsent', 'consenttomarketing', 'optin', 'agree', 'ยินยอม', 'ยินยอมรับข่าวสาร']
  };
  function mapHeader(h) { const k = norm(h); for (const f of Object.keys(ALIAS)) if (ALIAS[f].map(norm).includes(k)) return f; return null; }
  const YES = /^(y|yes|true|1|ok|agree|ยินยอม|ใช่|✓|x)$/i;
  // rows (arrays, first row = header) -> raw contact objects + the column mapping that was detected
  function fromTable(rows) {
    if (!rows.length) return { items: [], mapping: [] };
    const head = rows[0], map = head.map(mapHeader), hasHeader = map.some(Boolean);
    if (!hasHeader) { map.length = 0; head.forEach((_, i) => map.push(i === 0 ? 'name' : i === 1 ? 'phone' : i === 2 ? 'email' : null)); }
    const body = hasHeader ? rows.slice(1) : rows, items = [];
    for (const r of body) {
      const o = {}; map.forEach((f, i) => { if (f && r[i] != null && String(r[i]).trim() !== '') o[f] = String(r[i]).trim(); });
      if (!o.name && (o.first || o.last)) o.name = [o.first, o.last].filter(Boolean).join(' ');
      if (o.name || o.phone || o.email || o.line) items.push({ name: o.name || '', phone: o.phone || '', email: o.email || '', line: o.line || '', address: o.address || '', consent: o.consent == null ? null : YES.test(o.consent) });
    }
    return { items, mapping: head.map((h, i) => ({ header: h, field: map[i] })) };
  }
  // ---------- vCard (phone contact export) ----------
  function parseVCF(text) {
    const lines = String(text).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n'), items = []; let cur = null;
    for (const l of lines) {
      if (/^BEGIN:VCARD/i.test(l)) cur = { name: '', tels: [], email: '', address: '', line: '' };
      else if (/^END:VCARD/i.test(l)) { if (cur) { const t = cur.tels.find(x => (normPhone(x) || {}).mobile) || cur.tels[0] || ''; items.push({ name: cur.name, phone: t, email: cur.email, line: cur.line, address: cur.address, consent: null }); } cur = null; }
      else if (cur) {
        const m = /^([A-Za-z.\-]+)([^:]*):(.*)$/.exec(l); if (!m) continue; const k = m[1].replace(/^item\d+\./i, '').toUpperCase(), v = m[3].trim();
        if (k === 'FN') cur.name = v; else if (k === 'N' && !cur.name) cur.name = v.split(';').reverse().filter(Boolean).join(' ').trim();
        else if (k === 'TEL') cur.tels.push(v); else if (k === 'EMAIL' && !cur.email) cur.email = v; else if (k === 'ADR' && !cur.address) cur.address = v.split(';').filter(Boolean).join(' ');
        else if (k === 'X-LINE' || (k === 'URL' && /line\.me/.test(v))) cur.line = v;
      }
    }
    return items;
  }
  // ---------- LINE ----------
  // LINE does not give a shop a phone-number list. Two things a shop can actually hold: follower user IDs (Messaging API "get follower IDs",
  // JSON { userIds:[…] } or [{userId, displayName}]) and a chat-history export (.txt: time <TAB> name <TAB> text). IDs match U + 32 hex.
  function parseLine(text) {
    const t = String(text).trim(), items = [], seen = new Set();
    try {
      const j = JSON.parse(t), arr = Array.isArray(j) ? j : j.userIds || j.followers || [];
      for (const e of arr) { const id = typeof e === 'string' ? e : e.userId, nm = typeof e === 'string' ? '' : (e.displayName || e.name || ''); if (/^U[0-9a-f]{32}$/.test(id) && !seen.has(id)) { seen.add(id); items.push({ name: nm, phone: '', email: '', line: id, address: '', consent: null }); } }
      if (items.length) return items;
    } catch (e) { /* not JSON */ }
    const ids = t.match(/\bU[0-9a-f]{32}\b/g);
    if (ids) { ids.forEach(id => { if (!seen.has(id)) { seen.add(id); items.push({ name: '', phone: '', email: '', line: id, address: '', consent: null }); } }); return items; }
    const names = new Set();                                              // chat export: "10:15<TAB>Display Name<TAB>message"
    for (const l of t.split(/\r?\n/)) { const m = /^\d{1,2}:\d{2}\t([^\t]{1,60})\t/.exec(l); if (m && !/^(You|Unsent|Voice call|Group call)/i.test(m[1])) names.add(m[1].trim()); }
    names.forEach(n => items.push({ name: n, phone: '', email: '', line: '', address: '', consent: null }));
    return items;
  }

  // ---------- ingest: normalise, validate, de-duplicate ----------
  // existing = current contact list; customers = Map(phone -> row) of people who already have a ticket
  function ingest(items, source, existing, customers) {
    const out = [], st = { read: items.length, added: 0, merged: 0, invalid: 0, noPhone: 0, existingCustomers: 0, withLine: 0 };
    const byPhone = new Map(), byEmail = new Map(), byLine = new Map();
    const reg = c => { if (c.phone) byPhone.set(c.phone, c); if (c.email) byEmail.set(c.email, c); if (c.lineUserId) byLine.set(c.lineUserId, c); };
    existing.forEach(reg);
    for (const it of items) {
      const p = it.phone ? normPhone(it.phone) : null, email = (it.email || '').toLowerCase(), line = it.line || '';
      const bad = !!(it.phone && !p); if (bad) st.invalid++;
      const hit = (p && byPhone.get(p.n)) || (email && byEmail.get(email)) || (line && byLine.get(line));
      if (hit) {                                                          // same person: fill blanks, never overwrite, never downgrade consent
        if (!hit.name && it.name) hit.name = it.name; if (!hit.email && email) hit.email = email; if (!hit.lineUserId && line) hit.lineUserId = line; if (!hit.phone && p) hit.phone = p.n;
        if (it.consent === true && hit.consent !== 'Y' && hit.consent !== 'N') hit.consent = 'Y';
        reg(hit); st.merged++; continue;
      }
      if (!p && !email && !line) { if (!bad) st.noPhone++; continue; }
      const c = { Name: it.name || '', Phone: p ? p.n : '', Email: email, LineUserId: line, Source: source, Consent: it.consent === true ? 'Y' : 'N', mobile: !!(p && p.mobile), Address: it.address || '' };
      const cc = { name: c.Name, phone: c.Phone, email: c.Email, lineUserId: c.LineUserId, source, consent: c.Consent, mobile: c.mobile, address: c.Address };
      reg(cc); out.push(cc); st.added++;
      if (cc.phone && customers && customers.has(cc.phone)) st.existingCustomers++;
      if (cc.lineUserId) st.withLine++;
    }
    return { added: out, stats: st };
  }

  // ---------- broadcast ----------
  // audience of CONSENTED contacts only (PDPA: marketing needs consent) — contacts without consent are counted but never included
  function audience(kind, contacts, customers) {
    const consented = contacts.filter(c => c.consent === 'Y'), isCust = c => c.phone && customers.has(c.phone);
    const pick = { all: consented, customers: consented.filter(isCust), prospects: consented.filter(c => !isCust(c)), green: consented.filter(c => isCust(c) && customers.get(c.phone).risk === 'green') }[kind] || [];
    return { list: pick, excluded: contacts.length - consented.length };
  }
  function message(kind, lang, c, customers, shop, body) {
    const row = c.phone && customers.get(c.phone), name = c.name || (lang === 'th' ? 'ลูกค้า' : 'customer'), amt = row && row.upsell;
    const fmtN = n => Math.round(n).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US');
    if (kind === 'offer') {
      return lang === 'th'
        ? `เรียนคุณ${name} ${shop} เสนอวงเงินเพิ่ม${amt ? 'ได้สูงสุด ' + fmtN(amt) + ' บาท' : ''} ${amt ? 'จากทรัพย์ที่ขายฝากอยู่ ' : 'สำหรับการขายฝากทอง '}อัตราผลประโยชน์ไม่เกิน 15% ต่อปีตามกฎหมาย สนใจติดต่อร้านได้เลย`
        : `Dear ${name}, ${shop} can offer ${amt ? 'an additional loan of up to ' + fmtN(amt) + ' baht against your current collateral' : 'gold pawn loans'}. The rate is held to the legal limit of 15% a year. Please contact the shop if you are interested.`;
    }
    return lang === 'th' ? `เรียนคุณ${name} ข่าวจาก ${shop}: ${body}` : `Dear ${name}, news from ${shop}: ${body}`;
  }
  function link(channel, c, text) {
    const q = encodeURIComponent(text);
    if (channel === 'whatsapp') return c.phone ? `https://wa.me/${intl(c.phone)}?text=${q}` : null;
    if (channel === 'sms') return c.phone && c.mobile ? `sms:${c.phone}?&body=${q}` : null;
    if (channel === 'email') return c.email ? `mailto:${c.email}?subject=${encodeURIComponent('News')}&body=${q}` : null;
    if (channel === 'line') return `https://line.me/R/msg/text/?${q}`;       // opens LINE's friend picker; a stored LINE user ID alone cannot be messaged without a server + official account
    return null;
  }
  function prepareFor(audKey, kind, channel, lang, contacts, customers, shop, body) {
    const a = audience(audKey, contacts, customers), msgs = [], skipped = [];
    for (const c of a.list) {
      const text = message(kind, lang, c, customers, shop, body), href = link(channel, c, text);
      (href ? msgs : skipped).push({ c, text, href, status: 'prepared' });
    }
    return { msgs, skipped, excludedNoConsent: a.excluded, audienceSize: a.list.length };
  }

  const api = { normPhone, parseDelimited, fromTable, parseVCF, parseLine, ingest, audience, message, link, prepareFor, mapHeader };
  root.Contacts = Object.assign(root.Contacts || {}, api);
  if (typeof module !== 'undefined') module.exports = root.Contacts;
})(typeof window !== 'undefined' ? window : globalThis);
