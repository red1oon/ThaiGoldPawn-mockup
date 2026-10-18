// Books preview + data dictionary views (spec §15.7, §15.8).
window.Views2 = (function () {
  const Net = window.Net, AD = window.AD, Books = window.Books;
  let S, t, fmt, fd;
  const bind = (s, tr, f, d) => { S = s; t = tr; fmt = f; fd = d; };
  const REF = { 10: 'String', 11: 'Integer', 12: 'Amount', 14: 'Text', 15: 'Date', 17: 'List', 20: 'Yes-No', 19: 'TableDir', 22: 'Number' };
  const REF_TH = { 10: 'ข้อความสั้น', 11: 'จำนวนเต็ม', 12: 'จำนวนเงิน', 14: 'ข้อความยาว', 15: 'วันที่', 17: 'รายการเลือก', 20: 'ใช่/ไม่', 19: 'อ้างอิงตาราง', 22: 'ตัวเลข' };
  const DESC_TH = { PAWN_Ticket: 'สร้างจากเหตุการณ์ เสนอสัญญา / รับทราบ / ชำระ / ปิดตั๋ว', PAWN_Payment: 'สร้างจากเหตุการณ์ แจ้งชำระ / ตรวจแล้ว / ปฏิเสธ', PAWN_FollowUp: 'บันทึกติดตามภายในร้าน (ไม่ส่งไปกับโทเคน)', PAWN_Contact: 'รายชื่อลูกค้าและผู้สนใจ (นำเข้าจาก Excel, CSV, vCard, LINE, สมุดโทรศัพท์)', PAWN_Broadcast: 'ข้อเสนอหรือข่าวสารที่เตรียมไว้ให้กลุ่มที่ยินยอมรับข้อความ', PAWN_Locate: 'การเก็บเข้า / ย้าย / นำออก / ทำหลุด ของทรัพย์หลักประกัน เป็นเหตุการณ์ที่เซ็นกำกับภายในร้าน (คลัง ช่องเก็บ ล็อต)', PAWN_SlipCheck: 'หนึ่งแถวต่อการเรียกตรวจสลิปของร้านแต่ละครั้ง สรุปจากเหตุการณ์ชำระเงิน (โควตาและประมาณค่าใช้จ่าย)' };
  const nm = a => S.lang === 'th' ? a[2] : a[1];

  function books() {
    const ls = Object.values(Net.all()), es = Books.all(ls, Net.price), tb = Books.trial(es), keys = Object.keys(Books.ACCT);
    const bal = k => tb[k].dr - tb[k].cr, tot = keys.reduce((a, k) => ({ dr: a.dr + tb[k].dr, cr: a.cr + tb[k].cr }), { dr: 0, cr: 0 });
    const inc = tb.inc.cr - tb.inc.dr, gl = tb.gl.cr - tb.gl.dr;
    const lines = e => e.lines.map(l => `${l.dr ? t('drLbl') : t('crLbl')} ${nm(Books.ACCT[l.acct])} ${fmt(l.dr || l.cr)}`).join(' · ');
    return `<div class="card"><div class="panel"><h2>${t('booksHead')}</h2><div class="sub">${t('booksSub')}</div>
      <div class="note warnbox">${t('previewNote')}</div>
      <div class="sec-title">${t('trial')}</div><div class="tablewrap"><table><tr><th>${t('acct')}</th><th>${t('acctName')}</th><th class="n">Dr</th><th class="n">Cr</th><th class="n">${t('balance')}</th></tr>
        ${keys.map(k => `<tr><td>${Books.ACCT[k][0]}</td><td>${nm(Books.ACCT[k])}</td><td class="n">${fmt(tb[k].dr)}</td><td class="n">${fmt(tb[k].cr)}</td><td class="n">${fmt(bal(k))}</td></tr>`).join('')}
        <tr><th></th><th>${t('total')}</th><th class="n">${fmt(tot.dr)}</th><th class="n">${fmt(tot.cr)}</th><th class="n">${Math.abs(tot.dr - tot.cr) < 0.01 ? '✔ ' + t('balanced') : '✖'}</th></tr></table></div>
      <div class="sec-title">${t('incomeStmt')}</div><table><tr><td>${nm(Books.ACCT.inc)}</td><td class="n">${fmt(inc)}</td></tr><tr><td>${nm(Books.ACCT.gl)}</td><td class="n">${fmt(gl)}</td></tr><tr><th>${t('netIncome')}</th><th class="n">${fmt(inc + gl)}</th></tr></table>
      <div class="sec-title">${t('vatSummary')}</div><table><tr><td>${nm(Books.ACCT.vat)}</td><td class="n">${fmt(tb.vat.cr - tb.vat.dr)}</td></tr></table>
      <div class="sec-title">${t('journalHead')} (${es.length})</div><div class="tablewrap"><table><tr><th>${t('date')}</th><th>${t('ticketNo')}</th><th>${t('event')}</th><th>${t('journal')}</th></tr>
        ${es.slice(-30).reverse().map(e => `<tr><td>${fd(e.date)}</td><td>${e.tk}</td><td>${t.raw('ev_' + e.desc)}</td><td>${lines(e)}</td></tr>`).join('')}</table></div></div></div>`;
  }

  function ad() {
    const gl = c => S.lang === 'th' ? c.th : c.Name, th = S.lang === 'th', yn = v => th ? (v === 'Y' || v === 1 || v === true ? 'ใช่' : '') : (v === 'Y' || v === 1 || v === true ? 'Y' : '');
    return `<div class="card"><div class="panel"><h2>${t('adHead')}</h2><div class="sub">${t('adSub')}</div>
      <div class="note">${t('adUsed')}</div>
      ${AD.tables.map(tb => `<div class="sec-title">${tb.TableName} <small style="color:var(--muted)">· AD_Table_ID ${tb.AD_Table_ID} · ${th ? (DESC_TH[tb.TableName] || tb.Description) : tb.Description}</small></div>
        <div class="tablewrap"><table><tr><th>${th ? 'ชื่อคอลัมน์ (รหัส)' : 'ColumnName'}</th><th>${t('name')}</th><th>${th ? 'ชนิดข้อมูล' : 'AD_Reference'}</th><th>${t('refList')}</th><th>${th ? 'ความยาว' : 'Len'}</th><th>${th ? 'บังคับ' : 'Mand.'}</th><th>${th ? 'ใช้ค้นหา' : 'Sel.'}</th><th>${th ? 'แสดงในตาราง' : 'Grid'}</th><th>${th ? 'สูตรคำนวณ' : 'Fold / SQL'}</th></tr>
        ${AD.cols(tb.TableName).map(c => `<tr><td><code>${c.ColumnName}</code></td><td>${gl(c)}</td><td>${c.AD_Reference_ID} ${(th ? REF_TH : REF)[c.AD_Reference_ID] || ''}</td><td>${c.AD_Reference_Value_ID || ''}</td><td>${c.FieldLength || ''}</td><td>${yn(c.IsMandatory)}</td><td>${yn(c.IsSelectionColumn)}</td><td>${yn(c.IsDisplayedGrid)}</td><td><small>${c.ColumnSQL || ''}</small></td></tr>`).join('')}</table></div>`).join('')}
      <div class="sec-title">${th ? 'รายการเลือก (AD_Ref_List)' : 'AD_Ref_List'}</div><div class="tablewrap"><table>${[...new Set(AD.refLists.map(r => r.AD_Reference_Name))].map(n => `<tr><td><code>${n}</code></td><td>${AD.list(n).map(r => `${r.Value} = ${S.lang === 'th' ? r.th : r.Name}`).join(' · ')}</td></tr>`).join('')}</table></div>
      <div class="sec-title">${th ? 'ไฟล์แนบ (AD_Attachment)' : 'AD_Attachment'}</div><table>${AD.attachments.map(x => `<tr><td><code>${x.AD_Table}</code></td><td>${x.Title} · ${x.ContentType} · ${th ? 'คำตอบจากการตรวจสลิปของ SlipOK (สำเร็จ หรือรหัส 1012/1013/1014 พร้อมข้อมูลสลิป)' : x.Description}</td></tr>`).join('')}</table>
      <div class="sec-title">${th ? 'หน้าจอและแท็บ (AD_Window / AD_Tab)' : 'AD_Window / AD_Tab'}</div><table>${AD.windows.map(w => `<tr><td><b>${th ? 'ตั๋วขายฝาก' : w.Name}</b></td><td>${w.tabs.map(x => `${th ? ({ Ticket: 'ตั๋ว', Payment: 'การชำระ', 'Follow-up': 'การติดตาม' }[x.Name] || x.Name) : x.Name} → ${AD.tables.find(tb => tb.AD_Table_ID === x.AD_Table_ID).TableName} (${th ? 'ระดับ' : 'level'} ${x.TabLevel})`).join(' · ')}</td></tr>`).join('')}</table></div></div>`;
  }
  return { bind, books, ad };
})();
