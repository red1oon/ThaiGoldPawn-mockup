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
Object.assign(window.I18N, {
  navBackup:['สำรองข้อมูล','Backup'],
  bkSub:['สำเนาของบันทึกที่เซ็นกำกับทั้งหมดของร้าน เข้ารหัสด้วยรหัสกู้คืนก่อนออกจากเครื่อง นำกลับมาได้ และตรวจความถูกต้องก่อนใช้ทุกครั้ง','A copy of all the shop’s signed records, encrypted with a recovery code before it leaves this device. It can be restored, and is checked before anything is applied.'],
  bkNever:['ยังไม่เคยสำรองข้อมูล','No backup has been made yet.'], bkStaleDays:['ผ่านมานานแล้วตั้งแต่สำรองครั้งล่าสุด','It has been a while since the last backup'], bkStaleEvents:['มีรายการใหม่หลังสำรองครั้งล่าสุด','There are new records since the last backup'],
  bkEvents:['รายการที่บันทึก','records'], bkLast:['สำรองล่าสุด','Last backup'], bkch_file:['ไฟล์','file'], bkch_web:['เว็บ','web'], bkch_share:['แชร์/อีเมล','share/email'], bkch_journal:['บันทึกสำรองอัตโนมัติ','journal'],
  bkCodeHead:['รหัสกู้คืน','Recovery code'], bkCodeNote:['รหัสนี้ใช้เข้ารหัสและเปิดไฟล์สำรอง แสดงเพียงครั้งเดียว ให้จดหรือพิมพ์เก็บไว้ ถ้ารหัสหายจะเปิดไฟล์สำรองไม่ได้','This code encrypts and opens the backup. It is shown once; write it down or print it. If it is lost, the backup cannot be opened.'],
  bkGen:['สร้างรหัสกู้คืนใหม่','Create a new recovery code'], bkCodeOnce:['จดรหัสนี้ไว้ตอนนี้ จะไม่แสดงซ้ำ','Write this code down now. It will not be shown again.'], bkCodeIn:['รหัสกู้คืน','Recovery code'],
  bkLocal:['บันทึกเป็นไฟล์ในเครื่อง','Save to a file on this device'], bkPlain:['ไม่เข้ารหัส (ไม่แนะนำ)','No encryption (not recommended)'], bkPlainWarn:['ไฟล์ที่ไม่เข้ารหัสอ่านได้โดยทุกคนที่ได้ไฟล์ และจะไม่รวมกุญแจเซ็นของร้าน','Anyone who gets an unencrypted file can read it. The shop’s signing key is not included.'],
  bkSave:['บันทึกไฟล์สำรอง','Save backup file'], bkNeedCode:['ใส่รหัสกู้คืนก่อน (หรือสร้างรหัสใหม่)','Enter the recovery code first (or create a new one).'],
  bkRestore:['นำข้อมูลกลับมา','Restore'], bkRestoreNote:['เลือกไฟล์สำรอง ระบบจะเปิดไฟล์ ตรวจทุกสายบันทึก แล้วแสดงสรุปให้ยืนยันก่อน ข้อมูลที่ใหม่กว่าในเครื่องจะไม่ถูกทับ','Choose a backup file. It is opened, every chain is checked, and a summary is shown for you to confirm. Newer data on this device is never overwritten.'],
  bkPick:['ไฟล์สำรอง','Backup file'], bkSummary:['สรุปไฟล์สำรอง','Backup summary'], bkKind:['ชนิด','Kind'], bkVerify:['ตรวจความถูกต้อง','Check'], bkVsLocal:['เทียบกับในเครื่อง','Compared with this device'],
  bkk_shop:['สัญญา (ร้าน)','Ticket (shop)'], bkk_crm:['บันทึกภายในร้าน','Shop-internal'], bkk_phone:['โทรศัพท์ผู้กู้','Borrower phone'],
  bkst_new:['ใหม่ (ไม่มีในเครื่อง)','new (not on this device)'], bkst_same:['เหมือนกัน','same'], bkst_newer_backup:['ไฟล์สำรองใหม่กว่า','backup is newer'], bkst_newer_local:['ในเครื่องใหม่กว่า ไม่ทับ','device is newer, kept'], bkst_diverged:['ไม่ตรงกัน ไม่ทับ','differs, kept'],
  bkBadChains:['สายบันทึกที่ตรวจไม่ผ่าน จะไม่ถูกนำกลับมา','chains failed the check and will not be restored.'], bkApply:['นำกลับมาเฉพาะที่ตรวจผ่าน','Restore the valid ones'], bkCancel:['ยกเลิก','Cancel'],
  bkApplied:['นำกลับมาแล้ว','Restored'], bkSkipped:['ข้าม','skipped'], bkReload:['กำลังโหลดหน้าใหม่','reloading'], bkUnreadable:['อ่านไฟล์นี้ไม่ได้','This file cannot be read.'], bkCannotOpen:['เปิดไม่ได้: รหัสไม่ถูกต้อง หรือไฟล์ถูกแก้ไข','Cannot open: wrong code, or the file was altered.'],
  bkLimits:['ข้อจำกัด: ถ้าไม่มีรหัสกู้คืนจะเปิดไฟล์ไม่ได้ ข้อมูลที่ยังไม่ได้สำรองจะหายถ้าเบราว์เซอร์ถูกล้าง และไฟล์สำรองพิสูจน์ได้ว่าบันทึกไม่ถูกแก้ แต่ไม่ได้พิสูจน์ว่าเนื้อหาเป็นความจริง','Limits: without the recovery code the file cannot be opened; anything not yet backed up is lost if the browser is cleared; a backup proves the records were not altered, not that their content is true.']
});
Object.assign(window.I18N, {
  bkWeb:['ส่งไปยังที่อยู่เว็บ','Send to a web address'], bkWebNote:['ส่งไฟล์ที่เข้ารหัสแล้วไปยัง URL ของร้านเอง ผู้รับเก็บได้เฉพาะข้อมูลที่อ่านไม่ได้ ใช้ที่อยู่ demo: เพื่อลองใช้โดยไม่ต้องมีเซิร์ฟเวอร์ (เก็บในเบราว์เซอร์นี้ เป็นตัวแทน)','Sends the already-encrypted file to a URL the shop owns. The receiver only keeps data it cannot read. Use the address demo: to try it without a server (kept in this browser, a stand-in).'],
  bkWebUrl:['ที่อยู่เว็บ','Web address'], bkWebToken:['โทเคนเข้าถึง','Access token'], bkSend:['ส่งสำรองตอนนี้','Send backup now'], bkFetch:['ดึงฉบับล่าสุดจากเว็บ','Fetch the latest from the web'],
  bkRcptId:['รหัสใบรับ','Receipt'], bkSent:['ส่งแล้ว ใบรับตรงกับไฟล์','Sent; the receipt matches the file'], bkShaMismatch:['ใบรับไม่ตรงกับไฟล์ที่ส่ง','The receipt does not match the file that was sent'],
  bkFail:['ส่งไม่สำเร็จ','Not sent'], bkNet:['ติดต่อไม่ได้','cannot connect'], bkNotBacked:['ยังไม่ถือว่าสำรองแล้ว','This is NOT counted as backed up.'],
  bkDemoHead:['เซิร์ฟเวอร์ตัวอย่าง (ในเบราว์เซอร์นี้)','Demo server (in this browser)'], bkDemoNote:['จำลองการตอบกลับแบบเดียวกับเซิร์ฟเวอร์จริง แสดงสิ่งที่เซิร์ฟเวอร์เห็น: เฉพาะข้อมูลเข้ารหัส','Answers like a real server would, and shows what it sees: encrypted data only.'],
  bkDemoDown:['จำลองว่าเซิร์ฟเวอร์ใช้งานไม่ได้','Pretend the server is down'], bkDemoSees:['เซิร์ฟเวอร์เห็น (ต้นข้อมูลเข้ารหัส)','The server sees (start of the ciphertext)']
});
Object.assign(window.I18N, {
  bkShare:['แชร์ / ส่งอีเมล','Share / email'], bkShareNote:['มือถือ: เปิดหน้าต่างแชร์พร้อมไฟล์ (อีเมล LINE ไดรฟ์) คอมพิวเตอร์: บันทึกไฟล์แล้วเปิดโปรแกรมอีเมลพร้อมข้อความสรุป ให้แนบไฟล์เอง เบราว์เซอร์ส่งอีเมลเองโดยอัตโนมัติไม่ได้ ขั้นตอนนี้จึงต้องกดเอง','Phone: opens the share sheet with the file (mail, LINE, drive). Computer: saves the file and opens the mail program with a short summary; attach the file yourself. A browser cannot send mail on its own, so this step is manual.'],
  bkMailTo:['อีเมลผู้รับ (ไม่บังคับ)','Recipient email (optional)'], bkShareBtn:['แชร์ / เตรียมอีเมล','Share / prepare email'], bkShared:['แชร์แล้ว','Shared'], bkShareCancelled:['ยกเลิกการแชร์','Share cancelled'],
  bkMailPrepared:['บันทึกไฟล์แล้ว และเปิดอีเมลให้ แนบไฟล์แล้วกดส่ง (ระบบยืนยันการส่งให้ไม่ได้)','File saved and mail opened; attach it and send (delivery cannot be confirmed here)']
});
Object.assign(window.I18N, {
  bkJournal:['บันทึกสำรองอัตโนมัติ (กล่องดำ)','Automatic journal (black box)'], bkJournalNote:['ทุกรายการใหม่จะถูกเข้ารหัสและส่งไปเก็บต่อท้ายที่เซิร์ฟเวอร์เป็นระยะ เมื่อร้านหยุดทำงานสักครู่ ระบบไม่หยุดรอ เซิร์ฟเวอร์เก็บต่อท้ายได้อย่างเดียว ลบหรือแก้ไม่ได้ และอ่านเนื้อหาไม่ได้ ใช้ที่อยู่เว็บและโทเคนด้านบน','Every new record is encrypted and sent to be appended on a server, a little after the shop stops working; nothing waits. The server can only append, cannot edit or delete, and cannot read the content. It uses the web address and token above.'],
  bkJOn:['เปิดการส่งอัตโนมัติ','Turn on automatic sending'], bkJNeedCode:['ใส่รหัสกู้คืนเพื่อเริ่มส่ง (รหัสไม่ถูกเก็บในเครื่อง)','Enter the recovery code to start sending (the code is not stored on this device).'],
  bkJSynced:['ส่งแล้ว','sent'], bkJPending:['ยังไม่ได้ส่ง','not yet sent'], bkJLastTry:['พยายามส่งล่าสุด','last try'], bkJSend:['ส่งที่ค้างอยู่ตอนนี้','Send the pending ones now'], bkJAudit:['ตรวจกับเซิร์ฟเวอร์','Audit against the server'], bkJRestore:['กู้คืนจากบันทึกสำรอง','Restore from the journal'],
  bkJKept:['รายการที่ค้างยังอยู่ และจะส่งใหม่','The pending records are kept and will be sent again.'], bkAChain:['ลำดับของเซิร์ฟเวอร์ต่อเนื่อง','Server order is continuous'], bkAMissing:['เซิร์ฟเวอร์ไม่มีรายการ','Missing on the server'], bkAAltered:['เซิร์ฟเวอร์เก็บรายการที่ไม่ตรง','Altered on the server'], bkAServer:['รายการที่เซิร์ฟเวอร์เก็บ','Records held by the server'],
  bkABad:['พบความผิดปกติที่เซิร์ฟเวอร์ เก็บใบรับไว้เป็นหลักฐาน','A problem was found on the server. Keep your receipts as evidence.'], bkAGood:['ทุกรายการที่ส่งแล้วตรงกับเซิร์ฟเวอร์','Every record sent matches the server.'],
  bkJLimits:['ข้อจำกัด: เซิร์ฟเวอร์พิสูจน์ได้เพียงว่ารับรายการตามลำดับนี้และไม่ถูกแก้ ไม่ได้พิสูจน์ว่าเนื้อหาเป็นจริง รายการที่ยังไม่ได้ส่งจะหายหากเบราว์เซอร์ถูกล้างก่อน และเซิร์ฟเวอร์อาจปฏิเสธบริการได้','Limits: the server can only prove it received these records in this order, unaltered; not that they are true. Records not yet sent are lost if the browser is cleared first, and the server may refuse service.']
});
Object.assign(window.I18N, { bkJServer:['รายการในบันทึกสำรองของเซิร์ฟเวอร์','Records in the server journal'] });
Object.assign(window.I18N, { wt_safe:['ความปลอดภัยของข้อมูล','Data safety'], bkNone:['ยังไม่เคย','never'], bkJOff:['บันทึกสำรองอัตโนมัติปิดอยู่','Automatic journal is off'] });
Object.assign(window.I18N, { bkEmpty:['ยังไม่มีบันทึกของร้านในเครื่องนี้ ข้อมูลตัวอย่างไม่ถูกสำรอง ออกใบขายฝากก่อนเพื่อลองสำรอง','There are no shop records on this device yet. Sample data is not backed up; issue a ticket first to try a backup.'] });
