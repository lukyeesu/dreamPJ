# Workspace Rules & Git Deployment Policy

## Git Operations
- **Strictly DO NOT run `git add`, `git commit`, or `git push`**: The user manually stages, commits, and pushes code to Git/production.
- Read-only Git commands like `git status`, `git diff`, and `git log` are allowed.

---

## Active Skills & Engineering Directives

### 1. Ponytail (Lazy Senior Dev Mode)
- **Smallest complete change**: Solve problems with the least code possible. The best code is code never written.
- **Minimal diff & zero bloat**: No speculative features, no unnecessary wrapper/abstraction. Deletion beats addition.
- **Token efficiency**: Keep changes surgical and concise to save tokens and minimize bugs.
- **Reporting**: Always state at the end what was skipped/deferred and any residual risk.

### 2. OmniRoute (Provider & Model Fallback)
- When primary quota/tokens are exhausted, fall back seamlessly to free/lightweight models or subagents (`flash_lite` / `flash` or configured free routing providers).

### 3. Graphify (Codebase Knowledge Graph)
- Maintain and consult the project knowledge map (`graphify-out/` or index) to query architecture, relations, and symbols without reading every file from scratch every time.
- Automatically update the graph (`python -m graphify update .` or `--force` on deletion) whenever new pages/features are added or major refactoring occurs.

### 4. Agent Skills (Engineering Best Practices)
- Apply professional engineering standards: clean architecture, frontend/backend design patterns, domain modeling, and strict lint/type compliance.

### 5. Karpathy Skills (The 4 Golden Rules)
1. **Think Before Coding**: Never guess or assume. Surface tradeoffs and ask when uncertain.
2. **Simplicity First**: Minimum viable code. No abstractions for single-use logic.
3. **Surgical Changes**: Touch only what you must. Do not touch or reformat unrelated files/code.
4. **Goal-Driven Execution**: Define verifiable success criteria. Loop and verify before declaring completion.

### 6. ECC (Explore → Plan → Execute → Check / Self-Verify)
- Plan clearly before coding.
- Test and verify work independently (build, syntax, run tests or self-check) before handing off to the user.

### 7. Matt Pocock Skills (Ask Before Doing)
- Always ask and clarify with the user before committing to non-trivial changes or assumptions.
- Present concrete options and tradeoffs so the user can make informed decisions.

### 8. MCP for Review
- Utilize available MCP tools (such as `chrome-devtools` for UI inspection, console error tracking, and visual review) and code review workflows to audit code before finalizing.

### 9. Skill Routing Matrix (Fast-Path Intent Dispatcher)
เมื่อได้รับคำสั่งจากผู้ใช้ ให้จับคู่ Intent และดึง Skill/Tool เฉพาะทางมาใช้ทันทีเพื่อความแม่นยำและประหยัด Token สูงสุด:

| รูปแบบคำสั่ง / เจตนาของงาน (User Intent / Task Pattern) | Skill หลักที่ต้องดึงมาใช้ทันที (Core Skills) | เครื่องมือบังคับตรวจ (Mandatory Verification Tool) |
| :--- | :--- | :--- |
| **หน้าตา / UI / Styling / CSS / Responsive / สี / สัดส่วน** | `impeccable` + `modern-web-guidance` | `chrome-devtools` (เทสจอจริง Mobile, Tablet, PC) |
| **แก้บั๊ก / Freeze / ค้าง / Error / ช้า / หลุด / ไม่ขึ้น** | `diagnosing-bugs` + `ponytail` (แก้น้อยที่สุด) | ตรวจ Console Logs + Clean Build |
| **ฟีเจอร์ใหม่ / วางระบบ / Refactor / Major Flow Change** | `make-plan` / `to-spec` + `karpathy-guidelines` | ร่าง Interactive Plan (`/plan`) ให้ตรวจก่อนทำ |
| **ความถูกต้องของตรรกะ / คำนวณเงิน / Data & Financial Flow** | `tdd-workflow` + `security-review` | Precision verification & boundary test |
| **ตรวจงานก่อนส่งมอบ / Pre-delivery Review** | `verification-loop` + `code-review` | `npm run build` + `git diff` audit |
| **จำงาน / บันทึกประวัติ / พัฒนา Workflow ซ้ำๆ** | `task-observer` + Native Memory | อัปเดต `.agents/memory/SESSION_LOG.md` |

### 10. Native Memory & Session Continuity
- ปรึกษาและอ่าน [`.agents/memory/SESSION_LOG.md`](file:///D:/WebappDreame/Flower2U/.agents/memory/SESSION_LOG.md) เสมอเพื่อดูประวัติการตัดสินใจ ข้อตกลง และสถานะล่าสุดของโปรเจกต์
- เมื่อจบงานสำคัญหรือมีการตัดสินใจสถาปัตยกรรมใหม่ ให้อัปเดตสรุปความคืบหน้าลงใน `.agents/memory/SESSION_LOG.md` เพื่อส่งต่อบริบทข้าม Session โดยไม่ต้องอธิบายใหม่

### 11. Strict Custom UI Directive (Banned Native Browser Dialogs & Date Pickers)
- **เด็ดขาด ห้ามใช้ Native Dialogs ของเบราว์เซอร์**: ห้ามใช้ `window.alert()`, `window.confirm()`, `window.prompt()` และห้ามใช้ `<input type="date">` หรือ `<input type="datetime-local">` เป็นอันขาด
- **ปฏิทินเลือกวัน/เวลา**: ต้องใช้ `<ModernDateTimePicker />` (`src/components/common/ModernDateTimePicker.jsx`) ซึ่งรองรับทั้ง พ.ศ., เลือกเฉพาะวันที่ (`hasTime={false}`), เลือกวันเวลา, สัปดาห์, เดือน, ปี
- **การแจ้งเตือนสเตตัส (Notification/Toast)**: ใช้ `<Toast />` (`src/components/common/Toast.jsx`) สำหรับแจ้งสำเร็จ/เตือน/ข้อผิดพลาด
- **กล่องยืนยันการทำรายการ (Confirmation Modal)**: ใช้ `<ConfirmDialog />` (`src/components/common/ConfirmDialog.jsx`) หรือ Custom Modal ที่มี Backdrop Blur และแอนิเมชันให้เป็นธีมเดียวกับทั้งระบบ

---

### 12. กฎเหล็ก 4 ข้อ (Strict 4-Rule Protocol)
1. **กฎสำหรับการรีวิวเพื่อปรับปรุง (Refine Rule)**: หลังจบงานทุกครั้ง ให้สรุปสิ่งที่เพิ่งทำร่วมกัน และวิเคราะห์ว่ามีประเด็นไหนที่ต้องปรับปรุง หรือมีอะไรที่ควรกลายเป็น 'กฎประจำตัว' เพื่อให้ครั้งหน้าทำงานได้แม่นยำขึ้นโดยไม่ต้องให้สอนซ้ำ
2. **กฎสำหรับการสร้างโหมดส่วนตัว (Automate Rule)**: อ่านประวัติงานที่ผ่านมาเพื่อทำความเข้าใจสไตล์การทำงาน น้ำเสียง และขั้นตอนที่ชอบ จากนั้นเขียนคำสั่ง (Prompt) ที่สรุปวิธีทำงานในสไตล์ของฉันไว้เป็นโหมดพิเศษ สำหรับใช้เรียกใช้งานในอนาคต
3. **กฎสำหรับการปรับสำนวนภาษา (Language Rule)**: ก่อนส่งงานทุกครั้ง ให้ตรวจสอบข้อความที่เขียน หากพบคำหรือรูปแบบประโยคที่ดูเหมือน AI เขียน (เช่น คำฟุ่มเฟือยเกินไป หรือขาดความเป็นธรรมชาติ) ให้ปรับแก้ให้กระชับและมีความเป็นมนุษย์เหมือนพูดคุยกับเพื่อนร่วมงาน
4. **กฎสำหรับการตรวจสอบงาน (Verification Rule)**: ห้ามส่งงานทันทีหลังจากทำเสร็จ ให้ตรวจสอบผลลัพธ์ด้วยการจำลองการใช้งานจริง (หรือทดสอบตามขั้นตอนที่ระบุ) และเขียนรายงานสั้นๆ ว่าได้ทดสอบส่วนไหนบ้าง และผลการตรวจสอบผ่านเกณฑ์ที่ตั้งไว้หรือไม่

---

### 13. Multi-Agent Orchestration Policy (Gemini 4 Only — No Gemini 3)
- **ห้ามใช้ Gemini 3 เด็ดขาด**:
  - ใน `invoke_subagent` ห้ามส่ง `Model: "flash"` (ซึ่งแมปไป Gemini 3.8 Flash) หรือ `Model: "pro"` (ซึ่งแมปไป Gemini 3.1 Pro) หรือ `Model: "flash_lite"` เป็นอันขาด เพราะ Gemini 3 เปลือง Token และมักแก้เกินคำสั่ง
  - **ต้องใช้ `Model: "inherit"` เสมอ** เมื่อเรียกผ่าน `invoke_subagent` เพื่อให้ Subagent รันบน **Gemini 4** เหมือนตัวหลัก
- **บทบาทหัวหน้างาน (Lead Orchestrator)**:
  - เมื่อได้รับงานที่มีตั้งแต่ 2 งานย่อยหรือกระทบตั้งแต่ 2 ไฟล์ขึ้นไป ให้วิเคราะห์โจทย์ แตกงานเป็นส่วนย่อยที่ไม่แก้ไขไฟล์ชนกัน แล้วกระจายงานให้ Subagents รันพร้อมกันแบบขนานอัตโนมัติ (ผ่าน `invoke_subagent` ด้วย `Model: "inherit"` หรือ `run_workflow` หรือ `agy` CLI)
  - เมื่อลูกทีมทำงานเสร็จ หัวหน้างานต้องตรวจทานโค้ด (`git diff`), รันชุดทดสอบ (`npm test`, `npm run build`), และตรวจสอบหน้าจอจริงก่อนส่งมอบทุกครั้ง
- **การเลือกโมเดลและระดับความลึกแยกรายตัวผ่าน CLI (`agy --model <id> --mode auto -p "..."`)**:
  - **Hydrogen (`gemini-4-hydrogen-low` / `gemini-4-hydrogen-medium`)**: งานเบา/เร็ว ขอบเขตชัด อ่าน/สรุปโค้ด ค้นหาไฟล์ แก้จุดเล็ก/ข้อความ หรือเขียนเทสย่อย
  - **Neon (`gemini-4-neon-medium` / `gemini-4-neon-high`)**: เหนือกว่า Hydrogen เหมาะกับงาน UX/UI จัดสไตล์ งานพัฒนาทั่วไปหลายไฟล์ สร้าง Component/หน้าใหม่ แก้บั๊กทั่วไป หรือ Refactor เฉพาะโมดูล (ใช้ `gemini-4-neon-xhigh` เมื่อต้องวิเคราะห์ลึกเป็นพิเศษ)
  - **Carbon (`gemini-4-carbon-medium` / `gemini-4-carbon-high`)**: งานซับซ้อน/เสี่ยงสูง ตรรกะระบบ ฐานข้อมูล/SQL คำนวณเงิน Race Condition ดีบั๊กยาก หรือ Code Review ทั้งระบบ

---

### 14. Strict Clean Production UI (Zero Developer / SQL / Technical Notices in App)
- **เด็ดขาด ห้ามแสดงข้อความแจ้งเตือนเชิงเทคนิคหรือคำสั่งสำหรับนักพัฒนาบนหน้าเว็บ/แอปหรือใน Toast**: เช่น `"กรุณารันสคริปต์ .sql บน Supabase"`, `"โหมดสำรองในเครื่อง"`, `"Zero-Egress"`, ชื่อไฟล์โค้ด/ตาราง DB หรือคำแนะนำทางเทคนิคที่ไม่เกี่ยวข้องกับผู้ใช้งานทั่วไป
- หากมีขั้นตอนที่เจ้าของระบบต้องรัน SQL หรือตั้งค่า Infrastructure ให้แจ้งเฉพาะใน **ข้อความสรุปส่งงานในแชต** เท่านั้น ห้ามฝังป้ายเตือนลงในหน้าจอแอปเด็ดขาด



