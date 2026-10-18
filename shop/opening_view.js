// Import existing tickets tab (spec §20.2): file/paste -> review (valid / invalid with reasons) -> one confirmed commit.
window.OpeningView = (function () {
  const O = window.Opening, K = window.Contacts, Net = window.Net;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const icon = n => `<span class="material-symbols-rounded">${n}</span>`;
  const V = { stage: null, msg: '', paste: '' };
  const loadXLSX = () => window.XLSX ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'lib/xlsx.full.min.js'; s.onload = ok; s.onerror = () => no(new Error('xlsx')); document.head.appendChild(s); });
  async function sha256(buf) { const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
  function stage(rows, name, sha) {
    const { items, missingCols } = O.fromRows(rows);
    if (missingCols.length) { V.msg = '⚠ ' + t('opMissingCols') + ': ' + missingCols.join(', '); V.stage = null; return; }
    const v = O.validate(items, { today: Net.today, set: Net.set }); V.stage = { name, sha, read: items.length, ...v }; V.msg = '';
  }
  async function file(el) {
    const f = el.files && el.files[0]; if (!f) return; const buf = await f.arrayBuffer(), sha = await sha256(buf), ext = (f.name.split('.').pop() || '').toLowerCase();
    try {
      if (ext === 'xlsx' || ext === 'xls') { await loadXLSX(); const wb = XLSX.read(new Uint8Array(buf), { type: 'array' }); stage(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }), f.name, sha); }
      else stage(K.parseDelimited(new TextDecoder().decode(buf)), f.name, sha);
    } catch (e) { V.msg = '⚠ ' + t('ctReadFail') + ' ' + f.name; V.stage = null; }
    el.value = '';
  }
  function view() {
    const s = V.stage, sumP = s ? s.ok.reduce((a, r) => a + r.loan, 0) : 0, kyc = s ? s.ok.filter(r => r.kycMissing).length : 0, capped = s ? s.ok.filter(r => r.rateCapped).length : 0;
    return `<div class="card"><div class="panel"><h2>${t('navOpening')}</h2><div class="sub">${t('opSub')}</div>
      <div class="note">${t('opCols')}: <code>ticketNo, date, name, phone, loan, months, rate, group, paidTo, category, weightG, locator</code></div>
      <div class="actions" style="justify-content:flex-start"><button class="btn small ghost" data-op="template">${icon('download')} ${t('opTemplate')}</button></div>
      <div class="fields"><label class="f">${t('opFile')}<input type="file" data-op-file="1" accept=".csv,.tsv,.txt,.xlsx,.xls"></label></div>
      <div class="fields"><label class="f">${t('opPaste')}<textarea data-op-paste="1" rows="4" placeholder="ticketNo,date,name,phone,loan,months,rate,group,paidTo,category,weightG">${V.paste}</textarea></label></div>
      <div class="actions" style="justify-content:flex-start"><button class="btn small" data-op="paste">${t('opReview')}</button></div>
      ${V.msg ? `<div class="note">${V.msg}</div>` : ''}
      ${s ? `<div class="sec-title">${t('opReviewHead')}: ${s.name}</div>
        <div class="chips"><div class="kchip" style="--c:--s1">${icon('table_rows')}<b>${s.read}</b><span>${t('opRead')}</span></div><div class="kchip" style="--c:--s6">${icon('check_circle')}<b>${s.ok.length}</b><span>${t('opValid')}</span></div>
          <div class="kchip" style="--c:${s.bad.length ? '--s8' : '--s6'}">${icon('error')}<b>${s.bad.length}</b><span>${t('opInvalid')}</span></div><div class="kchip" style="--c:--s1">${icon('payments')}<b>${fmt(sumP)}</b><span>${t('opPrincipal')}</span></div></div>
        ${kyc ? `<div class="note slipwarn warn">${icon('warning')} ${kyc} ${t('opKycMissing')}</div>` : ''}${capped ? `<div class="note slipwarn warn">${icon('warning')} ${capped} ${t('opRateCapped')}</div>` : ''}
        ${s.bad.length ? `<div class="tablewrap"><table><tr><th>${t('opRow')}</th><th>${t('ticketNo')}</th><th>${t('opWhy')}</th></tr>${s.bad.slice(0, 30).map(b => `<tr><td>${b.row}</td><td>${b.tk}</td><td style="color:var(--s8)">${b.why.map(w => t('opwhy_' + w)).join(' · ')}</td></tr>`).join('')}</table></div>` : ''}
        ${s.ok.length ? `<div class="tablewrap"><table><tr><th>${t('ticketNo')}</th><th>${t('date')}</th><th>${t('name')}</th><th class="n">${t('loan')}</th><th>${t('months')}</th><th class="n">%</th><th>${t('opPaidTo')}</th></tr>${s.ok.slice(0, 10).map(r => `<tr><td>${r.tk}</td><td>${fd(r.date)}</td><td>${r.name}</td><td class="n">${fmt(r.loan)}</td><td>${r.months}</td><td class="n">${r.rate}</td><td>${fd(r.paidTo)}</td></tr>`).join('')}</table></div><div class="note">${s.ok.length > 10 ? '… ' + (s.ok.length - 10) + ' ' + t('opMore') : ''}</div>` : ''}
        <div class="note">${t('opCommitNote')}</div>
        <div class="actions" style="justify-content:flex-start"><button class="btn" data-op="commit" ${s.ok.length ? '' : 'disabled'}>${t('opCommit')} (${s.ok.length})</button><button class="btn small ghost" data-op="cancel">${t('bkCancel')}</button></div>` : ''}</div></div>`;
  }
  async function click(el) {
    const n = el.closest('[data-op]'); if (!n) return false; const a = n.dataset.op;
    if (a === 'template') { const x = document.createElement('a'); x.href = URL.createObjectURL(new Blob([O.TEMPLATE], { type: 'text/csv' })); x.download = 'open-tickets-template.csv'; document.body.appendChild(x); x.click(); setTimeout(() => { URL.revokeObjectURL(x.href); x.remove(); }, 400); return false; }
    if (a === 'paste') { const ta = document.querySelector('[data-op-paste]'); V.paste = ta ? ta.value : V.paste; if (V.paste.trim()) stage(K.parseDelimited(V.paste), t('opPasted'), ''); return true; }
    if (a === 'cancel') { V.stage = null; V.msg = ''; return true; }
    if (a === 'commit' && V.stage && V.stage.ok.length) {
      const s = V.stage, r = await O.commit(s.ok, { file: s.name, sha: s.sha, read: s.read, invalid: s.bad.length });
      V.msg = '✔ ' + t('opDone') + ': ' + r.added + ' · ' + fmt(r.principal) + ' ' + t('baht'); V.stage = null; V.paste = ''; return true;
    }
    return false;
  }
  return { bind, view, file, click, state: V, input: el => { V.paste = el.value; } };
})();
