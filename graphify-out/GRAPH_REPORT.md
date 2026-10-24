# Graph Report - Flower2U  (2026-10-22)

## Corpus Check
- 33 files · ~63,600 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 187 nodes · 379 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `16816a2c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- ShopFooter.jsx
- processImageUrl
- แผนพัฒนา: ระบบหน้าการเงินและตารางบันทึกกำไรขาดทุน (Flower2U)
- App.jsx
- devDependencies
- Active Skills & Engineering Directives
- SettingsView.jsx
- Flower2U - Native Session Memory & Context Ledger
- React + Vite
- vercel.json
- FinanceView.jsx

## God Nodes (most connected - your core abstractions)
1. `App()` - 30 edges
2. `react` - 22 edges
3. `lucide-react` - 19 edges
4. `processImageUrl()` - 15 edges
5. `ShopFooter()` - 13 edges
6. `formatDate()` - 12 edges
7. `Active Skills & Engineering Directives` - 11 edges
8. `renderDeliveryTime()` - 10 edges
9. `react-dom` - 9 edges
10. `SettingsView()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `LoginScreen()`  [EXTRACTED]
  src/App.jsx → src/components/auth/LoginScreen.jsx
- `App()` --calls--> `DateFilterControl()`  [EXTRACTED]
  src/App.jsx → src/components/common/DateFilterControl.jsx
- `App()` --calls--> `ImageViewer()`  [EXTRACTED]
  src/App.jsx → src/components/common/ImageViewer.jsx
- `App()` --calls--> `CustomerQuotationView()`  [EXTRACTED]
  src/App.jsx → src/components/customer/CustomerQuotationView.jsx
- `App()` --calls--> `CustomerTrackingView()`  [EXTRACTED]
  src/App.jsx → src/components/customer/CustomerTrackingView.jsx

## Import Cycles
- None detected.

## Communities (14 total, 3 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.07
Nodes (29): dependencies, lucide-react, react, react-dom, homepage, name, private, scripts (+21 more)

### Community 1 - "ShopFooter.jsx"
Cohesion: 0.53
Nodes (7): ShopFooter(), LineIcon(), StoreIcon(), TelegramIcon(), WeChatIcon(), XIcon(), formatPhoneNumber()

### Community 2 - "processImageUrl"
Cohesion: 0.33
Nodes (10): LoginScreen(), ImageViewer(), CustomerQuotationView(), CustomerTrackingView(), SharePreviewModal(), arabicNumberToText(), formatDate(), generateTrackingToken() (+2 more)

### Community 3 - "แผนพัฒนา: ระบบหน้าการเงินและตารางบันทึกกำไรขาดทุน (Flower2U)"
Cohesion: 0.10
Nodes (19): 1. ภาพรวมความต้องการ (Requirements Overview), 2. โครงสร้างตาราง "บันทึกข้อมูลกำไรขาดทุน" (Print A4 Formatter), 3. การเพิ่มช่องใส่วันที่ในระดับรายการย่อย (Item Date Tracking), 4. ระบบ Mobile Navigation แบบลากขึ้น (Pull-up Bottom Sheet), 5. การเพิ่มฟิลด์สถานะการเงิน (Payment Status Field), 6. ฟังก์ชันเพิ่มเติมที่ได้รับการอนุมัติ (Enhanced Features), 7. แผนการดำเนินงานและสถาปัตยกรรมโค้ด (Roadmap & Implementation Steps), 8. คำแนะนำเชิงรุกด้านการซิงค์ข้อมูล (Data Sync Guidance) (+11 more)

### Community 4 - "App.jsx"
Cohesion: 0.12
Nodes (27): lucide-react, react, react-dom, AnalyticsView(), DonutChart(), App(), getBasePath(), getTabFromUrl() (+19 more)

### Community 5 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, gh-pages, globals (+7 more)

### Community 6 - "Active Skills & Engineering Directives"
Cohesion: 0.14
Nodes (13): 10. Native Memory & Session Continuity, 1. Ponytail (Lazy Senior Dev Mode), 2. OmniRoute (Provider & Model Fallback), 3. Graphify (Codebase Knowledge Graph), 4. Agent Skills (Engineering Best Practices), 5. Karpathy Skills (The 4 Golden Rules), 6. ECC (Explore → Plan → Execute → Check / Self-Verify), 7. Matt Pocock Skills (Ask Before Doing) (+5 more)

### Community 7 - "SettingsView.jsx"
Cohesion: 0.29
Nodes (10): AdvancedListManager(), colorPresets, defaultThemeColors, LineIcon(), ListManager(), SettingsView(), systemStatusTypes, TelegramIcon() (+2 more)

### Community 8 - "Flower2U - Native Session Memory & Context Ledger"
Cohesion: 0.17
Nodes (11): 1. ข้อมูลสถาปัตยกรรมโปรเจกต์ (Project Snapshot), [2026-10-21], [2026-10-22], 2.1 ลำดับการ์ดสรุปยอดด้านบน (Top KPI Cards in FinanceView):, 2.2 ลำดับการ์ดสรุปยอดหน้าวิเคราะห์ (AnalyticsView Summary Cards):, 2.3 ลำดับแถบตัวเลขในบัตรงานและตาราง (Cards, Strips & Modals):, 2.4 โครงสร้างสีที่ผ่านการปรับแต่งแล้ว:, 2. โครงสร้างและลำดับข้อมูลที่ตกลงล่าสุด (Agreed Data Flow & Order) (+3 more)

### Community 9 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + Vite

### Community 13 - "FinanceView.jsx"
Cohesion: 0.48
Nodes (5): DateFilterControl(), escapeHtml(), FinanceView(), formatCurrency(), formatItemDate()

## Knowledge Gaps
- **7 isolated node(s):** `@tailwindcss/postcss`, `@types/react`, `@types/react-dom`, `autoprefixer`, `gh-pages` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 87 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.jsx` to `package.json`, `ShopFooter.jsx`, `processImageUrl`, `SettingsView.jsx`, `FinanceView.jsx`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **What connects `@tailwindcss/postcss`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07007575757575757 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Should `แผนพัฒนา: ระบบหน้าการเงินและตารางบันทึกกำไรขาดทุน (Flower2U)` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.jsx` to `package.json`, `ShopFooter.jsx`, `processImageUrl`, `SettingsView.jsx`, `FinanceView.jsx`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12317073170731707 - nodes in this community are weakly interconnected._