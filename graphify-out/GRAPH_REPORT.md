# Graph Report - Flower2U  (2026-11-10)

## Corpus Check
- 86 files · ~179,710 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .css 2, .example 1, (none) 1)

## Summary
- 543 nodes · 1232 edges · 27 communities (21 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `53f6835a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- syncService.js
- Finance.jsx
- Settings.jsx
- App.jsx
- devDependencies
- Active Skills & Engineering Directives
- 4. กลไกอัตโนมัติข้ามระบบ (Automated Cross-Module Pipelines)
- 3. ประวัติการทำงานและข้อตกลงล่าสุด (Session History)
- index.js
- vercel.json
- Staff.jsx
- แผนพัฒนา: ระบบหน้าการเงินและตารางบันทึกกำไรขาดทุน (Flower2U)
- Web Automation & Testing (E2E & System Integrity)
- seed_mock_data.cjs
- 📊 แผนพัฒนาระบบวิเคราะห์ข้อมูลและธุรกิจ (Business & Data Analytics Roadmap)
- test_backend_api_suite.cjs
- audit_database_and_api.cjs
- migrate_sheets_to_supabase.cjs
- monitor_backend_health.cjs
- sync_auth_users.cjs
- ref_fs
- @supabase/supabase-js

## God Nodes (most connected - your core abstractions)
1. `getActiveClient()` - 64 edges
2. `App()` - 61 edges
3. `react` - 36 edges
4. `lucide-react` - 32 edges
5. `3. ประวัติการทำงานและข้อตกลงล่าสุด (Session History)` - 25 edges
6. `Toast()` - 23 edges
7. `processImageUrl()` - 18 edges
8. `Inventory()` - 17 edges
9. `ModernDateTimePicker()` - 16 edges
10. `[2026-11-05 - อัปเกรดระบบสิทธิ์ Roles & Permissions, แยกหมวดหมู่หน้า Settings, ปรับแต่งรหัสผ่าน และ Profile Popup สไตล์ Facebook]` - 16 edges

## Surprising Connections (you probably didn't know these)
- `1. วิเคราะห์โครงสร้างข้อมูลเดิม (Google Sheets Legacy Analysis)` --references--> `Settings()`  [INFERRED]
  F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md → src/Settings.jsx
- `[2026-11-06 - กะค่ำ (Global Real-time Theme Synchronization & Icon Fix)]` --references--> `StoreIcon()`  [INFERRED]
  .agents/memory/SESSION_LOG.md → src/components/icons/SocialIcons.jsx
- `[2026-11-06 - กะค่ำ (Toast Text Cleanup & Multi-Window/Cross-Device Realtime Theme Sync)]` --references--> `subscribeToRealtimeSettings()`  [INFERRED]
  .agents/memory/SESSION_LOG.md → src/services/syncService.js
- `[2026-11-05 - กะเช้า/บ่าย]` --references--> `formatDate()`  [INFERRED]
  .agents/memory/SESSION_LOG.md → src/utils/formatters.jsx
- `[2026-11-10 - รอบดึก (Missing Numbers Bug Fix, Filter Clean-up & Mobile Multi-Item Card UX Overhaul)]` --references--> `App()`  [INFERRED]
  .agents/memory/SESSION_LOG.md → src/App.jsx

## Import Cycles
- None detected.

## Communities (27 total, 6 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.05
Nodes (38): [2026-11-10 - รอบดึก (Missing Numbers Bug Fix, Filter Clean-up & Mobile Multi-Item Card UX Overhaul)], dependencies, dexie, @hookform/resolvers, leaflet, lucide-react, react, react-dom (+30 more)

### Community 1 - "syncService.js"
Cohesion: 0.06
Nodes (91): [2026-11-04], [2026-11-04 - การขยายระบบเต็มรูปแบบ & Zero-Egress Architecture Execution], [2026-11-05 - อัปเกรดระบบสิทธิ์ Roles & Permissions, แยกหมวดหมู่หน้า Settings, ปรับแต่งรหัสผ่าน และ Profile Popup สไตล์ Facebook], App(), getTabFromUrl(), useStickyFilter(), Inventory(), Plans() (+83 more)

### Community 2 - "Finance.jsx"
Cohesion: 0.21
Nodes (16): Artists(), compressImage(), fileToBase64(), ConfirmDialog(), DateFilterControl(), ModernDateTimePicker(), escapeHtml(), Finance() (+8 more)

### Community 3 - "Settings.jsx"
Cohesion: 0.11
Nodes (25): leaflet, react-hook-form, Toast(), VenueDetailModal(), Customers(), calculateDistanceKm(), DEFAULT_FLOWER2U_HUB, getVenueCoordinate() (+17 more)

### Community 4 - "App.jsx"
Cohesion: 0.09
Nodes (44): [2026-11-06 - กะค่ำ (Quotation Alignment, Comma Formatting, Theme Engine 120 FPS & Cross-Tab/All-Page Realtime Sync)], lucide-react, react, react-dom, Analytics(), DonutChart(), getBasePath(), navItems (+36 more)

### Community 5 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, gh-pages, globals (+7 more)

### Community 6 - "Active Skills & Engineering Directives"
Cohesion: 0.05
Nodes (41): 10. Native Memory & Session Continuity, 11. Strict Custom UI Directive (Banned Native Browser Dialogs & Date Pickers), 1. Ponytail (Lazy Senior Dev Mode), 2. OmniRoute (Provider & Model Fallback), 3. Graphify (Codebase Knowledge Graph), 4. Agent Skills (Engineering Best Practices), 5. Karpathy Skills (The 4 Golden Rules), 6. ECC (Explore → Plan → Execute → Check / Self-Verify) (+33 more)

### Community 7 - "4. กลไกอัตโนมัติข้ามระบบ (Automated Cross-Module Pipelines)"
Cohesion: 0.07
Nodes (28): 1. วิเคราะห์โครงสร้างข้อมูลเดิม (Google Sheets Legacy Analysis), 2. แผนผังความสัมพันธ์เอนทิตี (Unified Entity-Relationship Diagram), 3. ตารางฐานข้อมูล 8 โดเมนหลัก (8 Core Database Domains), 4.10 ทำไมการแยกคอลัมน์และตารางลูกจึงช่วยประหยัด Egress สู่จุดขีดสุด (Maximum Zero-Egress Proof), 4.1 ท่อส่งข้อมูล: บันทึกรายจ่าย ➔ ดันเข้าคลังสินค้าอัตโนมัติ (Expense-to-Inventory Flow), 4.2 ระบบควบคุมอุปกรณ์ยืม-คืน & วัสดุสิ้นเปลือง (Tool Lending & Consumables Engine), 4.3 วงจรนำวัสดุกลับมาใช้ซ้ำ (Reusable Materials & Salvage Cycle: ดอกไม้พลาสติก), 4.4 ระบบอัจฉริยะประวัติการจัดซื้อและแจ้งเตือนคู่ค้า (Vendor Intelligence & Defect Shield) (+20 more)

### Community 8 - "3. ประวัติการทำงานและข้อตกลงล่าสุด (Session History)"
Cohesion: 0.07
Nodes (28): 1. ข้อมูลสถาปัตยกรรมโปรเจกต์ (Project Snapshot), [2026-10-21], [2026-10-22], [2026-11-05 - กะดึก], [2026-11-05 - กะบ่าย/เย็น (Table Black Line Glitch Elimination & Financial Ledger Overhaul)], [2026-11-05 - กะเช้า/บ่าย], [2026-11-05 - ยกระดับ UX/UI Modal ทุกหน้าให้เป็นดีไซน์เดียวกับหน้าแผนงาน (Unified Modal Design System)], [2026-11-06 - กะค่ำ (Brand Logo Dynamic Theme Sync)] (+20 more)

### Community 9 - "index.js"
Cohesion: 0.13
Nodes (18): zod, artistFormSchema, artistPayloadSchema, customerFormSchema, customerPayloadSchema, inventoryItemFormSchema, inventoryItemPayloadSchema, locationFormSchema (+10 more)

### Community 13 - "Staff.jsx"
Cohesion: 0.18
Nodes (13): dexie, PRESETS, SuspendStaffModal(), UserProfileModal(), clearAllLocalDatabase(), db, deleteStaffSync(), loadStaffLocalFirst() (+5 more)

### Community 15 - "แผนพัฒนา: ระบบหน้าการเงินและตารางบันทึกกำไรขาดทุน (Flower2U)"
Cohesion: 0.10
Nodes (19): 1. ภาพรวมความต้องการ (Requirements Overview), 2. โครงสร้างตาราง "บันทึกข้อมูลกำไรขาดทุน" (Print A4 Formatter), 3. การเพิ่มช่องใส่วันที่ในระดับรายการย่อย (Item Date Tracking), 4. ระบบ Mobile Navigation แบบลากขึ้น (Pull-up Bottom Sheet), 5. การเพิ่มฟิลด์สถานะการเงิน (Payment Status Field), 6. ฟังก์ชันเพิ่มเติมที่ได้รับการอนุมัติ (Enhanced Features), 7. แผนการดำเนินงานและสถาปัตยกรรมโค้ด (Roadmap & Implementation Steps), 8. คำแนะนำเชิงรุกด้านการซิงค์ข้อมูล (Data Sync Guidance) (+11 more)

### Community 16 - "Web Automation & Testing (E2E & System Integrity)"
Cohesion: 0.14
Nodes (13): 1.1 In-Session Browser Automation (Chrome DevTools MCP), 1.2 Programmatic Test Scripts, 1. Automated Testing Architecture & Tools, 2.1 Perceived Performance & Visual Continuity, 2.2 Responsive Layouts & Touch Targets, 2.3 Strict UI Policy, 2. UI/UX Heuristic Audit Standards, 3.1 Local-First Database (IndexedDB / Dexie) (+5 more)

### Community 17 - "seed_mock_data.cjs"
Cohesion: 0.14
Nodes (12): countArg, { createClient }, env, envPath, fs, isDryRun, MOCK_ARTISTS, MOCK_CATEGORIES (+4 more)

### Community 18 - "📊 แผนพัฒนาระบบวิเคราะห์ข้อมูลและธุรกิจ (Business & Data Analytics Roadmap)"
Cohesion: 0.14
Nodes (13): 🎯 1. บทนำและวิสัยทัศน์ (Executive Summary), 🗄️ 2. คลังข้อมูลปัจจุบันที่มีอยู่ในระบบ (Current Data Inventory), 🧭 3. เสาหลัก 5 มิติการวิเคราะห์เชิงลึก (5 Analytical Dimensions), 🚨 4. ระบบตรวจจับและแจ้งเตือนความเสี่ยง (Early Warning Radar), 🗺️ 5. แผนการพัฒนาตามลำดับความสำคัญ (Phased Implementation Roadmap), 📌 6. สรุปคำแนะนำสำหรับการตัดสินใจ (Recommendation), มิติที่ 1: การเงิน & กำไรที่แท้จริง (Financial & True Profitability), มิติที่ 2: วงจรแฟนด้อม & วันสำคัญของศิลปิน (Fandom & Event Seasonality) (+5 more)

### Community 19 - "test_backend_api_suite.cjs"
Cohesion: 0.20
Nodes (8): anonClient, { createClient }, env, envPath, fs, path, runTestSuite(), serviceClient

### Community 20 - "audit_database_and_api.cjs"
Cohesion: 0.22
Nodes (7): anonClient, { createClient }, env, envPath, fs, path, serviceClient

### Community 21 - "migrate_sheets_to_supabase.cjs"
Cohesion: 0.22
Nodes (7): client, { createClient }, envPath, fs, KNOWN_VENUES, migrate(), path

### Community 22 - "monitor_backend_health.cjs"
Cohesion: 0.22
Nodes (7): anonClient, { createClient }, env, envPath, fs, path, serviceClient

### Community 23 - "sync_auth_users.cjs"
Cohesion: 0.25
Nodes (5): client, { createClient }, envPath, fs, path

### Community 24 - "ref_fs"
Cohesion: 0.33
Nodes (3): envPath, fs, path

## Knowledge Gaps
- **7 isolated node(s):** `@tailwindcss/postcss`, `@types/react`, `@types/react-dom`, `autoprefixer`, `gh-pages` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 253 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `@supabase/supabase-js` to `package.json`, `seed_mock_data.cjs`, `test_backend_api_suite.cjs`, `audit_database_and_api.cjs`, `migrate_sheets_to_supabase.cjs`, `monitor_backend_health.cjs`, `sync_auth_users.cjs`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **What connects `@tailwindcss/postcss`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.054878048780487805 - nodes in this community are weakly interconnected._
- **Why does `BatchDeliveryBanner()` connect `Active Skills & Engineering Directives` to `syncService.js`, `App.jsx`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Should `syncService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05635964912280702 - nodes in this community are weakly interconnected._
- **Why does `พิมพ์เขียวโครงสร้างฐานข้อมูล Supabase และแผนพัฒนาระบบในอนาคต` connect `4. กลไกอัตโนมัติข้ามระบบ (Automated Cross-Module Pipelines)` to `Active Skills & Engineering Directives`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Should `Settings.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11083743842364532 - nodes in this community are weakly interconnected._