// Contacts tab (spec §15.13): import (Excel / CSV / phone contacts / LINE / picker / paste) -> review -> list -> prepare an offer or news.
// Form fields, grid columns and list options come from the AD rows PAWN_Contact / PAWN_Broadcast. Every import and broadcast is a signed, shop-internal event.
window.ContactsView = (function () {
  const K = window.Contacts, AD = window.AD, Net = window.Net, Dash = window.Dash, T = window.Token;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const C = { list: [], stage: null, prepared: null, form: { Kind: 'offer', Audience: 'green', Channel: 'whatsapp', Title: '', Body: '' }, filter: '', msg: '' };
  try { const j = JSON.parse(store.get('gp.contacts')); if (Array.isArray(j)) C.list = j; } catch (e) {}
  const save = () => store.set('gp.contacts', JSON.stringify(C.list));
  const lang = () => S.lang, gl = c => lang() === 'th' ? c.th : c.Name;
  const lab = (list, v) => AD.label(list, v, lang());
  const shop = () => t('ticketHead');

  // people who already have a ticket: phone -> { tk, risk, upsell }
  function customers() {
    const m = new Map();
    Dash.rows().forEach(r => { const p = K.normPhone(r.st.phone); if (p && !m.has(p.n)) m.set(p.n, { tk: r.tk, risk: r.risk, upsell: r.upsell, status: r.status }); });
    return m;
  }

  // ---------- reading files ----------
  const loadXLSX = () => window.XLSX ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'lib/xlsx.full.min.js'; s.onload = ok; s.onerror = () => no(new Error('xlsx')); document.head.appendChild(s); });
  async function sha256(buf) { const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
  async function readFile(kind, file) {
    const buf = await file.arrayBuffer(), sha = await sha256(buf), name = file.name, ext = (name.split('.').pop() || '').toLowerCase();
    let items = [], mapping = [], source = kind;
    if (kind === 'excel') {
      if (ext === 'xlsx' || ext === 'xls') { await loadXLSX(); const wb = XLSX.read(new Uint8Array(buf), { type: 'array' }); const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }); ({ items, mapping } = K.fromTable(rows)); source = 'excel'; }
      else { ({ items, mapping } = K.fromTable(K.parseDelimited(new TextDecoder().decode(buf)))); source = 'csv'; }
    } else if (kind === 'vcf') {
      const text = new TextDecoder().decode(buf);
      if (/BEGIN:VCARD/i.test(text)) items = K.parseVCF(text); else ({ items, mapping } = K.fromTable(K.parseDelimited(text)));
      source = 'vcf';
    } else if (kind === 'line') { items = K.parseLine(new TextDecoder().decode(buf)); source = 'line'; }
    return { source, name, sha, bytes: buf.byteLength, items, mapping };
  }
  function stageBatch(b) {
    const res = K.ingest(b.items, b.source, C.list, customers());
    // ingest mutates matched existing contacts (fills blanks); the new ones are held until the shop confirms
    C.stage = { ...b, added: res.added, stats: res.stats, agreed: false };
  }
  async function file(el) {
    const f = el.files && el.files[0]; if (!f) return;
    try { stageBatch(await readFile(el.dataset.ctFile, f)); C.msg = ''; } catch (e) { C.msg = '⚠ ' + t('ctReadFail') + ' ' + f.name; }
    el.value = '';
  }
  function paste() {
    const text = (document.getElementById('ct_paste') || {}).value || ''; if (!text.trim()) return;
    let items, mapping = [];
    if (/BEGIN:VCARD/i.test(text)) items = K.parseVCF(text); else ({ items, mapping } = K.fromTable(K.parseDelimited(text)));
    stageBatch({ source: 'csv', name: t('ctPasted'), sha: '', bytes: text.length, items, mapping });
  }
  async function picker() {
    try { const r = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true });
      stageBatch({ source: 'picker', name: t('ctPicker'), sha: '', bytes: 0, items: r.map(c => ({ name: (c.name || [])[0] || '', phone: (c.tel || [])[0] || '', email: (c.email || [])[0] || '', line: '', address: '', consent: null })), mapping: [] });
    } catch (e) { C.msg = '⚠ ' + t('ctPickFail'); }
  }
  async function confirmBatch() {
    const b = C.stage; if (!b) return;
    if (b.agreed) b.added.forEach(c => { if (c.consent !== 'Y') c.consent = 'Y'; });
    C.list.push(...b.added); save();
    await Net.logContact('import', { source: b.source, file: b.name, sha256: b.sha, read: b.stats.read, added: b.stats.added, merged: b.stats.merged, invalid: b.stats.invalid, agreedAll: !!b.agreed });
    C.msg = t('ctAdded') + ' ' + b.stats.added; C.stage = null;
  }
  async function prepare() {
    const f = C.form, cust = customers(), body = f.Body || t('ctDefaultNews');
    const r = K.prepareFor(f.Audience, f.Kind, f.Channel, lang(), C.list, cust, shop(), body);
    C.prepared = { ...r, form: { ...f } };
    await Net.logContact('broadcast', { kind: f.Kind, audience: f.Audience, channel: f.Channel, title: f.Title || t('ct_kind_' + f.Kind), prepared: r.msgs.length, noAddress: r.skipped.length, excludedNoConsent: r.excludedNoConsent, lang: lang() });
  }

  // ---------- view ----------
  const optList = (list, sel) => AD.list(list).map(o => `<option value="${o.Value}" ${o.Value === sel ? 'selected' : ''}>${lang() === 'th' ? o.th : o.Name}</option>`).join('');
  function bcForm() {
    const f = C.form, cust = customers(), cnt = a => K.audience(a, C.list, cust).list.length;
    const fld = c => { const id = 'bc_' + c.ColumnName, v = f[c.ColumnName] || '';
      let ctl;
      if (c.AD_Reference_ID === 17) ctl = `<select id="${id}" data-ct-bc="${c.ColumnName}">${AD.list(c.AD_Reference_Value_ID).map(o => `<option value="${o.Value}" ${o.Value === v ? 'selected' : ''}>${lang() === 'th' ? o.th : o.Name}${c.ColumnName === 'Audience' ? ' (' + cnt(o.Value) + ')' : ''}</option>`).join('')}</select>`;
      else if (c.AD_Reference_ID === 14) ctl = `<textarea id="${id}" data-ct-bc="${c.ColumnName}" rows="2" placeholder="${f.Kind === 'offer' ? t('ctOfferAuto') : t('ctDefaultNews')}">${v}</textarea>`;
      else ctl = `<input id="${id}" data-ct-bc="${c.ColumnName}" value="${v}" placeholder="${t('ct_kind_' + f.Kind)}">`;
      return `<label class="f ${c.AD_Reference_ID === 14 ? 'wide' : ''}">${gl(c)}${c.IsMandatory === 'Y' && c.AD_Reference_ID !== 14 ? ' *' : ''}${ctl}</label>`; };
    return `<div class="fields">${AD.cols('PAWN_Broadcast').map(fld).join('')}</div>`;
  }
  function stageView() {
    const b = C.stage; if (!b) return '';
    const s = b.stats, cust = customers();
    const chips = b.mapping.length ? `<div class="chs2">${b.mapping.map(m => `<span class="chip2" style="--c:var(${m.field ? '--s6' : '--muted'})">${m.header || '·'} → ${m.field ? t('ctf_' + m.field) : t('ctf_skip')}</span>`).join('')}</div>` : '';
    const cell = c => `<tr><td>${c.name || '–'}</td><td>${c.phone || '–'}</td><td>${c.email || '–'}</td><td>${c.lineUserId ? c.lineUserId.slice(0, 8) + '…' : '–'}</td><td>${c.phone && cust.has(c.phone) ? `<span class="chip2" style="--c:var(--s1)">${t('ctCustomer')} ${cust.get(c.phone).tk}</span>` : '–'}</td><td>${c.consent === 'Y' ? '✔' : '–'}</td></tr>`;
    return `<div class="card"><div class="panel"><h2>${t('ctReview')}: ${b.name} <small style="color:var(--muted)">· ${lab('PAWN_ContactSource', b.source)}${b.sha ? ' · sha256 ' + b.sha.slice(0, 10) : ''}</small></h2>${chips}
      <div class="stats">${[['read', s.read], ['added', s.added], ['merged', s.merged], ['invalid', s.invalid], ['noPhone', s.noPhone], ['existingCustomers', s.existingCustomers], ['withLine', s.withLine]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${t('cts_' + k)}</span></div>`).join('')}</div>
      <div class="tablewrap"><table><tr><th>${gl(AD.cols('PAWN_Contact')[0])}</th><th>${t('phone')}</th><th>Email</th><th>LINE ID</th><th>${t('ctCustomer')}</th><th>${t('ctConsent')}</th></tr>${b.added.slice(0, 8).map(cell).join('') || `<tr><td colspan="6">${t('none')}</td></tr>`}</table></div>
      ${b.added.length > 8 ? `<div class="note">… ${b.added.length - 8} ${t('ctMore')}</div>` : ''}
      <label class="choice" style="margin-top:8px"><input type="checkbox" data-ct="agreed" ${b.agreed ? 'checked' : ''}> ${t('ctAgreeAll')}</label><div class="note">${t('ctConsentNote')}</div>
      <div class="actions" style="justify-content:flex-start"><button class="btn" data-ct="confirm">${t('ctAdd')}</button><button class="btn ghost" style="color:var(--accent)" data-ct="discard">${t('ctDiscard')}</button></div></div></div>`;
  }
  function preparedView() {
    const p = C.prepared; if (!p) return '';
    return `<div class="card"><div class="panel"><h2>${t('ctPrepared')}</h2>
      <div class="stats"><div class="stat"><b>${p.msgs.length}</b><span>${t('ctReady')}</span></div><div class="stat"><b>${p.skipped.length}</b><span>${t('ctNoAddress')}</span></div><div class="stat"><b>${p.excludedNoConsent}</b><span>${t('ctNoConsent')}</span></div></div>
      <div class="note">${t('ctOpenNote')}</div>
      <div class="tablewrap"><table><tr><th>${t('name')}</th><th>${t('ctTo')}</th><th>${t('ctText')}</th><th></th></tr>${p.msgs.slice(0, 12).map((m, i) => `<tr><td>${m.c.name || '–'}</td><td>${p.form.Channel === 'email' ? m.c.email : m.c.phone || '–'}</td><td><small>${m.text}</small></td><td><a href="${m.href}" target="_blank" rel="noopener" data-ct-open="${i}">${t('open')} ↗</a></td></tr>`).join('')}</table></div>
      ${p.msgs.length > 12 ? `<div class="note">… ${p.msgs.length - 12} ${t('ctMore')}</div>` : ''}
      <div class="actions" style="justify-content:flex-start"><button class="btn small" data-ct="copyall">${t('ctCopyAll')}</button></div></div></div>`;
  }
  function logView() {
    const l = Net.crm._contacts; if (!l || !l.chain.shop.length) return '';
    const ev = l.chain.shop, v = C.verify || [];
    return `<div class="card"><div class="panel"><h2>${t('ctHistory')}</h2><div class="tablewrap"><table><tr><th>#</th><th>${t('date')}</th><th>${t('event')}</th><th>${t('detail')}</th><th>${t('check')}</th></tr>
      ${ev.map(e => { const b = e.body, x = v.find(y => y.n === e.n); return `<tr><td>${e.n}</td><td>${new Date(e.ts).toISOString().slice(0, 10)}</td><td>${e.type}</td><td>${e.type === 'import' ? `${lab('PAWN_ContactSource', b.source)} · ${b.file} · ${b.read} → +${b.added}, ${b.merged} ${t('cts_merged')}` : `${lab('PAWN_BcastKind', b.kind)} · ${lab('PAWN_Audience', b.audience)} · ${lab('PAWN_BcastChannel', b.channel)} · ${b.prepared} ${t('ctReady')}`}</td><td>${x ? (x.ok ? `<span class="okm">✔ ${t('verified')}</span>` : `<span class="badm">✖ ${t('broken')}</span>`) : '…'}</td></tr>`; }).join('')}</table></div></div></div>`;
  }
  function view() {
    const cust = customers(), n = C.list.length, ok = C.list.filter(c => c.consent === 'Y').length, nc = C.list.filter(c => c.phone && cust.has(c.phone)).length, wl = C.list.filter(c => c.lineUserId).length;
    const q = C.filter.toLowerCase(), shown = C.list.filter(c => !q || [c.name, c.phone, c.email].join(' ').toLowerCase().includes(q));
    const cols = AD.cols('PAWN_Contact').filter(c => c.IsDisplayedGrid === 'Y');
    const src = [['excel', 'table_view', 'ctSrcExcel', '.xlsx,.xls,.csv,.tsv,.txt'], ['vcf', 'contacts', 'ctSrcVcf', '.vcf,.csv'], ['line', 'forum', 'ctSrcLine', '.json,.txt']];
    return `<div class="card"><div class="panel"><h2>${t('navContacts')}</h2><div class="sub">${t('ctSub')}</div>
      <div class="stats"><div class="stat"><b>${n}</b><span>${t('ctTotal')}</span></div><div class="stat"><b>${ok}</b><span>${t('ctConsent')}</span></div><div class="stat"><b>${nc}</b><span>${t('ctCustomers')}</span></div><div class="stat"><b>${wl}</b><span>${t('cts_withLine')}</span></div></div>
      <div class="sec-title">${t('ctImport')}</div>
      <div class="srcs">${src.map(([k, ic, lb, acc]) => `<label class="src"><span class="material-symbols-rounded">${ic}</span><b>${t(lb)}</b><small>${t(lb + 'S')}</small><input type="file" data-ct-file="${k}" accept="${acc}" hidden></label>`).join('')}
        ${navigator.contacts && navigator.contacts.select ? `<button class="src" data-ct="picker"><span class="material-symbols-rounded">person_search</span><b>${t('ctSrcPicker')}</b><small>${t('ctSrcPickerS')}</small></button>` : ''}</div>
      <div class="sec-title">${t('ctPaste')}</div><textarea id="ct_paste" rows="2" placeholder="${t('ctPastePh')}"></textarea>
      <div class="actions" style="justify-content:flex-start"><button class="btn small" data-ct="paste">${t('ctRead')}</button></div>
      <div class="note">${t('ctLineNote')}</div><div class="note">${C.msg}</div></div></div>
      ${stageView()}
      <div class="card"><div class="panel"><h2>${t('ctList')}</h2><label class="f" style="max-width:320px"><input data-ct-filter="1" value="${C.filter}" placeholder="${t('ctSearch')}"></label>
        <div class="tablewrap"><table><tr>${cols.map(c => `<th>${gl(c)}</th>`).join('')}<th>${t('ctCustomer')}</th></tr>
        ${shown.slice(0, 40).map(c => `<tr>${cols.map(col => `<td>${col.ColumnName === 'Source' ? lab('PAWN_ContactSource', c.source) : col.ColumnName === 'Consent' ? `<button class="chip2" style="--c:var(${c.consent === 'Y' ? '--s6' : '--muted'})" data-ct-consent="${C.list.indexOf(c)}">${c.consent === 'Y' ? t('yes') : t('no')}</button>` : col.ColumnName === 'Name' ? (c.name || '–') : col.ColumnName === 'Phone' ? (c.phone || '–') : col.ColumnName === 'Email' ? (c.email || '–') : ''}</td>`).join('')}<td>${c.phone && cust.has(c.phone) ? `<span class="chip2" style="--c:var(--s1)">${cust.get(c.phone).tk}${cust.get(c.phone).risk === 'green' ? ' · ' + t('ctGreen') : ''}</span>` : '–'}</td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}">${t('none')}</td></tr>`}</table></div>
        ${shown.length > 40 ? `<div class="note">… ${shown.length - 40} ${t('ctMore')}</div>` : ''}</div></div>
      <div class="card"><div class="panel"><h2>${t('ctBroadcast')}</h2><div class="sub">${t('ctBroadcastSub')}</div>${bcForm()}
        <div class="actions" style="justify-content:flex-start"><button class="btn" data-ct="prepare">${t('ctPrepare')}</button></div><div class="note">${t('ctConsentOnly')}</div></div></div>
      ${preparedView()}${logView()}`;
  }

  // ---------- events ----------
  async function refreshVerify() { const l = Net.crm._contacts; C.verify = l ? await l.verifyAll() : []; }
  function click(el) {
    const n = el.closest('[data-ct]'), m = n && n.dataset.ct;
    if (m === 'confirm') { confirmBatch().then(refreshVerify).then(() => window.dispatchEvent(new Event('gp-render'))); return false; }
    if (m === 'discard') { C.stage = null; return true; }
    if (m === 'agreed') { if (C.stage) C.stage.agreed = el.closest('input').checked; return true; }
    if (m === 'paste') { paste(); return true; }
    if (m === 'picker') { picker().then(() => window.dispatchEvent(new Event('gp-render'))); return false; }
    if (m === 'prepare') { readForm(); prepare().then(refreshVerify).then(() => window.dispatchEvent(new Event('gp-render'))); return false; }
    if (m === 'copyall' && C.prepared) { const txt = C.prepared.msgs.map(x => (x.c.name || '') + '\t' + (x.c.phone || x.c.email) + '\t' + x.text).join('\n'); try { navigator.clipboard.writeText(txt); } catch (e) {} C.msg = t('ctCopied'); return true; }
    const cs = el.closest('[data-ct-consent]'); if (cs) { const c = C.list[+cs.dataset.ctConsent]; c.consent = c.consent === 'Y' ? 'N' : 'Y'; save(); return true; }
    return false;
  }
  function readForm() { AD.cols('PAWN_Broadcast').forEach(c => { const e = document.getElementById('bc_' + c.ColumnName); if (e) C.form[c.ColumnName] = e.value; }); }
  function input(el) { if (el.dataset.ctFilter) { C.filter = el.value; return true; } if (el.dataset.ctBc) { C.form[el.dataset.ctBc] = el.value; return el.dataset.ctBc === 'Kind'; } return false; }
  function addConsented(it) {                       // a customer agreed at the counter: record it as a consented contact (PDPA: consent is kept with the contact)
    const n = K.normPhone(it.phone); if (!n) return false; const have = C.list.find(c => c.phone === n.n);
    if (have) { have.consent = 'Y'; if (!have.name) have.name = it.name; } else C.list.push({ name: it.name || '', phone: n.n, email: '', lineUserId: '', source: 'counter', consent: 'Y', mobile: !!n.mobile, address: '' });
    save(); return true;
  }
  return { addConsented, bind, view, click, input, file, state: C, customers, refreshVerify, prepare, confirmBatch, stageBatch, readFile };
})();
