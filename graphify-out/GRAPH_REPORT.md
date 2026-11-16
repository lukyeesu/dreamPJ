# Graph Report - Flower2U  (2026-11-16)

## Corpus Check
- 178 files · ~497,263 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .part 3, (none) 2, .css 2)

## Summary
- 1394 nodes · 2881 edges · 81 communities (73 shown, 8 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 155 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ebcf47ed`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- syncService.js
- Staff.jsx
- ref_node_assert
- App.jsx
- devDependencies
- Active Skills & Engineering Directives
- Settings.jsx
- 3. ประวัติการทำงานและข้อตกลงล่าสุด (Session History)
- index.js
- vercel.json
- productionService.js
- Inventory.jsx
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
- qrLabels.js
- syncService.test.cjs
- inventoryCompactInstaller.test.cjs
- inventoryCompactRuntime.test.cjs
- Compact Inventory Schema & Lossless Migration Specification (v2)
- 4. `warehouse_dispatch` Business Actions Catalog
- ref_node_path
- 5. Production Assignment Lifecycle RPCs
- 2.1 Table Definitions
- productionUiSafety.test.cjs
- processImageUrl
- inventory-redesign.md
- inventoryComponents.test.cjs
- pageNavigation.test.cjs
- qrLabelPrint.test.cjs
- dependencies
- inventoryWorkflow.test.cjs
- ShopFooter.jsx
- react
- qrScanner.test.cjs
- 4.6 Cash Operations (Strict RBAC)
- themeManager.js
- inventoryFullPreview.test.cjs
- [2026-11-05 - อัปเกรดระบบสิทธิ์ Roles & Permissions, แยกหมวดหมู่หน้า Settings, ปรับแต่งรหัสผ่าน และ Profile Popup สไตล์ Facebook]
- Independent Browser QA Report: Plan C Responsive Inventory Components
- inventory-offline-data.js
- inventoryUi.test.cjs
- Inventory Plan C — Backend Architecture & UI API Handoff
- HeaderFilterPortal
- Quotations.jsx
- Flower2you Inventory: Compact Architecture Review
- Compact inventory contract — approved implementation direction
- 4. Frontend Service API (`src/services/warehouseService.js`)
- 4.5 Item Metadata & Categories CRUD
- หน้ากลางงานผลิตและการตรวจรับตามโปรเจกต์
- 4. ข้อตกลงและกฎเหล็กประจำตัว (Non-Negotiable Directives)
- Product
- 2. โครงสร้างและลำดับข้อมูลที่ตกลงล่าสุด (Agreed Data Flow & Order)
- 4. กลไกอัตโนมัติข้ามระบบ (Automated Cross-Module Pipelines)
- scripts
- รูปสินค้า ฉลาก และการเลื่อนโหลดรายการ — 2026-11-13
- 4.1 Summary & Projection Loaders
- 4.4 Tool Custody, Returns & Handovers
- 3. Security, Roles & Server Verification
- คลังสินค้า Flower2you
- inventory-offline-db.js
- ref_node_path
- 🌸 Flower2U - Master System Architecture & Agent Onboarding Roadmap
- financeInventoryBridge.js
- db.js
- README.md
- 6. กฎเหล็กและข้อห้ามเด็ดขาดสำหรับ Agent
- inventory-offline.config.js

## God Nodes (most connected - your core abstractions)
1. `getActiveClient()` - 83 edges
2. `react` - 73 edges
3. `App()` - 68 edges
4. `Inventory()` - 65 edges
5. `lucide-react` - 54 edges
6. `Toast()` - 43 edges
7. `3. ประวัติการทำงานและข้อตกลงล่าสุด (Session History)` - 36 edges
8. `dispatchWarehouseCommand()` - 31 edges
9. `react-dom` - 25 edges
10. `useWarehouseCommandKey()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `1. วิเคราะห์โครงสร้างข้อมูลเดิม (Google Sheets Legacy Analysis)` --references--> `Settings()`  [INFERRED]
  F2U_DATABASE_SCHEMA_AND_EXPANSION_PLAN.md → src/Settings.jsx
- `🚀 จุดเด่นของระบบ (Key Features)` --references--> `BatchDeliveryBanner()`  [INFERRED]
  README.md → src/components/common/BatchDeliveryBanner.jsx
- `5. สารบัญโมดูลระบบ 11 วิวหลัก` --references--> `BatchDeliveryBanner()`  [INFERRED]
  ROADMAP.md → src/components/common/BatchDeliveryBanner.jsx
- `5.4 Backend Review Corrections & Hardened Invariants (Supervisor Audit Fixes)` --references--> `inspectProductionCash()`  [INFERRED]
  docs/inventory-production-hub-backend.md → src/services/productionService.js
- `🛠️ การติดตั้งและรันระบบ (Quickstart)` --references--> `saveProjectSync()`  [INFERRED]
  README.md → src/services/syncService.js

## Import Cycles
- None detected.

## Communities (81 total, 8 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.11
Nodes (20): homepage, name, private, type, version, autoprefixer, eslint, @eslint/js (+12 more)

### Community 1 - "syncService.js"
Cohesion: 0.05
Nodes (40): [2026-11-04 - การขยายระบบเต็มรูปแบบ & Zero-Egress Architecture Execution], ARTIST_COLUMNS, ASSET_LOAN_COLUMNS, ASSET_UNIT_COLUMNS, cacheProjectRows(), CHECKLIST_ITEM_COLUMNS, CUSTOMER_COLUMNS, DEFAULT_ASSET_UNITS (+32 more)

### Community 2 - "Staff.jsx"
Cohesion: 0.16
Nodes (19): 2026-11-15 (Evening) — Global AppBar Vertical Padding & Height Upgrade Across All 11 Pages + Inventory AppBar & QR Studio Redesign, @hookform/resolvers, leaflet, react-hook-form, PRESETS, SuspendStaffModal(), Customers(), useStickyFilter() (+11 more)

### Community 3 - "ref_node_assert"
Cohesion: 0.20
Nodes (7): @zxing/library, assert, { RGBLuminanceSource, HybridBinarizer, BinaryBitmap, MultiFormatReader, BarcodeFormat, DecodeHintType }, test, assert, {
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
  QRCodeReader
}, test

### Community 4 - "App.jsx"
Cohesion: 0.10
Nodes (35): App(), getBasePath(), getTabFromUrl(), navItems, ROUTE_TO_TAB, TAB_ROUTES, updateUrlForTab(), BatchDeliveryBanner() (+27 more)

### Community 5 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, autoprefixer, @electric-sql/pglite, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, gh-pages (+11 more)

### Community 6 - "Active Skills & Engineering Directives"
Cohesion: 0.15
Nodes (13): 10. Native Memory & Session Continuity, 11. Strict Custom UI Directive (Banned Native Browser Dialogs & Date Pickers), 12. กฎเหล็ก 4 ข้อ (Strict 4-Rule Protocol), 1. Ponytail (Lazy Senior Dev Mode), 2. OmniRoute (Provider & Model Fallback), 3. Graphify (Codebase Knowledge Graph), 4. Agent Skills (Engineering Best Practices), 5. Karpathy Skills (The 4 Golden Rules) (+5 more)

### Community 7 - "Settings.jsx"
Cohesion: 0.16
Nodes (16): DEFAULT_FLOWER2U_HUB, broadcastPermissionsUpdated(), ACTION_PERMISSIONS, colorPresets, DEFAULT_PERMISSION_MATRIX, defaultThemeColors, LineIcon(), ListManager() (+8 more)

### Community 8 - "3. ประวัติการทำงานและข้อตกลงล่าสุด (Session History)"
Cohesion: 0.06
Nodes (32): [2026-10-21], [2026-10-22], [2026-11-05 - กะดึก], [2026-11-05 - กะบ่าย/เย็น (Table Black Line Glitch Elimination & Financial Ledger Overhaul)], [2026-11-05 - กะเช้า/บ่าย], [2026-11-05 - ยกระดับ UX/UI Modal ทุกหน้าให้เป็นดีไซน์เดียวกับหน้าแผนงาน (Unified Modal Design System)], [2026-11-06 - กะค่ำ (Brand Logo Dynamic Theme Sync)], [2026-11-06 - กะค่ำ (Brand Logo & Settings Reversion to Original)] (+24 more)

### Community 9 - "index.js"
Cohesion: 0.13
Nodes (18): zod, artistFormSchema, artistPayloadSchema, customerFormSchema, customerPayloadSchema, inventoryItemFormSchema, inventoryItemPayloadSchema, locationFormSchema (+10 more)

### Community 13 - "productionService.js"
Cohesion: 0.22
Nodes (23): activeProductionSubscriptions, createProductionAssignment(), createProductionIssue(), generateIdempotencyKey(), inspectProductionCash(), inspectProductionWork(), listWarehousePeople(), loadProductionProject() (+15 more)

### Community 14 - "Inventory.jsx"
Cohesion: 0.07
Nodes (76): [2026-11-10 - ปรับปรุงความถูกต้องและความสมบูรณ์ UI คลังสินค้า Plan C (Plan C UI Hardening & Bug Fixes)], [2026-11-10 - ปรับปรุงและส่งมอบระบบหลังบ้านคลังสินค้า Plan C (Plan C Backend Hardening, Operations Read RPC & Lifecycle Guarantees)], 2026-11-15 — Game-Style Inventory Backpack, 1-Modal Hub, Shopping-Cart Staged Bags & Seamless Finance ↔ Inventory Sync, 5. Client Lifecycle, Auth & Deduplication, 7.2 Service Lifecycle Suite (`tests/warehouseService.test.cjs`), `onWarehouseAuthSessionChange(callback)` & `initWarehouseAuthListener()`, `resetWarehouseAuthSession()`, 2. ขอบเขตกรรมสิทธิ์ไฟล์ (File Ownership & Responsibilities) (+68 more)

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

### Community 28 - "qrLabels.js"
Cohesion: 0.06
Nodes (54): 1. ขอบเขตกรรมสิทธิ์ไฟล์ (File Ownership), 2. รูปแบบ Payload มาตรฐาน (QR Data Format), 3.1 `QrScanner`, 3.2 `QrLabelPrint`, 3. การเชื่อมต่อกับ `src/Inventory.jsx`, 4. สถานะการตรวจสอบความถูกต้อง (Verification Status), Props:, Props: (+46 more)

### Community 29 - "syncService.test.cjs"
Cohesion: 0.05
Nodes (30): [2026-11-10 - รอบดึก (Missing Numbers Bug Fix, Filter Clean-up & Mobile Multi-Item Card UX Overhaul)], 1. Executive Summary & Egress Budget, 2. Top 5 Ranked Findings & Concrete Zero-Cost Fixes, 3. Network Egress Scenario Comparison, 4. Architectural Target Spec (No Paid Infra / No Cache Tables), Finding 1: Unconditional App Boot Preload Duplication, Finding 2: Unbounded Monolithic Summary RPC Over-fetching, Finding 3: Realtime Stampede: Full Board Refetch on Single Task Event (+22 more)

### Community 30 - "inventoryCompactInstaller.test.cjs"
Cohesion: 0.06
Nodes (35): @electric-sql/pglite, { createProductionPgHarness, setAuthUser, ADMIN_AUTH_ID, TECH_AUTH_ID }, fs, path, runCompactMigration(), seedRealisticLegacyData(), createProductionPgHarness(), fs (+27 more)

### Community 31 - "inventoryCompactRuntime.test.cjs"
Cohesion: 0.09
Nodes (18): assembleCompact(), compactSql(), createCompactFixture(), fs, itemId(), legacy, path, { randomUUID } (+10 more)

### Community 32 - "Compact Inventory Schema & Lossless Migration Specification (v2)"
Cohesion: 0.05
Nodes (36): 1. Executive Summary & Design Constraints, 2. The 8 Canonical Inventory Tables, 3. Mapping of the 22 Retired Tables, 4. Verification Assertions Executed Prior to Dropping Tables, 5. Assembly & Execution Lifecycle, Automated Test Suite (`tests/inventoryCompactMigration.test.cjs`), Compact Inventory Schema & Lossless Migration Specification (v2), Installation (+28 more)

### Community 33 - "4. `warehouse_dispatch` Business Actions Catalog"
Cohesion: 0.06
Nodes (35): 1. Executive Summary & Architecture Overview, 2.1 Role-Based Permissions, 2.2 Anti-Escalation Triggers, 2.3 Row Level Security (RLS) & Cash Boundary, 2. Security, Anti-Escalation & Cash Isolation, 3.1 `warehouse_command_lookup`, 3.2 `warehouse_command_finish`, 3. Shared Request Helpers (+27 more)

### Community 34 - "ref_node_path"
Cohesion: 0.08
Nodes (17): assert, fs, path, root, { test }, vm, assert, fs (+9 more)

### Community 35 - "5. Production Assignment Lifecycle RPCs"
Cohesion: 0.08
Nodes (24): 1.1 The 8 Physical Tables Foundation, 1.2 Build Piece Guard, 1. Architectural Principles & Storage Contracts, 2.1 `warehouse_list_people(p_query TEXT DEFAULT '', p_limit INT DEFAULT 20) RETURNS JSONB`, 2.2 `warehouse_resolve_person(p_person_key TEXT) RETURNS JSONB`, 2. People Registry RPCs, 3.1 `warehouse_ensure_production_work(p_issue_document_id UUID) RETURNS UUID`, 3.2 `warehouse_sync_cash_work(p_batch_document_id UUID) RETURNS VOID` (+16 more)

### Community 36 - "2.1 Table Definitions"
Cohesion: 0.08
Nodes (23): 1. Overview & Architectural Principles, 2.1 Table Definitions, 2.2 People Registry Enhancements, 2. Database Schema (`database_scripts/inventory_production_hub.sql`), 3. Seamless Inventory & Cash Integration, 4.1 People Pickers & Resolution, 4.2 Project Production Board Loader, 4.3 Issue Creation with Production Work (+15 more)

### Community 37 - "productionUiSafety.test.cjs"
Cohesion: 0.07
Nodes (28): jsdom, @testing-library/react, componentCache, dom, esbuild, { JSDOM }, loadProductionComponent(), path (+20 more)

### Community 38 - "processImageUrl"
Cohesion: 0.32
Nodes (12): [2026-11-04], LoginScreen(), ImageViewer(), CustomerQuotationView(), CustomerTrackingView(), SharePreviewModal(), loadProjectsLocalFirst(), arabicNumberToText() (+4 more)

### Community 39 - "inventory-redesign.md"
Cohesion: 0.11
Nodes (17): การใช้ QR และมือถือ, ของหายและความรับผิดชอบ, คำแนะนำจากขั้นตอนงานจริง, งานในโกดังกับรอบออกงาน, จ่ายธนบัตรให้ผู้ช่วยพับหรือใส่ซอง, ประเด็นที่ยังรอคำตอบ, ผลลัพธ์ที่ต้องได้, ยืมรายบุคคลและรายทีม (+9 more)

### Community 40 - "inventoryComponents.test.cjs"
Cohesion: 0.11
Nodes (13): assert, dom, esbuild, { JSDOM }, path, React, { render, fireEvent, act }, test (+5 more)

### Community 41 - "pageNavigation.test.cjs"
Cohesion: 0.13
Nodes (10): assert, dom, esbuild, fs, { JSDOM }, { parse }, path, React (+2 more)

### Community 42 - "qrLabelPrint.test.cjs"
Cohesion: 0.14
Nodes (14): assert, dom, esbuild, flush(), items, { JSDOM }, mod, output (+6 more)

### Community 43 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, dexie, @hookform/resolvers, jsbarcode, leaflet, lucide-react, qrcode, react (+6 more)

### Community 44 - "inventoryWorkflow.test.cjs"
Cohesion: 0.14
Nodes (9): assert, dom, esbuild, {JSDOM}, observers, path, React, {render,fireEvent,act,waitFor,cleanup,within,configure} (+1 more)

### Community 45 - "ShopFooter.jsx"
Cohesion: 0.44
Nodes (8): [2026-11-06 - กะค่ำ (Global Real-time Theme Synchronization & Icon Fix)], ShopFooter(), LineIcon(), StoreIcon(), TelegramIcon(), WeChatIcon(), XIcon(), formatPhoneNumber()

### Community 46 - "react"
Cohesion: 0.08
Nodes (52): 1. Executive Summary, lucide-react, react, react-dom, Artists(), compressImage(), fileToBase64(), ConfirmDialog() (+44 more)

### Community 47 - "qrScanner.test.cjs"
Cohesion: 0.17
Nodes (11): assert, createMockStream(), createMockTrack(), dom, esbuild, { JSDOM }, path, QrScanner (+3 more)

### Community 48 - "4.6 Cash Operations (Strict RBAC)"
Cohesion: 0.17
Nodes (12): 4.6 Cash Operations (Strict RBAC), `adjustCashCount({ denomination, deltaCount, reason })`, `deliverCashToCustomer({ projectId, denomination, noteCount, notes })`, `depositCash({ denomination, noteCount, notes })`, `handoverCashBatch({ batchId, toRecipientId, toRecipientName, noteCount, accepted = false, notes })`, `issueCashBatch({ projectId, recipientName, denomination, noteCount, useReservation, notes })`, `receivePreparedCash({ batchId, noteCount, notes })`, `recordCountedOpeningCash({ counts, notes })` (+4 more)

### Community 49 - "themeManager.js"
Cohesion: 0.42
Nodes (9): hexToRgbString(), shadeColor(), applyThemeVariables(), computeThemeColors(), computeThemeInk(), ensureThemeStylesheet(), getContrastYIQ(), luminance() (+1 more)

### Community 50 - "inventoryFullPreview.test.cjs"
Cohesion: 0.17
Nodes (8): assert, dom, esbuild, { JSDOM }, path, React, { render, fireEvent, waitFor, act, cleanup, within }, { test }

### Community 51 - "[2026-11-05 - อัปเกรดระบบสิทธิ์ Roles & Permissions, แยกหมวดหมู่หน้า Settings, ปรับแต่งรหัสผ่าน และ Profile Popup สไตล์ Facebook]"
Cohesion: 0.33
Nodes (11): [2026-11-05 - อัปเกรดระบบสิทธิ์ Roles & Permissions, แยกหมวดหมู่หน้า Settings, ปรับแต่งรหัสผ่าน และ Profile Popup สไตล์ Facebook], 5.1 Direct REST Table Write Bypass Lockdown (`inventory_items`, `asset_units`, Legacy Tables), validatePayload(), isValidUuid(), saveArtistSync(), saveAssetUnitSync(), saveCustomerSync(), saveInventoryItemSync() (+3 more)

### Community 52 - "Independent Browser QA Report: Plan C Responsive Inventory Components"
Cohesion: 0.18
Nodes (10): 2. Viewport Inspection Matrix, 3.1 Stock Table & Filters (`StockTable.jsx`), 3.2 Issue Cart Drawer (`IssueCartDrawer.jsx`), 3.3 QR Scanner Modal (`QrScanner.jsx`), 3.4 QR Label Print Modal (`QrLabelPrint.jsx`), 3. Interactive Component Verification, 4. Theme Switching Verification, 5. Screenshot Evidence (+2 more)

### Community 53 - "inventory-offline-data.js"
Cohesion: 0.20
Nodes (7): InventoryFullPreview(), activities, categories, client, items, people, units

### Community 54 - "inventoryUi.test.cjs"
Cohesion: 0.18
Nodes (10): assert, esbuild, fs, loadJsxComponent(), path, React, ReactDOMServer, root (+2 more)

### Community 55 - "Inventory Plan C — Backend Architecture & UI API Handoff"
Cohesion: 0.20
Nodes (9): 1. Overview & Architectural Principles, 2.1 File Location, 2.2 Execution Requirements, 2.3 Tables Created, 2. Migration & Database Setup, 6. Known Boundaries & Non-Goals, 7.1 Database Transaction Suite (`tests/warehouseSql.test.cjs`), 7. Verification Evidence & Test Suites (+1 more)

### Community 56 - "HeaderFilterPortal"
Cohesion: 0.32
Nodes (6): Calendar(), colorPresets, HeaderFilterPortal(), colorPresets, systemStatusTypes, themeColors

### Community 57 - "Quotations.jsx"
Cohesion: 0.31
Nodes (9): Quotations(), DEFAULT_MATERIAL_RATES, deleteQuotationSync(), fetchLatest30ProjectsFromSupabase(), loadMaterialRatesLocalFirst(), loadQuotationsLocalFirst(), saveMaterialRateSync(), saveProjectChecklistItemSync() (+1 more)

### Community 58 - "Flower2you Inventory: Compact Architecture Review"
Cohesion: 0.22
Nodes (8): 1. Executive Summary & Assessment (7 vs 8 Tables), 2. Target Physical Schema (7 Core Tables), 3. Complete Source-to-Target Migration Matrix, 4. Integrity, Locking & RLS Enforcement, 5. RPC Facade & 1-Transaction Safe Migration, 6. Tradeoffs & Dependency Risks, Flower2you Inventory: Compact Architecture Review, Safe Migration Protocol:

### Community 59 - "Compact inventory contract — approved implementation direction"
Cohesion: 0.22
Nodes (8): Build pieces (not standalone install scripts), Canonical storage names (shared by all runtime authors), Compact inventory contract — approved implementation direction, Corrections to advisory reports, Domain mapping and migration rules, Physical tables: exactly 8 owned inventory tables, Runtime ownership and public contracts, Shared helper contracts (core owner implements, production owner consumes)

### Community 60 - "4. Frontend Service API (`src/services/warehouseService.js`)"
Cohesion: 0.25
Nodes (8): 4.2 Issue Operations (Atomic Mixed Cart), 4.3 Material Returns & Recoveries, 4. Frontend Service API (`src/services/warehouseService.js`), `createIssue(params)`, `inspectRecovery(params)`, `issueMaterials(params)`, `recoverMaterials(params)`, `returnUnusedMaterials(params)`

### Community 61 - "4.5 Item Metadata & Categories CRUD"
Cohesion: 0.25
Nodes (8): 4.5 Item Metadata & Categories CRUD, `addAssetUnit({ itemId, unitCode, notes })`, `adjustStock({ itemId, deltaQuantity, reason })`, `createCategory({ name, type, is_active })`, `createItem(params)`, `renameCategory(id, name)`, `retireCategory(id, is_active)`, `saveItemMetadata(params)`

### Community 62 - "หน้ากลางงานผลิตและการตรวจรับตามโปรเจกต์"
Cohesion: 0.25
Nodes (7): กติกาที่ไม่ให้สต็อกหรือเงินจริงผิด, การเห็นความคืบหน้าร่วมกัน, ขั้นตอนที่ต้องได้, จอและธีม, รายชื่อจากฐานข้อมูล, สถานะและยอด, หน้ากลางงานผลิตและการตรวจรับตามโปรเจกต์

### Community 63 - "4. ข้อตกลงและกฎเหล็กประจำตัว (Non-Negotiable Directives)"
Cohesion: 0.29
Nodes (6): 1. ข้อมูลสถาปัตยกรรมโปรเจกต์ (Project Snapshot), 2026-11-12 — Compact inventory delivery, 2026-11-13 — Inventory photos, barcode labels and infinite catalog, 2026-11-15 (Late Night) — Unified 3-Zone AppBar / Headline Redesign (Apple / IG / Facebook Style + Strict `≤ 3` Actions Overflow Menu + `16pt` Base Padding), 4. ข้อตกลงและกฎเหล็กประจำตัว (Non-Negotiable Directives), Flower2U - Native Session Memory & Context Ledger

### Community 64 - "Product"
Cohesion: 0.25
Nodes (7): Capabilities and Constraints, Open Decisions, Operating Context, Platform, Product, Product Principles, Product Purpose

### Community 65 - "2. โครงสร้างและลำดับข้อมูลที่ตกลงล่าสุด (Agreed Data Flow & Order)"
Cohesion: 0.40
Nodes (5): 2.1 ลำดับการ์ดสรุปยอดด้านบน (Top KPI Cards in FinanceView):, 2.2 ลำดับการ์ดสรุปยอดหน้าวิเคราะห์ (AnalyticsView Summary Cards):, 2.3 ลำดับแถบตัวเลขในบัตรงานและตาราง (Cards, Strips & Modals):, 2.4 โครงสร้างสีที่ผ่านการปรับแต่งแล้ว:, 2. โครงสร้างและลำดับข้อมูลที่ตกลงล่าสุด (Agreed Data Flow & Order)

### Community 66 - "4. กลไกอัตโนมัติข้ามระบบ (Automated Cross-Module Pipelines)"
Cohesion: 0.07
Nodes (28): 1. วิเคราะห์โครงสร้างข้อมูลเดิม (Google Sheets Legacy Analysis), 2. แผนผังความสัมพันธ์เอนทิตี (Unified Entity-Relationship Diagram), 3. ตารางฐานข้อมูล 8 โดเมนหลัก (8 Core Database Domains), 4.10 ทำไมการแยกคอลัมน์และตารางลูกจึงช่วยประหยัด Egress สู่จุดขีดสุด (Maximum Zero-Egress Proof), 4.1 ท่อส่งข้อมูล: บันทึกรายจ่าย ➔ ดันเข้าคลังสินค้าอัตโนมัติ (Expense-to-Inventory Flow), 4.2 ระบบควบคุมอุปกรณ์ยืม-คืน & วัสดุสิ้นเปลือง (Tool Lending & Consumables Engine), 4.3 วงจรนำวัสดุกลับมาใช้ซ้ำ (Reusable Materials & Salvage Cycle: ดอกไม้พลาสติก), 4.4 ระบบอัจฉริยะประวัติการจัดซื้อและแจ้งเตือนคู่ค้า (Vendor Intelligence & Defect Shield) (+20 more)

### Community 67 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, deploy, dev, predeploy, preview, test

### Community 68 - "รูปสินค้า ฉลาก และการเลื่อนโหลดรายการ — 2026-11-13"
Cohesion: 0.40
Nodes (4): การตรวจสอบ, การเก็บข้อมูลและโควตา, รูปสินค้า ฉลาก และการเลื่อนโหลดรายการ — 2026-11-13, เปิดใช้

### Community 69 - "4.1 Summary & Projection Loaders"
Cohesion: 0.40
Nodes (5): 4.1 Summary & Projection Loaders, `loadCashSummary(onUpdate = null)`, `loadWarehouseHistory({ projectId, limit, offset, includeCash })`, `loadWarehouseOperations({ projectId = null, roundId = null, limit = 100, offset = 0 } = {})`, `loadWarehouseSummary(onUpdate = null)`

### Community 70 - "4.4 Tool Custody, Returns & Handovers"
Cohesion: 0.50
Nodes (4): 4.4 Tool Custody, Returns & Handovers, `adoptOrReturnLegacyTool(params)`, `handoverTools(params)`, `returnTools(params)`

### Community 71 - "3. Security, Roles & Server Verification"
Cohesion: 0.67
Nodes (3): 3.1 Permission Helpers, 3.2 Row Level Security (RLS) & Direct Write Revocation, 3. Security, Roles & Server Verification

### Community 74 - "ref_node_path"
Cohesion: 0.21
Nodes (11): assert, buttons, data, directLinks, escapeHtml(), fs, options, path (+3 more)

### Community 75 - "🌸 Flower2U - Master System Architecture & Agent Onboarding Roadmap"
Cohesion: 0.15
Nodes (13): 1. ภาพรวมระบบและยุทธศาสตร์หลัก, 2. ไดอะแกรมสถาปัตยกรรมระบบรวม, 3 เสาหลักเชิงสถาปัตยกรรม (Core Architectural Pillars):, 3. ไดอะแกรมกระแสข้อมูลและการเงิน 4 ขั้นตอน, 4. ผังความสัมพันธ์ฐานข้อมูล, 5. สารบัญโมดูลระบบ 11 วิวหลัก, 7. แผนที่การพัฒนาและสถานะงาน, 8. คู่มือเริ่มงานทันทีสำหรับ Agent ตัวถัดไป (+5 more)

### Community 77 - "financeInventoryBridge.js"
Cohesion: 0.17
Nodes (23): [2026-11-15 - รื้อระบบคลังสินค้าเป็น 1-Tap Game Backpack ของจริง + กวาดล้าง Mockup นอก Supabase + Auto-Sync การเงินไร้รอยต่อ], RFC-4122, DateFilterControl(), escapeHtml(), Finance(), formatCurrency(), formatItemDate(), formatItemDateTime() (+15 more)

### Community 81 - "db.js"
Cohesion: 0.32
Nodes (6): dexie, DbCombobox(), normalizeOption(), TABLE_CONFIG, db, ComboHarness()

### Community 82 - "README.md"
Cohesion: 0.20
Nodes (6): Git Operations, Workspace Rules & Git Deployment Policy, 🌸 Flower2U (Flower2you), 🛠️ การติดตั้งและรันระบบ (Quickstart), 🚀 จุดเด่นของระบบ (Key Features), 📌 เอกสารสำคัญสำหรับนักพัฒนาและ AI Agent

### Community 88 - "6. กฎเหล็กและข้อห้ามเด็ดขาดสำหรับ Agent"
Cohesion: 0.25
Nodes (8): 6. กฎเหล็กและข้อห้ามเด็ดขาดสำหรับ Agent, 🚫 กฎข้อที่ 1: ห้ามสั่ง Git Add / Commit / Push เด็ดขาด, 🚫 กฎข้อที่ 2: ห้ามใช้ Native Browser Dialogs & Date Pickers เด็ดขาด (Directive 11), 📌 กฎข้อที่ 3: ยึดมั่นกฎลำดับการเงิน 4 ขั้นตอน (Standard Financial Hierarchy), 🎨 กฎข้อที่ 4: การป้องกันบั๊กเส้นสีดำบนตาราง (Table Black Line Glitch Prevention), 💾 กฎข้อที่ 5: Local-First & Zero-Egress Philosophy, 🪟 กฎข้อที่ 6: มาตรฐานโครงสร้าง Modal (Silky-Smooth Modal Architecture), 🧪 กฎข้อที่ 7: Pre-Delivery Verification Loop

### Community 90 - "inventory-offline.config.js"
Cohesion: 0.22
Nodes (4): vite, @vitejs/plugin-basic-ssl, @vitejs/plugin-react, manualChunks()

## Knowledge Gaps
- **8 isolated node(s):** `@tailwindcss/postcss`, `@types/react`, `@types/react-dom`, `autoprefixer`, `gh-pages` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 728 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `package.json`, `Staff.jsx`, `App.jsx`, `Settings.jsx`, `3. ประวัติการทำงานและข้อตกลงล่าสุด (Session History)`, `Inventory.jsx`, `qrLabels.js`, `productionUiSafety.test.cjs`, `processImageUrl`, `inventoryComponents.test.cjs`, `pageNavigation.test.cjs`, `qrLabelPrint.test.cjs`, `inventoryWorkflow.test.cjs`, `ShopFooter.jsx`, `qrScanner.test.cjs`, `inventoryFullPreview.test.cjs`, `inventory-offline-data.js`, `inventoryUi.test.cjs`, `HeaderFilterPortal`, `Quotations.jsx`, `financeInventoryBridge.js`, `db.js`?**
  _High betweenness centrality (0.227) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `Inventory()` (e.g. with `2026-11-15 (Evening) — Global AppBar Vertical Padding & Height Upgrade Across All 11 Pages + Inventory AppBar & QR Studio Redesign` and `2026-11-15 (Late Night) — Unified 3-Zone AppBar / Headline Redesign (Apple / IG / Facebook Style + Strict `≤ 3` Actions Overflow Menu + `16pt` Base Padding)`) actually correct?**
  _`Inventory()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@tailwindcss/postcss`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.10822510822510822 - nodes in this community are weakly interconnected._
- **Why does `@supabase/supabase-js` connect `@supabase/supabase-js` to `package.json`, `seed_mock_data.cjs`, `test_backend_api_suite.cjs`, `audit_database_and_api.cjs`, `migrate_sheets_to_supabase.cjs`, `monitor_backend_health.cjs`, `sync_auth_users.cjs`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Should `syncService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.04902867715078631 - nodes in this community are weakly interconnected._
- **Why does `getActiveClient()` connect `productionService.js` to `syncService.js`, `Staff.jsx`, `App.jsx`, `Settings.jsx`, `react`, `Inventory.jsx`, `db.js`, `[2026-11-05 - อัปเกรดระบบสิทธิ์ Roles & Permissions, แยกหมวดหมู่หน้า Settings, ปรับแต่งรหัสผ่าน และ Profile Popup สไตล์ Facebook]`, `@supabase/supabase-js`, `Quotations.jsx`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._