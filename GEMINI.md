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

