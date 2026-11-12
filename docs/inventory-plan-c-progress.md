# ความคืบหน้าแผน C

> **สถานะล่าสุด 12 พฤศจิกายน 2026:** ทำต่อด้วย Codex แล้ว มีตัวติดตั้งรวม `database_scripts/inventory_compact.sql` เหลือ 8 ตารางคลัง พร้อมทดสอบย้ายข้อมูลและรันซ้ำ รายงานตรวจสอบปัจจุบันอยู่ที่ [inventory-compact-verification.md](inventory-compact-verification.md) ข้อความด้านล่างเป็นบันทึกระหว่างพัฒนา ไม่ใช่คำสั่งติดตั้งล่าสุด ยังไม่ได้รัน SQL บนฐานข้อมูลจริงของผู้ใช้

## ทิศทางล่าสุด: ลดจำนวนตารางและใช้เฉพาะแพ็กเกจฟรี

ผู้ใช้รัน inventory_plan_c.sql และ inventory_production_hub.sql แล้ว และขอให้รวมตารางเพราะสองไฟล์เพิ่มใหม่ 22 ตาราง (15 + 7) มากเกินความจำเป็น ผู้ใช้มีข้อจำกัดงบประมาณ Supabase Free และ uncached egress 5 GB/เดือน ห้ามยึดแผนแยกตารางเดิมต่อโดยไม่ปรับ

หยุด agent ที่ทำโครงสร้างเดิมแล้ว กำลังตรวจแบบรวมประมาณ 7–9 ตารางคลังทั้งหมด (ไม่นับ projects/staff_users/roles ที่ใช้ร่วมกันทั้งแอป) โดยต้องย้ายข้อมูลเดิมครบ ตรวจจำนวน/ยอด/UUID/ประวัติ และไม่ลบข้อมูลเพื่อเริ่มใหม่ ต้องลด payload, โหลดเฉพาะหน้าที่เปิด, pagination, dedup และ realtime ที่รีเฟรชเฉพาะรายการด้วย จำนวนตารางไม่ใช่ตัวคูณ egress โดยตรง

ยังไม่ให้รัน SQL เพิ่มระหว่างเปลี่ยนแบบ และยังไม่ได้ใช้เครื่องมือใดแก้ฐานข้อมูลจริง ตรวจโค้ดและเตรียม migration ใน workspace เท่านั้น

ผู้ใช้อนุมัติให้ลงมือแผน C และทำต่อให้เสร็จเมื่อ 10 พฤศจิกายน 2026 Codex เป็นผู้ควบคุมและตรวจงาน Gemini ผ่าน `agy` เป็นผู้พัฒนา ห้าม git add/commit/push และยังไม่รัน SQL กับ Supabase จริง

ผู้ใช้ย้ำเพิ่มเติม: หน้าคลังและทุกฟอร์มต้องใช้งานบนมือถือได้ง่าย และสีส่วนเน้นต้องเปลี่ยนตามธีมที่เลือก ใช้ CSS variables ที่มีอยู่ใน src/utils/themeManager.js ไม่ตรึงสี rose; สีสถานะและสีของวัสดุยังสื่อความหมายเดิม ส่วน QR ที่พิมพ์ยังเป็นดำบนขาว

ผู้ใช้ลองรัน SQL ระหว่างพัฒนาและพบ syntax error42601 ที่บรรทัด2056 สาเหตุคือบล็อก SET/WHERE ซ้ำหลัง UPDATE cash_update_thresholds ลบส่วนซ้ำแล้วและทดสอบติดตั้งพร้อมรันซ้ำผ่านใน PGlite หลังแก้ แต่ยังมีงานตรวจ integration อื่นต่อ ต้องยึดผลตรวจฉบับสุดท้ายก่อนเปิดใช้งานจริง

## จุดเริ่มต้น

- ก่อนเริ่ม: Git working tree สะอาด ชุดทดสอบเดิม 25/25 ผ่าน และ npm run build ผ่าน
- ทดลอง agy ในโฟลเดอร์แยกสำเร็จ แก้บั๊กจำลองและผ่าน 4/4 ก่อนเริ่มงานจริง
- โมเดลที่ CLI เปิดให้ใช้และเลือกสำหรับรอบนี้: gemini-3.8-flash-high
- เชื่อม Chrome DevTools MCP ผ่าน agy ได้แล้ว และเก็บภาพจาก fixture ข้อมูลจำลอง 6 ขนาดจอใน docs/inventory-plan-c-screenshots ผลยังเป็น preliminary ระหว่างแก้ UI ไม่ใช่การยืนยันกล้องหรือเครื่องพิมพ์จริง

## งานที่กำลังทำ

- ผู้ใช้เพิ่มหน้ากลางงานผลิตตามโปรเจกต์และชื่อจาก DB แล้ว: ข้อกำหนดอยู่ใน docs/inventory-production-hub.md ต้องทำเพิ่มจากแผน C เดิม ไม่ใช่เพียงเปลี่ยนหน้าตา
- กำลังเพิ่ม migration เสริม inventory_production_hub.sql, productionService.js, PersonPicker และ ProductionHubView ให้เชื่อมเบิกครั้งเดียวกับความรับผิดชอบ/ส่งงาน/ตรวจรับ โดยไม่ตัดสต็อกซ้ำ
- ผู้ใช้ต้องการ responsive ครอบคลุมแท็บเล็ต จอแคบ/กว้าง แนวตั้ง/แนวนอน และแบ่งหน้าต่าง ได้ค้นเอกสารผู้ผลิตและกำลังบันทึก test matrix พร้อมปรับสีให้ตาม theme variables
- ผล npm test รอบรวมล่าสุด: 115/117 ผ่าน (รวม parent suite) ยังไม่ผ่าน test ยืนยันเบิกซ้ำใน inventoryComponents ต้องเลือกผู้รับให้ครบใน fixture และทดสอบซ้ำหลัง UI รุ่นใหม่เสร็จ
- Production hub SQL/service รอบแรกผ่าน 17 รายการ แต่ supervisor พบกรณีสิทธิ์ driver แก้งานผ่าน RPC ได้, line ข้าม assignment และ expected_version ที่ว่าง จึงกำลังเพิ่ม regression และแก้ก่อนตรวจรับ
- PersonPicker / ProductionHubView สร้างแล้ว แต่การเชื่อมหน้าหลัก การป้องกัน ID จำลอง การส่งซ้ำ และ responsive/theme ยังอยู่ระหว่างตรวจและแก้ ไม่ถือว่าจบงาน

- Backend session: `83765aed-31dd-48af-8594-75d9b2556bdb` สร้าง migration/service/tests แล้ว อยู่ระหว่างแก้ security, idempotency, atomic mixed issue, lifecycle และ API ที่ขาดตาม review ของ Codex
- QR session: `4a7ac250-46c1-4dd8-92ad-7c6605323055` เพิ่ม dependencies, utility และ tests แล้ว กำลังทำ scanner/print components
- UI assignment: กำลังทำ Inventory ใหม่ เชื่อม backend และ QR หลังตรวจสัญญาข้อมูล
- ยังไม่มีการเปิดใช้ฐานข้อมูลใหม่ใน production และยังไม่ผ่าน final verification

## เอกสารที่ต้องอ่านต่อ

ข้อกำหนดธุรกิจ: docs/inventory-redesign.md เอกสาร API และการเปิดใช้จะอยู่ใน docs/inventory-plan-c-backend.md และ docs/inventory-plan-c-qr.md เมื่อ agent ส่งงานเสร็จ ต้องตรวจไฟล์จริงและรันทดสอบก่อนสรุปว่าเสร็จ

หาก agy headless รายงาน `denied_actions` แม้ status เป็น SUCCESS ถือว่ายังทำงานไม่ครบ ให้ต่อ session เดิมโดยระบุงานค้างและใช้ native file tools; Codex รันคำสั่งตรวจให้ ไม่ใช้การข้ามสิทธิ์ทั้งหมด
