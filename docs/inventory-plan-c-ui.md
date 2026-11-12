# สถาปัตยกรรมและคู่มือการเชื่อมต่อระบบคลังสินค้า Plan C (Inventory UI Architecture)

เอกสารส่งมอบสถาปัตยกรรมส่วนติดต่อผู้ใช้ (Frontend Architecture) สำหรับระบบคลังสินค้า **Flower2you (Flower2U)** ตามแนวทาง **Plan C (Inventory-First UX)** ภายใต้การควบคุมของ Codex Supervisor

---

## 1. ภาพรวมสถาปัตยกรรม (Architecture Overview)

ระบบคลังสินค้า Plan C ออกแบบขึ้นโดยยึดหลัก **"เห็นของพร้อมใช้ แล้วเบิกผลิตงานหรือจัดชุดออกหน้างาน"** ตามภาพร่างอ้างอิง `.impeccable/mocks/decision/warehouse-stock.html` พร้อมทั้งผสานการทำงาน 4 มิติหลักเข้าด้วยกันอย่างไร้รอยต่อ:

```mermaid
graph TD
    App[App.jsx] -->|isActive, userProfile, props| Inv[src/Inventory.jsx]
    
    subgraph Core Hook & State
        Inv --> Hook[useWarehouseData.js]
        Hook -->|In-flight Dedup & RPC| WService[warehouseService.js]
        Hook -->|Local-First Cache Read-Only| DB[Dexie IDB & SyncService]
    end

    subgraph 4 Main Views
        Inv --> V1[ของในคลัง StockTable.jsx]
        Inv --> V2[เบิก–คืน CustodyFlowView.jsx]
        Inv --> V3[เงินสดสำรอง CashVaultView.jsx]
        Inv --> V4[ประวัติ HistoryAuditView.jsx]
    end

    subgraph Contextual Workspaces & Modals
        V1 --> Cart[IssueCartDrawer.jsx]
        Inv --> Scan[QrScanner.jsx (Lazy)]
        Inv --> Print[QrLabelPrint.jsx (Lazy)]
        Inv --> M1[ItemFormModal.jsx]
        Inv --> M2[StockAdjustModal.jsx]
        Inv --> M3[CategoryManageModal.jsx]
        Inv --> M4[AddRecipientModal.jsx]
        Inv --> M5[AddAssetUnitModal.jsx]
    end
```

---

## 2. ขอบเขตกรรมสิทธิ์ไฟล์ (File Ownership & Responsibilities)

| พาธไฟล์ | หน้าที่และรายละเอียดทางสถาปัตยกรรม |
| :--- | :--- |
| `src/Inventory.jsx` | คอมโพเนนต์หลัก: จัดการแท็บ 4 มุมมอง, ตะกร้าเบิกแบบอะตอมิก (Mixed Cart), สแกนเนอร์ QR (Lazy loaded), และการส่งคำสั่งธุรกรรมผ่าน Service |
| `src/hooks/useWarehouseData.js` | คอนโทรลเลอร์ Lifecycle, Active-page gating, In-flight deduplication, Authoritative Empty Cloud State, Zero-persistence cash, และ Operations tracking |
| `src/components/inventory/InventoryHeader.jsx` | ส่วนหัวหลัก: แสดงแบรนด์, ปุ่มสแกนยืม/คืน, ปุ่มพิมพ์ฉลาก, ปุ่มรับของเข้า, จัดการหมวดหมู่, และปุ่มรีเฟรช |
| `src/components/inventory/InventoryNavTabs.jsx` | แถบนำทาง 4 มุมมอง: ของในคลัง, เบิก–คืน (พร้อม Badge เครื่องมือยืมอยู่), เงินสดสำรอง (ไอคอนล็อกสำหรับสิทธิ์เฉพาะ), ประวัติ |
| `src/components/inventory/StockTable.jsx` | ตารางพัสดุและตัวกรองผสม (Type, Category, Color, Size, Storage, Search), คำนวณยอดเครื่องมือพร้อมใช้จากรหัสชิ้นงานจริง (`asset_units`), ปุ่มรับของเข้า |
| `src/components/inventory/IssueCartDrawer.jsx` | ตะกร้าเบิกพัสดุ: โหมดผลิตงาน vs โหมดชุดออกหน้างาน (รองรับ 15+ จุดส่งงาน), ผสานรายการวัสดุและเครื่องมือในบิลเดียว, ป้องกัน Idempotency Key ซ้ำ |
| `src/components/inventory/CustodyFlowView.jsx` | หน้าเบิก–คืน: รายการเครื่องมือยืมอยู่, ส่งต่อเครื่องมือ (Handover with accepted=true), รับคืนเครื่องมือ (Condition ดี/ชำรุด/สูญหาย พร้อมข้อความ ม.76/77), คืนวัสดุ, กู้คืนวัสดุ, คิวตรวจสภาพ |
| `src/components/inventory/CashVaultView.jsx` | หน้าเงินสดสำรอง: ตรวจสอบสิทธิ์ฝั่งเซิร์ฟเวอร์ (Admin/Accountant), ตารางชนิดธนบัตร 5 ชนิด, จองเงินให้งาน, ปลดการจอง, อัปเดตเกณฑ์แจ้งเตือน, จ่ายผู้ช่วยพับ, ส่งต่อชุดเงิน, ตรวจรับชุดเงิน, คืนเงินสด |
| `src/components/inventory/HistoryAuditView.jsx` | หน้าประวัติ: รายการเคลื่อนไหวจริงผ่าน `loadWarehouseHistory` พร้อมการแบ่งหน้า (Pagination) และค้นหา, เช็กลิสต์โปรเจกต์เดิม, ประวัติการยืมเดิม, รายการบริการ |
| `src/components/inventory/ItemFormModal.jsx` | โมดอลสร้าง/แก้ไขพัสดุ: สร้างรายการใหม่พร้อมยอดยกมาเริ่มต้น (`initialStock` และ `openingStockReason`), แก้ไขพัสดุเดิมโดยไม่เขียนทับยอดสต็อก, เพิ่มรหัสประจำชิ้น |
| `src/components/inventory/StockAdjustModal.jsx` | โมดอลรับของเข้า/ปรับลดยอด: ส่ง signed deltaQuantity ไปยัง `adjustStock` โดยไม่มีการ clamp ฝั่ง Client เพื่อให้ Database ทำหน้าที่ตรวจสอบความถูกต้อง |
| `src/components/inventory/CategoryManageModal.jsx` | จัดการหมวดหมู่: สร้าง, เปลี่ยนชื่อ, เลิกใช้ (Soft delete รักษาประวัติเดิม) |
| `src/components/inventory/AddRecipientModal.jsx` | ลงทะเบียนผู้รับจริง: ผู้ช่วยภายนอก (ญาติ/เพื่อน), พนักงาน, หรือทีมงาน (พร้อมชื่อผู้รับหลักและสมาชิก) โดยเชื่อมต่อ RPC เซิร์ฟเวอร์จริง (ห้ามใช้ Fake IDs) |
| `src/components/inventory/AddAssetUnitModal.jsx` | เพิ่มรหัสประจำชิ้นเครื่องมือเดี่ยว (`addAssetUnit`) |
| `src/components/inventory/MigrationNoticeBanner.jsx` | แถบแจ้งเตือนสถานะฐานข้อมูลกรณี Supabase ยังไม่ได้ติดตั้ง RPC `warehouse_dispatch` |
| `src/App.jsx` | อัปเดตเฉพาะจุด: ส่ง `isActive={activeTab === 'Inventory'}` และ `userProfile={userProfile}` เข้า `Inventory` |
| `tests/inventoryUi.test.cjs` | ชุดทดสอบการเรนเดอร์และพฤติกรรม UI 10 หัวข้อ |

---

## 3. การผูก API ฝั่ง Backend (`warehouseService.js`)

ทุกการทำรายการเชื่อมโยงไปยัง API กลางใน `src/services/warehouseService.js` โดยมีโครงสร้างดังนี้:

### 3.1 การเบิกจ่ายแบบอะตอมิก (Atomic Mixed Cart)
- **ฟังก์ชัน:** `createIssue({ issueType, projectId, projectIds, roundCode, roundTitle, recipientId, recipientName, teamMembers, dueDate, materialLines, toolUnits, notes, idempotencyKey })`
- **พฤติกรรม:**
  - รวมทั้งวัสดุสิ้นเปลือง วัสดุใช้ซ้ำ และเครื่องมือที่มีรหัสประจำชิ้นไว้ใน 1 ธุรกรรมฐานข้อมูล
  - โหมดชุดออกหน้างาน (`FIELD_ISSUE`) ไม่ตัดแถวรายการวัสดุ (Material Lines) ทิ้ง
  - รหัส Idempotency Key คงที่ตลอดการพยายามส่งซ้ำกรณีเน็ตเวิร์กไม่เสถียร และสร้างใหม่เมื่อมีการแก้ไขเนื้อหาในตะกร้า
  - หากเขียนสำเร็จจะล้างตะกร้า; หากการเขียนล้มเหลวจะไม่ล้างข้อมูลในตะกร้าทิ้ง

### 3.2 การปรับปรุงยอดสต็อกและการเพิ่มพัสดุ
- **สร้างพัสดุใหม่:** `createItem({ code, name, categoryId, itemType, unit, minAlertThreshold, averageCost, storageLocation, color, size, initialStock, openingStockReason, idempotencyKey })`
- **แก้ไขข้อมูลพัสดุเดิม:** `saveItemMetadata({ id, name, categoryId, itemType, unit, minAlertThreshold, averageCost, storageLocation, color, size, idempotencyKey })` (ตัดฟิลด์ `current_stock` ออกเพื่อป้องกัน Stale Overwrite)
- **ปรับยอดสต็อก:** `adjustStock({ itemId, deltaQuantity, reason, idempotencyKey })` ส่งค่าตัวเลขเครื่องหมายบวก (รับเข้า) หรือลบ (ปรับลด) พร้อมเหตุผลตรวจสอบได้
- **เพิ่มรหัสเครื่องมือ:** `addAssetUnit({ itemId, unitCode, notes, idempotencyKey })`

### 3.3 ทะเบียนผู้รับและทีม
- **บุคคล / ผู้ช่วยภายนอก:** `createRecipient({ name, recipientType, contactInfo, is_active: true, idempotencyKey })`
- **ทีมปฏิบัติงาน:** `createTeam({ name, primaryReceiverName, memberNames, idempotencyKey })`
- อัปเดต State จากผลลัพธ์ที่ยืนยันแล้วจากเซิร์ฟเวอร์เท่านั้น (ไม่มีการใช้ `rec-Date.now()` เป็น ID จำลอง)

### 3.4 การจัดการเงินสดสำรอง (Petty Cash Vault)
- **การเข้าถึง:** จำกัดสิทธิ์เฉพาะผู้ใช้ที่มีบทบาท `admin` หรือ `accountant` เท่านั้น หากไม่มีสิทธิ์จะปิดกั้นทันที (Fail-Closed)
- **การจัดเก็บ:** ข้อมูลเงินสดอยู่ในหน่วยความจำเท่านั้น ไม่บันทึกลง IndexedDB หรือ LocalStorage และถูกล้างทันทีเมื่อออกจากแท็บ
- **ฟังก์ชันที่เชื่อมต่อ:**
  - `depositCash({ denomination, noteCount, notes, idempotencyKey })`
  - `recordCountedOpeningCash({ counts, notes, idempotencyKey })`
  - `reserveCash({ projectId, denomination, noteCount, notes, idempotencyKey })`
  - `releaseCashReservation({ projectId, denomination, noteCount, notes, idempotencyKey })`
  - `updateCashThresholds({ denomination, lowAlertThreshold, targetAvailableCount, idempotencyKey })`
  - `issueCashBatch({ projectId, recipientId, recipientName, denomination, noteCount, useReservation, notes, idempotencyKey })`
  - `handoverCashBatch({ batchId, toRecipientId, toRecipientName, noteCount, accepted: true, notes, idempotencyKey })`
  - `receivePreparedCash({ batchId, noteCount, notes, idempotencyKey })`
  - `returnUnusedRawCash({ batchId, noteCount, keepReservation: true, notes, idempotencyKey })`
  - `deliverCashToCustomer({ projectId, denomination, noteCount, notes, idempotencyKey })`

### 3.5 ประวัติการเคลื่อนไหว
- **ฟังก์ชัน:** `loadWarehouseHistory({ projectId, limit, offset, includeCash })`
- รองรับการแบ่งหน้า (Pagination) จริงครั้งละ 50 รายการ และตัวกรองประเภทการเคลื่อนไหว

---

## 4. มาตรการด้าน UI & การเข้าถึง (Accessibility & Directives)

1. **ห้ามใช้ Native Browser Dialogs & Date Pickers โดยเด็ดขาด:**
   - ใช้งาน `<Toast />` แทน `window.alert()`
   - ใช้งาน `<ConfirmDialog />` แทน `window.confirm()`
   - ใช้งาน `<ModernDateTimePicker />` แทน `<input type="date">`
2. **ขนาดการสัมผัสและการอ่าน:**
   - ปุ่มและตัวควบคุมบนมือถือมีขนาดสัมผัสไม่ต่ำกว่า 44px
   - ข้อความและการตั้งค่าภาษาไทยใช้ขนาดไม่ต่ำกว่า 14px เพื่อให้อ่านง่าย
3. **การโหลดแบบ Lazy-loading สำหรับระบบ QR:**
   - นำเข้า `QrScanner` และ `QrLabelPrint` ผ่าน `React.lazy` และ `<Suspense>` เพื่อไม่ให้โมดูลถอดรหัสและพิมพ์เพิ่มขนาดใน Bundle หลัก
   - ถอดประกอบและคืนทรัพยากรกล้องทันทีเมื่อปิดหน้าต่าง หรือเมื่อ `isActive === false`

---

## 5. การส่งมอบและการตรวจสอบ (Verification Handoff)

การตรวจสอบความถูกต้องทั้งหมดส่งมอบให้ **Codex Supervisor** เป็นผู้ดำเนินการรันคำสั่ง:
1. การตรวจสอบชุดทดสอบ: `node --experimental-vm-modules --test tests/*.test.cjs`
2. การตรวจสอบการบิวด์: `npm run build`
3. การตรวจสอบ Lint และ Type Checks: ตามกระบวนการมาตรฐานของโปรเจกต์
