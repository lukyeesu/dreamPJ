# 🌸 Flower2U (Flower2you)
> **ระบบบริหารจัดการร้านจัดดอกไม้และอีเวนต์ศิลปิน (Fandom Support & Event Florist Operations Platform)**
> ขับเคลื่อนด้วยเทคโนโลยี **React 19 + Vite 7 + Tailwind CSS v4 + Dexie IndexedDB (Local-First) + Supabase (PostgreSQL)**

---

## 📌 เอกสารสำคัญสำหรับนักพัฒนาและ AI Agent

| เอกสาร | ลิงก์ | คำอธิบาย |
| :--- | :--- | :--- |
| **🗺️ แผนแม่บทระบบ & คู่มือ Agent** | [`ROADMAP.md`](./ROADMAP.md) | ไดอะแกรมสถาปัตยกรรมระบบ, ผังข้อมูลการเงิน, สารบัญ 11 โมดูล, กฎเหล็ก และงานขั้นถัดไป |
| **🧠 บันทึกประวัติและบริบทงาน** | [`.agents/memory/SESSION_LOG.md`](./.agents/memory/SESSION_LOG.md) | บันทึกประวัติการตัดสินใจ ข้อตกลง และสถานะงานคงค้างเพื่อส่งต่อบริบทข้าม Session |
| **⚖️ กฎเหล็กและข้อบังคับระบบ** | [`GEMINI.md`](./GEMINI.md) | กฎการพัฒนา, ข้อห้ามการสั่ง Git, Directive 11 (ห้าม Native UI) และ Skill Matrix |
| **💾 พิมพ์เขียวฐานข้อมูล** | [`F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md`](./F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md) | สคีมาตาราง 9 โดเมนบน Supabase และสถาปัตยกรรม Zero-Egress |

---

## 🚀 จุดเด่นของระบบ (Key Features)

1. **⚡ สถาปัตยกรรม Local-First & Zero-Egress**:
   - บันทึกและดึงข้อมูลจาก IndexedDB (`Dexie`) ภายในเครื่องทันที (0ms Latency)
   - ดึงข้อมูลจาก Supabase โดยจำกัดคอลัมน์เจาะจง ไม่ดึง Egress ส่วนเกิน
   - ซิงก์เฉพาะส่วนที่เปลี่ยนแปลงย้อนหลัง (Delta Sync)

2. **💰 ระบบการเงิน 4 ขั้นตอน (Standard Financial Hierarchy)**:
   - เรียงลำดับตัวเลขอย่างเป็นเอกภาพ: **1. เงินศิลปิน (Support Money)** ➔ **2. รายได้ (Revenue)** ➔ **3. ค่าใช้จ่าย (Expenses)** ➔ **4. กำไรสุทธิ (Net Margin)**
   - หน้าบันทึกรายการแบบไดนามิก (Dynamic Line Items, ส่วนลด, VAT ในตัว/แยก/ไม่มี)
   - เครื่องคำนวณแจกแจงธนบัตรเงินซัพพอร์ต (Banknote Float Calculator)

3. **🚚 ระบบโลจิสติกส์และการจัดส่ง (Venue Intelligence & Batch Delivery)**:
   - แผนที่ขนส่ง Dual-Pin: แยกพิกัดจุดส่งลูกค้า กับจุดเทียบโหลดของจริง (Loading Dock)
   - เรดาร์เตือนงานส่งพ่วงสถานที่เดียวกันวันเดียวกัน (`BatchDeliveryBanner`) ประหยัดต้นทุน

4. **👥 ระบบบทบาทและสิทธิ์ไดนามิก (Dynamic RBAC & Staff Management)**:
   - ออกรหัสพนักงานมาตรฐาน 7 หลัก (`YY`+`PP`+`NNN`) อัตโนมัติ
   - หน้าจัดการสิทธิ์เลือกหน้าที่มองเห็นได้และฟังก์ชันพิเศษของแต่ละตำแหน่ง

5. **🎨 Modern Silky-Smooth UI**:
   - ปลอด Native Dialogs และ Native Date Pickers 100%
   - ปฏิทินและเวลาภาษาไทย (พ.ศ.) ผ่าน `<ModernDateTimePicker />`
   - ตารางข้อมูลป้องกันบั๊กเส้นสีดำกวนใจ 100%

---

## 🛠️ การติดตั้งและรันระบบ (Quickstart)

```bash
# ติดตั้ง Dependencies
npm install

# รัน Development Server
npm run dev

# ทดสอบบิลด์ Production
npm run build

# ทดสอบการโหลดซ้ำ แคช Realtime และการบันทึกโปรเจกต์ด้วยข้อมูลจำลอง
npm test
```

ก่อน deploy โค้ดที่ใช้ `saveProjectSync` เวอร์ชันใหม่ ให้รัน [`database_scripts/save_project_with_items.sql`](./database_scripts/save_project_with_items.sql) ใน Supabase SQL Editor ก่อนหนึ่งครั้ง เพื่อสร้าง RPC บันทึกโปรเจกต์และรายการเงินใน transaction เดียว หากยังไม่ได้รัน แอปจะแจ้งข้อผิดพลาดและไม่รายงานว่าบันทึกสำเร็จ

> [!CAUTION]
> **Git Deployment Policy**: นักพัฒนาและ AI Agent ห้ามรันคำสั่ง `git add`, `git commit`, `git push` เป็นอันขาด การ Staging และ Deploy จะดำเนินการโดยผู้ดูแลระบบด้วยตนเอง
