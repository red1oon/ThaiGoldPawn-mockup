// Dashboard infographics, collateral locator and SlipOK usage (spec §18). Key → [th, en]. Plain wording.
Object.assign(window.I18N, {
  navLocator:['คลังหลักประกัน','Collateral locator'], navSlip:['ตรวจสลิป SlipOK','SlipOK usage'],
  wt_flow:['เส้นทางของสัญญาทั้งหมด','Loan lifecycle'], wt_book:['เงินต้นที่ปล่อยอยู่ ตามระดับความเสี่ยง','Open principal by risk'], wt_nplg:['อัตรา NPL','NPL ratio'],
  wt_slipm:['โควตาตรวจสลิปเดือนนี้','Slip-check quota this month'], wt_vault:['แผนผังห้องนิรภัย','Vault map'], wt_unloc:['ทรัพย์ที่ยังไม่ระบุที่เก็บ','Items not located'],
  wt_aisle:['เงินต้นตามแถวที่เก็บ','Principal by aisle'], wt_donutcat:['เงินต้นตามประเภททรัพย์ (โดนัท)','Principal by collateral (donut)'], c_donut:['โดนัท','Donut'], sc_unlocated:['ยังไม่ระบุที่เก็บ','Not located'],
  total:['รวม','Total'], ctFilter:['ค้นหา','Filter'],
  stkSub:['ทรัพย์หลักประกันอยู่ที่ไหน: คลัง แถว ช่อง ชั้น (เช่น A-03-2) และเลขถุง ล็อตเดียวต่อสัญญา ต่ออายุแล้วล็อตเดิมตามไป ทุกการเก็บ ย้าย นำออก เป็นเหตุการณ์ที่เซ็นกำกับภายในร้าน','Where each pawned item is: warehouse, aisle, bin, level (e.g. A-03-2) and bag number. One lot per ticket chain; a renewal keeps the lot. Every put-away, move and take-out is a signed event inside the shop.'],
  stkInVault:['ในห้องนิรภัย','In the vault'], stkForfeit:['สต็อกทองหลุด','Forfeited stock'], stkUnlocated:['ยังไม่ระบุที่เก็บ','Not located'],
  stkMap:['แผนผังช่องเก็บ','Locator map'], stkMapHint:['แถวคือแถวที่เก็บ คอลัมน์คือช่อง ตัวเลขคือจำนวนถุง แตะเพื่อกรอง','rows = aisles, columns = bins, number = bags; tap to filter'],
  stkPutMove:['เก็บเข้า / ย้ายที่เก็บ','Put away / move'], stkLocator:['ช่องเก็บ','Locator'], stkBag:['เลขถุง/ห่อ','Bag / pack no.'], stkLot:['ล็อต','Lot'],
  stkApply:['บันทึกที่เก็บ','Save location'], stkWillMove:['จะบันทึก','Will record'], stkNone:['ยังไม่ระบุ','not located'], stkAuto:['เสนอช่องว่าง','Suggest a slot'],
  stkAllLocated:['ทุกสัญญาที่เปิดอยู่ระบุที่เก็บแล้ว','Every open ticket has a location.'], stkList:['รายการในช่องเก็บ','Items in the locators'], stkClear:['ล้างตัวกรอง','Clear'],
  stkCount:['ตรวจนับสิ้นวัน','Day-end count'], stkCountHint:['จำนวนที่ควรมี = สัญญาที่เปิดอยู่ในช่องนั้น กรอกจำนวนที่นับจริง','expected = open tickets in that locator; type what was counted'],
  stkExpected:['ควรมี','Expected'], stkCounted:['นับได้','Counted'], stkVariance:['ผลต่าง','Variance'], stkSaveCount:['บันทึกผลตรวจนับ','Save the count'], stkSaved:['บันทึกผลตรวจนับแล้ว','Count saved'],
  stkMoves:['ความเคลื่อนไหวล่าสุด','Recent movements'], stkhow_in:['เก็บเข้า','Put away'], stkhow_move:['ย้าย','Move'], stkhow_out:['นำออก (ไถ่ถอน)','Taken out (redeemed)'], stkhow_forfeit:['โอนเป็นสต็อกทองหลุด','Moved to forfeited stock'],
  slipSub:['จำนวนครั้งที่ร้านเรียกตรวจสลิปกับ SlipOK ในแต่ละเดือน เทียบกับโควตาของแพ็กเกจ และค่าใช้จ่ายโดยประมาณ นับจากเหตุการณ์ชำระเงิน ไม่เก็บยอดรวมไว้ต่างหาก','How many times the shop asked SlipOK to check a slip each month, against the plan’s quota, and the estimated cost. Counted from the payment events; no separate totals are kept.'],
  slipPlan:['แพ็กเกจ (ค่าบริการ / โควตา)','Plan (fee / quota)'], slipMonth:['เดือน','Month'], slipOverRate:['ค่าตรวจเกินโควตา (บาท/สลิป)','Over-quota price (THB/slip)'],
  slipWarn80:['ใช้โควตาไปแล้วกว่า 80%','More than 80% of the quota is used.'], slipWarn100:['ใช้โควตาครบแล้ว การตรวจเพิ่มจะคิดเงินตามแพ็กเกจ','The quota is used up; further checks are charged by the plan.'],
  slipUsed:['ใช้โควตา','Quota used'], slipChecks:['ครั้ง','checks'], slipOver:['เกินโควตา','Over quota'], slipCost:['ค่าใช้จ่ายโดยประมาณ','Estimated cost'], slipRateMissing:['ยังไม่ทราบค่าตรวจเกินโควตา','over-quota price not entered'],
  slipPerPay:['ต่อการชำระที่ตรวจผ่าน','Per verified payment'], slipRej:['ถูกปฏิเสธ','rejected'], slipMonthly:['จำนวนครั้งตรวจต่อเดือน','Checks per month'], slipLast:['การตรวจล่าสุด','Latest checks'],
  slipResult:['ผล','Result'], slipRef:['อ้างอิง','Reference'], slipOk:['ผ่าน','passed'],
  slipNote:['ตัวเลขนี้เป็นการประมาณจากราคาแพ็กเกจที่บันทึกไว้ ใบแจ้งหนี้จริงของ SlipOK เป็นตัวตัดสิน รหัส 1009, 1010, 1003, 1004 ไม่ใช้โควตา','This is an estimate from the plan prices on record. SlipOK’s own invoice is the authority. Codes 1009, 1010, 1003 and 1004 use no quota.']
});
