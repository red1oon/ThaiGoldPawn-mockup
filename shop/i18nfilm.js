// Film mode (window.__film set by the recorder): viewer-facing wording only — positive statements of what the screens show.
if (window.__film) Object.assign(window.I18N, {
  slipSim:['สลิปที่ส่ง','Slip sent'], code:['รหัสยืนยันครั้งเดียว','One-time code'],
  codeNote:['รหัสยืนยันมาจากร้าน','The one-time code comes from the shop.'],
  previewNote:['รายการบัญชีและรายงานคำนวณจากรายการเดียวกับแดชบอร์ด','Journals and reports are produced from the same events as the dashboard.'],
  tokenNote:['ทุกข้อความเป็นโทเคนที่เซ็นกำกับและเชื่อมกับรายการก่อนหน้า','Each message is a signed token, linked to the previous record.'],
  navThai:['เหมาะกับประเทศไทย','Made for Thailand'], thaiHead:['เหมาะกับประเทศไทย','Made for Thailand'], thaiSub:['สิ่งที่ใช้อยู่แล้วในระบบนี้','What the system already uses.'],
  ch12t:['เหมาะกับประเทศไทย','Made for Thailand'], ch12s:['พร้อมเพย์ ลิงก์ผ่าน LINE WhatsApp และ SMS และหน้าจอภาษาไทยและอังกฤษ','PromptPay, share links through LINE, WhatsApp and SMS, and Thai and English screens.'],
  loSub:['ทำงานอย่างไรเมื่อไม่มีเซิร์ฟเวอร์คลาวด์','How it works without a cloud server.'],
  lo6:['ค่าใช้จ่าย: แกนหลักไม่ต้องมีเซิร์ฟเวอร์ฐานข้อมูลหรือค่าใช้จ่ายต่อผู้ใช้ การตรวจสลิปด้วย SlipOK คิดเป็นแพ็กเกจรายเดือน ตั้งแต่ 0 บาท (100 สลิป) ถึง 2,580 บาท (6,000 สลิป)','Cost: no database server and no per-user charge for the core. The SlipOK slip check is a monthly plan, from 0 baht (100 slips) to 2,580 baht (6,000 slips).'],
  ch3s:['ชำระผ่านพร้อมเพย์ ร้านตรวจสลิปด้วย SlipOK และบันทึกคำตอบไว้กับรายการชำระ','Payment goes through PromptPay. The shop checks the slip with SlipOK and keeps the answer with the payment record.'],
  ch8s:['ระบบ ERP หลักอยู่เบื้องหลัง รายการบัญชีและรายงานคำนวณจากรายการเดียวกัน','The kernel ERP is behind this. Journals and reports come from the same events.'],
  lo_ok:['ทำได้','In place'],
  closeS:['ทำงานออฟไลน์ได้ · ไม่ต้องมีเซิร์ฟเวอร์คลาวด์ · ทุกรายการเซ็นกำกับ','Works offline · No cloud server needed · Every record signed'],
  demoDate:['วันที่วันนี้','Today’s date'],
  fpL1:['การชำระเงิน','Payment done'], fpL2:['เจาะลึก','in depth'], fpS:['ใบเสนอที่เข้ารหัส และการชำระเงินหนึ่งรายการจากโทรศัพท์ถึงสมุดบัญชีของร้าน','The sealed offer, and one payment from the phone to the shop\'s ledger'],
  fpAt:['เข้ารหัสใบเสนอ','Sealing the offer'], fpAs:['เปิดได้ด้วยรหัสครั้งเดียว ข้อความทุกชิ้นมีแม่กุญแจ','Events, keys and wire format: what is signed, what is sealed, and what a carrier can see.'],
  fpBt:['การชำระเงินหนึ่งรายการ เจาะลึก','One payment, in depth'], fpBs:['ตั้งแต่เลือกจำนวนเงิน จนร้านบันทึกและส่งใบเสร็จกลับ','Quote, claim, SlipOK check, signed record, evidence, refusals, receipt, usage.'],
  fpCloseS:['ทุกขั้นเป็นเหตุการณ์ที่เล่นซ้ำและตรวจสอบได้','Every step is an event that can be replayed and verified.']
});
