# สถาปัตยกรรมระบบสแกนและพิมพ์ฉลาก QR ครุภัณฑ์ (Plan C — QR Subsystem)

## อัปเดต 2026-11-13: QR / Code 128 และแก้เส้นทางพิมพ์

- เลือก QR หรือ Code 128 ในหน้าพิมพ์ได้ มีขนาดแนวยาว 50 × 15 มม. สำหรับพื้นที่ติดที่เหมาะสม
- QR ใช้ `F2U:T:<unit_code>`; Code 128 ใช้ `unit_code` เดิม กล้องอ่านได้ทั้งสองแบบโดยไม่เปลี่ยนตัวพิมพ์
- ตรวจพื้นที่ว่างข้างรหัสและความกว้างแท่งก่อนพิมพ์ หากรหัสยาวเกินฉลากจะบอกให้เพิ่มขนาดหรือใช้ QR
- หน้าว่างไม่สร้างตัวอย่าง SC-001 อีกต่อไป ต้องมีรหัสอุปกรณ์จริงก่อนพิมพ์ ปุ่มเพิ่มรายชิ้นเปิดการสร้างเครื่องมือ/รหัส แล้วกลับมาเลือกฉลากให้
- เอกสารพิมพ์ใช้ขนาด มม. และ iframe ที่มีพื้นที่หน้า พร้อมเก็บและคืน object URL แยกแต่ละคำสั่งพิมพ์
- ทดสอบการสร้างและอ่านกลับด้วย ZXing และเรียก iframe → print แบบจำลองแล้ว ยังไม่ได้ทดสอบเครื่องพิมพ์ กล้องมือถือ หรือด้ามโค้งจริง ขนาดเล็กทุกแบบยังต้องทดลองพิมพ์ 100% และสแกนก่อนติด

ส่วนด้านล่างเป็นเอกสารฐานเดิมของระบบ QR; การทำงานล่าสุดข้างต้นรองรับบาร์โค้ดด้วย

เอกสารส่งมอบสถาปัตยกรรมและคู่มือการเชื่อมต่อระบบสแกนและพิมพ์ฉลาก QR สำหรับจัดการเครื่องมือในคลังสินค้า **Flower2you**

---

## 1. ขอบเขตกรรมสิทธิ์ไฟล์ (File Ownership)

| พาธไฟล์ | หน้าที่ / ขอบเขต |
| :--- | :--- |
| `src/utils/qrLabels.js` | Pure Utility functions: เข้ารหัส/ถอดรหัส Payload, ตรวจสอบมิติ mm, Quiet zone 4 ช่อง, คำนวณเลย์เอาต์ A4/Roll, Escape HTML ป้องกัน XSS และสร้าง HTML สำหรับ Iframe พิมพ์ |
| `src/components/inventory/QrScanner.jsx` | คอมโพเนนต์หน้าต่างสแกนกล้อง continuous decoder (`@zxing/browser`) พร้อม generation token ป้องกัน async race condition, ระบบสลับกล้อง, ช่องคีย์รหัส/ปืนยิงบาร์โค้ด และการคืนทรัพยากรกล้อง |
| `src/components/inventory/QrLabelPrint.jsx` | เวิร์กสเปซพิมพ์ฉลากเต็มจอ: พรีเซ็ตด้ามกรรไกร (18×24 มม.), ปกติ (30×40 มม.), กำหนดเอง, รองรับกระดาษ A4 (เว้นดวงที่ลอกแล้วได้) หรือเครื่องพิมพ์ม้วน, แสดงตัวอย่างขนาดจริง, แผ่นเทียบขนาด 10 มม. |
| `tests/qrLabels.test.cjs` | ชุดทดสอบอัตโนมัติ Unit & Integration ครอบคลุม Payload, Validation, A4 Pagination และการสร้าง QR จริงพร้อม Decode Round-trip ด้วย ZXing |
| `docs/inventory-plan-c-qr.md` | เอกสารคู่มือทางเทคนิคและสเปก Props สำหรับเชื่อมต่อกับ `src/Inventory.jsx` |

> **หมายเหตุ:** ไม่มีการแก้ไขไฟล์ `src/Inventory.jsx`, `src/App.jsx` หรือโค้ด SQL/Backend ใดๆ ในงานชุดนี้ตามข้อกำหนดการทำงานแบบคู่ขนาน

---

## 2. รูปแบบ Payload มาตรฐาน (QR Data Format)

Flower2U ใช้รูปแบบ Payload สั้นและคงที่ (Stable Short Payload):
- **รูปแบบใน QR Code:** `F2U:T:<unit_code>` (เช่น `F2U:T:SC-001`, `F2U:T:DR-002`)
  - ไม่ใส่ชื่อผู้ยืม สถานะ หรือข้อมูลที่เปลี่ยนแปลงบ่อยลงใน QR
  - คงตัวพิมพ์เล็ก–พิมพ์ใหญ่เดิมอย่างแม่นยำ (Preserve exact casing)
- **การถอดรหัส (Decoding):**
  - รองรับรหัสมาตรฐาน `F2U:T:SC-001` จากการสแกนด้วยกล้อง
  - รองรับรหัสดิบ `SC-001` จากปืนยิงบาร์โค้ดแบบ USB/Bluetooth หรือการพิมพ์ด้วยมือ
  - **ปฏิเสธทันที:** ลิงก์ URL ทุกชนิด (`http://`, `https://`, `www.`), สคริปต์/HTML (`<script>`) และ Namespace อื่นที่ไม่รู้จัก

---

## 3. การเชื่อมต่อกับ `src/Inventory.jsx`

### 3.1 `QrScanner`
หน้าต่างโมดอลสำหรับสแกนรับรหัสเครื่องมือ ไม่ตัดสต็อกหรือเบิกของอัตโนมัติเมื่อสแกนติด (Callback ส่งรหัสให้ฟอร์มหลักตรวจสอบก่อนกดยืนยัน)

#### Props:
```typescript
interface QrScannerProps {
  isOpen: boolean;                         // สถานะเปิด/ปิดโมดอล
  onClose: () => void;                     // ฟังก์ชันปิดโมดอล
  onScan: (unitCode: string, resultObj: object) => void; // ทำงานเมื่ออ่านรหัสสำเร็จ
  title?: string;                          // ค่าเริ่มต้น: "สแกน QR ครุภัณฑ์"
  subtitle?: string;                       // ข้อความคำแนะนำใต้ชื่อ
  codeReaderInstance?: object;             // สำหรับ Mock ตอนทดสอบ (Dependency Injection)
}
```

#### ตัวอย่างการเรียกใช้จาก `src/Inventory.jsx`:
```jsx
import QrScanner from './components/inventory/QrScanner.jsx';

// ภายในคอมโพเนนต์ Inventory:
<QrScanner
  isOpen={isScannerOpen}
  onClose={() => setIsScannerOpen(false)}
  onScan={(scannedUnitCode) => {
    setSelectedTools((prev) => prev.includes(scannedUnitCode) ? prev : [...prev, scannedUnitCode]);
  }}
/>
```

---

### 3.2 `QrLabelPrint`
เวิร์กสเปซเต็มหน้าจอสำหรับจัดพิมพ์ฉลากติดเครื่องมือ

#### Props:
```typescript
interface QrLabelPrintProps {
  units: Array<{ unit_code: string; item_id: string; status: string; notes?: string }>;
  items: Array<{ id: string; name: string; color?: string; size?: string; category_id?: string }>;
  categories: Array<{ id: string; name: string }>;
  onClose: () => void;
  initialSelectedUnitCodes?: string[];    // เริ่มต้นว่างเปล่า (ไม่เลือกทั้งคลังอัตโนมัติ)
  onPrintSuccess?: () => void;
}
```

#### ตัวอย่างการเรียกใช้จาก `src/Inventory.jsx`:
```jsx
import QrLabelPrint from './components/inventory/QrLabelPrint.jsx';

// ภายในคอมโพเนนต์ Inventory:
{isPrintOpen && (
  <QrLabelPrint
    units={units}
    items={items}
    categories={categories}
    initialSelectedUnitCodes={selectedCodes}
    onClose={() => setIsPrintOpen(false)}
    onPrintSuccess={() => showToast('สั่งพิมพ์เรียบร้อย')}
  />
)}
```

---

## 4. สถานะการตรวจสอบความถูกต้อง (Verification Status)

### ก. การทดสอบในระบบจำลอง (Automated Test Suite)
- **Payload & Security:** ทดสอบ `encodeQrPayload`, `decodeQrPayload`, การปฏิเสธ URL/Script, การ Escape HTML และการกรอง SVG ปลอดภัย
- **Geometry & Worst-case Payload:** คำนวณขนาดช่อง QR (Module size mm) โดยอิงตามรหัสที่ยาวที่สุดที่เลือกจริง และบล็อกฉลากที่มีขนาดช่องเล็กกว่า 0.25 มม.
- **A4 / Roll Layout & Pagination:** ตรวจสอบความถูกต้องของตรรกะคำนวณแถว/คอลัมน์, การเว้นดวงสติ๊กเกอร์ที่ลอกแล้ว (Start offset) และการบล็อกยอดพิมพ์เกิน 500 ดวง
- **Round-Trip ZXing Decode:** ทดสอบสร้าง QR ด้วย `qrcode` ในเครื่อง แล้วถอดรหัสกลับด้วย `@zxing/library` สำเร็จ
- **Race Condition & Lifecycle:** ทดสอบ Monotonically increasing generation token เพื่อรับมือกับ Asynchronous camera start ที่ Resolve ช้าหรือซ้อนกัน และทดสอบการ Throttle รหัสซ้ำภายใน 2 วินาที

### ข. รายการที่ต้องตรวจสอบกับอุปกรณ์จริง (Physical Hardware Checks)
1. **การพิมพ์ฉลากจริง:** ต้องเปิดหน้าต่างพิมพ์ของเบราว์เซอร์แล้วเลือก **Scale: 100% (Actual size)** เสมอ (ห้ามเลือก Fit to page)
2. **ฉลากด้ามกรรไกร (18×24 มม.):** เป็นขนาดทดลอง ควรใช้ปุ่ม "พิมพ์แผ่นเทียบขนาด (10 มม.)" เพื่อวัดเทียบด้วยไม้บรรทัด และทดสอบสแกนด้วยกล้องมือถือจริง
3. **การเข้าถึงกล้อง:** เบราว์เซอร์บนมือถือต้องการการเชื่อมต่อแบบ HTTPS เพื่ออนุญาตให้เข้าถึงกล้อง
