# Graph Report - Flower2U  (2026-10-21)

## Corpus Check
- 32 files · ~62,783 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 2, (none) 1)

## Summary
- 173 nodes · 366 edges · 13 communities (10 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ce5301f5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- App.jsx
- processImageUrl
- แผนพัฒนา: ระบบหน้าการเงินและตารางบันทึกกำไรขาดทุน (Flower2U)
- react
- devDependencies
- Active Skills & Engineering Directives
- SettingsView.jsx
- FinanceView.jsx
- React + Vite
- vercel.json

## God Nodes (most connected - your core abstractions)
1. `App()` - 30 edges
2. `react` - 22 edges
3. `lucide-react` - 19 edges
4. `processImageUrl()` - 15 edges
5. `ShopFooter()` - 13 edges
6. `formatDate()` - 12 edges
7. `renderDeliveryTime()` - 10 edges
8. `react-dom` - 9 edges
9. `SettingsView()` - 9 edges
10. `Active Skills & Engineering Directives` - 9 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `AnalyticsView()`  [EXTRACTED]
  src/App.jsx → src/AnalyticsView.jsx
- `App()` --calls--> `LoginScreen()`  [EXTRACTED]
  src/App.jsx → src/components/auth/LoginScreen.jsx
- `App()` --calls--> `DateFilterControl()`  [EXTRACTED]
  src/App.jsx → src/components/common/DateFilterControl.jsx
- `App()` --calls--> `ImageViewer()`  [EXTRACTED]
  src/App.jsx → src/components/common/ImageViewer.jsx
- `App()` --calls--> `ModernDateTimePicker()`  [EXTRACTED]
  src/App.jsx → src/components/common/ModernDateTimePicker.jsx

## Import Cycles
- None detected.

## Communities (13 total, 3 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.07
Nodes (29): dependencies, lucide-react, react, react-dom, homepage, name, private, scripts (+21 more)

### Community 1 - "App.jsx"
Cohesion: 0.17
Nodes (24): App(), getBasePath(), getTabFromUrl(), navItems, ROUTE_TO_TAB, TAB_ROUTES, updateUrlForTab(), CalendarView() (+16 more)

### Community 2 - "processImageUrl"
Cohesion: 0.25
Nodes (13): LoginScreen(), ImageViewer(), CustomerQuotationView(), CustomerTrackingView(), SharePreviewModal(), colorPresets, systemStatusTypes, themeColors (+5 more)

### Community 3 - "แผนพัฒนา: ระบบหน้าการเงินและตารางบันทึกกำไรขาดทุน (Flower2U)"
Cohesion: 0.10
Nodes (19): 1. ภาพรวมความต้องการ (Requirements Overview), 2. โครงสร้างตาราง "บันทึกข้อมูลกำไรขาดทุน" (Print A4 Formatter), 3. การเพิ่มช่องใส่วันที่ในระดับรายการย่อย (Item Date Tracking), 4. ระบบ Mobile Navigation แบบลากขึ้น (Pull-up Bottom Sheet), 5. การเพิ่มฟิลด์สถานะการเงิน (Payment Status Field), 6. ฟังก์ชันเพิ่มเติมที่ได้รับการอนุมัติ (Enhanced Features), 7. แผนการดำเนินงานและสถาปัตยกรรมโค้ด (Roadmap & Implementation Steps), 8. คำแนะนำเชิงรุกด้านการซิงค์ข้อมูล (Data Sync Guidance) (+11 more)

### Community 4 - "react"
Cohesion: 0.21
Nodes (7): lucide-react, react, react-dom, AnalyticsView(), DonutChart(), colorPresets, ModernDateTimePicker()

### Community 5 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, gh-pages, globals (+7 more)

### Community 6 - "Active Skills & Engineering Directives"
Cohesion: 0.17
Nodes (11): 1. Ponytail (Lazy Senior Dev Mode), 2. OmniRoute (Provider & Model Fallback), 3. Graphify (Codebase Knowledge Graph), 4. Agent Skills (Engineering Best Practices), 5. Karpathy Skills (The 4 Golden Rules), 6. ECC (Explore → Plan → Execute → Check / Self-Verify), 7. Matt Pocock Skills (Ask Before Doing), 8. MCP for Review (+3 more)

### Community 7 - "SettingsView.jsx"
Cohesion: 0.29
Nodes (10): AdvancedListManager(), colorPresets, defaultThemeColors, LineIcon(), ListManager(), SettingsView(), systemStatusTypes, TelegramIcon() (+2 more)

### Community 8 - "FinanceView.jsx"
Cohesion: 0.48
Nodes (5): DateFilterControl(), escapeHtml(), FinanceView(), formatCurrency(), formatItemDate()

### Community 9 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + Vite

## Knowledge Gaps
- **7 isolated node(s):** `@tailwindcss/postcss`, `@types/react`, `@types/react-dom`, `autoprefixer`, `gh-pages` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 76 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `package.json`, `App.jsx`, `processImageUrl`, `SettingsView.jsx`, `FinanceView.jsx`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **What connects `@tailwindcss/postcss`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07007575757575757 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Should `แผนพัฒนา: ระบบหน้าการเงินและตารางบันทึกกำไรขาดทุน (Flower2U)` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `react` to `package.json`, `App.jsx`, `processImageUrl`, `SettingsView.jsx`, `FinanceView.jsx`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._