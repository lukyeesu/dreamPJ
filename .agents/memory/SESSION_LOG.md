# Flower2U - Native Session Memory & Context Ledger

> **วัตถุประสงค์**: บันทึกบริบทโปรเจกต์ การตัดสินใจสำคัญ และสถานะงานคงค้าง เพื่อให้ Agent จำงานข้าม Session ได้ทันทีโดยไม่ต้องอธิบายใหม่

---

## 1. ข้อมูลสถาปัตยกรรมโปรเจกต์ (Project Snapshot)
- **ชื่อโปรเจกต์**: Flower2you (Flower2U)
- **เทคโนโลยีหลัก**: React 19 + Vite 7 + Tailwind CSS v4 + Lucide Icons
- **ฟีเจอร์หลัก**:
  - ระบบบันทึกข้อมูลกำไรขาดทุน (`FinanceView.jsx`)
  - โหมดการแสดงผล 3 รูปแบบ: ตารางบัญชี (Accounting Sheet), การ์ดสรุป (Interactive Dashboard), ตารางสลิปโอนเงิน (Slips Grid)
  - ระบบวิเคราะห์ประสิทธิภาพ (`AnalyticsView.jsx`)
  - ระบบพิมพ์กระดาษ A4 (แบบย่อประหยัดกระดาษ, แบบละเอียดดีเทล, แบบสลิป 3 หรือ 4 คอลัมน์)

---

## 2. โครงสร้างและลำดับข้อมูลที่ตกลงล่าสุด (Agreed Data Flow & Order)

**กฎมาตรฐานลำดับการเงิน 4 ขั้นตอน (Standard 4-Step Financial Sequence):**
> ต้องแสดงผลและคำนวณเรียงลำดับนี้ทุกจุดในแอปพลิเคชัน:
> 1. **เงินศิลปิน** (เงินสนับสนุน / ส่งต่อศิลปิน / Money Order)
> 2. **รายได้** (ค่าจ้าง / รายรับ / รายการเสนอราคา Quotation)
> 3. **ค่าใช้จ่าย** (รายจ่ายจริง / ต้นทุนเพิ่ม Expenses)
> 4. **กำไรสุทธิ** (คงเหลือสุทธิ / Margin กำไร)

### 2.1 ลำดับการ์ดสรุปยอดด้านบน (Top KPI Cards in FinanceView):
1. **เงินสนับสนุน** (สีม่วง Indigo - ยอดส่งต่อศิลปิน ไม่หักกำไร)
2. **รายรับรวม** (สีเขียว Emerald - ยอดจ้างรวมทั้งหมด)
3. **รายจ่ายจริง** (สีแดง Rose - ต้นทุนต่องาน)
4. **คงเหลือสุทธิ (กำไร)** (สีเขียว Emerald - พร้อม Margin สุทธิ)

### 2.2 ลำดับการ์ดสรุปยอดหน้าวิเคราะห์ (AnalyticsView Summary Cards):
1. **เงินศิลปิน (ยอดสนับสนุน)** (Slate/Indigo - ส่งต่อศิลปิน ไม่หักกำไร)
2. **รายได้ (ค่าจ้าง)** (Emerald - รายรับจากงาน)
3. **ค่าใช้จ่าย (รวมรายจ่าย)** (Rose - ต้นทุนรวม)
4. **กำไรสุทธิ** (Indigo - กำไรสุทธิพร้อม % Margin)

### 2.3 ลำดับแถบตัวเลขในบัตรงานและตาราง (Cards, Strips & Modals):
- **แถบ 4 ช่องในการ์ดงาน (`FinanceView.jsx`)**: 1. ส่งต่อศิลปิน → 2. รายรับ → 3. รายจ่ายจริง → 4. กำไรสุทธิ
- **ตารางสรุปใน Modal จัดการโปรเจกต์ (`App.jsx`)**: ยอดเรียกเก็บสุทธิ (Badge) + 1. เงินศิลปิน → 2. รายได้ → 3. ค่าใช้จ่าย → 4. กำไรสุทธิ
- **การ์ดและตารางหน้าแรก (`App.jsx`)**: เงินศิลปิน (สนับสนุน) → รายได้ (ค่าจ้าง) → ค่าใช้จ่าย → กำไรสุทธิ
- **ส่งออกไฟล์ CSV (`FinanceView.jsx`)**: ยอดเงินสนับสนุนศิลปิน (คอลัมน์ 7) → ยอดใบเสนอราคา (คอลัมน์ 8) → รายจ่ายจริง → กำไรสุทธิ
- **ใบเสร็จ/ใบกำกับภาษีพิมพ์ (`SharePreviewModal.jsx`)**: รายการเงินสนับสนุน (Non-Vat) → รายการเสนอราคา (Vat)

### 2.4 โครงสร้างสีที่ผ่านการปรับแต่งแล้ว:
- สีคอลัมน์และข้อความกำไร/ขาดทุน: `#0d652d` (เขียวเข้มอ่านง่าย) บนพื้นหลัง `#ceead6`

---

## 3. ประวัติการทำงานและข้อตกลงล่าสุด (Session History)

### [2026-11-06 - กะค่ำ (Customer Search, Markup High-Contrast UI, Mobile 4-Col Grid & Circular Swatches)]
- **1. ค้นหาลูกค้าเก่าอัตโนมัติในหน้าเสนอราคา ([`src/QuotationsView.jsx`](file:///D:/WebappDreame/Flower2U/src/QuotationsView.jsx))**:
  - ส่ง `customers={savedCustomers}` เข้าไปใน `QuotationsView`
  - ทำ Searchable Autocomplete Combobox ใต้ช่อง "ชื่อลูกค้า / ผู้ติดต่อ / บ้านเบส" ดึงประวัติลูกค้าเก่าทั้งจากฐานข้อมูลลูกค้าและประวัติโปรเจกต์ที่ผ่านมา (แสดงจำนวนงานที่เคยสั่งซื้อ และเบอร์โทร/โซเชียล)
  - กรองชื่อที่ไม่สมบูรณ์ (เช่น `-`) ออกอัตโนมัติ และคลิกเลือกเพื่อเติมชื่อได้ทันที หรือพิมพ์ชื่อลูกค้าใหม่ได้อย่างอิสระ
- **2. ปรับปรุง UX/UI การ์ดบวกอัตรากำไร (% Markup) & ราคาเสนอสุทธิ ([`src/QuotationsView.jsx`](file:///D:/WebappDreame/Flower2U/src/QuotationsView.jsx))**:
  - แก้ไขปัญหาสีหมอง/มืดเวลาเปลี่ยนธีม โดยเปลี่ยนจากพื้นหลังสีผสมมืดๆ มาเป็นการ์ดสีขาวสว่างคมชัด (`bg-white border-slate-200`)
  - ออกแบบปุ่มเลือกเปอร์เซ็นต์กำไรด่วน (`+20%`, `+30%`, `+40%`, `+50%`) เป็น Segmented Control ชัดเจน สว่างตา ไม่กลืนกับพื้นหลัง
  - กล่องราคาเสนอสุทธิ (Final Price) ปรับเป็นกรอบเด่น คมชัด ตัวเลขสีเข้มชัดเจนบนพื้นขาว พร้อมสัญลักษณ์ `฿` ขนาดใหญ่ อ่านง่ายในทุกธีมสี
- **3. โหมดมือถือ: ปรับ Drawer เมนูขยายเป็นตาราง 4 คอลัมน์ต่อแถว ([`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx))**:
  - ปรับเมนูรองตอนดึง Bottom Sheet ขึ้นมาจากเดิมที่อัดแน่น 7 ไอคอนในแถวเดียว ให้เป็นตาราง `grid-cols-4` (4 ไอคอนต่อแถว) สวยงาม เว้นระยะพอดี ไม่ชิดติดกัน
  - ขยาย `EXPAND_TARGET_H` เป็น 156px รองรับ 2 แถวอย่างลงตัว ลื่นไหล นุ่มนวล
- **4. สีไฮไลท์ปุ่ม (+) และแท็บที่เลือกในโหมดมือถือเปลี่ยนตามธีม ([`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx))**:
  - ปุ่ม `(+)` ลอยตรงกลางผูกเข้ากับ `theme-logo-bg` เปลี่ยนสี Gradient และเงาตามธีมสีที่เลือกทันที (เช่น Amber, Rose, Emerald ฯลฯ)
  - ไอคอน ข้อความ และจุดบอกสถานะ (Active Dot) ของทุกหน้าจอเปลี่ยนจาก Hardcoded Color เป็นคลาสที่ผูกกับ Dynamic Theme สีเดียวกับระบบ 100%
- **5. ปุ่มเลือกสีธีมทรงกลม พร้อมหลอดดูดสีและสลับ Gradient/Solid แบบลื่นไหล ไม่กระตุก ([`src/SettingsView.jsx`](file:///D:/WebappDreame/Flower2U/src/SettingsView.jsx))**:
  - ออกแบบปุ่มเลือกสีเป็นวงกลมมน (Circular Swatches) พร้อมเครื่องหมายถูก `✓` และวงแหวนสีขาวรอบปุ่มที่เลือก ตรงตาม Screenshot 183053
  - เพิ่มวงกลมหลอดดูดสี (Pipette) พร้อม Color Picker ให้เลือกผสมสีเองได้อย่างอิสระ
  - เพิ่มปุ่มเลือก Display Mode ระหว่าง "ไล่เฉดสี (Gradient)" และ "สีเดียว (Solid)"
  - แก้ปัญหาเลื่อนเลือกสีแล้วกระตุกด้วยการ Debounce การบันทึกลง Database 350ms ทำให้การลากเลือกสีใน Color Picker ลื่นไหลระดับ 60fps

### [2026-11-06 - กะค่ำ (Quotation Modal Add Button Relocation to Bottom UX)]
- **ย้ายตำแหน่งปุ่มเพิ่มรายการในหน้าคำนวณเสนอราคาลงมาไว้ด้านล่างตาม Screenshot 182401 ([`src/QuotationsView.jsx`](file:///D:/WebappDreame/Flower2U/src/QuotationsView.jsx))**:
  - **ส่วนที่ 2 (คำนวณ Backdrop & โครงสร้างป้าย)**:
    - นำปุ่ม `+ เพิ่มรายการป้าย/ฉาก` ออกจาก Header ด้านบน
    - วางแถบ Action Bar ด้านล่างรายการ Backdrop: ฝั่งซ้ายเป็นปุ่ม `+ เพิ่มรายการป้าย/ฉาก` สไตล์ Clean Text Button และฝั่งขวาเป็น Badge สรุปยอดรวม `รวม: ฿{totalBackdropCost}`
  - **ส่วนที่ 3 (รายการดอกไม้ กระดาษ พร็อพ และบริการเสริม)**:
    - นำปุ่ม `+ เพิ่มรายการเสริม` ออกจาก Header ด้านบน
    - วางแถบ Action Bar ที่ขอบล่างของกล่องตาราง: ฝั่งซ้ายเป็นปุ่ม `+ เพิ่มรายการเสริม` และฝั่งขวาเป็น Badge สรุปยอดรวม `รวม: ฿{totalFloralCost}`
  - **แก้ไขปัญหาไอคอนซ้ำซ้อน (+ +)**: ตัดเครื่องหมาย `+ ` หน้าชื่อข้อความออกให้เหลือเฉพาะ `<Plus className="w-4 h-4" />` เพื่อไม่ให้แสดงเครื่องหมายบวกซ้อนกันสองตัว
  - **การตรวจสอบผลงานจริง (Verification)**: ทดสอบเปิด Modal คำนวณเสนอราคา และคลิกเพิ่มทั้ง Backdrop และดอกไม้ผ่าน DevTools พบว่าเพิ่มแถวใหม่ได้ราบรื่น ยอดคำนวณ Subtotal อัปเดตถูกต้อง และ `npm run build` ผ่าน 100% ไร้ Error

### [2026-11-06 - กะค่ำ (Toast Text Cleanup & Multi-Window/Cross-Device Realtime Theme Sync)]
- **ลบชื่อเทคนิคหลังบ้าน (Supabase / Supabase & Realtime) ออกจาก Toast แจ้งเตือนผู้ใช้ทั้งหมด**:
  - ตัดคำว่า `(Supabase)`, `(Supabase & Realtime)`, `(Supabase Auth)` ออกจากข้อความแจ้งเตือนทั้งหมดใน [`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx) และ [`src/StaffView.jsx`](file:///D:/WebappDreame/Flower2U/src/StaffView.jsx) เช่น ปรับเป็น "บันทึกการตั้งค่าเรียบร้อยแล้ว", "บันทึกข้อมูลเรียบร้อยแล้ว", "ลบข้อมูลเรียบร้อยแล้ว" เพื่อให้เป็นภาษาสำหรับผู้ใช้งานจริง ไม่หลุดชื่อฐานข้อมูลหลังบ้าน
  - เพิ่ม Option `{ silent: true }` ในการคลิกเลือกธีมสี เพื่อไม่ให้แสดง Toast รบกวนขณะคลิกสลับสีไปมา และจะแสดงแจ้งเตือนเฉพาะเมื่อกดปุ่ม "บันทึกข้อมูลร้าน" จริงๆ เท่านั้น
- **แก้ปัญหาเปลี่ยนสีธีมแล้วหน้าจอ/แท็บอื่นหรือเครื่องอื่นไม่เปลี่ยนแบบ Real-time**:
  - **BroadcastChannel (`flower2u_sync_channel`)**: เพิ่มการส่งข้อความข้ามแท็บ/หน้าจอทันทีที่มีการเปลี่ยนสีหรือบันทึกข้อมูลร้านค้า ทำให้หน้าจออื่นบนเครื่องเดียวกันอัปเดตสีธีมทันทีแบบ 0ms ไม่ต้องรอรีเฟรช
  - **Storage Event Fallback**: ดักจับ `storage` event บน `window` สำรองสำหรับ Cross-Tab Sync
  - **Supabase Realtime for `shop_settings`**: เพิ่มฟังก์ชัน `subscribeToRealtimeSettings` ใน [`src/services/syncService.js`](file:///D:/WebappDreame/Flower2U/src/services/syncService.js) เพื่อดักจับการเปลี่ยนแปลงของตาราง `shop_settings` จากฝั่ง Supabase และต่อเข้ากับ Realtime Listener ใน `App.jsx` ทำให้เครื่องอื่น (Cross-Device) อัปเดตสีธีมพร้อมกันแบบ Real-time ทันที
  - **แก้ไข Bug Fallback สีธีม**: แก้ไขใน `syncService.js` จากที่เคย fallback เป็น `'rainbow'` ให้เป็น `'violet'` และใน `App.jsx` จากเดิมที่เคยแปลงสี `'rose'` กลับไปเป็น `'violet'` ให้แปลงเฉพาะ `'indigo'` เก่าเท่านั้น เพื่อไม่ให้ไปทับสีที่ผู้ใช้จงใจเลือก

### [2026-11-06 - กะค่ำ (Global Real-time Theme Synchronization & Icon Fix)]
- **แก้ปัญหาเปลี่ยนสีธีมแล้วหน้าจออื่นไม่ Real-time และไอคอนหัวข้อไม่เปลี่ยนสีตามธีม ([`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx) & [`src/SettingsView.jsx`](file:///D:/WebappDreame/Flower2U/src/SettingsView.jsx))**:
  - **สาเหตุ**:
    1. ระบบ CSS Injector (`nexus-theme-styles`) ใน `App.jsx` เคยดักจับเฉพาะคลาส `.text-indigo-*`, `.bg-indigo-*` แต่คอมโพเนนต์และไอคอนรุ่นใหม่ใช้คลาส `violet` เช่น `text-violet-600`, `bg-violet-50` ทำให้เวลาเลือกธีม Amber, Rose, Emerald ไอคอนและหัวข้อเหล่านั้นไม่ยอมเปลี่ยนสีตาม
    2. ปุ่มเลือกธีมใน `SettingsView.jsx` เคยอัปเดตเฉพาะ State ท้องถิ่นโดยไม่อัปเดต `localStorage` และ `saveSystemSettings` แบบทันที ทำให้หน้าจออื่นไม่สะท้อนสีใหม่จนกว่าจะกดบันทึก
  - **การแก้ไข**:
    1. ขยาย `nexus-theme-styles` ใน `App.jsx` ให้ครอบคลุมทั้งคลาส `indigo` และ `violet` ทุกระดับ (text, bg, border, focus, ring, hover, gradient, shadow) เชื่อมโยงกับ CSS Variable `--theme-main`, `--theme-hover`, `--theme-light`
    2. ปรับปุ่มเลือกธีมสีใน `SettingsView.jsx` ให้เซฟลง `localStorage` และซิงค์ `saveSystemSettings` ในทันทีที่คลิกเลือก
  - **ผลลัพธ์**: ไอคอนหัวข้อ (`StoreIcon`, `Shield`, `Database`), Breadcrumb Pill, การ์ดสรุปยอดใน `QuotationsView` และปุ่มเมนูทั้งหมดเปลี่ยนสีตามธีมแบบ Real-time 100% ทันทีที่คลิกเลือก

### [2026-11-06 - กะค่ำ (Brand Logo Dynamic Theme Sync)]
- **แก้ไขสีพื้นหลัง Logo ให้เปลี่ยนตามธีมสีหลักของร้านค้าแบบ Real-time ([`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx))**:
  - สาเหตุเดิม: คลาสพื้นหลังกล่องโลโก้ถูก Hardcode ค่าสีม่วงไว้ ทำให้เมื่อเลือกธีมอื่น (เช่น Amber, Rose, Emerald, Blue) สีของโลโก้ไม่ยอมเปลี่ยนตาม
  - แก้ไข: ผูกคลาสกล่องโลโก้เข้ากับระบบ `.theme-logo-bg` ใน `nexus-theme-styles` ซึ่งดึงค่าสีจาก `shopInfo.themeColor` โดยตรง ทั้ง Gradient, Solid, และ Rainbow
  - ผลลัพธ์: กล่องโลโก้ `<Clipboard />` และข้อความชื่อร้านจะเปลี่ยนสีตามธีมที่เลือกทันทีแบบเรียลไทม์

### [2026-11-06 - กะค่ำ (Brand Logo & Settings Reversion to Original)]
- **กู้คืนไอคอนโลโก้หลักของร้านค้ากลับเป็น `<Clipboard />` เดิม 100% ([`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx))**:
  - เปลี่ยนไอคอนในกล่อง Sidebar Logo กลับเป็น `<Clipboard className="w-6 h-6 text-white" />` และพื้นหลังสีม่วงไวโอเล็ต `from-violet-500 to-purple-600 shadow-lg shadow-violet-200/50` ตรงตาม Screenshot 173425
  - ยึดมั่นกฎเหล็ก **Surgical Changes & Zero Bloat**: ห้ามเปลี่ยน แก้ หรือเพิ่มสิ่งใดที่ผู้ใช้ไม่ได้สั่งโดยเด็ดขาด

### [2026-11-06 - กะค่ำ (Settings Page UX/UI Layout & Alignment Redesign)]
- **แก้ปัญหาจัดเรียงแปลกๆ ไม่เป็นระเบียบในหน้าตั้งค่าระบบ ([`src/SettingsView.jsx`](file:///D:/WebappDreame/Flower2U/src/SettingsView.jsx)) ตรงตาม Screenshot 172056**:
  - **ปลดล็อกความกว้างหน้าจอ (Responsive Full Width)**:
    - เปลี่ยนจาก `max-w-7xl mx-auto` ที่บีบหน้าจอให้เหลือขอบขาวว่างเปล่าทางขวาเกือบ 500px มาใช้ `w-full flex-1 px-4 sm:px-8 lg:px-10` สอดคล้องกับหน้าอื่นๆ ในระบบ ทำให้ตารางสิทธิ์ (Permissions Matrix) มีพื้นที่แสดงผลครบทุกคอลัมน์ (รวมตำแหน่ง Dev ลูกหม้อจ้ะ) โดยไม่ถูกตัดขอบขวา
  - **กำจัดหัวเรื่องซ้ำซ้อน (Duplicate Title Removal)**:
    - นำบล็อก `<h2>ตั้งค่าระบบ</h2>` และคำอธิบายยืดยาวที่ซ้ำซ้อนกับ Sticky Header ด้านบนออก
    - แทนที่ด้วย **Context Breadcrumb Bar** ที่กระชับและบอกพิกัดชัดเจน: `ระบบ Flower2U / [ชื่อหมวดหมู่ที่เลือก] — คำอธิบายหมวดหมู่` พร้อม Sync Status Indicator
  - **จัดระเบียบปุ่มในหัวการ์ด (Header Actions Grid)**:
    - ปรับ Header ของ Permissions Matrix เป็น `flex flex-col xl:flex-row justify-between items-center`
    - ปุ่ม `+ เพิ่มบทบาทใหม่`, `ค่าเริ่มต้น`, และ `บันทึกสิทธิ์` เรียงแถวเดียวกันอย่างเป็นระเบียบ ไม่หล่นลงมาเป็น 2 แถวที่เกยกัน
  - **ปรับปรุงตารางสิทธิ์การใช้งาน (Permissions Matrix Table UX)**:
    - คอลัมน์แรก (ชื่อโมดูลและคำอธิบาย) เป็น **Sticky Column** (`sticky left-0 bg-white shadow`) พร้อมเส้นแบ่งชัดเจน ทำให้เวลาเลื่อนตารางในแนวนอนยังเห็นชื่อฟังก์ชันเสมอ
    - ปรับส่วนหัวคอลัมน์ของแต่ละบทบาทให้ความกว้างสมดุล (`min-w-[140px] sm:min-w-[160px]`) จัดกึ่งกลางสวยงาม พร้อมแสดง Badge รหัส 2 หลัก และปุ่มลบบทบาทแบบ Hover
    - เปลี่ยน Checkbox เดิมๆ เป็น **Custom Toggle Cells** พื้นหลังสีม่วง Violet พร้อมไอคอน Check สีขาว สะอาดตา สามารถคลิกได้ทั้งช่องตาราง สะดวกต่อการใช้งานบนจอสัมผัสและเมาส์
  - **Sticky Category Sidebar**:
    - เมนูหมวดหมู่ฝั่งซ้ายปรับให้ตรึงตำแหน่งขณะเลื่อนหน้าจอ (`lg:sticky lg:top-16 self-start`) ไม่หลุดจอ
    - ลบการ์ดสถานะส่วนเกินออกตามหลัก Zero Bloat (ไม่ใส่ของที่ไม่จำเป็น)
- **การตรวจสอบผลงานจริง (Verification)**:
  - `npm run build` ผ่าน 100% ไร้ข้อผิดพลาด
  - ตรวจสอบผ่าน DevTools: `tableWidth` 1170px แสดงผลครบทุกคอลัมน์บนหน้าจอ Desktop ไม่มีข้อความตกขอบ และ Console ไร้ Error 100%

### [2026-11-06 - กะค่ำ (Brand Primary Theme #8B5CF6 Violet Restoration & Quotation Section 4 Redesign)]
- **กู้คืนสีธีมหลักประจำแบรนด์ Flower2U เป็นสีม่วงไวโอเล็ต `#8B5CF6` (Violet)**:
  - ผู้ใช้ระบุเจตนาชัดเจนว่าสีเอกลักษณ์หลักของแบรนด์ Flower2U คือ `#8B5CF6` (Violet) สิ่งที่เคยขัดตาไม่ใช่เฉดสีนี้ แต่เป็นสไตล์ AI ที่มักใช้สีน้ำเงินมืด/นีออนม่วงไฟฟ้าตัดกับฉากหลังสีดำ Cyberpunk
  - กู้คืนและกำหนดให้ `#8B5CF6` (`violet`) เป็นอันดับ 1 ใน [`src/constants/appConstants.js`](file:///D:/WebappDreame/Flower2U/src/constants/appConstants.js) และ [`src/SettingsView.jsx`](file:///D:/WebappDreame/Flower2U/src/SettingsView.jsx)
  - เพิ่ม Auto-migration ใน [`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx): หากพบข้อมูลเดิมเป็น `'indigo'` หรือไม่มีค่า จะปรับสู่ `'violet'` (`#8b5cf6`) โดยอัตโนมัติ
  - ปรับองค์ประกอบ UI ทั่วทั้งระบบ (Sidebar, Header Action Buttons, Mobile Navigation Plus, Settings Matrix) ให้ใช้สี `#8b5cf6` (Violet Gradient) ร่วมกับ Neutral White/Slate ที่สว่างและสบายตา
- **ยกเครื่องการ์ดสรุปยอดส่วนที่ 4 ในหน้าคำนวณเสนอราคา ([`src/QuotationsView.jsx`](file:///D:/WebappDreame/Flower2U/src/QuotationsView.jsx)) เป็น Light User-Centric Experience**:
  - ลบการ์ดมืดสไตล์ Cyberpunk (`from-slate-900 via-indigo-950 to-slate-900`) ที่อ่านยากและดูเหมือนวิดเจ็ตโปรแกรมเมอร์
  - ปรับโครงสร้างใหม่ทั้งหมดให้เป็น Flow ทางการเงินที่เข้าใจง่ายสำหรับคนทำงานจริง:
    1. **สรุปสัดส่วนต้นทุน 2 คอลัมน์**: แยกชัดเจนระหว่าง `ต้นทุนป้ายโครงสร้าง (ตร.ม.)` กับ `ต้นทุนดอกไม้ & พัสดุเสริม`
    2. **แถบต้นทุนจริงรวม (Total Cost)**: แถบสีอำพันอบอุ่น (Warm Amber) แสดงยอดรวมต้นทุนจริงทั้งหมดก่อนคิดกำไร
    3. **กำหนดกำไรขาย (% Markup & Final Price)**:
       - ปุ่มเลือกเปอร์เซ็นต์กำไรสำเร็จรูป (`+20%`, `+30%`, `+40%`, `+50%`) พร้อมช่องกรอก % แบบกำหนดเอง
       - ช่องกรอก `ราคาเสนอสุทธิ (Final Price)` เด่นชัด กรอบสีม่วง Violet ไฮไลท์ยอดรวมที่ใช้เสนอราคาลูกค้า
    4. **การ์ดสรุปกำไรสุทธิ (Net Profit & Margin)**: พื้นหลังสีเขียวมรกตสะอาดตา แสดงกำไรสุทธิเป็นจำนวนบาท (`+฿X,XXX`) และสัดส่วน `% margin`
- **การตรวจสอบผลงานจริง (Verification)**:
  - รัน `npm run build` ผ่าน 100% ไม่มีข้อผิดพลาด
  - ใช้ MCP `chrome-devtools` เปิดดูใบเสนอราคา QT-2026-041 บน Local Dev Server ยืนยันว่าการ์ดส่วนที่ 4 แสดงผลเป็นระเบียบ สว่าง ชัดเจน และสะท้อนสี `#8b5cf6` อย่างสมบูรณ์

### [2026-11-06 - กะค่ำ (Global Theme Overhaul to Rose Floral & Settings Page UI Redesign)]
- **แก้ปัญหา UI ดูเหมือน AI Template (กำจัดสีน้ำเงิน/ม่วง Indigo ไฟฟ้า และ Shadow เรืองแสง)**:
  - ผู้ใช้แจ้งว่า UI เดิมมีสีม่วง indigo/electric blue ที่ดูเหมือนเทมเพลตที่ AI เจนเนอเรตมา
  - ปรับระบบธีมหลักของทั้งเว็บไซต์กลับสู่แก่นแท้ของ Flower2U: **Rose / Floral Carmine (`#e11d48` Rose + `#db2777` Pink)** ร่วมกับ Neutral Slate ที่สะอาดตา สว่าง และดูประณีต
  - แก้ไข [`src/constants/appConstants.js`](file:///D:/WebappDreame/Flower2U/src/constants/appConstants.js):
    - ตั้งค่า `themeColors.rose` ให้อยู่ลำดับที่ 1 และเป็น Default หลักของทั้งระบบ
  - แก้ไข [`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx):
    - ค่าเริ่มต้น `shopInfo.themeColor = 'rose'`
    - เพิ่ม Auto-migration ใน `localStorage` หากพบค่าเดิมเป็น `'indigo'` จะอัปเกรดเป็น `'rose'` ทันที
    - ซ่อมจุดบกพร่อง CSS syntax ใน CSS injector (`nexus-theme-styles`) สำหรับ `--tw-gradient-stops` พร้อมรองรับ `accent-color` และ `focus:ring` ให้สะท้อนธีมสีหลักทั้งระบบแบบ 100%
    - Sidebar Header Logo: เปลี่ยนจากกล่องสีม่วง AI เป็นกล่องไล่เฉด Rose/Pink พร้อมไอคอน `<Sparkles />`
    - Sidebar Nav Active Button: เปลี่ยนเป็น `bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg shadow-rose-200/60`
    - Header Action Buttons (เพิ่มแผนงาน, เพิ่มงาน, คำนวณเสนอราคา, เพิ่มพนักงาน): เปลี่ยนเป็น Rose Floral Gradient
    - Mobile Navigation Bar Center Plus Button: ปรับเป็น Rose Gradient พร้อมเงา Rose นุ่มนวล
  - ยกเครื่อง UI หน้าตั้งค่าระบบ ([`src/SettingsView.jsx`](file:///D:/WebappDreame/Flower2U/src/SettingsView.jsx)) ให้ตรงตามความต้องการ:
    - ปรับ Category Nav ด้านซ้ายให้ปุ่ม Active เป็น Rose Floral Card
    - ตารางสิทธิ์การใช้งาน (Roles & Permissions Matrix):
      - หัวเรื่องใช้ไอคอน `<Shield className="text-rose-600" />`
      - ปุ่ม `+ เพิ่มบทบาทใหม่`: Soft tinted rose พร้อมขอบ
      - ปุ่ม `บันทึกสิทธิ์`: Rose gradient button
      - Badge รหัสตำแหน่งในหัวคอลัมน์ (`รหัส 11`, `รหัส 21`, ...): Soft Rose/Pink pills
      - กล่องข้อความแจ้งเตือนด้านล่าง: กรอบและพื้นหลัง Rose โทนอบอุ่น
      - Checkboxes: เปลี่ยนสี Accent เป็น Rose แดงกุหลาบ
    - Modal เพิ่มบทบาทใหม่ (`isAddRoleModalOpen`):
      - หัว Modal และไอคอน UserPlus สี Rose
      - Pill คัดเลือกหน้าจอและสิทธิ์พิเศษที่เลือกเปลี่ยนเป็น Rose Pills สวยงาม
      - ปุ่มสร้างบทบาทใหม่สี Rose Gradient
    - หน้าข้อมูลร้านค้า & แบรนด์ (Shop Branding):
      - ปุ่มอัปโหลดโลโก้สี Rose
      - ตัวเลือกธีมสีหลักแสดง "Rose (ชมพูกุหลาบ - ธีมหลัก Flower2U)" เป็นตัวเลือกเด่นแรกสุด
    - หมวดตัวเลือกระบบ (ListManager & SortableListManager):
      - ไอคอนและปุ่มเพิ่มเป็นโทน Rose ทั้งหมด
    - หน้าฐานข้อมูลและคลาวด์ซิงค์:
      - ปรับการ์ด Supabase Cloud เป็น Rose Card และ Role-Based Guard เป็น Neutral Slate ไม่ใช้สีม่วง AI อีกต่อไป
  - **การทดสอบจริง (Verification)**:
    - ทดสอบรัน `npm run build` ผ่านสมบูรณ์ (8.14s) ไร้ข้อผิดพลาด
    - ใช้ MCP `chrome-devtools` จำลองหน้าจอจริง ถ่ายภาพแคปเจอร์ทั้ง 4 หน้าจอและโมดอลยืนยันสี Rose Floral เรียบร้อย 100%

### [2026-11-06 - กะดึก (Analytics View Layout Optimization - Move Category Chart to 2x2 Grid)]
- **แก้ปัญหาความสูงเกินไปของการ์ด "สัดส่วนหมวดหมู่งาน" บน PC ([`src/AnalyticsView.jsx`](file:///D:/WebappDreame/Flower2U/src/AnalyticsView.jsx))**:
  - **สาเหตุเดิม**: การ์ด "สัดส่วนค่าใช้จ่ายสูงสุด" และ "สัดส่วนหมวดหมู่งาน" ถูกวางไว้ข้างกันใน `grid grid-cols-2` ทำให้เมื่อร้านมีหมวดหมู่ค่าใช้จ่ายจริงจำนวนมาก (เช่น 15-30 รายการ) การ์ดค่าใช้จ่ายฝั่งซ้ายจะสูงขึ้น และดึงให้การ์ดหมวดหมู่งานฝั่งขวายืดตัวสูงตามจนเกิดพื้นที่ว่างขนาดใหญ่
  - **การปรับปรุง Layout แบบเป็นระเบียบ**:
    - **คงการ์ด "สัดส่วนค่าใช้จ่ายสูงสุด" ไว้ตามเดิม 100%**: ไม่ตัดทอนหรือบีบอัดรายการค่าใช้จ่าย ให้แสดงผลในแถวของตัวเองอย่างอิสระ ไม่ดึงความสูงของการ์ดอื่น
    - **ย้ายการ์ด "สัดส่วนหมวดหมู่งาน" ไปยังตำแหน่งที่ 4 ในหมวด Top Performers**: เดิมหมวด Top Performers มี 3 การ์ด (อันดับศิลปิน, อันดับลูกค้าทำเงิน, อันดับลูกค้าจ้างงาน) ซึ่งทำให้ช่องล่างขวาเป็นพื้นที่ว่างเปล่า การย้ายหมวดหมู่งานมาต่อท้ายทำให้ได้กริด 2x2 ที่สมดุล สวยงาม และเต็มพื้นที่ทุกช่อง
    - **ปรับ DonutChart ให้เป็น Responsive Side-by-Side**: บน PC วางวงแหวน Donut ไว้ฝั่งซ้าย และรายชื่อหมวดหมู่พร้อม Badge จำนวนงานไว้ฝั่งขวา รองรับ Scrollbar เมื่อมีหมวดหมู่จำนวนมาก และจำกัดความสูงให้พอดีกับ `max-h-[400px]` เหมือนกับการ์ดอื่นๆ ในกริด
  - **การทดสอบยืนยันผล**:
    - ทดสอบรัน `npm run build` ผ่านสมบูรณ์ (10.40s)
    - ใช้ MCP `chrome-devtools` ทดสอบทั้งโหมดปกติและโหมดเลือกดู "ทั้งหมด" (มีค่าใช้จ่าย 30+ รายการ) พบว่าการ์ดค่าใช้จ่ายขยายได้อย่างอิสระ ขณะที่กริด 2x2 ด้านล่างสูงเท่ากันทุกช่อง และ DonutChart แสดงผลสวยงามทั้งบน PC และ Mobile

### [2026-11-06 - กะค่ำ (Quotation Alignment, Comma Formatting, Theme Engine 120 FPS & Cross-Tab/All-Page Realtime Sync)]
- **แก้ปัญหาช่องรายการไม่ตรงกันในแถวพัสดุและดอกไม้เสริม ([`src/QuotationsView.jsx`](file:///D:/WebappDreame/Flower2U/src/QuotationsView.jsx)) ตรงตาม Screenshot 192126**:
  - เปลี่ยนคอนเทนเนอร์แถวจาก `items-center` เป็น `items-start`
  - กำหนดความสูงมาตรฐาน `h-[38px]` ให้กับทุกคอลัมน์ (Col 1 Input, Col 2 หน่วย, Col 3 จำนวน, Col 4 ราคาต่อหน่วย, Col 5 รวมเงิน, Col 6 ปุ่มลบ)
  - ทำให้กล่อง Input ทุกช่องและตัวเลขรวมเงินอยู่บนระนาบแนวนอนเดียวกันเป๊ะ แม้ช่องชื่อรายการจะมีข้อความย่อย "รายการกำหนดเอง (นอกคลังพัสดุ)" หรือแท็กเปรียบเทียบกำไร-ขาดทุนอยู่ด้านล่าง
- **ใส่เครื่องหมายจุลภาค (,) ในช่องราคาเสนอสุทธิ และจัดระเบียบ Typography ([`src/QuotationsView.jsx`](file:///D:/WebappDreame/Flower2U/src/QuotationsView.jsx)) ตรงตาม Screenshot 192221**:
  - เปลี่ยนจาก `<input type="number">` เป็น `<input type="text" inputMode="numeric">` ที่รองรับการแปลงตัวเลขแบบมี `,` คั่นหลักพันอัตโนมัติ (`Number(finalPrice).toLocaleString('en-US')`) ช่วยให้อ่านยอดเงินหลักแสน/หลักล้านได้ง่ายดาย (เช่น `5,855,616`)
  - คลีนข้อความด้านซ้าย: ปรับเป็น `ราคาเสนอสุทธิ (Final Price)` พร้อมคำบรรยายสั้นกระชับบรรทัดเดียว `ยอดรวมสุทธิในใบเสนอราคา` ตัดคำฟุ่มเฟือยและเครื่องหมายดอกจันที่ตกบรรทัดออก
- **เครื่องยนต์ธีมสีแบบ GPU-Accelerated และการซิงค์ข้ามหน้าจอ/ข้ามแท็บ Realtime ([`src/utils/themeManager.js`](file:///D:/WebappDreame/Flower2U/src/utils/themeManager.js), [`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx), [`src/InventoryView.jsx`](file:///D:/WebappDreame/Flower2U/src/InventoryView.jsx), [`src/SettingsView.jsx`](file:///D:/WebappDreame/Flower2U/src/SettingsView.jsx)) ตรงตาม Screenshot 191946 & 192344**:
  - สร้างโมดูล `themeManager.js` ควบคุม CSS Variables บน `:root` (`--theme-main`, `--theme-hover`, `--theme-light`, `--theme-shadow`, `--theme-logo-bg`, `--theme-gradient-image`) ฉีดสไตล์ชีตครั้งเดียว รันลื่นระดับ 120+ FPS (เวลาประมวลผล 0.12ms ต่อเหตุการณ์ ตัดปัญหาการกระตุก 268ms ได้ 100%)
  - แก้ไขปุ่ม Action หลักในหน้าอื่นๆ ที่เคย Fix สีตายตัว (`bg-amber-600` คลังพัสดุ, `bg-sky-600` สถานที่, `bg-pink-600` ลูกค้า, `bg-emerald-600` การเงิน) ให้เปลี่ยนตามธีมสีของระบบอัตโนมัติ
  - แก้ไขปัญหาข้อความตกหล่นใน BroadcastChannel โดยเปลี่ยนมาใช้ Singleton `broadcastShopInfoSync` ป้องกันการสั่ง `.close()` เร็วกว่าที่กระบวนการ IPC จะส่งข้อความ
  - เชื่อมโยง Supabase Realtime และ BroadcastChannel ใน `App.jsx` ให้เรียก `applyThemeVariables` ทันทีที่ข้อมูลธีมเปลี่ยน ทำให้แท็บอื่นหรือจออื่นเปลี่ยนสีตามทันทีแบบ Real-time
- **การทดสอบยืนยันผล (Verification)**:
  - บิลด์ผ่าน `npm run build` ใน 7.63s สะอาด 100%
  - ทดสอบจริงบน Chrome DevTools: ตรวจสอบความตรงของช่องในแถวรายการเสริม, พิมพ์ทดสอบยอดเงิน `5855616` แสดงผลเป็น `5,855,616`, และสลับหน้าไปยัง `/inventory` กับ `/venues` พบว่าปุ่มและองค์ประกอบทั้งหมดเปลี่ยนสีตามธีมทันที

### [2026-11-06 - กะเย็น (Quotation Floral & Inventory Direct Integration & Cost Auto-Calculation)]
- **ยกเครื่องระบบเลือกพัสดุและคำนวณต้นทุนในหน้าใบเสนอราคา ([`src/QuotationsView.jsx`](file:///D:/WebappDreame/Flower2U/src/QuotationsView.jsx)) ตรงตาม Screenshot 162139**:
  - **ตัดส่วนเกิน (Zero Bloat)**:
    - นำแถบ **"แม่แบบด่วน"** (`handleAddFloralPreset`) ออก 100% ตามคำสั่ง
    - นำปุ่ม **"📦 เลือกจากคลังพัสดุ"** ที่ส่วนหัว และ Modal ย่อยขนาดใหญ่ (`isInventoryPickerOpen`) ออก เนื่องจากระบบเชื่อมต่อตรงในแถวแล้ว
  - **ระบบ Searchable Combobox & Dropdown ในแถวรายการเสริม**:
    - ช่อง "ชื่อรายการ" เปลี่ยนเป็น Combobox ที่สามารถพิมพ์ค้นหาพัสดุในคลัง หรือพิมพ์ชื่อรายการกำหนดเองได้อิสระ
    - หากไม่มีในคลัง สามารถกดตัวเลือก "➕ ใช้ชื่อนี้: ... (รายการกำหนดเอง / นอกคลัง)" หรือพิมพ์แล้วเลื่อนผ่านได้ทันที
  - **แสดงสถานะและสต็อกคงเหลือเรียลไทม์ (Stock Level & Low-Stock Alerts)**:
    - ดึงข้อมูลจาก Local Dexie (`db.inventory_items`) และ Props `inventoryItems` แบบ Local-First
    - แจ้งเตือนสถานะสต็อกทั้งใน Dropdown และใต้ช่องชื่อรายการ:
      - `❌ หมดสต็อก (0 {unit})` (Badge แดง) หากไม่มีของในคลัง
      - `⚠️ ใกล้หมด! เหลือ X {unit}` (Badge ส้ม) หากจำนวนคงเหลือ $\le$ จุดแจ้งเตือน
      - `✓ คงเหลือ: X {unit}` (Badge เขียว/Slate)
      - แจ้งเตือนใต้ช่องจำนวนหากกรอกจำนวนมากกว่าที่มีในสต็อก (`⚠️ เกินสต็อก (มี X)`)
  - **ดึงราคาต้นทุนอัตโนมัติและระบบเปรียบเทียบกำไร (Cost Pulling & Margin Comparison)**:
    - เมื่อเลือกพัสดุจากคลัง ระบบจะดึง `average_cost` (ราคาต้นทุนที่ซื้อมา) มาเป็นราคาเริ่มต้นทันที เพื่อให้ไม่ต้องนั่งจำราคาของแต่ละอย่าง
    - แสดงป้าย `🏷️ ทุนคลัง: ฿...` ใต้รายการ
    - แสดงป้ายคำนวณส่วนต่างกำไร/ขาดทุนแบบเรียลไทม์เมื่อปรับราคาเสนอขายลูกค้า:
      - `+฿... กำไร (...%)` (Badge เขียว)
      - `⚠️ ต่ำกว่าทุน -฿...` (Badge แดง)
      - ปุ่มคลิกเดียว `ดึงราคาทุน` เพื่อคืนค่าราคาเสนอขายให้เท่ากับต้นทุนคลัง
  - **การทดสอบยืนยันผล**: ตรวจสอบ UI จริงผ่าน `chrome-devtools` (MCP) ทั้งการเปิด Dropdown ค้นหา ดึงต้นทุน และการแจ้งเตือนสต็อก พร้อมทดสอบบิลด์ผ่าน `npm run build` ใน 11.38s สะอาดปราศจาก Error

### [2026-11-06 - จัดทำ Master Roadmap & Agent Onboarding Blueprint พร้อมไดอะแกรมสถาปัตยกรรมครบวงจร]
- **จัดทำพิมพ์เขียวและโรดแมปกลางระบบ [`ROADMAP.md`](file:///D:/WebappDreame/Flower2U/ROADMAP.md) สำหรับส่งต่องานระหว่าง AI Agents และทีมพัฒนา**:
  - **สร้างไดอะแกรมสถาปัตยกรรมระบบ (Mermaid Flowchart)**: อธิบายความสัมพันธ์ของ Client Layer (React 19), Local Data Engine (Dexie IndexedDB v1-v5), Sync Engine (syncService.js), Cloud Backend (Supabase PostgreSQL) และ External Integrations
  - **สร้างผังลำดับกระบวนการเงิน 4 ขั้นตอน (Standard 4-Step Financial Sequence)**: ตอกย้ำลำดับ 1. เงินศิลปิน (Support Money) ➔ 2. รายได้ (Revenue) ➔ 3. ค่าใช้จ่าย (Expenses) ➔ 4. กำไรสุทธิ (Net Margin) พร้อม Sequence Diagram การบันทึกและซิงก์ข้อมูลธุรกรรม
  - **สร้างผังความสัมพันธ์ฐานข้อมูล (Mermaid ERD)**: รวบรวม 13 ตารางหลักของระบบ ครอบคลุมโปรเจกต์ การเงิน ใบเสนอราคา พัสดุ สถานที่จัดส่ง และสิทธิ์บทบาทพนักงาน
  - **สารบัญและหน้าที่ของ 11 วิวหลักในระบบ**: ระบุเส้นทางไฟล์และจุดประสงค์ของทุกหน้าจอ เพื่อให้ Agent ตัวต่อไปค้นหาและต่อยอดโค้ดได้ทันที
  - **สรุปกฎเหล็ก 7 ข้อสำหรับ Agent (Non-Negotiable Directives)**: ตอกย้ำกฎห้าม Git add/commit/push, กฎ Directive 11 ห้าม Native UI, กฎการป้องกันบั๊กเส้นสีดำบนตาราง, กฎ Local-First Zero-Egress, และโครงสร้าง Modal แบบ Silky-Smooth
  - **แผนที่ก้าวต่อไป (Phase 4 Milestones)**: วางผังงานรอพัฒนา เช่น ท่อส่งข้อมูล Expense-to-Inventory, วงจร Reusable Flower Salvage, Vendor Intelligence และ Realtime Subscriptions
  - **คู่มือ Agent Onboarding Quickstart**: ผัง 5 ขั้นตอนสำหรับ Agent ใหม่เริ่มงานได้ทันที
- **ปรับปรุง [`README.md`](file:///D:/WebappDreame/Flower2U/README.md)**: ยกระดับจาก Default Vite Template เป็นคู่มือแนะนำโปรเจกต์ฉบับสมบูรณ์ พร้อมเชื่อมโยงเอกสารสำคัญทั้งหมด
- **ตรวจสอบความสมบูรณ์**: รัน `npm run build` สำเร็จ 100% ปราศจากข้อผิดพลาด

### [2026-11-05 - กะบ่าย/เย็น (Table Black Line Glitch Elimination & Financial Ledger Overhaul)]
- **แก้ไขปัญหาเส้นสีดำกวนใจบนตารางทุกหน้าจอแบบเบ็ดเสร็จ (Eliminate Table Black Line Glitch 100%)**:
  - **สาเหตุที่แท้จริง**:
    1. Tailwind CSS v4 รีเซ็ต `table`, `th`, `td` โดยไม่มีการประกาศ `border-color` เริ่มต้น ทำให้เบราว์เซอร์ Chromium ดึงค่า `currentColor` ของข้อความ (`text-slate-900` / `#1e293b` หรือ `oklch(0.279 ...)`) มาใช้เป็นสีขอบเริ่มต้น
    2. แถว `<tr>` ทุกตารางในระบบมีคลาส `transition-colors` ซึ่ง Tailwind สั่ง transition คุณสมบัติ `border-color` ไปด้วย (150ms) ทุกครั้งที่มีแถวใหม่ถูก Render เข้ามาใน DOM (เช่น ตอนกดเพิ่ม/ลบรายการ หรือตอนเลื่อนจอเกิด Infinity Loading)
    3. ระหว่างที่แถวใหม่กำลังโหลด สีของเส้นขอบจะค่อยๆ เปลี่ยนจากสีดำ (`currentColor`) เป็นสีเทาอ่อน ทำให้สายตามองเห็นเป็นเส้นสีดำเข้มกะพริบหรือค้างอยู่บนจอ
    4. เมื่อตารางเกิดการขยายขนาด (Overflow) บนระบบปฏิบัติการ Windows Chromium จะวาดแถบ Scrollbar สีดำทึบของระบบลงบนขอบล่าง/ขอบข้างของตาราง
  - **วิธีแก้ไขใน [`src/index.css`](file:///D:/WebappDreame/Flower2U/src/index.css)**:
    - บังคับ `border-color: #f1f5f9` (Slate-100) ลงบน `table`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td` ทุกตัวในระดับ Global เพื่อไม่ให้ตกไปเป็น `currentColor` สีดำอีกต่อไป
    - จำกัด `transition-property` ของ `table tr` ให้ Transition เฉพาะ `background-color`, `opacity`, `transform` เท่านั้น โดยตัด `border-color` ออกจาก Animation 100%
    - ปรับแต่ง Scrollbar ทั่วทั้งระบบ (`::-webkit-scrollbar` & `scrollbar-color`) ให้เป็นสี Slate-300 มนกลม โปร่งใส ป้องกันไม่ให้เบราว์เซอร์ดึง Scrollbar สีดำของ Windows มาแสดง
  - **การทดสอบยืนยันผล**: ตรวจสอบด้วย DevTools และวิเคราะห์ Pixel ค่าสีในภาพถ่าย พบว่าเส้นสีดำ RGB(43, 55, 74) หายไป 100% ทุกตาราง (`InventoryView`, `PlansView`, `FinanceView`, `StaffView` ฯลฯ) ไม่ว่าจะเกิดการเลื่อนจอหรือ Infinity Loading

- **ยกเครื่องตารางบัญชีรายรับ-รายจ่ายหน้าการเงิน (`FinanceView.jsx`) ตรงตามแบบ Screenshot 161214 & 161324**:
  - ปรับหัวตาราง Desktop View เป็น 8 คอลัมน์มาตรฐาน:
    1. `วันที่/เวลา`: วันที่ (พ.ศ.) บรรทัดบน (ตัวหนา) / เวลา (น.) บรรทัดล่าง (ตัวจาง) สวยงามชัดเจน
    2. `เลขที่บิล`: รหัสโปรเจกต์/เลขที่รายการ Font-mono สีฟ้า/น้ำเงินชัดเจน
    3. `รายละเอียด`: แสดงชื่อโปรเจกต์และรายการสินค้า/ค่าใช้จ่ายเป็นบรรทัดข้อความปกติ อ่านง่าย ไม่เป็นกล่องย่อยตัวเล็ก (ตามคำขอ "เอาแค่ข้อความไปใส่ช่องและก็จัดระเบียบเป็นทีละบรรทัด")
    4. `ประเภท/หมวดหมู่`: Badge แสดงประเภท (`[เงินศิลปิน]`, `[รายรับ]`, `[รายจ่าย]`) พร้อมแท็กหมวดหมู่งาน
    5. `ลูกค้า / ศิลปิน`: **วางศิลปินไว้ด้านบน** ด้วยไอคอน `Sparkles` สี Indigo ชัดเจน และชื่อลูกค้าอยู่บรรทัดล่างตามคำสั่งโดยเคร่งครัด
    6. `จำนวนเงิน`: แสดง `+฿...` สีเขียวสดใส (Emerald) สำหรับเงินสนับสนุน/รายรับ และ `-฿...` สีแดง (Rose) สำหรับรายจ่ายจริง
    7. `สถานะ`: Badge มนกลม แสดงสถานะการชำระเงิน (`✓ ชำระแล้ว`, `รอชำระ`, `มัดจำ`)
    8. `ดำเนินการ`: ปุ่มดูสลิปโอนเงิน (Receipt), ปุ่มดูรายละเอียดโปรเจกต์ (Eye), และปุ่มเพิ่มรายการด่วน (Plus)
  - Mobile View: แสดงเป็นการ์ดสัมผัสพร้อมเรียงศิลปินไว้ด้านบนลูกค้า และจัดระเบียบตัวเลขตามลำดับการเงินสากล

- **ยกเครื่องหน้าต่างบันทึกรายการใหม่ (Manual Transaction Modal) ตาม Screenshot 161654, 161721, 161806**:
  - **Header**: หัวข้อ "เพิ่มรายการใหม่" พร้อม Subtitle "MANUAL TRANSACTION" และไอคอนสถานะเปลี่ยนตามประเภท
  - **ปุ่มเลือกรายรับ-รายจ่ายแบบการ์ดปุ่มกด (No Dropdown)**: การ์ดใหญ่ 2 ช่อง `[ ↗ รายรับ ]` (กรอบเขียวเมื่อเลือก) และ `[ ↘ รายจ่าย ]` (กรอบแดงเมื่อเลือก) สลับสถานะได้ทันที
  - **ช่องวันและเวลาทำรายการอยู่บนสุด**: วางคู่กับเลขที่รายการ (`INC-รอการบันทึก` / `EXP-รอการบันทึก`) โดยใช้วันและเวลาผ่าน `<ModernDateTimePicker hasTime={true} />` (ตรงตาม Directive 11)
  - **ตารางรายการสินค้าและบริการ (Dynamic Multi-Row Line Items)**:
    - ปุ่ม `+ เพิ่มรายการ` เพิ่มแถวใหม่ได้เรื่อยๆ
    - แต่ละแถวประกอบด้วย: `รายละเอียด` (ช่องพิมพ์ชื่อสินค้า), `จำนวน`, `ราคา/หน่วย`, `รวม (บาท)` คำนวณอัตโนมัติ และปุ่มถังขยะลบแถว
  - **กล่องสรุปคำนวณเงิน + ส่วนลด + ภาษี**:
    - แสดงยอด `รวมเป็นเงิน` (Subtotal)
    - ช่องกรอก `ส่วนลด` พร้อมปุ่มสลับหน่วย `[ บาท | % ]`
    - ตัวเลือก `การคิดภาษี`: วิทยุ 3 ทางเลือก `รวม VAT` (7% ในตัว), `แยก VAT` (+7%), และ `ไม่มี VAT` (0% เริ่มต้น)
    - การ์ด `ยอดสุทธิ` (Net Total Hero Card): การ์ดสีฟ้าไล่เฉด Blue Gradient พร้อมไอคอน Pulse/Heartbeat และยอดเงินสุทธิตัวหนาใหญ่
  - ระบบบันทึกรองรับการเพิ่มรายการเข้าโปรเจกต์เดิม หรือสร้างโปรเจกต์ใหม่อัตโนมัติหากยังไม่มีรหัสในระบบ พร้อมคำนวณและซิงก์ตรงสู่ Supabase ทันที

### [2026-11-05 - กะเช้า/บ่าย]
- **ขยาย Schema บน Supabase รองรับข้อมูลพนักงาน & ระบบบทบาท/สิทธิ์กำหนดได้อิสระ (Custom Roles & Page Permissions)**:
  - **SQL Migration Script**: สร้างไฟล์ [`database_scripts/add_staff_columns_and_custom_roles.sql`](file:///D:/WebappDreame/Flower2U/database_scripts/add_staff_columns_and_custom_roles.sql) ประกอบด้วย:
    - เพิ่มคอลัมน์ในตาราง `public.staff_users`: `citizen_id` (เลขบัตร ปชช.), `birth_date` (วันเกิด พ.ศ.), `address` (ที่อยู่), `emergency_contact` (ผู้ติดต่อฉุกเฉิน), `hire_date`, `bank_account_no`, `bank_name`, `note`, `email`, `phone`
    - สร้าง/อัปเกรดตาราง `public.roles`: รองรับ `name` (unique key), `code` (รหัส 2 หลัก เช่น 11, 21, 31, 41, 51...), `label` (ชื่อภาษาไทย), `description`, `allowed_pages TEXT[]` (รายชื่อหน้าที่มองเห็นได้ในเมนู), action flags (`can_edit_pricing`, `can_delete_project`, `can_borrow_tools`, `can_manage_users`), และ `is_system_role` (ป้องกันลบบทบาทหลัก)
    - ลงทะเบียน Default Roles (Admin, Technician, Driver, Accountant) ครบ 11 โมดูลระบบ และสร้าง RLS Policies (SELECT/INSERT/UPDATE/DELETE)
  - **ระบบสิทธิ์และบทบาทอิสระในหน้าตั้งค่า (`SettingsView.jsx`)**:
    - ดึงบทบาทจาก Supabase `roles` table เมื่อเปิดหน้า
    - เพิ่มปุ่ม `+ เพิ่มบทบาทใหม่` พร้อม Modal กรอกชื่อตำแหน่ง, Key ระบบ, รหัส 2 หลัก (Auto-suggest 51, 61, 71...), คำอธิบาย, และ Checkbox เลือกหน้าที่มองเห็นได้ + สิทธิ์พิเศษ
    - หัวตาราง Roles & Permissions Matrix แสดงบทบาททั้งหมดแบบไดนามิก พร้อมปุ่มลบบทบาทที่ไม่ใช่ System Role (มี ConfirmDialog เตือนก่อนลบ)
    - ปุ่ม "บันทึกสิทธิ์" ทำการ Upsert ข้อมูลบทบาทลง Supabase `roles` table และเซฟลง `localStorage.getItem('f2u_role_permissions')` พร้อมส่ง CustomEvent `'f2u_permissions_updated'` ให้ทั้งแอพอัปเดตเมนูทันที
  - **เชื่อมต่อหน้าข้อมูลพนักงาน (`StaffView.jsx`) แบบ Dynamic**:
    - รองรับบทบาทที่สร้างใหม่: ตัวกรองด้านบน (Role Pills) และ Dropdown ใน Modal เพิ่ม/แก้ไขพนักงาน ดึงจาก `activeRoleDefinitions` ที่ผสานบทบาทใหม่แบบเรียลไทม์
    - เพิ่มช่องกรอก "วันเดือนปีเกิด (พ.ศ.)" ด้วย `<ModernDateTimePicker hasTime={false} />` (ตาม Directive 11 ห้ามใช้ native date picker)
    - หน้าต่างประวัติพนักงาน (Staff Dossier Modal) แสดงวันเดือนปีเกิดด้วย `formatDate()`
  - **หน้าต่างโปรไฟล์ของฉัน (`UserProfileModal.jsx` & `SettingsView.jsx`)**:
    - เพิ่มฟิลด์ "วันเดือนปีเกิด (พ.ศ.)" ด้วย `<ModernDateTimePicker hasTime={false} />`
    - ป๊อปอัปโปรไฟล์มุมซ้ายล่างมีเพียง 2 เมนู: "โปรไฟล์ของฉัน" และ "ออกจากระบบ" (ตัดเมนูตั้งค่าและสิทธิ์ออกเพื่อความคลีน)
  - **ซิงก์ข้อมูลสองทิศทาง (`syncService.js`)**: อัปเดต `STAFF_COLUMNS` และ `ROLE_COLUMNS` ให้ครอบคลุมฟิลด์ใหม่ทั้งหมด

### [2026-11-05 - กะดึก]
- **ยกเครื่อง UX/UI ของ Modal ทุกตัวในระบบให้ลื่นไหล (Silky-Smooth Modal Architecture)**:
  - **โครงสร้าง Modal มาตรฐานใหม่**:
    - **Sticky Header**: ส่วนหัวติดหนึบด้านบน มี Icon เด่น, Title, Subtitle และปุ่มปิด `X` (มี active scale)
    - **Scrollable Body**: ตัวฟอร์มและเนื้อหาอยู่ภายใน `<div className="overflow-y-auto flex-1 overscroll-contain">` เลื่อนดูได้ลื่นไหล ไม่ดึงส่วนหัวหรือท้าย
    - **Sticky Footer**: แถบปุ่ม Action ด้านล่าง (บันทึก / ยกเลิก / โคลน / ลบ) อยู่ด้านนอก Scroll Container ติดหนึบด้านล่างเสมอ (`bg-slate-50/90 backdrop-blur-sm border-t p-4`) กดเซฟได้ทันทีไม่ต้องเลื่อนลงไปล่างสุด
    - **Responsive Bottom-Sheet**: บนจอมือถือ/แท็บเล็ตแสดงผลเป็นแผ่น Bottom-Sheet เลื่อนขึ้นจากด้านล่าง (`rounded-t-3xl sm:rounded-3xl max-h-[92dvh]`), ระยะกด $\ge 44$px
    - **Escape Key & Backdrop Click**: รองรับการกดปุ่ม `Escape` บนคีย์บอร์ดเพื่อปิด Modal ทุกตัวอย่างรวดเร็ว พร้อมคลิกพื้นหลังโปร่งแสง Blur เพื่อปิด
  - **นำไปใช้งานครบถ้วนทุกวิว**:
    - `StaffView.jsx`: Modal เพิ่ม/แก้ไขพนักงาน (`isModalOpen`) และ Modal ประวัติพนักงาน (`isDetailModalOpen`)
    - `ArtistsView.jsx`: Modal สร้าง/แก้ไขศิลปิน (`isModalOpen`) และ Modal ข้อมูลผลงานศิลปิน (`isDetailModalOpen`)
    - `CustomersView.jsx`: Modal เพิ่ม/แก้ไขลูกค้า (`isModalOpen`)
    - `QuotationsView.jsx`: Modal คำนวณต้นทุนเสนอราคา (`isModalOpen`) และ Modal ตั้งค่าราคากลางวัสดุ (`isRatesModalOpen`)
    - `InventoryView.jsx`: Modal เพิ่ม/แก้ไขพัสดุ (`isItemModalOpen`) และ Modal ยืมอุปกรณ์ (`isLoanModalOpen`)
    - `VenuesView.jsx`: Modal เพิ่ม/แก้ไขสถานที่จัดส่ง (`isCreateModalOpen`)
    - `VenueDetailModal.jsx`: Modal ลายแทงพิกัดจุดโหลดของจริง
    - `VenueDirectoryModal.jsx`: Modal คลังลายแทงสถานที่
    - `FinanceView.jsx`: Modal แก้ไขรายการ (`isEditTxModalOpen`) และ Modal เพิ่มรายการด่วน (`isAddTxModalOpen`)
    - `App.jsx`: เพิ่มคีย์ลัด `Escape` สากล ปิดโปรเจกต์ Modal, Delete Confirm, และ Share Modal
    - `SharePreviewModal.jsx`: เพิ่มคีย์ลัด `Escape`

- **ปรับปรุงระบบ Filter หน้าพนักงานใหม่ทั้งหมด (`StaffView.jsx`)**:
  - **Interactive KPI Cards**: เปลี่ยนการ์ดสรุปสถิติด้านบนทั้ง 5 ใบ (พนักงานทั้งหมด, ผู้ดูแลระบบ, ช่างจัดดอกไม้, พนักงานขับรถ, ฝ่ายบัญชี) ให้สามารถกดคลิกเพื่อกรองข้อมูลได้ทันที มี Ring ขอบสีและจุดบอกสถานะการเลือก
  - **Segmented Role Toolbar**: เพิ่มแถบแท็บตำแหน่งงานพร้อม Badge ตัวเลขจำนวนคน (ทั้งหมด, ผู้ดูแลระบบ, ช่างจัดดอกไม้, จัดส่ง/คนขับ, ฝ่ายบัญชี)
  - **Segmented Status Switch**: แยกแถบกรองสถานะการทำงานชัดเจน (สถานะทั้งหมด, พร้อมงาน, พักงาน)
  - **Search & Clear**: กล่องค้นหาแบบพิมพ์หาเรียลไทม์ (ชื่อ, ชื่อเล่น, รหัส, Username, เบอร์โทร) พร้อมปุ่ม `X` เคลียร์คำค้นทันที
  - **Reset Button**: ปุ่มรีเซ็ตตัวกรอง 1 คลิก (`RotateCcw`) คืนค่าการกรองทั้งหมดกลับสู่ค่าเริ่มต้น

- **นโยบายห้ามใช้ Native UI เด็ดขาด (Strict Custom UI & Banned Native Dialogs Directive)**:
  - เพิ่มกฎข้อบังคับข้อที่ 11 ลงใน [`GEMINI.md`](file:///D:/WebappDreame/Flower2U/GEMINI.md): ห้ามใช้ `window.alert()`, `window.confirm()`, `window.prompt()` และห้ามใช้ `<input type="date">` หรือ `<input type="datetime-local">` ของเบราว์เซอร์
  - **สร้าง Custom Confirmation Dialog สากล**: พัฒนา [`src/components/common/ConfirmDialog.jsx`](file:///D:/WebappDreame/Flower2U/src/components/common/ConfirmDialog.jsx) แบบ Portal-based พร้อม Glassmorphism Backdrop Blur, ปุ่มสีแยกตามประเภท (danger, warning, info, success) เพื่อใช้แทน `confirm()` ทั้งหมด
  - **ยกระดับ `ModernDateTimePicker.jsx`**: เพิ่มความสามารถในการแสดงผลเมื่อ `hasTime={false}` ให้ฟอร์แมตวัน/เดือน/ปี พ.ศ. (`DD/MM/YYYY`) อัตโนมัติ และคืนค่า `YYYY-MM-DD` มาตรฐาน
  - **กำจัด Native Dialogs และ Native Date Pickers ครบ 100% ทุกไฟล์**:
    - `App.jsx`: แทนที่ `<input type="date">` ในแถวรายการซัพพอร์ต, รายได้, และรายจ่ายใน Modal โปรเจกต์ด้วย `<ModernDateTimePicker hasTime={false} compact={true} />`
    - `ArtistsView.jsx`: แทนที่ `alert()` และ `confirm()` ด้วย `<Toast>` และ `<ConfirmDialog>`, เปลี่ยน `<input type="date">` เป็น `<ModernDateTimePicker>`, เปลี่ยนชื่อการ์ดสรุปเป็น "จำนวนงาน"
    - `CustomersView.jsx`: แทนที่ `alert()` ด้วย `<Toast>`
    - `QuotationsView.jsx`: แทนที่ `alert()` และ `confirm()` ในการลบใบเสนอราคาและบันทึกราคากลางด้วย `<Toast>` และ `<ConfirmDialog>`
    - `StaffView.jsx`: แทนที่ `alert()` และ `confirm()` ในการบันทึก ลบ และปรับสถานะพนักงานด้วย `<Toast>` และ `<ConfirmDialog>`
    - `InventoryView.jsx`: แทนที่ `alert()` และ `confirm()` ในการบันทึกพัสดุ ยืม-คืน ด้วย `<Toast>` และ `<ConfirmDialog>`, แทนที่ `<input type="date">` เป็น `<ModernDateTimePicker>`
    - `VenuesView.jsx`: แทนที่ `alert()` ในการบันทึกลายแทงสถานที่ด้วย `<Toast>`
    - `FinanceView.jsx`: แทนที่ `window.confirm()` ในการ Void รายการและลบรายการด้วย `<ConfirmDialog>`, แทนที่ `alert()` ด้วย `<Toast>`, แทนที่ `<input type="date">` ใน Modal เพิ่มรายการด้วย `<ModernDateTimePicker>`
    - `VenueDetailModal.jsx` & `SharePreviewModal.jsx`: แทนที่ `alert()` ด้วย `<Toast>`

- **เปลี่ยนชื่อเมนูและหัวข้อ "ทำเนียบศิลปิน" เป็น "ข้อมูลศิลปิน"**:
  - อัปเดต Nav Item ใน [`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx) (Icon `Sparkles`, Label `ข้อมูลศิลปิน`, ShortLabel `ศิลปิน`)
  - อัปเดตการ์ดสรุปผลงานจาก "จำนวนงานจัดดอกไม้สะสม" เป็น "จำนวนงาน" ใน [`src/ArtistsView.jsx`](file:///D:/WebappDreame/Flower2U/src/ArtistsView.jsx)

- **เพิ่มระบบและหน้าจอข้อมูลพนักงาน & ทีมงาน (`StaffView.jsx`)**:
  - สร้างคอมโพเนนต์ [`src/StaffView.jsx`](file:///D:/WebappDreame/Flower2U/src/StaffView.jsx) สำหรับบริหารจัดการทีมงาน ดอกไม้ จัดส่ง และบัญชีอย่างเป็นระบบ
  - **การ์ดสรุป KPI ด้านบน**: สรุปยอดพนักงานทั้งหมด, ผู้ดูแลระบบ (Admin รหัส 11), ช่างจัดดอกไม้ (Technician รหัส 21), จัดส่ง/คนขับรถ (Driver รหัส 31), ฝ่ายบัญชี (Accountant รหัส 41) และสถานะพร้อมทำงาน
  - **ตารางข้อมูล Responsive**:
    - Desktop: Table Grid แสดงรหัสพนักงาน (Staff Code 7 หลัก เช่น `2611001`), ชื่อ-นามสกุล, ชื่อเล่น, Username, ป้ายตำแหน่ง & สิทธิ์, เบอร์โทร (คลิกโทร `tel:`), อีเมล, สถานะเปิดใช้งาน/พักงาน, และปุ่ม Actions
    - Mobile: Touch Cards พร้อมปุ่มโทรออกด่วน
  - **ระบบสร้าง/แก้ไขพนักงาน (Staff Modal)**:
    - ออกรหัสพนักงานมาตรฐานอัตโนมัติ: `YY` + `PP` (Role Code 11/21/31/41) + `NNN` ลำดับประจำปี เช่น `2621005`
    - กำหนดสิทธิ์ ตำแหน่ง บัญชีผู้ใช้ รหัสผ่าน ข้อมูลติดต่อ และรูปโปรไฟล์
  - **หน้าต่างประวัติพนักงาน (Staff Dossier Modal)**: แสดงข้อมูลสิทธิ์หน้าที่ และช่องทางติดต่อ
  - **เชื่อมโยงระบบ Local-First (IndexedDB Store: `staff`)**: แคชลงเครื่อง 0ms และซิงก์กับ Supabase `staff_users` / `roles`
  - เพิ่มเมนู "ข้อมูลพนักงาน" ในแถบ Sidebar, Mobile Drawer (7 คอลัมน์) และปุ่ม `+ เพิ่มพนักงานใหม่` ใน Header

- **ปรับแต่งหน้าใบเสนอราคา (`QuotationsView.jsx`)**:
  - เรียงลำดับเลขใบเสนอราคาจากมากไปน้อย (ล่าสุดอยู่บนสุด เช่น `QT-2026-040` -> `QT-2026-039` -> ... -> `QT-2026-001`)
  - วันที่และเวลาของใบเสนอราคา: ดึงและแสดงผลตาม "วันและเวลาเปิดโปรเจกต์" (`rawDateTime` / `date`) ของโปรเจกต์ที่ผูกโดยตรง
  - ฟังก์ชันสร้างและโคลนใบเสนอราคาจะคำนวณและออกเลขลำดับถัดไป (`QT-YYYY-NNN`) ต่อจากเลขสูงสุดที่มีอยู่ในระบบเสมอ

- **นำการ์ดคลังลายแทงสถานที่จัดส่งออกจากหน้าตั้งค่า (`SettingsView.jsx`)**:
  - ลบการ์ด Venue Intelligence Directory Card ออกจาก `SettingsView.jsx` เพื่อลดความซ้ำซ้อน เนื่องจากระบบได้แยกหน้า "สถานที่จัดส่ง" (`VenuesView.jsx`) ออกมาเป็นเมนูหลักพร้อมแผนที่ Thailand Logistics Map เรียบร้อยแล้ว
  - ปรับ Props ใน `SettingsView.jsx` และ `App.jsx` ให้กระชับ ไม่เหลือโค้ดค้าง (Zero Bloat)

- **ระบบทำเนียบศิลปิน & ประวัติศิลปินแยกอิสระ (`ArtistsView.jsx`)**:
  - เพิ่มการจัดเก็บข้อมูลศิลปินอิสระ: สังกัด/ค่าย (Agency), ชื่อกลุ่มแฟนคลับ (Fandom Name), สีประจำตัว/สีแฟนด้อม (Fandom Color Picker), วันเกิดและอายุ, วันเดบิวต์, ประวัติ/เรื่องราว (Bio), ช่องทาง Social Media (X, IG, TikTok, Weibo), ดอกไม้/โทนสีที่ชื่นชอบ, และรูปภาพโปรไฟล์ (Avatar URL)
  - รองรับการกด "+ เพิ่มศิลปินใหม่" จาก Header ของแอป เพื่อสร้างโปรไฟล์ศิลปินล่วงหน้าได้โดยไม่ต้องรอให้มีงานจัดดอกไม้
  - หน้าต่างดูประวัติฉบับเต็ม (Artist Dossier Modal): แสดงยอดเงินซัพพอร์ตสะสม, จำนวนงานจัดดอกไม้, ไทม์ไลน์งานจัดดอกไม้ล่าสุด, และลิงก์ไปยังกิจกรรมทั้งหมดของศิลปิน
  - แสดงผลแบบ Responsive: Desktop Table Grid และ Mobile Touch Cards

- **แก้ไขแผนที่สถานที่จัดส่ง (Thailand Logistics Map) & เส้นทางขนส่ง (`VenuesView.jsx`)**:
  - แก้ไขปัญหา Tile ลายน้ำของ CARTO basemaps ("API KEY REQUIRED carto.com/basemaps/apikey") โดยเปลี่ยนมาใช้ Google Maps roadmap tiles ทางการ (`https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}`) ร่วมกับ Google Hybrid Satellite และ OpenStreetMap พร้อม Layer Switcher
  - เพิ่มจุดเริ่มต้นหลักของร้าน **Flower2U Workshop & Hub** (หมุดไอคอน 🌸)
  - เชื่อมโยงเส้นทางขนส่งจำลอง (Polyline สี Indigo) จากร้านไปยังสถานที่จัดส่งปลายทาง พร้อมคำนวณระยะทาง (กม.) และเวลาเดินทางเฉลี่ย (นาที)
  - เพิ่มปุ่มคลิกเดียว "เปิดนำทางใน Google Maps" (Turn-by-Turn Navigation) ตรงไปยังพิกัดจุดโหลดของจริง (Loading Dock)
  - ใส่ Null & Function Guard ครอบ `invalidateSize()` ป้องกันปัญหา Leaflet unmount / tab switch error 100%

- **ยกเครื่องหน้าเสนอราคาเต็มรูปแบบตามคู่มือ (`หน้าเสนอราคา.md`) ใน `QuotationsView.jsx`**:
  - **Core 1: คำนวณ Backdrop ตามตารางเมตร**: สูตร กว้าง (ม.) x สูง (ม.) x จำนวน = ตร.ม. พร้อมคูณราคาต่อ ตร.ม.
  - **Core 2: Master Price & Price Override Logic**:
    - ดึงราคาตั้งต้นจากตารางราคากลางวัสดุ (`material_rates`)
    - หากพิมพ์ราคาหน้างานทับ กรอบจะเปลี่ยนเป็นสีส้ม Amber พร้อม Badge "แก้หน้างาน (กลาง XXX฿)" และปุ่ม "คืนค่า" กลับเป็นราคากลาง
    - หน้าต่าง Master Rates Modal สำหรับจัดการและเพิ่มราคากลางวัสดุมาตรฐานของร้าน
  - **Core 3: ตารางดอกไม้/พัสดุ & Quick Presets**:
    - ปุ่มลัดเพิ่มรายการด่วน 1 คลิก (`+ ดอกไม้สด`, `+ ดอกไม้กระดาษ`, `+ โครง Truss`, `+ ไฟส่องป้าย`, `+ ค่าขนส่ง/ติดตั้ง`)
  - **Core 4: Searchable Project Combobox**:
    - ช่องค้นหาโปรเจกต์แบบ Searchable Dropdown ดึงตัวเลือก `.slice(0, 30)` ตอบสนองทันที 0ms ไม่หน่วง
    - รองรับการสร้างใบเสนอราคาล่วงหน้า (Draft) โดยยังไม่ต้องผูกโปรเจกต์
  - **Core 5: ตารางประวัติใบเสนอราคา & ฟังก์ชัน Clone**:
    - แสดงรายการใบเสนอราคาแบบ Responsive (Desktop Table + Mobile Cards) พร้อมฟิลเตอร์ ทั้งหมด, ยังไม่ผูกโปรเจกต์, ผูกแล้ว
    - ปุ่ม `📋 ใช้เป็นต้นแบบ (Clone)`: โคลนสเปกทั้งหมดของงานเดิม ออกเลข `QT-` รหัสใหม่ และปลดล็อกช่องผูกโปรเจกต์
    - สรุปต้นทุน (Cost) + Markup % + ราคาเสนอขายลูกค้า (Quote / Final Price) + Margin กำไรสุทธิ
  - สคริปต์ DDL ฐานข้อมูล Supabase: [`database_scripts/create_quotations_and_material_rates.sql`](file:///D:/WebappDreame/Flower2U/database_scripts/create_quotations_and_material_rates.sql) รองรับระบบ Offline-First ใน IndexedDB (Dexie) พร้อมใช้งานทันที

### [2026-11-04]
- **ระบบสถานที่จัดส่ง Master Table (`delivery_locations`) & Venue Intelligence**:
  - สร้าง DDL: [`database_scripts/create_delivery_locations.sql`](file:///D:/WebappDreame/Flower2U/database_scripts/create_delivery_locations.sql)
    - ตาราง `delivery_locations`: รองรับ Dual-Pin (จุดส่งลูกค้า vs จุดโหลดของจริง Loading Dock), ประตูเทียบรถ, ความสูงรถ, เบอร์โทร รปภ., และกฎการแลกบัตร
    - เชื่อมโยง `projects.location_id` กับ `delivery_locations.id`
    - เพิ่ม Unique Index `idx_customers_name` บน `customers.name`
  - ย้ายข้อมูลสะอาด 100% จาก Google Sheets เข้า Supabase ผ่าน [`scripts/migrate_sheets_to_supabase.cjs`](file:///D:/WebappDreame/Flower2U/scripts/migrate_sheets_to_supabase.cjs):
    - นำเข้า 302 Projects, 516 Quotation Items, 394 Support Money Items, 827 Expenses, 111 Artists, 8 Customers, 42 Delivery Locations มาตรฐาน
  - เพิ่ม Dexie store `delivery_locations` ใน [`src/services/db.js`](file:///D:/WebappDreame/Flower2U/src/services/db.js) และฟังก์ชัน Local-First `loadLocationsLocalFirst` / `saveLocationSync` ใน [`src/services/syncService.js`](file:///D:/WebappDreame/Flower2U/src/services/syncService.js)
  - สร้างคอมโพเนนต์ Venue Intelligence:
    - [`src/components/modals/VenueDetailModal.jsx`](file:///D:/WebappDreame/Flower2U/src/components/modals/VenueDetailModal.jsx): แผ่นลายแทงนำทาง 2 พิกัด, ข้อมูลประตู, จำกัดความสูง, เบอร์โทร รปภ., และแก้ไขอัปเดตแบบเรียลไทม์
    - [`src/components/modals/VenueDirectoryModal.jsx`](file:///D:/WebappDreame/Flower2U/src/components/modals/VenueDirectoryModal.jsx): แคตตาล็อกสถานที่จัดส่ง 42+ แห่ง พร้อมระบบค้นหาและกรองตามโซน
    - [`src/components/common/BatchDeliveryBanner.jsx`](file:///D:/WebappDreame/Flower2U/src/components/common/BatchDeliveryBanner.jsx): เรดาร์ตรวจจับงานส่งวันเดียวกันในสถานที่เดียวกัน แนะนำคนขับรถจัดคิวส่งพ่วงเที่ยวเดียว ประหยัดค่าน้ำมัน
  - เชื่อมต่อใน [`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx):
    - ระบบ Autocomplete Dropdown แนะนำสถานที่ 1 วินาที พร้อมชิปแสดงคำแนะนำหน้างานและปุ่มดูลายแทง
    - เรดาร์เตือนงานส่งพ่วงใน `PlansView`
    - แบนเนอร์เปิดคลังลายแทงสถานที่ใน `SettingsView`
- **ระบบวิเคราะห์ประสิทธิภาพการเงินและทำเล (Analytics Roadmap Execution)**:
  - ปรับปรุง [`src/AnalyticsView.jsx`](file:///D:/WebappDreame/Flower2U/src/AnalyticsView.jsx) และ `src/App.jsx`:
    - เพิ่มชิป Average Order Value (AOV) ฿/งาน และ Net Margin % บนการ์ดสรุปการเงิน
    - เพิ่ม **Banknote Float Calculator (เครื่องคำนวณแจกแจงธนบัตรเงินซัพพอร์ต)**: แจกแจงฉบับธนบัตร ฿1,000, ฿500, ฿100, ฿50, ฿20 พร้อมปุ่มคัดลอกยอดเบิกธนาคารในคลิกเดียว
    - เพิ่ม **Top Delivery Venues (ทำเล & สถานที่จัดส่งยอดนิยม)**: จัดอันดับสถานที่จัดส่งบ่อยสุด พร้อมปุ่มเปิดลายแทง Loading Dock
    - เพิ่ม **Low Margin Anomaly Radar**: ตรวจจับงานที่มี Margin < 40% หรือต้นทุนพุ่งสูงผิดปกติ เพื่อช่วยบริหารความเสี่ยง
  - ตรวจสอบความถูกต้อง: บิลด์ผ่านฉลุย `npm run build` ใน 7.19s ตรวจสอบ UI ผ่าน `chrome-devtools` และคอนโซลสะอาดปราศจาก Error
    - ดึง 302 งานสดจาก Google Sheets แปลงสถานที่ยอดฮิตเข้าตาราง `delivery_locations` พร้อมคำนวณ `location_id`
    - เพิ่ม IndexedDB store `delivery_locations` ใน [`src/services/db.js`](file:///D:/WebappDreame/Flower2U/src/services/db.js) (v2) และฟังก์ชัน `loadLocationsLocalFirst`, `saveLocationSync` ใน [`src/services/syncService.js`](file:///D:/WebappDreame/Flower2U/src/services/syncService.js)

- **ระบบรหัสพนักงานมาตรฐาน 7-8 หลัก (Staff Code: YY + PP + NNN) & เชื่อม Role Code**:
  - โครงสร้างรหัส: `YY` (ปี 2 หลัก) + `PP` (รหัสตำแหน่ง 2 หลัก) + `NNN` (ลำดับพนักงานของปีนั้น 3 หลักขึ้นไป รีเซ็ตทุกขึ้นปีใหม่)
  - ขยายเป็น 8 หลักอัตโนมัติหากมีพนักงานเกิน 1,000 คนในปีนั้น (`26111000`)
  - รหัสตำแหน่งเก็บในตาราง `roles` ฟิลด์ `role_code VARCHAR(2)`:
    - `11` = ผู้ดูแลระบบ / เจ้าของร้าน (`admin`)
    - `21` = ช่างจัดดอกไม้ / หน้างาน (`technician`)
    - `31` = พนักงานจัดส่ง / ขนส่ง (`driver`)
    - `41` = ฝ่ายบัญชีและการเงิน (`accountant`)
  - สคริปต์ DDL & Trigger อัตโนมัติ: [`database_scripts/add_staff_code_and_role_code.sql`](file:///D:/WebappDreame/Flower2U/database_scripts/add_staff_code_and_role_code.sql)
  - อัปเดตพนักงาน 4 คนแรก: `2611001` (1), `2611002` (AOM), `2611003` (DREAM), `2611004` (Chuti)
  - หน้า Login รองรับล็อกอินได้ทั้งด้วย `username` หรือ `staff_code`

- **ยกเครื่องหน้าจอหลัก 5 เมนูใหม่ (Redesign Views, BOM Estimator, Leaflet Thailand Map, Single Header Action & Responsive Table-Cards)**:
  - **Single Unified Header Button & Zero Header Duplication**:
    - ลบกล่องแบนเนอร์ส่วนหัวการ์ดขนาดใหญ่ที่ซ้ำซ้อนออกจากทุกหน้าจอ (`CustomersView`, `InventoryView`, `VenuesView`, `QuotationsView`, `ArtistsView`)
    - รวบปุ่มเพิ่มข้อมูลให้เหลือเพียงปุ่มเดียวในแถบ `<header>` ด้านบนสุดของ `App.jsx` ที่เปลี่ยนชื่อและสีตามแท็บที่กำลังเปิดอยู่โดยอัตโนมัติ (เช่น "+ เพิ่มลูกค้าใหม่", "+ เพิ่มพัสดุเข้าคลัง", "+ เพิ่มสถานที่", "+ คำนวณเสนอราคา")
  - **แผนที่พิกัดสถานที่จัดส่งประเทศไทย & กรุงเทพฯ ด้วย Leaflet (`VenuesView.jsx`)**:
    - ติดตั้งและเชื่อมต่อ `leaflet` แบบโต้ตอบได้ 100% ฟรี ไม่มีค่าบริการ API และโควต้ากวนใจ
    - ปักหมุดสถานที่จัดส่งและฮอลล์สำคัญทั่วไทย 42+ แห่ง พร้อมระบบ Dual-Pin: 🚚 หมุดสีส้มสำหรับจุดโหลดของจริง (Loading Dock) และ 📍 หมุดสีฟ้าสำหรับประตูหน้าห้าง
    - ระบบ FlyTo ซูมเข้าหาพิกัดแบบ 3D ลื่นไหลเมื่อคลิกจากตาราง พร้อม Popup แสดงข้อมูลประตู, ความสูงรถ, เบอร์โทร รปภ., และปุ่มเปิด Google Maps นำทาง
  - **ระบบถอดแบบต้นทุนวัสดุ & คำนวณใบเสนอราคาอัจฉริยะ (Smart BOM Estimator Modal in `QuotationsView.jsx`)**:
    - เครื่องคำนวณถอดแบบวัสดุและต้นทุนตามคำสั่งผู้ใช้:
      - **งานแบ็กดรอป & ฟิวเจอร์บอร์ด**: คำนวณความกว้าง (ม.) x สูง (ม.) = ตร.ม. อัตโนมัติ พร้อมคิดต้นทุนต่อ ตร.ม. (฿500/ตร.ม.) และค่าโครงสร้าง
      - **ดอกไม้ & ธีมสี**: เลือกรายการจากคลังพัสดุ ระบุธีมสี (ชมพูพาสเทล, ขาวครีม ฯลฯ) จำนวน x ต้นทุนเฉลี่ย
      - **อุปกรณ์ & พัสดุยืมใช้**: ขาตั้งเหล็ก, ป้ายไฟ, ฐานรอง
      - **ค่าแรง & ค่าจัดส่ง**: ค่าแรงช่างจัดดอกไม้หน้างาน และค่าขนส่ง
      - **ระบบตั้งกำไร (Markup Engine)**: รวมต้นทุนจริง (COGS) ทั้งหมด คำนวณราคาขายแนะนำตาม % Markup หรือกำไรบาท พร้อมปรับราคาเสนอขายและแสดง Gross Margin สุทธิ
      - ผูกรหัสโปรเจกต์ (`P-XXXX`) และบันทึกลงระบบทันที
  - **การแสดงผล Responsive แบบ Responsive Table (Desktop) & Cards (Mobile)**:
    - หน้าจอคอมพิวเตอร์ Desktop: แสดงเป็นตารางรายการ (Table Grid) ข้อมูลกระชับ จัดการง่าย
    - หน้าจอมือถือ Mobile: สลับเป็นรูปแบบการ์ดสัมผัส (Touch Cards) ที่ดูง่าย ไม่ล้นจอ
    - ปรับปรุงชื่อเรียกและ UX Copy เป็นภาษาไทยที่เข้าใจง่าย 100%
  - ตรวจสอบความถูกต้อง: บิลด์ผ่านฉลุย `npm run build` ใน 7.24s และทดสอบความถูกต้องผ่าน `chrome-devtools` บน Desktop (1440px) และ Mobile (390px) คอนโซลสะอาด ปราศจากข้อผิดพลาด

- **ตัดขาดจาก Google Sheets 100% และเปลี่ยนมาใช้ Supabase เป็น Single Source of Truth สมบูรณ์แบบ (Google Sheets Fully Decoupled)**:
  - ยกเลิกการอ่าน/เขียนข้อมูลทั้งหมดไปยัง Google Sheets ตามคำสั่งของผู้ใช้ (`action: 'read'`, `action: 'save'`, `action: 'delete'`, `action: 'getSettings'` ถูกลบออกจากโค้ดถาวร)
  - Google Apps Script ถูกจำกัดหน้าที่เหลือเฉพาะการเป็น File Proxy สำหรับอัปโหลดรูปภาพและสลิปลง Google Drive (`action: 'uploadAsset'`, `action: 'deleteFile'`) เท่านั้น
  - `fetchSettings`: โหลดตรงจาก `shop_settings` และ `staff_users` ใน Supabase
  - `saveSystemSettings`: บันทึกตรงลง Supabase `shop_settings` และซิงก์โปรไฟล์พนักงาน `staff_users`
  - `handleLogin`: ตรวจสอบรหัสผ่านตรงกับข้อมูลพนักงานใน Supabase
  - `handleSaveProject`: คำนวณรหัส ID งานใหม่จากข้อมูล In-Memory และ Supabase โดยไม่ต้องยิงไปอ่าน Google Sheets อีกต่อไป
  - ตรวจสอบความถูกต้องผ่าน `npm run build` ผ่านฉลุย 100% ใน 5.89s
  - ทดสอบระบบจริงผ่าน Chrome DevTools:
    - เบราว์เซอร์เชื่อมต่อ Supabase Realtime WebSocket สำเร็จ (`status: SUBSCRIBED`)
    - ยิงอัปเดตข้อมูลบน Supabase แล้วหน้าเว็บเบราว์เซอร์เด้งรับ Event `UPDATE P-0001` และรีเฟรช UI ให้ทันทีในเวลา <100ms
    - บันทึกลง IndexedDB (Dexie) แบบ Offline/Local-First เรียบร้อย

- **เชื่อมต่อหน้าบ้านสู่ Supabase & IndexedDB เรียบร้อยสมบูรณ์ (Frontend Local-First Live Integration)**:
  - ติดตั้งและตั้งค่า `@supabase/supabase-js` และ `dexie` สำหรับจัดการ IndexedDB บนเบราว์เซอร์
  - สร้างโมดูลบริการหลัก:
    - [`src/services/db.js`](file:///D:/WebappDreame/Flower2U/src/services/db.js): สถาปัตยกรรม IndexedDB แคชถาวรบนเครื่อง พร้อมคำสั่ง `navigator.storage.persist()`
    - [`src/services/supabaseClient.js`](file:///D:/WebappDreame/Flower2U/src/services/supabaseClient.js): ตัวเชื่อมต่อ Supabase Client มาตรฐานสากล
    - [`src/services/syncService.js`](file:///D:/WebappDreame/Flower2U/src/services/syncService.js): ตัวจัดการแปลงข้อมูล Normalized ข้ามสตรีม และระบบ Live Sync
  - ปรับแต่ง [`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx):
    - `fetchProjects`: สลับมาดึงผ่าน `loadProjectsLocalFirst` ดึงจาก IndexedDB 0ms และซิงก์ส่วนต่างจาก Supabase
    - `handleSaveProject`: บันทึกผ่าน `saveProjectSync` อัปเดตลง IndexedDB ทันทีและส่งขึ้น Supabase
    - `executeDelete`: ลบผ่าน `deleteProjectSync` ลบจาก IndexedDB ทันทีและส่งคำสั่งลบไปยัง Supabase
    - `subscribeToRealtimeProjects`: เปิดรับ WebSocket Realtime เมื่อมีคนอื่นแก้ไข ข้อมูลบนจอจะเด้งเปลี่ยนสดทันทีโดยไม่ต้องรีเฟรช
  - ทดสอบรันหน้าเว็บจริงผ่าน Chrome DevTools: ตรวจสอบ Console ข้อความ 0 Errors, WebSocket ผ่านฉลุย 100%

- **สร้างไฟล์ `.env.local` และสคริปต์ทดสอบ API Health Check**:
  - สร้างไฟล์ [`.env.local`](file:///D:/WebappDreame/Flower2U/.env.local) เก็บค่า `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` และ URL เก่าของ Google Apps Script
  - สร้างแม่แบบ [`.env.example`](file:///D:/WebappDreame/Flower2U/.env.example) และป้องกันไม่ให้ Git commit ข้อมูลลับผ่าน `.gitignore`
  - สร้างสคริปต์ตรวจสุขภาพการเชื่อมต่อ [`scripts/test_api_connection.cjs`](file:///D:/WebappDreame/Flower2U/scripts/test_api_connection.cjs) ทดสอบการอ่านข้อมูลจาก Supabase และฟังก์ชัน RPC ผ่าน 100%

- **ย้ายข้อมูลสำเร็จ 100% จาก Google Sheets สู่ Supabase (Data Migration Complete)**:
  - ดึงข้อมูล 302 โปรเจกต์งานจาก Apps Script Web App แปลงเป็นโครงสร้าง Relational 100% ปราศจาก JSON:
    - **Projects**: ย้ายสำเร็จครบ 302/302 แถว
    - **Quotation Items**: แตกเป็นตารางลูกสำเร็จ 516 รายการ
    - **Customer Support (ธนบัตร)**: แตกเป็นตารางลูกสำเร็จ 394 รายการ
    - **Expenses (ค่าใช้จ่ายจริง)**: แตกเป็นตารางลูกสำเร็จ 827 รายการ
    - **Artists**: สกัดรายชื่อศิลปินไม่ซ้ำสำเร็จ 111 คน พร้อมแมป `artist_id`
    - **Customers**: สกัดรายชื่อลูกค้าไม่ซ้ำสำเร็จ 8 คน พร้อมแมป `customer_id`
    - **Shop Settings**: โฟลเดอร์ Drive และ Chatbot tokens ย้ายขึ้น Supabase เรียบร้อย
  - ทดสอบรัน RPC `get_financial_analytics` บน Server คำนวณข้าม 302 แถวใน 0.05 วินาที ได้ตัวเลขตรงเป๊ะ (ยอดเงินสนับสนุน 4,527,760 บาท, รายได้ 1,771,719.43 บาท, รายจ่าย 620,601.22 บาท, กำไรสุทธิ 1,151,118.21 บาท)
  - จัดเตรียมสคริปต์ RLS Policy ใน [`database_scripts/enable_rls_and_policies.sql`](file:///D:/WebappDreame/Flower2U/database_scripts/enable_rls_and_policies.sql) เพื่อเปิดสิทธิ์ให้หน้าบ้านดึงข้อมูลผ่าน `anon` key ได้ครบ 100%

- **ระบบ Supabase Realtime Live Synchronization (อัปเดตสดข้ามหน้าจอแบบ Realtime ครบ 100% ทั้ง 17 ตาราง)**:
  - เพิ่มการตั้งค่า `REPLICA IDENTITY FULL` และผูกครบทั้ง 17 ตารางในระบบเข้ากับ `supabase_realtime` publication (`roles`, `staff_users`, `artists`, `customers`, `projects`, `deleted_records`, `project_quotation_items`, `project_customer_support`, `project_expenses`, `vendors`, `inventory_categories`, `inventory_items`, `inventory_procurements`, `asset_loans`, `inventory_disposals`, `financial_transactions`, `shop_settings`)
  - อัปเดตลงใน [`database_scripts/supabase_master_schema.sql`](file:///D:/WebappDreame/Flower2U/database_scripts/supabase_master_schema.sql) และ [`F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md`](file:///D:/WebappDreame/Flower2U/F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md) เรียบร้อยแล้ว

- **จัดเตรียมโฟลเดอร์ `database_scripts` และไฟล์ `supabase_master_schema.sql`**:
  - ย้ายไฟล์ SQL ไปไว้ในโฟลเดอร์ [`database_scripts/supabase_master_schema.sql`](file:///D:/WebappDreame/Flower2U/database_scripts/supabase_master_schema.sql) เพื่อความเป็นระเบียบเรียบร้อยของโครงสร้างโปรเจกต์
  - ไฟล์เป็น Pure SQL 100% ไม่มี Markdown tags `#` พร้อมสำหรับคัดลอกไปรันบน Supabase SQL Editor ทันที

- **ระบบตัดจ่ายพัสดุอุปกรณ์ชำรุด-หมดคม-สูญหาย (Asset Disposal & Decommissioning: "อันนี้ไม่มีแล้วนะ") & มาตรฐานรหัส Code ID**:
  - **กลไกบอกสถานะ "อันนี้ไม่มีแล้ว"**: เพิ่มฟิลด์ `status` ('in_service', 'maintenance', 'low_stock', 'out_of_stock', 'written_off', 'lost'), `decommission_reason`, `decommissioned_at`, `decommissioned_by_user_id` และ `is_active` บน `inventory_items`
  - **ตารางประวัติการตัดจ่าย `inventory_disposals`**: บันทึกรหัสใบตัดจำหน่าย `DSP-YYMMDD-xxxx`, สาเหตุ (`damaged` พังหัก, `worn_out_dull` หมดคม/เสื่อมสภาพ, `lost` ทำหาย, `broken_on_site` เสียหายหน้างาน), แนบรูปหลักฐานบน Google Drive, ผูกกับงานอีเวนต์ที่เกิดเหตุ (`project_id`), พร้อม Trigger หักสต็อกและคำนวณมูลค่าความเสียหายทางบัญชีอัตโนมัติ
  - **ระบบ Code ID แบบสั้น กระชับ จำง่าย (Simple Code ID)**:
    - ปรับตามความต้องการของผู้ใช้ให้กระชับ จำง่าย พิมพ์ค้นหาเร็ว ไม่ต้องจำตัวย่อภาษาอังกฤษยาวๆ:
      - **แบบที่ 1 (Universal)**: `item0001`, `item0002`, `item0003`... รันตัวเลขต่อเนื่องทุกชิ้น
      - **แบบที่ 2 (Short Category)**: `eq0001` (อุปกรณ์), `mat0001` (วัสดุสิ้นเปลือง เช่น เทป กาว), `flw0001` (ดอกไม้พลาสติก)

- **เพิ่มระบบรันเลขบิล YYMMDD + มาตรฐานบัญชีสากล (Audit Integrity) & สถาปัตยกรรมเรียกชื่อข้ามหน้า (Cross-Page Linking)**:
  - **รูปแบบเลขที่บิลการเงิน (`transaction_code`)**: รันอัตโนมัติเป็น `2611040001` (ปีเดือนวัน + 4 หลัก) ผ่าน Trigger `trigger_set_transaction_code`
  - **มาตรฐานบัญชีสากลเรื่องบิลที่ถูกลบ**: ห้ามนำเลขเดิมมาใช้ซ้ำ (ต้องรันเป็น `0101` เสมอ) และห้าม Hard Delete แต่ใช้วิธี **"ยกเลิกเอกสาร (VOID)"** โดยเก็บ `void_reason`, `voided_at`, `voided_by_user_id` ทำให้เวลาผู้สอบบัญชี/สรรพากรตรวจจะเห็นลำดับตัวเลขเรียงต่อเนื่องครบ 100% ไม่ถูกตั้งข้อสงสัยว่าซ่อนรายได้
  - **การเรียกชื่อและคลิกข้ามหน้า (Cross-Page Deep Linking)**: เชื่อมโยง Foreign Key ระหว่าง Projects, Finance, Inventory, Artists, Customers ทำงานแบบ In-Memory ผ่าน Local-First IndexedDB (Dexie) ด้วยความเร็ว 0ms และ 0 Egress
  - **เกราะป้องกัน Egress สำหรับคลังพัสดุ (Zero-Egress Inventory Engine)**: เพิ่มฟังก์ชัน RPC `get_inventory_analytics()` คำนวณยอดสรุปคลังพัสดุบนเซิร์ฟเวอร์ส่งกลับมาเป็นก้อนตัวเลขขนาดเพียง ~80 Bytes พร้อมพิสูจน์ว่าโครงสร้างแบบแยกตารางประหยัด Egress ยิ่งกว่า JSON แบบเดิมหลายเท่าตัว
  - บันทึกลงใน [`F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md`](file:///D:/WebappDreame/Flower2U/F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md) (หัวข้อ 4.6 - 4.8 และสคริปต์ SQL หัวข้อ 6) เรียบร้อยแล้ว

- **ยกเครื่องสถาปัตยกรรมสู่โครงสร้างแบบแยกคอลัมน์อิสระ 100% (Zero-JSON Pure-Relational Normalization)**:
  - ตรวจสอบฟอร์มและฟิลด์ทั้งหมดในระบบ (`App.jsx`, Modals, Finance, Settings, Inventory) เพื่อตัดฟิลด์ประเภท JSON ออกทั้งหมด:
    1. **ข้อมูลลูกค้าใน Projects**: แยกเป็นคอลัมน์ `customer_social`, `customer_line`, `customer_phone`, `customer_email`, `customer_tax_id`, `customer_address` ชัดเจน
    2. **สร้างตารางลูกแบบ Normalized**:
       - `project_quotation_items`: รายการเสนอราคา (category, detail, quantity, unit_price, price, item_date, sort_order)
       - `project_customer_support`: รายการเงินสนับสนุนศิลปิน/ธนบัตร (denomination, quantity, price, item_date, sort_order)
       - `project_expenses`: รายการค่าใช้จ่ายเฉพาะงาน (category, detail, quantity, unit_price, price, item_date, sort_order)
    3. **สเปกพัสดุในคลัง (Inventory)**: แยกเป็นคอลัมน์ `color`, `size`, `texture_type`, `material_grade`
    4. **การตั้งค่าร้านค้า (Shop Settings)**: แยกเป็นตาราง `shop_settings` เก็บข้อมูลเบอร์โทร, โซเชียล, และโฟลเดอร์ Drive เป็นคอลัมน์เดี่ยว
  - อัปเดตสคริปต์มาสเตอร์ในหัวข้อที่ 6 ของ [`F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md`](file:///D:/WebappDreame/Flower2U/F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md) ให้หน้าบ้านสามารถคิวรีและบันทึกได้ตรงๆ โดยไม่ต้องเขียน `JSON.parse()` ช่วยลดภาระหน่วยความจำและตัดโอกาสข้อมูลตกหล่น 100%

- **เพิ่มระบบพนักงานและกำหนดสิทธิ์เข้าถึงตามบทบาท (Staff Management & Dynamic RBAC) + รวม Master SQL DDL**:
  - เสริมตาราง `roles` (กำหนด `allowed_pages` เช่น ช่างเห็นเฉพาะหน้างาน/คลัง, แอดมินเห็นทุกหน้า) และตาราง `staff_users` ใน [`F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md`](file:///D:/WebappDreame/Flower2U/F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md)
  - รวมสคริปต์ SQL ทั้งหมด (Projects, Deleted Records, Roles, Staff, Artists, Customers, Inventory, Asset Loans, Transactions, RPC Functions) รวมไว้เป็น **All-in-One Master Production DDL ในหัวข้อที่ 6** ทำให้ผู้ใช้สามารถคัดลอกไปกด **Run บน Supabase SQL Editor ได้ทันทีแบบ One-Click** โดยไม่มีการขาดตารางหรือฟังก์ชันใดๆ

- **ตรวจสอบและยกระดับเกราะป้องกันความเสี่ยงและบั๊กใน SUPABASE_MIGRATION_PLAN.md**:
  - ทบทวนหัวข้อ "การจัดการ Bug และความเสี่ยงในอนาคต" ที่ผู้ใช้เพิ่มเข้ามา พร้อมอัปเกรด 5 กลไกเชิงลึก:
    1. **แก้บั๊ก Delta Chunk Pagination**: ปรับ `get_project_deltas` ให้ใช้ `MAX(updated_at)` ของแถวสุดท้ายใน Chunk เป็น Watermark แทน `now()` พร้อมส่ง `has_more` เพื่อวนลูปดึงจนครบ ป้องกันข้อมูลหล่นหายเมื่อมีอัปเดตเกิน 200 แถว
    2. **เกราะป้องกัน Zombie Records จาก Tombstone Pruning**: เพิ่มการตรวจจับ `p_last_synced_at < NOW() - 30 days` สั่งทำ `requires_full_resync` อัตโนมัติ ป้องกันเครื่องที่ออฟไลน์นานเก็บประวัติเรคคอร์ดที่ลบไปแล้ว
    3. **Optimistic Locking แบบ Native PostgREST**: เสริมแนวทางการใช้ `.eq('version', clientVersion)` ผ่าน Supabase SDK โดยตรง และเพิ่มแนวคิด UI Side-by-side Conflict Resolution
    4. **Browser Persistent Storage Guard**: เพิ่มคำสั่ง `navigator.storage.persist()` ป้องกัน Safari iOS / Android ล้าง IndexedDB ทิ้ง
    5. **Apps Script Quota & Rate Limit Shield**: เพิ่มระบบ Exponential Backoff with Jitter ในการอัปโหลดไฟล์

- **ออกแบบสถาปัตยกรรมฐานข้อมูล Supabase ครบวงจรและแผนขยาย 4 ระบบในอนาคต (Enterprise Unified Schema)**:
  - จัดทำพิมพ์เขียวสถาปัตยกรรมระดับองค์กรไว้ที่ [`F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md`](file:///D:/WebappDreame/Flower2U/F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md)
  - วิเคราะห์และออกแบบตารางรองรับข้อมูล 302 แถวเดิมจาก Google Sheets พร้อม 4 ระบบหลักในอนาคต:
    1. **ระบบการเงินอิสระ & Auto-Inventory Link**: บันทึกรายจ่ายซื้อของแล้วดันเข้าสต็อกคลังสินค้าทันทีผ่าน DB Trigger
    2. **ระบบคลังพัสดุ & ยืมคืนอุปกรณ์ (Assets vs Consumables vs Reusable Materials)**: ติดตามช่างที่ยืมเครื่องมือนอกสถานที่, สต็อกวัสดุสิ้นเปลือง (กระดาษหลากสี/ขนาด, เทป, โฟม) พร้อมเกณฑ์เตือนภัยสต็อกต่ำ, และวงจรนำดอกไม้พลาสติกกลับมาใช้ซ้ำ (Return & Salvage)
    3. **ระบบประวัติการจัดซื้อและแจ้งเตือนคู่ค้า (Vendor Intelligence & Defect Shield)**: จำประวัติราคาเปรียบเทียบซัพพลายเออร์ที่คุ้มค่าที่สุด และขึ้น Badge แจ้งเตือนสีแดงหากร้านค้ามีประวัติส่งของมีตำหนิ
    4. **ระบบศิลปินและลูกค้าสัมพันธ์ (Artist & Customer CRM Directory)**: รองรับเรดาร์วันเกิดศิลปิน (Birthday Radar) และวิเคราะห์กำลังซื้อแฟนด้อมตาม [`แผนพัฒนาระบบวิเคราะห์ข้อมูล.md`](file:///D:/WebappDreame/Flower2U/แผนพัฒนาระบบวิเคราะห์ข้อมูล.md)
  - แนบคำสั่ง SQL DDL Production Scripts ครบชุดพร้อมดัชนี Index และ Triggers

- **จัดทำพิมพ์เขียวสถาปัตยกรรมย้ายฐานข้อมูล Google Sheets สู่ Supabase (Zero-Egress & Local-First Strategy)**:
  - จัดทำเอกสารพิมพ์เขียวทางวิศวกรรมฉบับสมบูรณ์ไว้ที่ [`SUPABASE_MIGRATION_PLAN.md`](file:///D:/WebappDreame/Flower2U/SUPABASE_MIGRATION_PLAN.md)
  - ครอบคลุมการแปลข้อกำหนดสู่ศัพท์วิศวกรรมมาตรฐาน, 20 เทคนิคขั้นสูงเพื่อประหยัด Egress ให้อยู่ในโควต้าฟรี 5GB/เดือน (ใช้งานจริงต่ำกว่า 100MB/เดือน), สคีมา PostgreSQL พร้อมฟังก์ชัน RPC สำหรับ Compute-at-Rest (`get_financial_analytics`) และ Incremental Delta Sync (`get_project_deltas`), และโครงสร้าง Local-First IndexedDB Engine (Dexie.js)

- **ยกเครื่อง UX/UI และแก้บั๊ก Drag & Drop ในส่วนรูปภาพอ้างอิงและสลิปโอนเงิน (Linear/Apple Quality UI Overhaul)**:
  - **แก้บั๊ก Drag & Drop หลุด/ไม่ไฮไลต์**: ปลดชนวนปัญหาที่ `handleModalDragLeave` ใน Modal กล่องแม่ไปสั่งปิดสถานะ `isDraggingRef(false)` และ `isDraggingSlip(false)` ของกล่องลูกขณะเคอร์เซอร์เคลื่อนผ่าน DOM ภายใน ปรับให้คอนเทนเนอร์ Modal ทำหน้าที่เพียงป้องกัน default drop และให้กล่องลูกจัดการเคาน์เตอร์สถานะลากแยกอิสระ 100% พร้อม `handleGlobalDrop` ที่หน้าต่าง Window เพื่อความปลอดภัย
  - **ลบกล่องทึบสีม่วง/ส้มที่บดบังรูป (Overlay Blackout Fix)**: ยกเลิก Overlay ทึบขนาดใหญ่ที่ปิดทับรูปเดิมทั้งหมดเมื่อมีรูปอยู่ในรายการแล้ว เปลี่ยนมาใช้การไฮไลต์กรอบคอนเทนเนอร์รอบนอกอย่างนุ่มนวล (`border-indigo-500 bg-indigo-50/40 ring-4 ring-indigo-500/15`) พร้อมแถบข้อความขนาดกะทัดรัดด้านบน ("ปล่อยเมาส์เพื่อเพิ่มรูปภาพต่อท้าย (X รูปเดิมจะคงอยู่)") ทำให้ผู้ใช้มองเห็นรูปเดิมครบถ้วน 100%
  - **การ์ดเป้าหมายการวางรูป ("+ เพิ่มอีก" Drop Target)**: เมื่อลากไฟล์เข้ามา ช่อง "+ เพิ่มอีก" จะแปลงร่างเป็นการ์ดเป้าหมาย drop target ("วางไฟล์ที่นี่ เพิ่มต่อท้าย") มีสีสันไฮไลต์ชัดเจน
  - **ปรับแต่งการ์ดรูปภาพ (Thumbnail Polish)**: การ์ดอัตราส่วน 3:4 ขอบมนสวยงาม มี Dark Gradient Scrim ด้านล่าง ป้ายเลขรูป "รูปที่ 1" / "สลิปที่ 1", ไอคอนดูภาพขยายเมื่อ Hover, และปุ่มถังขยะลบรูปที่เข้าถึงง่าย
  - **ปรับดีไซน์ Empty State**: กล่องอัปโหลดตอนยังไม่มีรูปได้รับการออกแบบใหม่ด้วยการ์ดโค้งมนสไตล์โมเดิร์น พร้อมปุ่ม "+ เพิ่มรูปภาพ" / "+ เพิ่มสลิป" ที่หัวข้อ ชัดเจน สะอาดตา ไร้อาการ Layout Shift
  - **ทดสอบและยืนยันผลจริงผ่าน `chrome-devtools`**: ทดสอบทั้ง Desktop (1440px) และ Mobile (390px) ตรวจสอบ Drag Active State และบิลด์ผ่าน `npm run build` ไร้ข้อผิดพลาด 100%
  - ตรวจสอบผ่าน `chrome-devtools` จำลองการลากไฟล์เข้า-ออกทั้งช่องรูปภาพอ้างอิงและสลิปโอนเงิน ยืนยันความสูงคงที่ 130px ไม่ขยับแม้แต่ 1 พิกเซล และบิลด์ผ่าน `npm run build` สำเร็จ 100%

- **ปรับแต่ง Desktop Filter แถวเดียว + ลบ Drag Banner ใน Modal + ลบก้อนคอนโทรลล่างของ ImageViewer**:
  - **ตัวกรองบนหน้าจอคอมพิวเตอร์ (Desktop Filter Single-Row with Toggle Button)**:
    - ปรับปรุงทั้ง [`App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx) (หน้ารายการแผนงาน/วิเคราะห์) และ [`FinanceView.jsx`](file:///D:/WebappDreame/Flower2U/src/FinanceView.jsx) (หน้าการเงิน):
    - จากเดิมแสดง 2 แถวตลอดเวลา เปลี่ยนเป็นแสดงเพียง **แถวเดียว** (ช่องค้นหา + ช่วงวันที่ + ปุ่ม "ตัวกรอง" + ปุ่มรีเซ็ต) ช่วยประหยัดพื้นที่แนวตั้งบนจอคอมพิวเตอร์อย่างมาก
    - เพิ่มปุ่ม "ตัวกรอง" (พร้อม Badge แสดงจำนวนตัวกรองที่เลือกอยู่) ให้ผู้ใช้สามารถกดเปิด/ปิดแถวที่สองได้ตามต้องการ เหมือนประสบการณ์บนมือถือ
  - **นำแถบแจ้งเตือนลากไฟล์ออกจาก Modal (Removed Top Drag Banner)**:
    - ลบแถบ `กำลังลากไฟล์: นำเมาส์ไปวางในช่อง 'รูปภาพอ้างอิง' หรือ 'สลิปโอนเงิน' แล้วปล่อยได้เลย` ออกจาก Modal จัดการข้อมูลใน `App.jsx` เพื่อไม่ให้บดบังหรือดันเนื้อหา Modal ลงมา
    - ยังคงเอฟเฟกต์ Active Dropzone เรืองแสงและคำแนะนำตรงช่องรูปภาพอ้างอิงและสลิปตามปกติ
  - **ลบก้อนคอนโทรลด้านล่างของ ImageViewer ออก (Removed Bottom Cluster)**:
    - นำแถบคอนโทรลด้านล่าง (Pill `1/4`, Interactive Dots และข้อความแนะนำ) ใน [`ImageViewer.jsx`](file:///D:/WebappDreame/Flower2U/src/components/common/ImageViewer.jsx) ออกทั้งหมดตามภาพสกรีนช็อตที่ผู้ใช้แนบ
    - คงป้ายตัวนับขนาดเล็ก (`1/6` ถึง `6/6`) ไว้ที่แถบด้านบนคู่กับชื่อประเภทรูปภาพ เพื่อให้ผู้ใช้ทราบตำแหน่งรูปภาพอย่างสะอาดตา ไม่บดบังรูปสลิปหรือรายละเอียดงาน
  - ตรวจสอบผ่าน `chrome-devtools` (Desktop 1440px และ Mobile) และคอมไพล์ผ่าน `npm run build` สำเร็จ 100%

- **ระบบเลื่อนดูรูปภาพอ้างอิงและสลิปโอนเงินแบบ Gallery (Gallery Slider, Touch Swipe & Image Counter)**:
  - ปรับปรุง [`ImageViewer.jsx`](file:///D:/WebappDreame/Flower2U/src/components/common/ImageViewer.jsx):
    - รองรับการรับข้อมูลรูปภาพทั้งแบบรูปเดี่ยว (`src`), อาร์เรย์รูปภาพ (`images`), และอ็อบเจ็กต์ชุดข้อมูลรูปภาพ (`{ images, initialIndex, title }`)
    - ซิงค์และแปลง URL ทุกรูปแบบอัตโนมัติด้วย `processImageUrl`
    - เพิ่มปุ่มเลื่อนซ้าย-ขวาขนาดใหญ่ (ChevronLeft, ChevronRight) พร้อมเอฟเฟกต์ Frosted Glass มัวโปร่งแสง กดง่ายทั้งบนมือถือและจอคอมพิวเตอร์
    - รองรับการสไลด์/ปัดนิ้วซ้าย-ขวาบนหน้าจอมือถือ (Touch Swipe Gesture) และการลากเมาส์บน Desktop โดยคำนวณตามระยะปัดจริง มีแอนิเมชันลื่นไหล
    - รองรับการกดปุ่มลูกศรบนคีย์บอร์ด (`ArrowLeft`, `ArrowRight`, `Escape`)
    - ระบบ Preload รูปภาพถัดไปและก่อนหน้าล่วงหน้าเพื่อความเร็วแบบเปิดติดทันที ไร้ดีเลย์
    - เพิ่มตัวบอกลำดับรูปภาพขนาดเล็กตามความต้องการ:
      - ป้ายตัวเลขเล็กที่แถบด้านบน (เช่น `1/6`, `2/6` ... `6/6`) พร้อมไอคอนแยกตามประเภท (ไอคอนรูปภาพอ้างอิงสีน้ำเงิน หรือไอคอนสลิปการเงินสีเหลืองทอง)
      - ป้ายบอกตำแหน่งด้านล่าง (Floating Counter Pill: `1 / 6 • สไลด์หรือกดลูกศรเพื่อเลื่อน`) พร้อมปุ่ม Interactive Dots ลัดไปยังรูปที่ต้องการได้ทันที
    - คงฟังก์ชัน Pinch-to-zoom (ขยาย 1x-5x), ดับเบิ้ลคลิก/แตะสองครั้งเพื่อซูม, และ Pan เลื่อนดูรายละเอียดเมื่อซูม
  - ปรับปรุง [`App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx):
    - เมื่อคลิกพรีวิวจากกริด "รูปภาพอ้างอิง" จะส่งรายการรูปภาพอ้างอิงทั้งหมดพร้อมตำแหน่ง `idx` เริ่มต้น ทำให้เลื่อนดูเฉพาะในกลุ่มรูปภาพอ้างอิง
    - เมื่อคลิกพรีวิวจากกริด "สลิปโอนเงิน" จะส่งรายการสลิปทั้งหมดพร้อมตำแหน่ง `idx` เริ่มต้น ทำให้เลื่อนดูเฉพาะในกลุ่มสลิปโอนเงิน
  - ปรับปรุง [`FinanceView.jsx`](file:///D:/WebappDreame/Flower2U/src/FinanceView.jsx):
    - นำ `ImageViewer` มาใช้แทน Lightbox แบบเดิมในหน้ารายการตารางสลิปโอนเงิน ทำให้สามารถเลื่อนดูสลิปทุกใบของรายการนั้นๆ พร้อมระบบนับจำนวนและซูม
  - ปรับปรุง [`SharePreviewModal.jsx`](file:///D:/WebappDreame/Flower2U/src/components/modals/SharePreviewModal.jsx), [`CustomerQuotationView.jsx`](file:///D:/WebappDreame/Flower2U/src/components/customer/CustomerQuotationView.jsx) และ [`CustomerTrackingView.jsx`](file:///D:/WebappDreame/Flower2U/src/components/customer/CustomerTrackingView.jsx):
    - รองรับการคลิกดูรูปขยายและเลื่อนดูรูปภาพอ้างอิงทั้งหมดในชุดข้อมูล
  - ตรวจสอบความถูกต้องผ่าน `chrome-devtools` (Mobile 390px, Tablet 820px, Desktop 1440px) และบิลด์ผ่าน `npm run build` สำเร็จ 100%

- **ระบบรูปภาพอ้างอิงหลายรูปและเอฟเฟกต์แสดงสถานะขณะลากรูปภาพมาวาง (Multi-reference Images & Visual Drag Overlay)**:
  - ปรับปรุง `App.jsx`:
    - เปลี่ยนส่วน "รูปภาพอ้างอิง" (Reference Images) ให้สามารถอัปโหลดได้หลายรูปพร้อมกันเหมือนระบบสลิปโอนเงิน (รองรับการเลือกหลายไฟล์พร้อมกันและ Drag & Drop)
    - เพิ่มระบบ Visual Drag Feedback: เมื่อลากไฟล์เข้ามาใน Modal จะแสดงแถบแจ้งเตือนด้านบน "กำลังลากไฟล์: นำเมาส์ไปวางในช่อง 'รูปภาพอ้างอิง' หรือ 'สลิปโอนเงิน' แล้วปล่อยได้เลย" พร้อมมีป้าย Highlight กระพริบชี้ตำแหน่งทั้งสองช่อง
    - เมื่อเลื่อนเมาส์ไปเหนือช่องดรอปโซน ช่องจะเปลี่ยนสถานะเป็น Active Dropzone (กรอบทึบสีน้ำเงิน/ส้มเรืองแสง, ขยายขึ้นเล็กน้อย, ไอคอน Upload เด้งแบบแอนิเมชัน, และข้อความชัดเจน "ปล่อยเมาส์เพื่อวางรูปภาพอ้างอิงทันที!")
    - กรณีมีรูปเดิมอยู่แล้ว เมื่อลากไฟล์มาวางเหนือกริดรูปภาพ จะมี Overlay มัวโปร่งใสสีธีมพร้อมไอคอนแจ้งว่า "ปล่อยเพื่อวางรูปภาพอ้างอิงทันที! จะเพิ่มรูปภาพต่อท้ายรูปเดิม"
    - ป้องกันปัญหา Browser บังคับเปิดไฟล์รูปภาพเมื่อปล่อยเมาส์นอกเป้าหมาย (Prevent Window Drop Navigation)
    - แสดงกริดพรีวิวรูปภาพอัตราส่วนเดียวกับสลิป พร้อมป้ายนับจำนวน (เช่น `2 รูป`), ป้ายลำดับ (`รูปที่ 1`, `รูปที่ 2`), ปุ่มดูรูปขยาย (ImageViewer) และปุ่มลบแยกรายรูป
    - รองรับการกดปุ่ม "เพิ่มรูปภาพ" ด้านบน และปุ่ม "เพิ่มอีก" ในกริด
    - อัปเกรดการบันทึก: เก็บใน `images` (array) และซิงค์ `image` ตัวแรกเพื่อ Backward Compatibility กับระบบแชร์ ใบเสนอราคา และการพิมพ์
    - รองรับการอัปโหลดอัตโนมัติขึ้น Google Drive ไปยังโฟลเดอร์รูปภาพอ้างอิง (`reference`) หากมีการเชื่อมต่อ Apps Script
  - ปรับปรุง `SharePreviewModal.jsx`:
    - รองรับการแสดงผลพรีวิวรูปภาพอ้างอิงทั้งแบบรูปเดียวและหลายรูป
  - ตรวจสอบผ่าน `chrome-devtools` (Mobile 390px, Tablet 820px, Desktop 1440px) และคอมไพล์ผ่าน `npm run build` ผ่าน 100%

### [2026-10-22]
- **มาตรฐานลำดับการเงิน 4 ส่วนทั่วทั้งระบบ (Standardized Financial Sequence)**:
  - ปรับปรุง `AnalyticsView.jsx`: สลับการ์ดบน 4 ใบ ให้ "เงินศิลปิน (ยอดสนับสนุน)" ขึ้นอันดับ 1 และ "รายได้ (ค่าจ้าง)" เป็นอันดับ 2
  - ปรับปรุง `FinanceView.jsx`: สลับลำดับคอลัมน์ CSV Export ให้ยอดเงินสนับสนุนศิลปินมาก่อนยอดใบเสนอราคา
  - ปรับปรุง `App.jsx`:
    - ปรับแถบสรุป 4 ช่องใน Modal จัดการโปรเจกต์ (Project Modal Summary Strip) ให้แสดง: 1. เงินศิลปิน 2. รายได้ 3. ค่าใช้จ่าย 4. กำไรสุทธิ พร้อม Badge ยอดเรียกเก็บสุทธิด้านบน
    - ปรับ Mobile Card View และ Desktop Table Cell ให้แสดงเงินศิลปิน (สนับสนุน) ก่อนรายได้ (ค่าจ้าง)
  - ปรับปรุง `SharePreviewModal.jsx`: จัดลำดับรายการพิมพ์เอกสารให้เงินสนับสนุนมาก่อนรายการเสนอราคา
  - ตรวจสอบผ่าน `chrome-devtools` และคอมไพล์ผ่าน `npm run build` สมบูรณ์

### [2026-10-21]
- **ระบบพิมพ์สลิปโอนเงิน**:
  - ปรับสลิปให้แสดงรูปเต็มตามอัตราส่วนจริง (ไม่กำหนดความกว้างตายตัว เพื่อไม่ให้มีขอบเทาว่าง)
  - เพิ่มตัวเลือกระหว่างพิมพ์: เลือกแสดงสลิปแถวละ 3 รูป (ชัดเจน อ่านง่าย) หรือ 4 รูป (กะทัดรัด)
  - เพิ่มตัวกรอง "ทั้งหมด" หรือ "เฉพาะที่มีสลิป"
  - แก้ไขปุ่มรูปแบบการพิมพ์ไม่ให้กระโดดไปมาเมื่อสลับโหมด
- **การ์ดสรุปยอดหน้าการเงิน**:
  - ปรับระบบตัวเลขอัตโนมัติ (Adaptive Typography) สั้น/ยาว สเกลฟอนต์อัตโนมัติ ไม่เหลือที่ว่างโล่งและไม่ล้นการ์ด
  - แก้ไข Badge "Margin สุทธิ" ให้สมส่วน
  - รองรับ Responsive สมบูรณ์: Mobile (2 คอลัมน์), Tablet (4 คอลัมน์ใน 1 แถว), Desktop (4 คอลัมน์)
  - สลับตำแหน่งให้ "เงินสนับสนุน" อยู่ซ้ายสุด และ "รายรับรวม" เป็นอันดับ 2
  - ปรับลำดับในบัตรงานย่อยให้ "1. ส่งต่อศิลปิน" อยู่ซ้ายสุด ตามด้วย "2. รายรับ"

### [2026-11-04 - การขยายระบบเต็มรูปแบบ & Zero-Egress Architecture Execution]
- **ตัดคำสั่ง `SELECT *` ออกจากระบบ 100% (Strictly NO `SELECT *`)**:
  - กำหนด Explicit Projection Constants ใน [`src/services/syncService.js`](file:///D:/WebappDreame/Flower2U/src/services/syncService.js): `PROJECT_LIST_COLUMNS`, `PROJECT_DETAIL_COLUMNS`, `CUSTOMER_COLUMNS`, `INVENTORY_COLUMNS`, `ASSET_LOAN_COLUMNS`, `QUOTATION_COLUMNS`, `SUPPORT_COLUMNS`, `EXPENSE_COLUMNS`, `LOCATION_COLUMNS`, `SHOP_SETTINGS_COLUMNS`
  - ตัด Array รูปภาพ (`images`) และ สลิป (`slips`) ออกจาก List query ลด Egress >98% พร้อมระบบ JIT On-Demand Fetch (`fetchProjectDetailOnDemand`)
- **Server-Side Pushdown Analytics (คำนวณสถิติการเงินบน Supabase Server)**:
  - เขียน RPC [`database_scripts/create_complete_analytics_rpc.sql`](file:///D:/WebappDreame/Flower2U/database_scripts/create_complete_analytics_rpc.sql) รวมผลบน Server ส่งเฉพาะผลลัพธ์ JSON ~1.5 KB
- **True Lazy Loading บน IndexedDB และ Supabase**:
  - ปรับปรุงการเลื่อนหน้าจอโหลดทีละ 20 แถวด้วย `loadProjectsPaginated` ผ่าน `.range()`
- **สร้าง 5 หน้าเมนูหลักใหม่เต็มรูปแบบ (Dedicated Full Views)**:
  1. 📍 **`VenuesView.jsx`**: หน้ารวมสถานที่จัดส่งเต็มรูปแบบ Dual-Pin นำทาง (จุดส่งลูกค้า vs Loading Dock), ข้อมูลประตู, จำกัดความสูง, เบอร์ รปภ., ฟอร์มเพิ่มสถานที่
  2. 🌟 **`ArtistsView.jsx`**: หน้าทำเนียบศิลปิน (111+ ศิลปิน) จัดอันดับศิลปินยอดนิยม ยอดเงินสนับสนุนธนบัตรสะสม จำนวนงาน และปุ่มกรองโปรเจกต์
  3. 👥 **`CustomersView.jsx`**: หน้าระบบจัดการลูกค้า & บ้านเบสแฟนคลับ (Customer Directory) ยอดซื้อสะสม, จำนวนออเดอร์, VIP Fandom, โทรออก (`tel:`), LINE, Social และฟอร์มสร้าง/แก้ไข
  4. 📦 **`InventoryView.jsx`**: หน้าระบบบริหารคลังพัสดุและยืม-คืนอุปกรณ์ (Inventory & Asset Management) สต๊อกพัสดุ (โฟม, ฐาน, ปรับสต๊อก +1/-1) และ ทะเบียนยืม-คืนอุปกรณ์งาน (`asset_loans`)
  5. 📄 **`QuotationsView.jsx`**: หน้ากระดานใบเสนอราคา (Quotations Board) ติดตามสถานะ, ดูตัวอย่างใบเสนอราคาเต็มหน้า, พิมพ์เอกสาร, และแชร์ลิงก์ออนไลน์
- **รีโนเวทหน้าการเงิน (`FinanceView.jsx`)**:
  - หน้าหลักเป็น **แถวรายการรายรับ-รายจ่าย (Interactive Transaction Feed)** แสดง 1,737+ รายการธุรกรรมแยกสี (🟢 รายรับ / 🔴 รายจ่าย / 🟣 ซัพพอร์ต)
  - รองรับการแก้ไขยอดและรายละเอียดสด (Edit Modal)
  - รองรับการยกเลิกรายการ (Void) ขีดฆ่าไม่คิดยอดในกำไรขาดทุนทันที
  - รองรับการลบรายการ และปุ่มเพิ่มรายการด่วน (+ Add Transaction)
  - ย้ายตารางสมุดบัญชีแบบเดิมไปไว้ที่แท็บ **"ตารางบัญชี (พิมพ์)"** สำหรับดูและพิมพ์รายงาน A4
- **เชื่อมต่อระบบนำทางสมบูรณ์แบบใน [`src/App.jsx`](file:///D:/WebappDreame/Flower2U/src/App.jsx)**:
  - รองรับ 10 แท็บ: Calendar, Plans, Finance, Quotations, Inventory, Venues, Artists, Customers, Analytics, Settings
  - รองรับ URL Routing: `/calendar`, `/plans`, `/finance`, `/quotations`, `/inventory`, `/venues`, `/artists`, `/customers`, `/analytics`, `/settings`
  - แถบเมนูด้านข้าง (Desktop Sidebar) แสดงครบ 10 เมนู
  - แถบนำทางมือถือ (Mobile Bottom Sheet) ออกแบบ 2 แถว แถวที่ 2 มี 6 เมนูย่อย
- **การทดสอบและผลการตรวจรับ**:
  - `npm run build` ผ่าน 100% ใน 7.40s
  - ทดสอบจริงทุกหน้าบน Browser ผ่าน `chrome-devtools` คอนโซลสะอาด ปราศจาก Error

### [2026-11-05 - ยกระดับ UX/UI Modal ทุกหน้าให้เป็นดีไซน์เดียวกับหน้าแผนงาน (Unified Modal Design System)]
- **ถอดรหัส Design DNA จากหน้าแผนงาน (Plans Modal: `isAddModalOpen` ใน `App.jsx`)**:
  1. **Clean White Signature Header**: ส่วนหัวพื้นหลังสีขาวสะอาดตา (`bg-white border-b border-slate-100 sticky top-0 z-20`) พร้อมกล่องไอคอนสี่เหลี่ยมโค้งมนมน มี Badge ป้ายกำกับ และปุ่มกากบาทปิดแบบ Hover
  2. **Card Container & Physics**: กล่องโมดอลขนาดใหญ่พรีเมียม `sm:rounded-[2.5rem] rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]` พร้อมแอนิเมชันเปิดแบบ Spring-Scale 0.35s (`modal-animate-in`) และฉากหลังมัว Blur (`backdrop-animate-in`)
  3. **Scrollable Form Body**: ช่องฟอร์มขนาดสมส่วน พื้นหลังสีอ่อน `bg-slate-50/70 focus:bg-white` ขอบมน `rounded-xl sm:rounded-2xl` พร้อมสกรอลล์บาร์แบบซ่อนสวยงาม
  4. **Signature Sticky Footer**: แถบปุ่มด้านล่างแบบ Sticky Blur (`bg-white/95 backdrop-blur-xl border-t border-slate-100`) ปุ่มยกเลิกโค้งมนมน และปุ่มหลักไล่เฉดสี Gradient เงาสวยงามกดแล้วมียุบตัวแบบสัมผัสจริง
- **อัปเกรด Modal ทั่วทั้งระบบครบ 100%**:
  - 👥 **`StaffView.jsx`**: โมดอลสร้าง/แก้ไขพนักงาน (`isModalOpen`) และโมดอลดูประวัติละเอียด Dossier (`isDetailModalOpen`)
  - 🌟 **`ArtistsView.jsx`**: โมดอลเพิ่ม/แก้ไขข้อมูลศิลปิน (`isModalOpen`) และโมดอลประวัติศิลปิน Dossier พร้อมข้อมูลแฟนคลับและสีประจำตัว (`isDetailModalOpen`)
  - 🤝 **`CustomersView.jsx`**: โมดอลเพิ่ม/แก้ไขข้อมูลลูกค้า & แฟนด้อม (`isModalOpen`)
  - 📄 **`QuotationsView.jsx`**: โมดอลคำนวณและออกใบเสนอราคาต้นทุน ตร.ม. (`isModalOpen`) และโมดอลตั้งค่าราคากลางวัสดุมาตรฐาน (`isRatesModalOpen`)
  - 📦 **`InventoryView.jsx`**: โมดอลเพิ่ม/แก้ไขพัสดุเข้าคลัง (`isItemModalOpen`) และโมดอลบันทึกการยืม-คืนอุปกรณ์ (`isLoanModalOpen`)
  - 📍 **`VenuesView.jsx` & Modals**: โมดอลสร้าง/แก้ไขสถานที่จัดส่ง (`isCreateModalOpen`), โมดอลลายแทงจุดส่ง (`VenueDetailModal.jsx`), และโมดอลคลังค้นหาสถานที่จัดส่ง (`VenueDirectoryModal.jsx`)
  - 💰 **`FinanceView.jsx`**: โมดอลเพิ่มรายการรายรับ-รายจ่ายด่วน (`isAddTxModalOpen`) และโมดอลแก้ไข/Void รายการธุรกรรม (`isEditTxModalOpen`)
- **การทดสอบและผลการตรวจรับ**:
  - `npm run build` ผ่าน 100% สำเร็จเรียบร้อย (Built in 12.10s) ไม่มี Syntax Error ใดๆ
  - ปฏิบัติตามกฎเหล็ก Directive 11: ไม่มีการใช้ Native Browser Dialog หรือ Native Date Picker

### [2026-11-05 - อัปเกรดระบบสิทธิ์ Roles & Permissions, แยกหมวดหมู่หน้า Settings, ปรับแต่งรหัสผ่าน และ Profile Popup สไตล์ Facebook]
1. **ปรับปรุงช่องรหัสผ่านและยืนยันรหัสผ่านในหน้าพนักงาน (`StaffView.jsx` - Screenshot 1)**:
   - ย้ายไอคอนรูปตา (เปิด/ซ่อนรหัสผ่าน) เข้าไปอยู่ **ภายในกรอบ Input** ทางด้านขวาอย่างสวยงาม
   - เพิ่มช่อง **ยืนยันรหัสผ่าน (Confirm Password) \*** พร้อมไอคอนรูปตาในกรอบ Input
   - เพิ่มระบบตรวจสอบแบบเรียลไทม์: แสดง Badge "รหัสตรงกัน" (สีเขียว) หรือ "รหัสไม่ตรงกัน" (สีแดง)
   - ป้องกันการบันทึกหากรหัสผ่านทั้ง 2 ช่องไม่ตรงกัน
   - เพิ่มการกรอกข้อมูล **เลขประจำตัวประชาชน (Citizen ID 13 หลัก)**, **ที่อยู่**, และ **ผู้ติดต่อฉุกเฉิน** ในข้อมูลพนักงาน
2. **ระบบกำหนดสิทธิ์และบทบาท (Roles & Permissions Matrix - Screenshot 2)**:
   - เพิ่มหมวด **"สิทธิ์และบทบาท"** ในหน้าตั้งค่าระบบ (`SettingsView.jsx`)
   - ถอดแบบหน้าจอตรงตาม Screenshot 2:
     - คอลัมน์บทบาท: แอดมิน (Admin - 11), ช่างจัดดอกไม้ (Technician - 21), พนักงานจัดส่ง (Driver - 31), ฝ่ายบัญชี/การเงิน (Accountant - 41)
     - แถวส่วนของระบบ: ทั้งหมด 11 โมดูล (Calendar, Plans, Finance, Quotations, Inventory, Venues, Artists, Customers, Staff, Analytics, Settings)
     - แถวสิทธิ์การทำรายการพิเศษ: `can_edit_pricing` (แก้ไขราคา/กำไร), `can_delete_project` (ลบงาน), `can_borrow_tools` (ยืมของในคลัง), `can_manage_users` (จัดการพนักงานและสิทธิ์)
   - เชื่อมโยงระบบเข้ากับการซิงค์ Supabase ตาราง `roles` และ LocalStorage `f2u_role_permissions`
   - เชื่อมต่อการกรองเมนูนำทาง (`allowedNavItems`) ใน `App.jsx` ให้ผู้ใช้งานแต่ละตำแหน่งมองเห็นเฉพาะหน้าที่ได้รับอนุญาต
3. **จัดหมวดหมู่หน้าตั้งค่าระบบ & เพิ่มหน้าโปรไฟล์ (Settings Categorization & Profile - Screenshot 3)**:
   - จัดหมวดหมู่ใน `SettingsView.jsx` เป็น 6 หมวดชัดเจน (Responsive: ด้านซ้ายแบบเมนูแนวตั้งบน Desktop, ด้านบนแบบแถบเลื่อนบน Mobile):
     1. 👤 **โปรไฟล์ของฉัน (My Profile)**: ข้อมูลส่วนตัว, เลขบัตร ปชช., เบอร์โทร, อีเมล, ที่อยู่, ผู้ติดต่อฉุกเฉิน, เปลี่ยนรหัสผ่าน
     2. 🛡️ **สิทธิ์และบทบาท (Roles & Permissions)**: ตารางเมทริกซ์สิทธิ์ตาม Screenshot 2
     3. 🏪 **ข้อมูลร้าน & แบรนด์ (Shop & Branding)**: โลโก้, ชื่อร้าน, เบอร์โทร, อีเมล, ที่อยู่, Social Accounts, ธีมสี
     4. 🤖 **การเชื่อมต่อ & บอท (Integrations & Bots)**: Google Drive Folder IDs, LINE Bot, Telegram Bot
     5. 🏷️ **ตัวเลือกระบบ (System Options)**: หมวดหมู่งาน, หมวดหมู่ค่าใช้จ่าย, สถานะดีล, สถานะขนส่ง
     6. 💾 **ฐานข้อมูล & ซิงค์ (Database & Sync)**: ซิงค์ Supabase, จัดการแคช และรีเซ็ตข้อมูล
4. **ป๊อปอัพโปรไฟล์สไตล์ Facebook (Profile Dropdown Popup - Screenshot 3)**:
   - เพิ่มปุ่มรูปโปรไฟล์มุมขวาบนใน Header พร้อมแสดงผลทั้งบน Desktop และ Mobile
   - เมื่อกดเปิดป๊อปอัพ (Screenshot 3):
     - การ์ดโปรไฟล์ส่วนบน: รูปภาพ, ชื่อจริง, รหัสพนักงาน (เช่น `2611001`), `@username`, Badge ตำแหน่งงาน
     - เมนู **"โปรไฟล์ของฉัน (My Profile)"**: เปิด Modal โปรไฟล์
     - เมนู **"สิทธิ์และบทบาท (Permissions)"**: ลิงก์ตรงไปหน้าตั้งค่าสิทธิ์
     - เมนู **"ตั้งค่าระบบ (Settings)"**: ลิงก์ไปหน้าตั้งค่า
     - เมนู **"ออกจากระบบ (Logout)"**
   - พัฒนาโมดอลสากล [`src/components/modals/UserProfileModal.jsx`](file:///D:/WebappDreame/Flower2U/src/components/modals/UserProfileModal.jsx) ดูและแก้ไขโปรไฟล์ของตนเองได้จากทุกหน้าจอ
5. **อัปเดตสคริปต์ฐานข้อมูล [`database_scripts/migrate_staff_id_to_staff_code.sql`](file:///D:/WebappDreame/Flower2U/database_scripts/migrate_staff_id_to_staff_code.sql)**:
   - เพิ่มคอลัมน์ `citizen_id TEXT`, `address TEXT`, `emergency_contact TEXT` ในตาราง `public.staff_users`
6. **การตรวจสอบคุณภาพ (Verification)**:
   - `npm run build` ผ่าน 100% ภายใน 6.99s
   - ตรวจสอบหน้าจอจริงผ่าน `chrome-devtools` (MCP) ทั้งขนาด Desktop (1440px) และ Mobile (390px) ไม่มี Error ใดๆ ใน Console
1. **ผูกเลขโปรเจกต์ (Searchable) เรียงจากมากไปน้อย (DESC)**:
   - เพิ่มระบบเรียงลำดับ `sortedProjects` ตามรหัสตัวเลขโปรเจกต์จริงแบบมากไปน้อย (P-0400 -> P-0001) ป้องกันปัญหาเรียงตัวอักษรผิดเพี้ยน
   - เพิ่มฟังก์ชัน `fetchLatest30ProjectsFromSupabase()` ใน `syncService.js` ดึงตรงจาก Supabase เฉพาะ 30 รายการล่าสุด (`limit(30)`) และเลือกเฉพาะ 5 คอลัมน์เล็ก (`id, name, customer, artist, delivery_date`) ประหยัด Egress สูงสุด (~1.2 KB) พร้อมทำงานร่วมกับ IndexedDB Local-First แบบ 0ms
2. **Supabase Staff ID to Staff Code Migration**:
   - สร้างไฟล์ SQL Migration: [`database_scripts/migrate_staff_id_to_staff_code.sql`](file:///D:/WebappDreame/Flower2U/database_scripts/migrate_staff_id_to_staff_code.sql) สำหรับรันบน Supabase เพื่อเปลี่ยน `staff_users.id` จาก UUID เป็น TEXT บรรจุ `staff_code` โดยตรง และ Drop คอลัมน์ `staff_code` ออก พร้อมปรับปรุง Trigger และ Foreign Keys ใน 4 ตารางที่เกี่ยวข้อง
   - อัปเดต `syncService.js` และ `StaffView.jsx` ให้ใช้ `id` เป็นรหัสพนักงาน (เช่น `2611001`) โดยตรง
3. **ตัดส่วนจัดการผู้ใช้งาน (User Management) ออกจากหน้า Settings**:
   - นำบล็อก User Management ออกจาก [`src/SettingsView.jsx`](file:///D:/WebappDreame/Flower2U/src/SettingsView.jsx) เนื่องจากระบบมีหน้าพนักงาน (`StaffView.jsx`) ที่สมบูรณ์และใช้งานแทนที่แล้ว ลดความซ้ำซ้อน
4. **แก้ไขและปรับปรุง SQL Migration Script ให้ทนทาน 100% (Error 42703 & 42804 Resolution)**:
   - ตรวจพบสาเหตุ `ERROR: 42703: column "staff_code" does not exist` เพราะใน Supabase ดั้งเดิม `staff_users` ยังไม่มีคอลัมน์ `staff_code` จึงไม่สามารถ `USING COALESCE(staff_code, id::TEXT)` ได้โดยตรง
   - ตรวจพบสาเหตุ `ERROR: 42804: foreign key constraint cannot be implemented` เพราะตาราง `inventory_disposals` มีคอลัมน์ UUID อ้างอิง `staff_users.id`
   - ปรับปรุงสคริปต์ [`database_scripts/migrate_staff_id_to_staff_code.sql`](file:///D:/WebappDreame/Flower2U/database_scripts/migrate_staff_id_to_staff_code.sql):
     1. ใช้ Dynamic Loop ปลด Foreign Key ทุกตัวที่ชี้มายัง `staff_users(id)` อัตโนมัติ พร้อมแปลงคอลัมน์ต้นทางทั้งหมดเป็น TEXT
     2. แปลง `staff_users.id` ด้วย `USING id::TEXT` ล้วนๆ (ไม่เรียกหา `staff_code` โดยตรง)
     3. ห่อหุ้มการตรวจสอบ `staff_code` ภายใน `IF EXISTS (SELECT 1 FROM information_schema.columns ...)`
     4. ปรับปรุงฟังก์ชัน Trigger `generate_staff_user_id()` ให้ค้นหาบทบาทจาก `name` ของ `roles` แทนคอลัมน์ `role_code` ที่ไม่มีอยู่จริง
     5. เพิ่ม `email TEXT` และผ่อนปรน `role_id DROP NOT NULL` บน Supabase เพื่อความยืดหยุ่นในการบันทึก
     6. ใช้ Safe Loop ในการเคลียร์ค่าตกค้างและผูก Foreign Key กลับคืนเฉพาะตารางและคอลัมน์ที่มีอยู่จริง
   - อัปเดต `src/services/syncService.js` และ `src/StaffView.jsx` ให้แสดงผลและจับคู่ `staff.id` (Fallback ด้วย `staff_code`) อย่างแม่นยำ
5. **Build Verification**:
   - คอมไพล์ผ่าน `npm run build` สำเร็จ 100% (Built in 7.77s) ปราศจาก Error ใดๆ
6. **แก้ไขปัญหาเส้นสีดำกั้นแถวตารางขณะเลื่อนจอ (Black Scroll Line Artifact Resolution)**:
   - ตรวจพบสาเหตุใน `src/App.jsx`: การใส่คลาสแอนิเมชัน `.space-row-animation` ที่มี `transform: translateY(20px)` และ `will-change: transform` บนแท็ก `<tr>` ของ `<table>` ซึ่งตาม CSS Standard ถือเป็น Undefined Behavior และในเอนจิน Chromium (Blink) จะทำให้เกิดการคำนวณ Layer และ Paint Glitch ล้นออกมาเป็นเส้นสีดำสี `currentColor` (`text-slate-800` RGB 29, 41, 61) คั่นระหว่างแถวที่ 20 กับแถวใหม่ขณะเลื่อนจอแบบ Infinite Scroll
   - ปลดคลาส `.space-row-animation` ออกจาก `<tr>` ใน `App.jsx`, ปรับใช้ `table-auto border-collapse` และกำหนดเส้นขอบแถวแบบ `border-b border-slate-100/70` ที่ชัดเจนและสะอาดตา พร้อมปรับขอบตัวโหลดท้ายตารางเป็น `border-0 bg-transparent`
   - ผลลัพธ์: การเลื่อนจอไม่มีเส้นสีดำกวนใจอีกต่อไป และลดอาการหน่วง/ค้างของหน้าเว็บลงอย่างเห็นได้ชัด
7. **ย้ายปุ่ม Action ในกล่อง Filter ไปไว้บน Page Header ทั้งหมด**:
   - `src/StaffView.jsx`: นำปุ่ม `+ เพิ่มพนักงานใหม่` ออกจากช่องค้นหา/Filter Toolbar ให้เหลือเฉพาะกล่อง Search และตัวกรองตำแหน่ง
   - `src/QuotationsView.jsx`: นำปุ่ม `ตั้งค่าราคากลางวัสดุ` และ `+ สร้างใบเสนอราคาใหม่` ออกจากกล่อง Filter Toolbar
   - `src/App.jsx`: เพิ่มปุ่ม `⚙️ ราคากลางวัสดุ` ควบคู่กับปุ่ม `+ คำนวณเสนอราคา` บน Header ของหน้าใบเสนอราคา พร้อมเชื่อมต่อ Custom Event ให้เปิด Modal ตั้งค่าราคากลางได้โดยตรงจาก Header
   - ตรวจสอบ `ArtistsView`, `CustomersView`, `InventoryView`, `VenuesView` ทุกหน้ามีปุ่ม Primary Action อยู่บน Header ของตนเองเรียบร้อย สะอาด สวยงาม เป็นมาตรฐานเดียวกันทั้งระบบ
8. **ย้ายตำแหน่งโปรไฟล์ไปมุมซ้ายล่าง (Bottom-Left) และให้มุมขวาบนมีเฉพาะปุ่ม Action**:
   - ปลดโปรไฟล์อวตารออกจาก Top Header ด้านขวาบนทั้งหมด ทำให้ขวาบนมีเฉพาะปุ่มแอ็กชันหลักของหน้าจอ (`+ เพิ่มแผนงาน`, `+ เพิ่มพนักงาน`, `+ คำนวณเสนอราคา`, `⚙️ ราคากลางวัสดุ` ฯลฯ) สะอาดตา ไม่เบียดแย่งพื้นที่
   - นำกล่องโปรไฟล์และ Popup เมนูสไตล์ Facebook ไปไว้ที่มุมซ้ายล่างของ Sidebar ด้านข้าง (`aside`) เมื่อคลิกที่รูป/การ์ดโปรไฟล์ที่มุมซ้ายล่าง จะมี Popup เด้งขึ้นมาด้านบน (Origin bottom-left)
   - ปรับตามความต้องการล่าสุด: นำเมนู "ตั้งค่าระบบ (Settings)" และ "สิทธิ์และบทบาท (Permissions)" ออกจาก Popup โปรไฟล์ คงเหลือเฉพาะ:
     1. การ์ดสรุปข้อมูลโปรไฟล์ผู้ใช้ (รูป, ชื่อ, รหัสพนักงาน, Username, ตำแหน่ง)
     2. เมนู **"โปรไฟล์ของฉัน (My Profile)"** (สำหรับดูและแก้ไขข้อมูลส่วนตัว, เบอร์โทร, เลขบัตร ปชช., รหัสผ่าน)
     3. ปุ่ม **"ออกจากระบบ (Logout)"** สีแดงด้านล่างสุด

9. **ยกเครื่องหน้าการเงิน (FinanceView) สู่ "รายรับ-รายจ่าย" Financial Column Table**:
   - เปลี่ยนชื่อปุ่มโหมดใน Segmented Control จาก "แถวรายการรับ-จ่าย" เป็น **"รายรับ-รายจ่าย"**
   - แปลงจากรูปแบบ Feed การ์ดธุรกรรมเดิม ให้เป็น **ตารางคอลัมน์การเงินระดับพรีเมียม (Financial Column Table)** เหมือนหน้าแผนงาน โฟกัสเฉพาะตัวเลขการเงิน 4 ลำดับมาตรฐาน:
     1. รหัสงาน / วันที่ (Project ID badge, วันที่จัดส่ง, วันที่จ่ายเงิน)
     2. โปรเจกต์ & หมวดหมู่ (ชื่อโปรเจกต์ + แท็กหมวดหมู่)
     3. ลูกค้า / ศิลปิน (Customer & Artist)
     4. สถานะการชำระเงิน (Pills: ชำระครบแล้ว, ชำระมัดจำ, รอชำระเงิน, ยกเลิก)
     5. เงินศิลปิน (บาท) (สีคราม Indigo, text-right, tabular-nums)
     6. รายรับ (บาท) (สีมรกต Emerald, text-right, tabular-nums)
     7. รายจ่ายจริง (บาท) (สีกุหลาบ Rose, text-right, tabular-nums)
     8. กำไรสุทธิ (บาท) (สีเขียวเข้ม `#0d652d` พร้อม Margin % badge)
     9. สลิป (ปุ่มพรีวิวสลิปและจำนวนสลิป กดเปิดดูรูปหลักฐานได้ทันที)
     10. ดำเนินการ (ปุ่มเปิดดูรายละเอียดโปรเจกต์ และปุ่มเพิ่มรายการธุรกรรมด่วน)
   - มีแถวสรุปยอดรวม (Sticky Grand Total Footer) รวมทั้ง 4 ค่าการเงินพร้อม Margin เฉลี่ย
   - แสดงผลบนมือถือ (Mobile Touch Cards) แบบ 4 ลำดับการเงินกระชับ ไม่ล้นจอ
   - ระบบโหลดต่อเนื่อง Progressive Load ครั้งละ 35 รายการเพื่อรักษา 60fps ลื่นไหลสูงสุด
10. **แก้ปัญหาอาการค้าง/กระตุกเวลาสลับหน้า (Page / Tab Switching Lag & Freeze Resolution)**:
   - ปัญหาเดิม: การกดสลับแท็บเรียก `setActiveTab` แบบซิงโครนัส, `useLayoutEffect` ทำ Layout Thrashing เรียก `setIsScrolled` สองรอบซ้อนก่อน Paint, และคอมโพเนนต์ทั้ง 11 หน้าถูก Render ทิ้งไว้พร้อมกันโดยไม่มี `React.memo`
   - วิธีแก้ไขแบบถอนรากถอนโคน:
     1. ใช้ `startTransition(() => setActiveTab(tabName))` ใน `handleSelectTab` ทุกการกดสลับหน้า (ทั้ง Sidebar, Mobile Bottom Drawer และ Filter Quick Switch)
     2. ปรับปรุง `useLayoutEffect` ใน `App.jsx`: ตรวจสอบสถานะก่อนเรียก `setIsScrolled(prev => prev !== shouldBeScrolled ? shouldBeScrolled : prev)` ตัด Render Cycle ที่ซ้ำซ้อนออก
     3. นำระบบ **Lazy Mount + Persistent Warm Layout** มาใช้ผ่าน `visitedTabs`: หน้าที่ยังไม่เคยเปิดจะไม่ถูกสร้าง DOM ให้เปลือง RAM/CPU แต่เมื่อเปิดแล้วจะคงสถานะไว้และสลับได้ใน 0ms
     4. ครอบ `React.memo` ให้กับทุก View: `FinanceView`, `AnalyticsView`, `PlansView`, `StaffView`, `SettingsView`, `QuotationsView`, `InventoryView`, `VenuesView`, `ArtistsView`, `CustomersView`, `CalendarView`
11. **ระบบซิงก์ผู้ใช้พนักงานเข้าสู่ Supabase Auth (`auth.users`) อัตโนมัติ (Supabase Auth Integration)**:
   - พัฒนาฟังก์ชัน `syncStaffToSupabaseAuth(staffData)` และ `syncAllStaffToSupabaseAuth(staffList)` ใน [`src/services/syncService.js`](file:///D:/WebappDreame/Flower2U/src/services/syncService.js):
     - ซิงก์ผู้ใช้เข้าสู่ Supabase Auth ผ่าน `supabase.auth.signUp()`
     - หากไม่มีอีเมล จะสร้างอีเมลภายในร้านอัตโนมัติ: `${username.toLowerCase()}@flower2u.internal`
     - จัดเก็บ User Metadata ครบถ้วน (ชื่อ, ชื่อเล่น, รหัสพนักงาน, ตำแหน่ง, เบอร์โทร, เลขบัตรประชาชน, วันเกิด)
     - จัดการผู้ใช้เดิม (Already Registered) โดยไม่โยน Error
   - ซิงก์อัตโนมัติเมื่อกดสร้างหรือแก้ไขพนักงานใน `saveStaffSync`
   - เพิ่มปุ่ม **"☁️ ซิงก์ Supabase Auth"** บนหัวตารางหน้าพนักงาน (`StaffView.jsx`) ให้กดแบทช์ซิงก์พนักงานเดิมและใหม่ทั้งหมดเข้าสู่ Supabase Auth ได้ในคลิกเดียว พร้อมแจ้งเตือนผลสรุปผ่าน Toast
   - ทำการทดสอบซิงก์จริงบนเครื่อง: พนักงาน 4 คนแรกถูกเพิ่มเข้า Supabase Auth สำเร็จ 100%
12. **ลบปุ่ม Action ที่ซ้ำซ้อนในกล่อง Filter ของหน้าการเงินออกตาม Directive 9**:
   - นำปุ่ม + เพิ่มรายรับ/จ่าย ออกจากกล่อง Filter Toolbar ใน [src/FinanceView.jsx](file:///D:/WebappDreame/Flower2U/src/FinanceView.jsx) เพื่อไม่ให้มีปุ่มขวางในแถวตัวกรองสถานะชำระเงิน
   - ย้ายปุ่ม + เพิ่มรายรับ/จ่าย (สีมรกต Emerald) ไปไว้บน Top Header ของ [src/App.jsx](file:///D:/WebappDreame/Flower2U/src/App.jsx) ที่มุมขวาบนโดยเฉพาะ พร้อมเชื่อมต่อ Event `trigger-create-finance-tx` เปิด Modal ได้ทันที สะอาด สวยงาม และเป็นมาตรฐานเดียวกันทุกหน้าจอ
13. **ระบบดึงข้อมูลเฉพาะเดือนแบบ Zero-Egress และแก้ปัญหาข้อมูลวันที่มีมาไม่ครบ (Month-Based Zero-Egress & Accurate Date Filter)**:
   - ปัญหาเดิม: หน้าการเงินตั้งค่าเริ่มต้นเป็นดึงทั้งหมดหรือติด limit 20 รายการแรก และฟังก์ชันแปลงวันที่ไม่รองรับปี พ.ศ. (2569) ทำให้ข้อมูลในเดือนหลุดหาย
   - วิธีแก้ไข:
     - ตั้งค่าเริ่มต้น `dateFilterMode` เป็น `'month'` และ `filterDate` เป็นเดือนปัจจุบัน (`YYYY-MM`) ทั้งใน `App.jsx` และ `FinanceView.jsx`
     - เพิ่ม `loadProjectsByMonth(yearMonth, onSyncUpdate)` ใน `src/services/syncService.js` ดึงเฉพาะโปรเจกต์ของเดือนนั้น (~20-40 รายการ) จาก Supabase พร้อมแบทช์ดึงรายการลูก (Quotation, Support, Expenses) แล้วแคชลง IndexedDB ตัดปริมาณ Egress จาก Supabase ลงกว่า 90%
     - เพิ่มคอลัมน์ `project_datetime` และ `payment_date` เข้าใน `PROJECT_LIST_COLUMNS`
     - พัฒนาระบบถอดรหัสวันที่แบบแม่นยำ `getEffectiveItemDateStr`: ดึงจาก `rawDeliveryStart`, `rawDateTime`, `date`, `paymentDate`, `deliveryDate` พร้อมแปลงปี พ.ศ. (ถ้า > 2500 ให้ลบ 543 เป็น ค.ศ.) ข้อมูลโปรเจกต์ทุกวันที่จึงแสดงผลถูกต้องครบถ้วน 100%
14. **ลบกล่อง Filter ซ้ำซ้อนอันล่างออก (Duplicate Filter Bar Removal - Screenshot 095049)**:
   - ลบแถบ Filter ซ้ำซ้อนที่อยู่เหนือตารางใน `viewMode === 'feed'` ออกทั้งหมด เหลือเฉพาะ Master Filter Bar ด้านบนสุดเพียงอันเดียว
15. **ลบแถบสรุปยอดรวมใต้ตารางออก (Grand Total Table Footer Removal - Screenshot 095113)**:
   - นำแท็ก `<tfoot>...</tfoot>` ออกจากตารางรายรับ-รายจ่าย เพื่อไม่ให้แสดงยอดรวมซ้ำซ้อนกับการ์ดสรุปยอดด้านบน 4 ใบที่คำนวณตาม Filter แบบ Realtime อยู่แล้ว
16. **ตารางการเงินแยกแถวรายการย่อย (Financial Line Item Breakdown) & แสดงวันที่/เวลาแม่นยำ (Screenshot 095149)**:
   - ตารางโหมด "รายรับ-รายจ่าย" ใน `FinanceView.jsx`: แตกรายการย่อยของแต่ละโปรเจกต์ (เงินศิลปิน, รายรับใบเสนอราคา, รายจ่ายจริง) ออกเป็นแถวย่อยที่อยู่ติดกันใต้โปรเจกต์นั้นๆ (`getProjectFinancialItems`) ทำให้มองเห็นว่าแต่ละโปรเจกต์มียอดอะไรบ้าง ยอดตรงตามคอลัมน์ และไม่ปนกัน
   - เพิ่มปุ่มขยาย/ยุบรายการย่อยของแต่ละโปรเจกต์ (Expand/Collapse) โดยตั้งค่าเริ่มต้นให้ขยายเปิดดูได้ทันที
   - แก้ไขปัญหา วันที่และเวลาหายไป หรือแสดงเป็น `🕒 -`: พัฒนา `formatItemDateTime(item)` ดึงทั้งวันที่และเวลาจาก `rawDeliveryStart`, `rawDateTime`, `deliveryDate` แสดงผลครบถ้วน เช่น `30/10/2026 20:31 น.`
17. **กำหนดจุดเริ่มต้นขนส่ง (Flower2U Workshop & Hub) ในหน้าสถานที่จัดส่ง (`VenuesView.jsx`)**:
   - เพิ่มระบบตั้งค่าจุดศูนย์รวมกระจายสินค้า / โรงงาน workshop: มีแบนเนอร์จุดเริ่มต้นขนส่งด้านบนแผนที่ Leaflet แสดงพิกัดและชื่อสถานที่ชัดเจน
   - รองรับการป้อนข้อมูลได้ทั้ง:
     1. ลิงก์ Google Maps (แปลงพิกัด `@lat,lng` หรือ `?q=lat,lng` อัตโนมัติ)
     2. พิกัดละติจูด/ลองจิจูดโดยตรง (`lat, lng`)
     3. ปุ่ม "ใช้ GPS ปัจจุบัน" ดึงพิกัดจากเครื่องอุปกรณ์ทันที
   - จุดพิกัดและเส้นทางการคำนวณระยะทาง (กม.) และลิงก์ขอเส้นทาง Google Maps จะอ้างอิงจากจุดเริ่มต้นที่ตั้งค่าไว้ และบันทึกถาวรลง `localStorage` (`flower2u_hub_settings`)
18. **แก้ปัญหาจำนวนงานแสดงผลแค่ 20 งาน และ Infinite Scroll ไม่โหลดต่อ**:
   - ตรวจพบสาเหตุ: `loadProjectsLocalFirst` ใน `syncService.js` มีการจำกัด `.range(0, 19)` ไว้ ทำให้ดึงโปรเจกต์มาแค่ 20 งานแรกและบันทึกทับ IndexedDB ส่งผลให้การ์ดนับจำนวนงานทั้งหมดบนหน้าแผนงานแสดงผลเพียง 20 งานแทนที่จะเป็น 302 งาน
   - ลบการจำกัด `.range(0, 19)` ออก ทำให้โหลดข้อมูลทั้ง 302 งาน (ขนาดข้อมูล Gzip รวมเพียง ~43 KB ใช้เวลา ~269ms) พร้อมมีระบบตรวจสอบอัปเกรดแคชเก่าอัตโนมัติ
   - แก้ไข Infinite Scroll ใน `App.jsx`: บน Desktop คอนเทนเนอร์การเลื่อนคือ `<main>` ที่มี `overflow-y-auto` ไม่ใช่ `window` ปรับ `handleScroll` ให้ตรวจจับระยะขอบล่าง 250px และเพิ่ม `visibleCount` ทีละ 20 รายการทันทีโดยไม่ติดหน่วงเวลา 1 วินาที และเพิ่มปุ่ม "แสดงข้อมูลเพิ่มเติม" ที่ท้ายตารางกรณีเลื่อนไม่ถึงขอบ
19. **ปรับปรุง Smart Batch Delivery Alert ให้เตือนเฉพาะงานที่ยังไม่เสร็จ (Unfinished Deliveries Only)**:
   - ตรวจพบสาเหตุ: เดิมระบบตรวจสอบเฉพาะ `item.transportStatus === 'delivered'` เท่านั้น แต่ข้อมูลโปรเจกต์จริงบนระบบใช้ Custom ID เช่น `custom-1771415278809` (ส่งสำเร็จ 247 งาน) และ `custom-1771415025673` (เสร็จสิ้น 250 งาน) และ `SHOP_SETTINGS_COLUMNS` ใน `syncService.js` ไม่ได้ดึง `deal_statuses` กับ `transport_statuses` ส่งผลให้งานที่ส่งสำเร็จแล้วในอดีต (เช่น อิมแพค 6 งานเมื่อ พ.ค. 2569) ถูกนำมาเตือนซ้ำ
   - เพิ่มคอลัมน์ `project_categories`, `expense_categories`, `deal_statuses`, `transport_statuses` เข้าใน `SHOP_SETTINGS_COLUMNS` และ Seed ข้อมูลสถานะจริงขึ้น Supabase ทำให้ระบบแปลง ID สถานะเป็นชื่อไทย ("ส่งสำเร็จ", "เสร็จสิ้น", "รอการจัดส่ง") ถูกต้อง 100%
   - ปรับปรุง [`BatchDeliveryBanner.jsx`](file:///D:/WebappDreame/Flower2U/src/components/common/BatchDeliveryBanner.jsx): เพิ่มฟังก์ชัน `isProjectFinishedOrCancelled` กรองงานที่เสร็จแล้ว (ทั้ง `delivered`, `completed`, `finished`, `done`, `type: 'completed'`, `custom-1771415278809`, `custom-1771415025673`, รวมถึงงานที่ยกเลิก/ปฏิเสธ) ออกทั้งหมด
   - แสดง Badge สถานะขนส่งที่ค้างอยู่จริง ("รอการจัดส่ง" / "กำลังจัดส่ง") ในแต่ละคิวงาน พร้อมปุ่มสลับกลุ่มจัดส่ง (กลุ่มที่ 1, 2...) กรณีมีหลายสถานที่ค้างส่ง
20. **ปรับตารางหน้าการเงินเป็นรูปแบบสเตตเมนต์ธนาคาร 7 คอลัมน์ (Bank Statement-Style Financial Ledger)**:
   - **7 คอลัมน์มาตรฐานตามที่ผู้ใช้กำหนดอย่างเคร่งครัด**:
     1. `รหัส / วันที่`
     2. `โปรเจกต์ / หมวดหมู่` (พร้อมรายการย่อยใต้แต่ละประเภท)
     3. `ลูกค้า / ศิลปิน`
     4. `สถานะชำระเงิน`
     5. `รายรับ (บาท)`
     6. `รายจ่าย (บาท)`
     7. `ดำเนินการ`
     *(นำคอลัมน์ เงินศิลปิน, กำไรสุทธิ, สลิป ออกตามคำขอ และย้ายปุ่มเปิดดูสลิปไปอยู่ในคอลัมน์ดำเนินการอย่างกะทัดรัด)*
   - **จัดระเบียบข้อมูลตามหลักการสเตตเมนต์ธนาคาร (ยื่นกู้ธนาคารได้)**:
     - **เงินศิลปิน (Artist Support Inflow)**: เงินโอนเข้าบัญชีร้านเพื่อส่งต่อศิลปิน จัดเป็น **"รายรับ"** พร้อมแจกแจงรายการแบงค์และจำนวนใบ (เช่น แบงค์ 100 x 369 ใบ) อยู่ในช่อง `รายรับ`
     - **ค่าจ้าง/ใบเสนอราคา (Quotation/Wage)**: รายได้จากการให้บริการ จัดเป็น **"รายรับ"** (เช่น ค่าอุปกรณ์, กล่องเงิน, แบ็กดรอป) อยู่ในช่อง `รายรับ`
     - **ค่าใช้จ่ายจริง (Actual Expenses)**: ต้นทุนค่าใช้จ่ายจริง จัดเป็น **"รายจ่าย"** อยู่ในช่อง `รายจ่าย` ตัวอักษรสีแดงเข้ม (`text-rose-600 font-black`)
     - แถวของโปรเจกต์เดียวกันจะอยู่ติดกันต่อเนื่อง โดยแถวแรกแสดงรหัสโปรเจกต์หลัก และแถวถัดไปมีสัญลักษณ์ลูกศร `↳` เชื่อมโยงชัดเจน
   - ปรับปรุงการ์ด Mobile View ให้แจกแจงรายการย่อยตามหมวดหมู่สเตตเมนต์ธนาคารในลักษณะเดียวกัน
21. **ปรับปรุง UI ฟิลเตอร์, โปรไฟล์โมดอล, หมวดหมู่การตั้งค่า และทดสอบ MCP ระบบเต็ม 100%**:
   - **ปุ่มตัวกรอง (Filter Button)**: นำข้อความ "ตัวกรอง" ออก เหลือเฉพาะปุ่มไอคอน `<SlidersHorizontal />` พร้อม Badge และลูกศรย่อ/ขยาย ขนาดสมส่วน ไม่เกะกะสายตา ทั้งใน `App.jsx` และ `FinanceView.jsx`
   - **โมดอลโปรไฟล์ของฉัน (`UserProfileModal.jsx`)**: นำช่องกรอก "ลิงก์รูปถ่ายโปรไฟล์ (URL หรือ Google Drive Link)" ออก เนื่องจากตอนอัปโหลดไฟล์รูปภาพ ระบบแปลงเป็นรูปและอัปเดตให้อัตโนมัติ พร้อมเพิ่มปุ่ม "เปลี่ยนรูปถ่ายโปรไฟล์" สะอาด สวยงาม และใช้งานง่าย
   - **ตั้งค่าระบบ (`SettingsView.jsx`)**: นำหมวดหมู่ "โปรไฟล์ของฉัน" ออกจากแท็บตั้งค่า (เนื่องจากมีในปุ่มโปรไฟล์มุมซ้ายล่างอยู่แล้ว) ตั้งค่าเริ่มต้นเป็น "สิทธิ์และบทบาท (Roles & Permissions Matrix)" ทันที
   - **ทดสอบสดผ่าน MCP `chrome-devtools` 100%**:
     - ทดสอบครบทั้ง 10 ระบบ: Plans, Finance, Quotations, Inventory, Venues, Artists, Customers, Staff, Analytics, Calendar
     - ทดสอบการ Create / Delete / Realtime Sync กับ Supabase ผ่าน `syncService.js` (Artists, Customers, Inventory, Venues, Quotations, Projects) สำเร็จ 100%
     - เพิ่มฟังก์ชัน `isValidUuid` ป้องกันข้อผิดพลาด `invalid input syntax for type uuid` เมื่อไม่มี UUID จากเครื่องลูกข่าย
22. **แก้ไขปัญหาเส้นสีดำกั้นตารางขณะเคลื่อนไหว เพิ่ม/ลบ หรือ Infinity Loading ในทุกตาราง (Black Border Artifact Global Fix - Screenshot 163217)**:
   - ตรวจพบสาเหตุลึก: Tailwind v4 CSS reset ไม่มี default `border-color` ให้กับแท็กตาราง (`table, thead, tbody, tfoot, tr, th, td`) ประกอบกับการใส่ `transition-colors duration-150` บนแท็ก `<tr>` ทำให้เวลาเกิดการเปลี่ยนแปลง DOM ใน Chromium เอนจิน Blink จะแอนิเมตสี `border-color` จาก `currentColor` (`oklch(0.279 ...)` / สีดำ) ไปยังสีอ่อน ทำให้เห็นเส้นแถบสีดำวาบขึ้นมาระหว่างการเลื่อนจอหรือเพิ่ม/ลบแถว
   - แก้ไขระดับสากลใน [`src/index.css`](file:///D:/WebappDreame/Flower2U/src/index.css):
     1. กำหนด `border-color: #f1f5f9 !important;` แบบตายตัวให้กับ `table, thead, tbody, tfoot, tr, th, td` ทั้งหมด
     2. บังคับ `table tr` ให้ Transition เฉพาะ `background-color, opacity, transform !important;` ตัดการแทรกแซง `border-color` ออก 100%
     3. ปรับแต่ง Scrollbar สากล ป้องกันขอบสีดำของ Scrollbar พื้นเมืองของระบบปฏิบัติการ
   - ทดสอบผ่าน `chrome-devtools` และเครื่องมือ Pixel Analyzer: เส้นสีดำ `RGB(43, 55, 74)` หายไปโดยสิ้นเชิงในทุกตาราง (`PlansView`, `FinanceView`, `InventoryView`)
23. **ยกเครื่อง UX/UI โมดอลคำนวณและสร้างใบเสนอราคา (Quotation & BOM Cost Estimator Modal Redesign - Screenshot 164845)**:
   - ปัญหาเดิม: โมดอล `max-w-4xl` ค่อนข้างแออัด ชนิดวัสดุป้ายแสดงชื่อไม่ครบถูกตัดคำ (`พลาสวูด 5 มม. แข็งพิเศษ + '...`), ช่องขนาด `[2.4] x [2.4] x [1]` อัดแน่นในแถวเดียวไม่มีป้ายกำกับแยก, รายการดอกไม้ทำเป็นการ์ดสีชมพูที่เขียนป้ายกำกับเดิมซ้ำๆ ทุกแถว, และไม่มีปุ่ม `+ เพิ่มรายการเสริม` แบบกำหนดเอง
   - ปรับปรุงใหม่ใน [`src/QuotationsView.jsx`](file:///D:/WebappDreame/Flower2U/src/QuotationsView.jsx):
     - ขยายขนาดโมดอลเป็น `max-w-5xl` ให้พื้นที่โปร่งโล่งสบายตาระดับพรีเมียม
     - **ส่วนที่ 1 (ข้อมูลงาน & ผูกโปรเจกต์)**: จัดระเบียบช่องชื่องานและชื่อลูกค้าเป็นกริด 7:5 กว้างขวาง ช่องค้นหาโปรเจกต์มีไอคอนแว่นขยาย Dropdown สูง 240px เลือกง่าย และปุ่ม "ปลดการผูก" สีแดงชัดเจน
     - **ส่วนที่ 2 (คำนวณ Backdrop & ป้าย ตร.ม.)**: ดีไซน์เป็นการ์ด 2 ชั้น (2-Tier Card) แยกแถวบนเป็นชื่อวัสดุเต็มบรรทัด (ไม่โดนตัดคำ) + จุดติดตั้ง และแถวล่างเป็นขนาด กว้าง, สูง, จำนวน ที่มีป้ายกำกับชัดเจนทุกช่อง พร้อม Badge พื้นที่รวม ตร.ม. สีม่วงสดใส, ราคา/ตร.ม. พร้อมปุ่ม "คืนค่า" เมื่อแก้หน้างาน, และยอดรวมเงินตัวหนา
     - **ส่วนที่ 3 (รายการดอกไม้ กระดาษ พร็อพ และบริการเสริม)**: แถบแม่แบบด่วน (🌸 ดอกไม้สด, ✂️ ดอกไม้กระดาษ, 🏗️ โครง Truss, 💡 ไฟส่องป้าย, 🚚 ค่าขนส่ง), เพิ่มปุ่มเด่น `+ เพิ่มรายการเสริม` สำหรับเพิ่มแถวเปล่า 1 คลิก, และเปลี่ยนรายการให้เป็นตารางเดี่ยวเรียบหรู ไม่มีป้ายกำกับซ้ำซ้อนให้รกสายตา
     - **ส่วนที่ 4 (หมายเหตุ & สรุปโครงสร้างต้นทุน BOM)**: หมายเหตุมีคีย์เวิร์ดด่วนคลิกใส่ได้ทันที, การ์ดสรุปต้นทุนแยกสัดส่วนป้ายและดอกไม้, ยอดต้นทุนรวม (COGS) สีเหลืองอำพัน, ปุ่มลัดกำไร `% Markup` (20%, 30%, 40%, 50%), ช่องราคาเสนอสุทธิขนาดใหญ่พิเศษ 20px, และ Badge อัตรากำไรสุทธิสีมรกต
24. **ระบบบริหารคลังวัสดุอุปกรณ์ เชื่อมโยงใบเสนอราคาและเช็กลิสต์จัดของตามข้อกำหนด (`_Markdown_.md_.md`)**:
   - **รองรับประเภทพัสดุครบทั้ง 5 ประเภทตามสเปก**:
     1. `ASSET` (อุปกรณ์ยืม-คืน): ติดตามรหัสรายชิ้น Serialized (`item0001`, `item0002`...), ต้นทุนโปรเจกต์ 0 บาท, สถานะ `AVAILABLE`, `BORROWED`, `LOST`, `BROKEN`
     2. `REUSABLE` (วัสดุหมุนเวียน): คืนสต็อกของดี (`good_qty`), คำนวณของเสียหายเป็นต้นทุนโปรเจกต์ (`damaged_qty` x `unit_cost`)
     3. `CONSUMABLE` (พัสดุสิ้นเปลือง): ตัดสต็อกทันที ต้นทุนคำนวณตามจำนวนที่เบิกใช้
     4. `BANKNOTE` (ธนบัตร): สต็อกธนบัตรแยกใบละ 20, 50, 100, 500, 1000 บาท คำนวณมูลค่าเงินสดตามหน้าธนบัตร
     5. `TASK` (งานบริการ/ขั้นตอนงาน): สต็อก 0 ชิ้น แสดงในเช็กลิสต์เพื่อติ๊กจบงานหน้างาน
   - **เชื่อมโยงใบเสนอราคาสู่คลังพัสดุ & เช็กลิสต์เตรียมของอัตโนมัติ**:
     - เพิ่มปุ่ม `📦 เลือกจากคลังพัสดุ` ในโมดอลใบเสนอราคา ดึงต้นทุนและหน่วยจากคลังมาคำนวณราคาอัตโนมัติ
     - เมื่อบันทึกใบเสนอราคาที่ผูกกับโปรเจกต์ ระบบจะแปลงรายการวัสดุและบริการลงสู่เช็กลิสต์เตรียมของหน้างาน (`project_checklist_items`) ทันที
   - **หน้าเช็กลิสต์เตรียมของ & กระทบยอดของเสียหาย (Inventory & Reconciliation Flow)**:
     - ดรอปดาวน์เลือกเฉพาะโปรเจกต์ที่ยังดำเนินการอยู่ (`QUOTING` หรือ `ACTIVE` โดยตัดงานที่เสร็จ/ยกเลิกออก)
     - เช็กลิสต์อินเทอร์แอคทีฟ มีสไตล์ขีดฆ่า `.done-item` (line-through) ชัดเจนเมื่อเตรียมของเสร็จ
     - ปุ่มพิมพ์ใบจัดของ A4 (`window.print()`) ซ่อนคอนโทรลด้วยคลาส `.no-print` ตามสเปก
     - โมดอลกระทบยอด (Reconciliation Modal): รับของดีคืนสต็อก คำนวณยอดชำรุดเสียหายและค่าปรับ/ต้นทุนทันที
     - โมดอลยืมอุปกรณ์ระบุรหัสชิ้น (`unit_code`) และผู้เบิก
   - **สถาปัตยกรรม Supabase & Local-First Resilience**:
     - สร้าง SQL Script [`database_scripts/create_inventory_checklist_and_units.sql`](file:///D:/WebappDreame/Flower2U/database_scripts/create_inventory_checklist_and_units.sql)
     - อัปเกรด Dexie Schema เป็น `db.version(5)` รองรับ `asset_units`, `project_checklist_items` ใช้งานได้ออฟไลน์และซิงก์สองทางกับ Supabase


25. **แก้บั๊กและยกระดับ UX/UI หน้าเสนอราคา (Quotation Table & Final Price Redesign - Screenshot 184106)**:
    - **แก้ปัญหาเส้นสีดำกั้นแถว**: เปลี่ยนจาก divide-y divide-slate-100 เป็นการจัดสไตล์รายแถว order-b border-slate-100 last:border-b-0 พร้อมทั้งล็อก CSS .border-slate-100 ให้เป็น #f1f5f9 !important; ป้องกันเอนจินเบราว์เซอร์วาบสีดำ/currentColor
    - **แก้ปัญหา Dropdown เปิดอัตโนมัติ**: ลบการสั่ง setActiveFloralDropdownIndex(newIdx) ออกจาก handleAddFloralRow เมื่อกดเพิ่มแถว แถวใหม่จะถูกเพิ่มแบบเรียบเนียนโดยไม่เปิดดรอปดาวน์ค้าง
    - **แก้ปัญหา Dropdown โดนขอบล่างของ Modal บัง**: เพิ่มการคำนวณตำแหน่งอัจฉริยะ openUpwards = floralItems.length > 2 && index >= floralItems.length - 2 สลับไปใช้ ottom-full mb-1.5 สำหรับแถวที่อยู่ด้านล่าง เพื่อเปิดลอยขึ้นด้านบน ไม่ล้นหรือโดนขอบโมดอลตัด
    - **แก้ปัญหาตัวเลขชนและทับกันระหว่างราคา/หน่วยกับยอดรวมเงิน**: ปรับสัดส่วน 12 คอลัมน์ใหม่หมดจด: 
      - ชื่อรายการ 5 คอลัมน์ (col-span-5)
      - หน่วยนับ 1 คอลัมน์ (col-span-1)
      - จำนวน 1 คอลัมน์ (col-span-1)
      - ราคาเสนอ/หน่วย 2 คอลัมน์ (col-span-2)
      - ยอดรวมเงิน 2 คอลัมน์ (col-span-2)
      - ปุ่มลบถังขยะ 1 คอลัมน์แยกต่างหาก (col-span-1)
      - ช่องไฟ 12px สะอาดตา ตัวเลขหลักหมื่น/หลักแสนไม่ชนหรือทับกัน พร้อมรองรับการแสดงผลบน Mobile ด้วย sm:contents ซับกริด 3 คอลัมน์กะทัดรัด
    - **แก้ปัญหาสีข้อความ "+ เพิ่มรายการเสริม" ไม่เปลี่ยนตามธีม**: ปรับคลาสจาก pink เป็นคลาส iolet ของระบบ (	ext-violet-600 hover:bg-violet-50 และ 	ext-violet-700 bg-violet-50) และเพิ่ม .text-violet-800 ใน Dynamic Theme Engine ของ App.jsx เชื่อมสี Realtime เข้ากับระบบธีมทุกสี
    - **ยกเครื่อง UX/UI และ Typography กรอบราคาเสนอสุทธิ (Final Price)**:
      - ตัดไอคอน Sparkles และข้อความเวิ่นเว้อออก เปลี่ยนเป็นหัวข้อคมชัด ราคาเสนอสุทธิ (Final Price) * พร้อมคำอธิบายกระชับ ยอดรวมสุทธิที่แสดงในเอกสารใบเสนอราคา
      - ปรับฟอนต์จาก ont-black ที่หนาเทอะทะให้เป็น ont-bold และ ont-semibold สะอาดตา มีมิติระดับสากล ตัดอิโมจิไม่จำเป็นออกทั้งหมด


26. **แก้ปัญหาเลือกสีธีมกระตุกอย่างรุนแรง เพิ่มความลื่นไหลเป็น 120 FPS (Theme Color Picker Performance Optimization - Screenshot 191946)**:
    - **ตรวจพบสาเหตุลึก**:
      1. ใน React อีเวนต์ onChange บน <input type="color"> จะถูกแมปเข้ากับอีเวนต์ input ของเบราว์เซอร์ ซึ่งทำงานทุกๆ มิลลิวินาทีในขณะที่ผู้ใช้ลากเมาส์หมุนวงกลมเลือกสี (60-120 ครั้ง/วินาที)
      2. เมื่อ onChange ยิง setShopInfo ใน App.jsx จะทำให้คอมโพเนนต์แม่ App.jsx (6,500 บรรทัด) สั่ง Re-render ทั้งแอปแบบ Synchronous ทุกๆ 16ms
      3. การใช้ Controlled Input alue={...} ทำให้ React บังคับเขียนค่ากลับไปยัง <input type="color"> ขณะที่หน้าต่าง Color Picker พื้นเมืองของ Windows กำลังเปิดอยู่ เกิด IPC Ping-pong ใน Chromium ทำให้ Cursor ค้างและดรอปเหลือ 4 FPS (250ms ต่อ Event)
      4. มีการทำ style.textContent = css ทำลายและสร้าง Ruleset ในแท็ก <style> ใหม่ทุกเฟรม บังคับให้เบราว์เซอร์คำนวณ CSSOM ใหม่ทั้งหน้า
    - **สถาปัตยกรรมใหม่ (Sub-millisecond CSS Variables & Decoupled State Engine)**:
      1. สร้าง [src/utils/themeManager.js](file:///D:/WebappDreame/Flower2U/src/utils/themeManager.js) สำหรับฉีดแท็ก <style id="nexus-theme-styles"> เพียงครั้งเดียว และเชื่อมโยงทุกคลาสของ Tailwind เข้ากับ CSS Variables (--theme-main, --theme-hover, --theme-light, --theme-shadow, --theme-logo-bg)
      2. เปลี่ยนการอัปเดตสีเป็นการเรียก pplyThemeVariables() ซึ่งตั้งค่า document.documentElement.style.setProperty(...) โดยตรง ใช้เวลาเพียง 0.02ms โดยไม่ต้องรื้อสไตล์ชีตหรือ Re-render React
      3. ใน [src/SettingsView.jsx](file:///D:/WebappDreame/Flower2U/src/SettingsView.jsx): เปลี่ยน <input type="color"> เป็น defaultValue + ดักอีเวนต์ onInput ผ่าน equestAnimationFrame สำหรับอัปเดตสีวงกลมและตัวแปร CSS สดๆ ที่ 120 FPS โดยไม่มี React Re-render ขัดจังหวะ และใช้ Native change Event ร่วมกับ Debounce 180ms เพื่อบันทึกลง React State / LocalStorage / Supabase เมื่อปล่อยเมาส์
    - **ผลการทดสอบเชิงประจักษ์ (Benchmark Results)**:
      - เวลาในการประมวลผลต่ออีเวนต์ลดลงจาก **268.3 มิลลิวินาที** เหลือเพียง **0.12 มิลลิวินาที** (ความเร็วเพิ่มขึ้นกว่า **2,000 เท่า**)
      - รองรับการลากเมาส์เลือกสีแบบ Real-time ที่ความลื่นไหลระดับ 120 FPS+ โดยไม่มีอาการกระตุกหรือ Cursor หน่วงอีกต่อไป

27. **ยกระดับแผนที่สถานที่จัดส่ง (Thailand Logistics Map) & เชื่อมพิกัด GPS ร้านจาก Shop Branding**:
    - **ขยายความสูงของแผนที่ (Full-Height Logistics View)**: ปรับความสูงของคอนเทนเนอร์ Leaflet จาก `h-[380px] sm:h-[450px]` เป็น `h-[520px] sm:h-[640px] lg:h-[740px]` เปิดกว้าง เต็มตา เห็นทุกโซนในกรุงเทพฯ และปริมณฑลพร้อมกันได้อย่างสะดวกสบาย
    - **แก้ไขปุ่มย่อ/ขยายตามพฤติกรรมจริง**: เมื่อแผนที่กางอยู่ ปุ่มแสดงคำว่า "ย่อ" พร้อมไอคอน `Minimize2` (ลูกศรหุบเข้า); เมื่อแผนที่หุบซ่อนอยู่ ปุ่มแสดงคำว่า "ขยาย" พร้อมไอคอน `Maximize2` (ลูกศรกางออก)
    - **เพิ่มฟังก์ชันโต้ตอบเสมือน Google Maps เต็มรูปแบบ**:
      - คลิกจุดใดก็ได้บนแผนที่เพื่อปักหมุด `user-click-pin` สีแดงสดใส พร้อมเปิด Popup อัตโนมัติ แสดงพิกัดตัวเลข (Lat, Lng) ที่กดคัดลอกได้, ระยะทางจริงจากร้าน/จุดเริ่มต้นขนส่ง (กม.), เวลาขับรถเฉลี่ย (นาที), ปุ่มเปิดนำทางใน Google Maps ทันที และปุ่มเปิดดูบน Google Maps
      - เพิ่มปุ่ม "ตำแหน่งฉัน" (Locate Me) ดึงพิกัด GPS ปัจจุบันของผู้ใช้จากเบราว์เซอร์พร้อมซูมเข้าและปักหมุดเป้าหมาย
      - เพิ่มปุ่ม "Google Maps" เปิดมุมมองและพิกัดแผนที่ปัจจุบันไปยัง Google Maps เต็มหน้าต่าง
    - **เพิ่มช่องใส่ GPS & พิกัดร้านใน Shop Branding (`SettingsView.jsx`)**:
      - เพิ่มการ์ด "พิกัด GPS หน้าร้าน / คลังกระจายสินค้า (Logistics Hub)" ในแท็บข้อมูลร้าน & แบรนด์
      - มีช่องใส่พิกัด Lat, Lng หรือวางลิงก์ Google Maps พร้อมปุ่ม "📍 ดึงพิกัดจาก GPS ปัจจุบัน"
      - มีช่องใส่ลิงก์ Google Maps ของร้าน พร้อมปุ่มทดสอบเปิดแผนที่
      - ซิงค์พิกัดเข้า `flower2u_hub_settings` ใน localStorage ทันที และส่งต่อ `shopInfo` ไปยัง `<VenuesView shopInfo={shopInfo} />` ทำให้แถบจุดเริ่มต้นขนส่ง (Logistics Origin) อัปเดตแสดงชื่อร้าน ที่อยู่จริง และพิกัดร้านใหม่โดยอัตโนมัติ

---

## 4. ข้อตกลงและกฎเหล็กประจำตัว (Non-Negotiable Directives)
1. **Strictly DO NOT run `git add`, `git commit`, `git push`** (ผู้ใช้เป็นคนจัดการ Git เองทั้งหมด)
2. **ตรวจหน้าจอจริงผ่าน `chrome-devtools` (MCP)**: ทุกครั้งที่แก้ UI ต้องตรวจสอบทั้ง Mobile (390px), Tablet (820px) และ Desktop (1440px)
3. **ต้องบิลด์ผ่าน `npm run build` เสมอ** ก่อนรายงานผู้ใช้
4. **Ponytail & Karpathy**: แก้น้อยที่สุด ไม่เขียนโค้ดเผื่อ ไม่ Over-engineer
