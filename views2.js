// Books preview + data dictionary views (spec §15.7, §15.8).
window.Views2 = (function () {
  const Net = window.Net, AD = window.AD, Books = window.Books;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const REF = { 10: 'String', 11: 'Integer', 12: 'Amount', 14: 'Text', 15: 'Date', 17: 'List', 20: 'Yes-No', 19: 'TableDir', 22: 'Number' };
  const nm = a => S.lang === 'th' ? a[2] : a[1];

  function books() {
    const ls = Object.values(Net.all()), es = Books.all(ls, Net.price), tb = Books.trial(es), keys = Object.keys(Books.ACCT);
    const bal = k => tb[k].dr - tb[k].cr, tot = keys.reduce((a, k) => ({ dr: a.dr + tb[k].dr, cr: a.cr + tb[k].cr }), { dr: 0, cr: 0 });
    const inc = tb.inc.cr - tb.inc.dr, gl = tb.gl.cr - tb.gl.dr;
    const lines = e => e.lines.map(l => `${l.dr ? 'Dr' : 'Cr'} ${nm(Books.ACCT[l.acct])} ${fmt(l.dr || l.cr)}`).join(' · ');
    return `<div class="card"><div class="panel"><h2>${t('booksHead')}</h2><div class="sub">${t('booksSub')}</div>
      <div class="note warnbox">${t('previewNote')}</div>
      <div class="sec-title">${t('trial')}</div><div class="tablewrap"><table><tr><th>${t('acct')}</th><th>${t('acctName')}</th><th class="n">Dr</th><th class="n">Cr</th><th class="n">${t('balance')}</th></tr>
        ${keys.map(k => `<tr><td>${Books.ACCT[k][0]}</td><td>${nm(Books.ACCT[k])}</td><td class="n">${fmt(tb[k].dr)}</td><td class="n">${fmt(tb[k].cr)}</td><td class="n">${fmt(bal(k))}</td></tr>`).join('')}
        <tr><th></th><th>${t('total')}</th><th class="n">${fmt(tot.dr)}</th><th class="n">${fmt(tot.cr)}</th><th class="n">${Math.abs(tot.dr - tot.cr) < 0.01 ? '✔ ' + t('balanced') : '✖'}</th></tr></table></div>
      <div class="sec-title">${t('incomeStmt')}</div><table><tr><td>${nm(Books.ACCT.inc)}</td><td class="n">${fmt(inc)}</td></tr><tr><td>${nm(Books.ACCT.gl)}</td><td class="n">${fmt(gl)}</td></tr><tr><th>${t('netIncome')}</th><th class="n">${fmt(inc + gl)}</th></tr></table>
      <div class="sec-title">${t('vatSummary')}</div><table><tr><td>${nm(Books.ACCT.vat)}</td><td class="n">${fmt(tb.vat.cr - tb.vat.dr)}</td></tr></table>
      <div class="sec-title">${t('journalHead')} (${es.length})</div><div class="tablewrap"><table><tr><th>${t('date')}</th><th>${t('ticketNo')}</th><th>${t('event')}</th><th>${t('journal')}</th></tr>
        ${es.slice(-30).reverse().map(e => `<tr><td>${fd(e.date)}</td><td>${e.tk}</td><td>${e.desc}</td><td>${lines(e)}</td></tr>`).join('')}</table></div></div></div>`;
  }

  function ad() {
    const gl = c => S.lang === 'th' ? c.th : c.Name;
    return `<div class="card"><div class="panel"><h2>${t('adHead')}</h2><div class="sub">${t('adSub')}</div>
      <div class="note">${t('adUsed')}</div>
      ${AD.tables.map(tb => `<div class="sec-title">${tb.TableName} <small style="color:var(--muted)">· AD_Table_ID ${tb.AD_Table_ID} · ${tb.Description}</small></div>
        <div class="tablewrap"><table><tr><th>ColumnName</th><th>${t('name')}</th><th>AD_Reference</th><th>${t('refList')}</th><th>Len</th><th>Mand.</th><th>Sel.</th><th>Grid</th><th>Fold / SQL</th></tr>
        ${AD.cols(tb.TableName).map(c => `<tr><td><code>${c.ColumnName}</code></td><td>${gl(c)}</td><td>${c.AD_Reference_ID} ${REF[c.AD_Reference_ID] || ''}</td><td>${c.AD_Reference_Value_ID || ''}</td><td>${c.FieldLength || ''}</td><td>${c.IsMandatory}</td><td>${c.IsSelectionColumn}</td><td>${c.IsDisplayedGrid}</td><td><small>${c.ColumnSQL || ''}</small></td></tr>`).join('')}</table></div>`).join('')}
      <div class="sec-title">AD_Ref_List</div><div class="tablewrap"><table>${[...new Set(AD.refLists.map(r => r.AD_Reference_Name))].map(n => `<tr><td><code>${n}</code></td><td>${AD.list(n).map(r => `${r.Value} = ${S.lang === 'th' ? r.th : r.Name}`).join(' · ')}</td></tr>`).join('')}</table></div>
      <div class="sec-title">AD_Attachment</div><table>${AD.attachments.map(x => `<tr><td><code>${x.AD_Table}</code></td><td>${x.Title} · ${x.ContentType} · ${x.Description}</td></tr>`).join('')}</table>
      <div class="sec-title">AD_Window / AD_Tab</div><table>${AD.windows.map(w => `<tr><td><b>${w.Name}</b></td><td>${w.tabs.map(x => `${x.Name} → ${AD.tables.find(tb => tb.AD_Table_ID === x.AD_Table_ID).TableName} (level ${x.TabLevel})`).join(' · ')}</td></tr>`).join('')}</table></div></div>`;
  }
  return { bind, books, ad };
})();
