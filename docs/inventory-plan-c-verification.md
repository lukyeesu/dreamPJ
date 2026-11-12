# รายงานการตรวจสอบระบบคลังสินค้าแผน C และการแก้ไข QR Scanner / Print

> บันทึกนี้เป็นผลระหว่างพัฒนารุ่นก่อนรวมตาราง ดูผลส่งมอบล่าสุดที่ [inventory-compact-verification.md](inventory-compact-verification.md) และติดตั้งเฉพาะ `database_scripts/inventory_compact.sql`

**วันที่ตรวจสอบ**: 10 พฤศจิกายน 2026  
**ผู้ตรวจสอบ**: QA / Verification Agent (ภายใต้การควบคุมของ Codex Supervisor)  
**ขอบเขตความรับผิดชอบ (Owned Files)**:
- `src/utils/qrLabels.js`
- `src/components/inventory/QrScanner.jsx`
- `src/components/inventory/QrLabelPrint.jsx`
- `tests/qrLabels.test.cjs`
- `tests/qrScanner.test.cjs`
- `tests/inventoryComponents.test.cjs`
- `tests/fixtures/inventory-preview.html`
- `tests/fixtures/inventory-preview.jsx`
- `docs/inventory-plan-c-verification.md`

**นโยบายความปลอดภัยและข้อกำหนดการทำงาน**:
- ไม่แก้ไขไฟล์ของทีมคู่ขนาน (`Inventory.jsx`, `App.jsx`, `tests/inventoryUi.test.cjs`, backend SQL/services หรือไฟล์ package)
- ใช้เครื่องมือ Native File Tools เท่านั้น ไม่รันคำสั่ง Terminal/Shell ใดๆ (Supervisor เป็นผู้รัน)
- ไม่เรียกใช้งาน MCP/Browser Tools หลังถูกปฏิเสธสิทธิ์ และไม่แอบอ้างว่ารันผ่านหากยังไม่ได้รันจริง
- รายงานข้อผิดพลาดของทีมคู่ขนานอย่างละเอียดพร้อมระบุไฟล์และบรรทัด

---

## 1. บันทึกผลการทดสอบจริงจาก Supervisor ก่อนการแก้ไขรอบนี้ (Supervisor Baseline Observations)

จากผลการรันชุดทดสอบเต็มระบบ `npm test` ของ Supervisor (บันทึกใน `test-core-final.log`):
- **รวมทั้งหมด**: 100 การทดสอบ
- **ผ่านแล้ว**: 88 การทดสอบ
- **ไม่ผ่าน**: 12 การทดสอบ (รวม 3 Parent Suites)

### ก. รายการทดสอบที่อยู่ในความรับผิดชอบ (Owned Failures)
1. **`tests/inventoryComponents.test.cjs` - Test 2 (Color Filtering)**:
   - *อาการ*: Assertion ล้มเหลว `true !== false` ที่ `assert.equal(container.textContent.includes('ขาว'), false)`
   - *สาเหตุ*: ใน JSDOM ที่ไม่มี CSS Media Query ตัวเลือก `<option value="ขาว">ขาว</option>` ในแท็ก `<select>` และส่วนแสดงผลแบบ Mobile Cards แสดงผลอยู่ใน DOM พร้อมกัน การใช้ `container.textContent.includes('ขาว')` ทำให้ตรวจพบข้อความ 'ขาว' จาก Dropdown Option เสมอ
2. **`tests/inventoryComponents.test.cjs` - Test 3 (Tool Availability)**:
   - *อาการ*: `assert.ok(container.textContent.includes('SC-001'))` ล้มเหลว
   - *สาเหตุ*: ใน `StockTable.jsx` รายการรหัสประจำชิ้น (`SC-001`, `SC-002`, `พร้อมใช้ในคลัง`, ผู้ยืม `ป้านิด`) ถูกซ่อนอยู่ใน Sub-row ที่จะแสดงผลเมื่อผู้ใช้กดปุ่มคลี่ขยาย (`แสดงรหัสรายชิ้นทั้งหมด`) ชุดทดสอบเดิมไม่ได้จำลองการคลิกขยายแถว และไม่ได้ตรวจสอบยอดคงเหลือพร้อมใช้ที่คำนวณจาก `assetUnits` (ต้องแสดง 1 ชิ้น ไม่ใช่ยอดแม่ 0 หรือ 999)
3. **`tests/inventoryComponents.test.cjs` - Test 7 (Casual Helper Selection)**:
   - *อาการ*: `assert.ok(helperTabBtn)` ล้มเหลว (ค่าเป็น `undefined`)
   - *สาเหตุ*: ตัวเลือกใน `IssueCartDrawer.jsx` ใช้ข้อความภาษาไทยว่า `'ผู้ช่วยภายนอก'` แต่ชุดทดสอบค้นหาด้วยคำว่า `'ผู้ช่วยงาน'`
4. **`tests/inventoryComponents.test.cjs` - Test 8 (Field Round 15 Job Stops)**:
   - *อาการ*: `assert.ok(submitBtn)` ล้มเหลว
   - *สาเหตุ*: ปุ่มส่งฟอร์มในโหมด Field Round แสดงข้อความว่า `ยืนยันเปิดรอบ ${roundCode}` ไม่ใช่ `บันทึกการเบิก` และข้อมูล `mockActivities` ขาดแคลนฟิลด์ `name` รวมถึงไม่ได้ระบุ `primaryReceiverName` ทำให้ติด Form Validation
5. **`tests/inventoryComponents.test.cjs` - Test 9 (Idempotency Key Fingerprinting)**:
   - *อาการ*: `fireEvent.click` ล้มเหลวด้วยข้อผิดพลาด `unable to fire click on null/undefined`
   - *สาเหตุ*: ข้อมูล Fixture ไม่ได้ส่ง `activities` และ `recipients` ทำให้ฟอร์มติดเงื่อนไขบังคับเลือกโปรเจกต์ ส่งผลให้ปุ่มบันทึกไม่เปิดให้กด
6. **`tests/qrScanner.test.cjs` - Test 4 (Generation Token Race)**:
   - *อาการ*: `assert.equal(start1Started, true)` ล้มเหลว (`false !== true`) และ `controls.stop()` ไม่ถูกเรียก
   - *สาเหตุ*: ตัวเลือก `getCamButton()` ค้นหาปุ่มด้วย `b.textContent.includes('กล้อง')` ซึ่งไปจับได้แท็บแรก (`กล้องสแกน`) แทนที่จะเป็นปุ่มเปิดกล้อง (`เปิดกล้องสแกน`) และ Mock Reader ยังไม่ได้ผูก Stream เข้ากับ `mockControls1`
7. **`src/components/inventory/QrScanner.jsx` - ESLint Immutability**:
   - *อาการ*: ข้อผิดพลาด `react-hooks/immutability` บรรทัดที่ 310 (`This value cannot be modified`)
   - *สาเหตุ*: มีการกำหนดค่า property โดยตรงลงบนออบเจกต์ MediaStream (`stream.__f2u_token = currentToken`)

### ข. รายการทดสอบที่อยู่นอกความรับผิดชอบ (Non-Owned External Failures)
1. **`tests/inventoryUi.test.cjs` (Tests 4 & 5)**:
   - *ข้อผิดพลาด*: `TypeError: (0, import_warehouseService.generateIdempotencyKey) is not a function`
   - *จุดที่พบ*: `tests/inventoryUi.test.cjs:142`
   - *คำแนะนำสำหรับ UI Owner*: ในไฟล์ทดสอบ `inventoryUi.test.cjs` มีการ Import ฟังก์ชัน `generateIdempotencyKey` จาก `warehouseService.js` แต่ Mock หรือ Module Bundle ใน Node SSR ไม่ได้ Export ฟังก์ชันนี้ออกมา
2. **`tests/inventoryUi.test.cjs` (Test 8)**:
   - *ข้อผิดพลาด*: `TypeError: import_dexie.default is not a constructor`
   - *จุดที่พบ*: `tests/inventoryUi.test.cjs:310`
   - *คำแนะนำสำหรับ UI Owner*: ในสภาพแวดล้อม Node Test Runner ไม่สามารถสร้างอินสแตนซ์ของ `Dexie` จริงได้ ต้องทำการ Mock Dexie IndexedDB หรือใช้ In-memory fallback

---

## 2. การแก้ไขที่ดำเนินการเสร็จสิ้น (Fixes Implemented)

### 2.1 แก้ไข `src/components/inventory/QrScanner.jsx`
- **แก้ไขปัญหา ESLint Immutability (บรรทัดที่ 310)**:
  - ตัดการเขียน `stream.__f2u_token = currentToken` ออกโดยสิ้นเชิง
  - เปลี่ยนมาใช้ `streamTokenMapRef = useRef(new WeakMap())` ในการจับคู่ Stream เข้ากับ Generation Token โดยไม่เปลี่ยนแปลง Properties บนออบเจกต์ภายนอก
- **การจัดการ Lifecycle ของ Stream ป้องกันการปิดกล้องข้าม Session**:
  - เพิ่ม `activeStreamRef = useRef(null)` สำหรับติดตามสตรีมที่กำลังแสดงผลจริงของ Generation ปัจจุบัน
  - เมื่อคำขอเริ่มกล้องที่ตกยุค (Obsolete Generation จากคำขอที่ 1) ได้รับสตรีมมาทีหลัง ระบบจะสั่งปิดเฉพาะ Tracks ของตนเอง และจะไม่แตะต้อง Tracks ของ `activeStreamRef.current` (คำขอที่ 2)
  - คืนค่า `capturedVideoEl.srcObject = activeStreamRef.current` ป้องกันไม่ให้วิดีโอถูกรีเซ็ตเป็นค่าว่าง
- **ยกระดับ Layer Z-Index**:
  - ปรับ Backdrop Container จาก `z-50` เป็น `z-[110]` เพื่อให้อยู่เหนือ Bottom Navigation Bar ของระบบหลัก (`z-90`) เสมอ
- **รองรับธีมและ Mobile UX**:
  - ผูกตัวแปร CSS: `var(--theme-main, #8b5cf6)`, `var(--theme-light, #f5f3ff)`, `var(--theme-shadow)`
  - ขนาดพื้นที่สัมผัสปุ่มทุกจุด $\ge 44$px (`min-h-[44px]`)
  - รองรับ Safe Area ขอบจอด้านล่าง `paddingBottom: calc(0.875rem + env(safe-area-inset-bottom, 0px))`

### 2.2 แก้ไข `src/components/inventory/QrLabelPrint.jsx`
- **ยกระดับ Layer Z-Index**:
  - ปรับคอนเทนเนอร์หลักเป็น `z-[110]`
- **ความสะอาดและการจัดการข้อผิดพลาด**:
  - ใช้ `catch {}` ในทุกจุดที่ไม่ได้อ่านค่า Error ปราศจาก Warning
  - ปรับการรอโหลดทรัพยากรภาพและฟอนต์ใน Iframe ก่อนสั่ง Print Dialog
- **คงความถูกต้องของสีฉลาก**:
  - ฉลาก QR Code และข้อความพิมพ์ออกมาเป็นขาว-ดำ 100% (Pure Black & White) เพื่อความคมชัดสูงสุดในการสแกนด้วยกล้องหรือบาร์โค้ดสแกนเนอร์

### 2.3 แก้ไข `tests/qrScanner.test.cjs` (Test 4)
- ปรับ `getCamButton()` ให้ค้นหาปุ่มแอ็กชันกล้องจริง (`เปิดกล้องสแกน` หรือ `กำลังเชื่อมต่อกล้อง`) ไม่ให้ชนกับปุ่มแท็บ
- กำหนด Mock Reader ให้รองรับทั้ง `decodeFromConstraints` และ `decodeFromVideoDevice`
- ส่งคืน `mockControls1.stream = mockStream1` และ `mockControls2.stream = mockStream2`
- ตรวจสอบยืนยัน:
  - `start1Started === true`
  - `start2Started === true`
  - `stopControls1Called === true` และ `mockTrack1.isStopped === true`
  - `mockTrack2.isStopped === false` (สตรีมตัวใหม่ต้องไม่ถูกปิด)

### 2.4 แก้ไข `tests/inventoryComponents.test.cjs`
- **Test 2 (Color Filter)**:
  - กำหนดขอบเขตการตรวจสอบให้เจาะจงที่แถวในตาราง `tbody tr` และการ์ดใน `.md:hidden` ป้องกันการนับคำว่า 'ขาว' ที่อยู่ใน `<option>` ของ Select
- **Test 3 (Tool Availability)**:
  - ตรวจสอบยอดพร้อมใช้ในแถวหลักว่าคำนวณจาก `assetUnits` (แสดง 1 เครื่อง พร้อมยืมอยู่ 1 เครื่อง)
  - จำลองการกดปุ่มคลี่ขยายแถว (`แสดงรหัสรายชิ้นทั้งหมด`) แล้วตรวจสอบว่าปรากฏ `SC-001`, `SC-002`, `พร้อมใช้ในคลัง`, และผู้ยืม `ป้านิด` ครบถ้วน
- **Test 7 (Casual Helper)**:
  - แก้ไขตัวเลือกปุ่มแท็บเป็น `'ผู้ช่วยภายนอก'` ตรงตาม UI
- **Test 8 (Field Round 15 Job Stops)**:
  - ส่งฟิลด์ `name` ใน mockActivities
  - กรอกชื่อผู้รับผิดชอบหลัก (`เมย์ (หัวหน้าทีมติดตั้ง)`)
  - ติ๊กเลือก Checkbox จุดติดตั้ง
  - ค้นหาปุ่มด้วยข้อความ `ยืนยันเปิดรอบ`
  - ยืนยันว่าส่งออก payload โหมด `field_round` โดยมีเครื่องมือ 1 ชิ้น ไม่ใช่ 15 ชิ้น
- **Test 9 (Idempotency Key Fingerprinting)**:
  - ส่ง mock activities และ recipients ที่ถูกต้องเพื่อให้ฟอร์มผ่าน Validation
  - ค้นหาปุ่มบันทึก `ยืนยันเบิกให้`
  - ทดสอบ Idempotency Key ซ้ำเดิมเมื่อกด Retry และสร้าง Key ใหม่เมื่อแก้ไขจำนวน

---

## 3. บันทึกข้อจำกัดของการทดสอบผ่านเบราว์เซอร์ (Browser Verification Status)

- **สถานะการเข้าถึงเบราว์เซอร์**: **ไม่สามารถใช้งานได้ (Unavailable)**
- **เหตุผล**: คำสั่งเครื่องมือ Chrome MCP ไม่ได้รับอนุญาต (Tool call permission canceled) และระบบไม่มี CUA Bridge ที่สามารถเข้าถึงหน้าจอ GUI อัตโนมัติในสภาพแวดล้อม Headless
- **แนวทางทดสอบทดแทนที่เตรียมไว้**:
  - ได้จัดเตรียมหน้า Fixture ออฟไลน์แบบ Standalone ที่:  
    `http://127.0.0.1:5174/tests/fixtures/inventory-preview.html`
  - ไฟล์นี้ทำงานแบบ In-Memory 100% ไม่มีการเรียกเครือข่าย ไม่มีการเชื่อมต่อ Supabase
  - มีปุ่มสลับธีม (Violet / Emerald / Rose) ให้ Supervisor หรือผู้ใช้เปิดตรวจดูความถูกต้องของ Responsive Layout บน Viewport ต่างๆ:
    - **Mobile**: 390px (ปุ่มแตะ $\ge 44$px, ป้องกันขอบล่างด้วย Safe Area, ไม่มี Horizontal Scrollbar หลุด)
    - **Tablet**: 820px
    - **Desktop**: 1440px

---

## 4. คำสั่งสำหรับ Supervisor ในการรันตรวจสอบ (Commands for Supervisor)

ให้ Supervisor รันคำสั่งต่อไปนี้เพื่อตรวจสอบผลลัพธ์:

```bash
# 1. รันการทดสอบ QR Labels Unit & Integration (13 ข้อ)
node --experimental-vm-modules --test tests/qrLabels.test.cjs

# 2. รันการทดสอบ QR Scanner Component Real DOM Suite (11 ข้อ)
node --experimental-vm-modules --test tests/qrScanner.test.cjs

# 3. รันการทดสอบ Inventory Components Suite (StockTable & IssueCartDrawer - 9 ข้อ)
node --experimental-vm-modules --test tests/inventoryComponents.test.cjs

# 4. ตรวจสอบ Lint เฉพาะไฟล์ QR
npx eslint src/utils/qrLabels.js src/components/inventory/QrScanner.jsx src/components/inventory/QrLabelPrint.jsx
```
