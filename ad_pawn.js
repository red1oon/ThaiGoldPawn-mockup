// Pawn data model as Application Dictionary rows (spec §15.8). Row shapes use the kernel's own AD_Table / AD_Column / AD_Ref_List /
// AD_Window / AD_Tab column names (erp/ad_seed.db). Screens below (follow-up form, group-by list, grid columns, data-dictionary view)
// are GENERATED from these rows. Records are folds of the signed events (§9) — the dictionary describes the folded record.
window.AD = (function () {
  // AD_Reference_ID values as in the kernel's AD: 10 String · 11 Integer · 12 Amount · 14 Text · 15 Date · 17 List · 19 TableDir · 22 Number
  const T = (id, name, tableName, desc) => ({ AD_Table_ID: id, Name: name, TableName: tableName, Description: desc, EntityType: 'U', AccessLevel: '3', IsView: 'N', IsActive: 'Y' });
  const tables = [
    T(1000001, 'Pawn Ticket', 'PAWN_Ticket', 'Folded from offer / ack / payment / closed events'),
    T(1000002, 'Pawn Payment', 'PAWN_Payment', 'Folded from payment_claim / payment_verified / payment_rejected events'),
    T(1000003, 'Pawn Follow-up', 'PAWN_FollowUp', 'Shop-internal CRM chain (never sent in a token)'),
    T(1000004, 'Pawn Contact', 'PAWN_Contact', 'Customer / prospect contact list (imported from Excel, CSV, vCard, LINE, phone picker)'),
    T(1000005, 'Pawn Broadcast', 'PAWN_Broadcast', 'Offer or news prepared for an audience of consented contacts')
  ];
  let cid = 2000000;
  // C(table, ColumnName, Name, th, ref, opts)
  const C = (tid, ColumnName, Name, th, ref, o = {}) => ({ AD_Column_ID: ++cid, AD_Table_ID: tid, ColumnName, Name, th, AD_Reference_ID: ref, AD_Reference_Value_ID: o.list || null, FieldLength: o.len || null,
    IsMandatory: o.m ? 'Y' : 'N', IsKey: o.key ? 'Y' : 'N', IsIdentifier: o.id ? 'Y' : 'N', IsSelectionColumn: o.sel ? 'Y' : 'N', IsDisplayed: o.hide ? 'N' : 'Y', IsDisplayedGrid: o.grid ? 'Y' : 'N',
    IsUpdateable: o.ro ? 'N' : 'Y', DefaultValue: o.def || null, ColumnSQL: o.virt || null, SeqNo: o.seq || cid - 2000000, IsActive: 'Y', EntityType: 'U' });
  const columns = [
    // PAWN_Ticket
    C(1000001, 'DocumentNo', 'Ticket no.', 'เลขที่ใบขายฝาก', 10, { len: 10, m: 1, id: 1, grid: 1, ro: 1 }),
    C(1000001, 'Name', 'Customer', 'ลูกค้า', 10, { len: 120, m: 1, grid: 1 }),
    C(1000001, 'Phone', 'Phone (identity)', 'โทรศัพท์ (ตัวตน)', 10, { len: 20, m: 1, sel: 1 }),
    C(1000001, 'Address', 'Address', 'ที่อยู่', 14, {}),
    C(1000001, 'Category', 'Collateral', 'ประเภททรัพย์', 17, { list: 'PAWN_Category', m: 1, sel: 1, grid: 1 }),
    C(1000001, 'Weight', 'Weight (g)', 'น้ำหนัก (กรัม)', 22, {}),
    C(1000001, 'RateGroup', 'Rate group', 'กลุ่มอัตรา', 17, { list: 'PAWN_RateGroup', m: 1, sel: 1 }),
    C(1000001, 'CeilingAmt', 'Loanable amount', 'วงเงินสูงสุด', 12, { ro: 1 }),
    C(1000001, 'LoanAmt', 'Loan amount', 'มูลค่าขายฝาก', 12, { m: 1, grid: 1, ro: 1 }),
    C(1000001, 'PrincipalAmt', 'Principal outstanding', 'เงินต้นคงเหลือ', 12, { grid: 1, ro: 1, virt: 'fold(LoanAmt − Σ PAWN_Payment.PrincipalAmt)' }),
    C(1000001, 'Rate', 'Rate % / month', 'อัตรา % / เดือน', 22, { ro: 1 }),
    C(1000001, 'DateTicket', 'Ticket date', 'วันที่ออก', 15, { m: 1, sel: 1, ro: 1 }),
    C(1000001, 'DateDue', 'Due date', 'กำหนดไถ่ถอน', 15, { grid: 1, ro: 1 }),
    C(1000001, 'PaidToDate', 'Interest paid to', 'ชำระดอกเบี้ยถึง', 15, { ro: 1 }),
    C(1000001, 'Status', 'Status', 'สถานะ', 17, { list: 'PAWN_Status', sel: 1, grid: 1, ro: 1, virt: 'fold(events)' }),
    C(1000001, 'Risk', 'Risk class', 'ระดับความเสี่ยง', 17, { list: 'PAWN_Risk', sel: 1, grid: 1, ro: 1, virt: 'classify(overdueDays, lateDays, nplDays)' }),
    C(1000001, 'Ageing', 'Due-date ageing', 'อายุตามกำหนด', 17, { list: 'PAWN_Ageing', sel: 1, ro: 1, virt: 'bucket(DateDue − today)' }),
    // PAWN_Payment
    C(1000002, 'PAWN_Ticket_ID', 'Ticket', 'ใบขายฝาก', 19, { m: 1, hide: 1 }),
    C(1000002, 'ClaimNo', 'Claim no.', 'ครั้งที่', 11, { m: 1, ro: 1 }),
    C(1000002, 'PayMode', 'Pay as', 'วิธีชำระ', 17, { list: 'PAWN_PayMode', m: 1, sel: 1 }),
    C(1000002, 'Amount', 'Amount', 'จำนวนเงิน', 12, { m: 1 }),
    C(1000002, 'InterestAmt', 'Interest', 'ดอกเบี้ย', 12, { ro: 1 }),
    C(1000002, 'TaxAmt', 'VAT', 'ภาษีมูลค่าเพิ่ม', 12, { ro: 1 }),
    C(1000002, 'PrincipalAmt', 'Principal part', 'ส่วนเงินต้น', 12, { ro: 1 }),
    C(1000002, 'SlipRef', 'Slip reference (transRef)', 'เลขอ้างอิงสลิป', 10, { len: 40, ro: 1 }),
    C(1000002, 'SlipBank', 'Sending bank (SlipOK)', 'ธนาคารผู้โอน (SlipOK)', 10, { len: 3, ro: 1 }),
    C(1000002, 'SlipTimestamp', 'Slip time (SlipOK transTimestamp)', 'เวลาตามสลิป', 15, { ro: 1 }),
    C(1000002, 'ClaimStatus', 'Claim status', 'สถานะการตรวจสลิป', 17, { list: 'PAWN_ClaimStatus', sel: 1, ro: 1 }),
    // PAWN_FollowUp (CRM)
    C(1000003, 'PAWN_Ticket_ID', 'Ticket', 'ใบขายฝาก', 19, { m: 1, hide: 1 }),
    C(1000003, 'DateContact', 'Contact date', 'วันที่ติดต่อ', 15, { m: 1, def: '@#Date@', seq: 10 }),
    C(1000003, 'Channel', 'Channel', 'ช่องทาง', 17, { list: 'PAWN_Channel', m: 1, sel: 1, def: 'call', seq: 20 }),
    C(1000003, 'Outcome', 'Outcome', 'ผลการติดต่อ', 17, { list: 'PAWN_Outcome', m: 1, sel: 1, def: 'promised', seq: 30 }),
    C(1000003, 'Note', 'Note', 'บันทึก', 14, { seq: 40 }),
    C(1000003, 'DateNext', 'Next follow-up', 'นัดติดตามครั้งถัดไป', 15, { seq: 50 })
  ];
  columns.push(
    C(1000004, 'Name', 'Name', 'ชื่อ', 10, { len: 120, m: 1, id: 1, grid: 1, seq: 10 }),
    C(1000004, 'Phone', 'Phone (normalised 0xxxxxxxxx)', 'โทรศัพท์', 10, { len: 12, sel: 1, grid: 1, seq: 20 }),
    C(1000004, 'Email', 'Email', 'อีเมล', 10, { len: 120, grid: 1, seq: 30 }),
    C(1000004, 'LineUserId', 'LINE user ID', 'LINE user ID', 10, { len: 33, seq: 40 }),
    C(1000004, 'Source', 'Imported from', 'นำเข้าจาก', 17, { list: 'PAWN_ContactSource', sel: 1, grid: 1, ro: 1, seq: 50 }),
    C(1000004, 'Consent', 'May receive offers and news', 'ยินยอมรับข้อเสนอและข่าวสาร', 20, { sel: 1, grid: 1, def: 'N', seq: 60 }),
    C(1000005, 'Kind', 'Kind', 'ประเภท', 17, { list: 'PAWN_BcastKind', m: 1, def: 'offer', seq: 10 }),
    C(1000005, 'Audience', 'Audience', 'กลุ่มผู้รับ', 17, { list: 'PAWN_Audience', m: 1, def: 'green', seq: 20 }),
    C(1000005, 'Channel', 'Channel', 'ช่องทาง', 17, { list: 'PAWN_BcastChannel', m: 1, def: 'whatsapp', seq: 30 }),
    C(1000005, 'Title', 'Title', 'หัวข้อ', 10, { len: 80, m: 1, seq: 40 }),
    C(1000005, 'Body', 'Message', 'ข้อความ', 14, { seq: 50 })
  );
  const L = (list, value, name, th) => ({ AD_Reference_Name: list, Value: value, Name: name, th, IsActive: 'Y' });
  const refLists = [
    L('PAWN_ContactSource', 'excel', 'Excel', 'Excel'), L('PAWN_ContactSource', 'csv', 'CSV / pasted table', 'CSV / ตารางที่วาง'), L('PAWN_ContactSource', 'vcf', 'Phone contacts (vCard / Google CSV)', 'รายชื่อในโทรศัพท์ (vCard / Google CSV)'),
    L('PAWN_ContactSource', 'line', 'LINE', 'LINE'), L('PAWN_ContactSource', 'picker', 'Phone contact picker', 'เลือกจากรายชื่อในโทรศัพท์'), L('PAWN_ContactSource', 'manual', 'Typed in', 'พิมพ์เอง'),
    L('PAWN_BcastKind', 'offer', 'Offer', 'ข้อเสนอ'), L('PAWN_BcastKind', 'news', 'News', 'ข่าวสาร'),
    L('PAWN_Audience', 'green', 'Green list customers', 'ลูกค้า Green list'), L('PAWN_Audience', 'customers', 'All customers with a ticket', 'ลูกค้าที่มีตั๋วทั้งหมด'), L('PAWN_Audience', 'prospects', 'Contacts without a ticket', 'ผู้ติดต่อที่ยังไม่มีตั๋ว'), L('PAWN_Audience', 'all', 'Everyone who agreed', 'ทุกคนที่ยินยอม'),
    L('PAWN_BcastChannel', 'whatsapp', 'WhatsApp', 'WhatsApp'), L('PAWN_BcastChannel', 'sms', 'SMS', 'SMS'), L('PAWN_BcastChannel', 'line', 'LINE', 'LINE'), L('PAWN_BcastChannel', 'email', 'Email', 'อีเมล'),
    L('PAWN_Status', 'offered', 'Offered', 'รอผู้กู้ยืนยัน'), L('PAWN_Status', 'active', 'Active', 'ใช้งานอยู่'), L('PAWN_Status', 'overdue', 'Overdue', 'เกินกำหนด'),
    L('PAWN_Status', 'redeemed', 'Redeemed', 'ไถ่ถอนแล้ว'), L('PAWN_Status', 'forfeited', 'Forfeited', 'หลุดจำนำ'),
    L('PAWN_Category', 'ornament', 'Ornament gold', 'ทองรูปพรรณ'), L('PAWN_Category', 'bar', 'Gold bar', 'ทองแท่ง'), L('PAWN_Category', 'silver', 'Silver', 'เงิน'), L('PAWN_Category', 'other', 'Other', 'อื่นๆ'),
    L('PAWN_RateGroup', 'standard', 'standard', 'standard'), L('PAWN_RateGroup', 'vip', 'vip', 'vip'), L('PAWN_RateGroup', 'supervip', 'supervip', 'supervip'), L('PAWN_RateGroup', 'relative', 'relative', 'relative'),
    L('PAWN_Risk', 'ok', 'Ok', 'ปกติ'), L('PAWN_Risk', 'green', 'Green list', 'ลูกค้าดี (เสนอวงเงินเพิ่มได้)'), L('PAWN_Risk', 'watch', 'Watch', 'เฝ้าระวัง'), L('PAWN_Risk', 'npl', 'NPL', 'หนี้ไม่ก่อให้เกิดรายได้ (NPL)'),
    L('PAWN_Ageing', 'over30', 'Overdue > 30 days', 'เกินกำหนด > 30 วัน'), L('PAWN_Ageing', 'over0', 'Overdue 1–30 days', 'เกินกำหนด 1–30 วัน'), L('PAWN_Ageing', 'd30', 'Due in 30 days', 'ครบใน 30 วัน'),
    L('PAWN_Ageing', 'd60', 'Due in 31–60 days', 'ครบใน 31–60 วัน'), L('PAWN_Ageing', 'later', 'Due after 60 days', 'ครบหลัง 60 วัน'),
    L('PAWN_PayMode', 'installment', 'Installment', 'ส่งงวด'), L('PAWN_PayMode', 'full', 'Pay in full (redeem)', 'ชำระเต็มจำนวน (ไถ่ถอน)'), L('PAWN_PayMode', 'other', 'Another amount', 'จำนวนอื่น'),
    L('PAWN_ClaimStatus', 'pending', 'Waiting for the shop', 'รอร้านตรวจ'), L('PAWN_ClaimStatus', 'waiting', 'Waiting for bank check', 'รอตรวจกับธนาคาร'), L('PAWN_ClaimStatus', 'verified', 'Verified', 'ตรวจแล้ว'), L('PAWN_ClaimStatus', 'rejected', 'Rejected', 'ไม่ผ่าน'),
    L('PAWN_Channel', 'call', 'Phone call', 'โทรศัพท์'), L('PAWN_Channel', 'line', 'LINE', 'LINE'), L('PAWN_Channel', 'sms', 'SMS', 'SMS'), L('PAWN_Channel', 'visit', 'Visit', 'พบที่ร้าน/เยี่ยม'), L('PAWN_Channel', 'email', 'Email', 'อีเมล'),
    L('PAWN_Outcome', 'promised', 'Promised to pay', 'รับปากว่าจะชำระ'), L('PAWN_Outcome', 'paid', 'Paid', 'ชำระแล้ว'), L('PAWN_Outcome', 'noanswer', 'No answer', 'ติดต่อไม่ได้'),
    L('PAWN_Outcome', 'upsell', 'Offered more lending', 'เสนอวงเงินเพิ่ม'), L('PAWN_Outcome', 'other', 'Other', 'อื่นๆ')
  ];
  // window → tabs (AD_Window / AD_Tab); the grid of each tab lists its table's IsDisplayedGrid columns
  const windows = [{ AD_Window_ID: 1000001, Name: 'Pawn Ticket', WindowType: 'M',
    tabs: [{ AD_Tab_ID: 1000001, Name: 'Ticket', AD_Table_ID: 1000001, TabLevel: 0 }, { AD_Tab_ID: 1000002, Name: 'Payment', AD_Table_ID: 1000002, TabLevel: 1 }, { AD_Tab_ID: 1000003, Name: 'Follow-up', AD_Table_ID: 1000003, TabLevel: 1 }] }];

  // AD_Attachment: files kept with a record (the SlipOK JSON response is stored on the payment); content type + sha256 held in the signed event
  const attachments = [{ AD_Table: 'PAWN_Payment', Title: 'slipok_<transRef>.json', ContentType: 'application/json', Description: 'SlipOK check-slip response (success or 1012/1013/1014 with data)' }];
  const tableOf = n => tables.find(t => t.TableName === n);
  const cols = n => columns.filter(c => c.AD_Table_ID === tableOf(n).AD_Table_ID).sort((a, b) => a.SeqNo - b.SeqNo);
  const list = n => refLists.filter(r => r.AD_Reference_Name === n);
  const label = (n, v, lang) => { const r = list(n).find(x => x.Value === v); return r ? (lang === 'th' ? r.th : r.Name) : v; };
  // ColumnName → key in the dashboard row (the fold's field name)
  const ROWKEY = { Status: 'status', Category: 'cat', RateGroup: 'grp', Risk: 'risk', Ageing: 'ageing', DateTicket: 'month' };
  const dimensions = () => cols('PAWN_Ticket').filter(c => c.IsSelectionColumn === 'Y' && ROWKEY[c.ColumnName]).map(c => ({ dim: ROWKEY[c.ColumnName], col: c }));
  return { tables, columns, refLists, windows, attachments, tableOf, cols, list, label, ROWKEY, dimensions };
})();
