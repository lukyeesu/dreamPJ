# Independent Browser QA Report: Plan C Responsive Inventory Components

> Historical preliminary capture, 10 November 2026. This report does not certify the final compact UI. Subsequent review found crowded QR print controls at 390px and fixed accent colors despite changing root theme variables. Those source defects have since been corrected; the current session cannot recapture screenshots because the browser access host and native pipe are unavailable. The old component fixture also omitted cart callbacks. Use the isolated full fixture described in `inventory-responsive-research.md` for further browser checks. Actual hardware camera and printer calibration remain unverified.

**Date & Time:** 2026-11-10T11:32:00+07:00  
**Inspection Target:** `http://127.0.0.1:5174/tests/fixtures/inventory-preview.html`  
**Tooling:** `chrome-devtools` MCP Server (Native Automation Profile)  
**Execution Mode:** Pure Offline Test Data Fixture (Zero DB writes / Zero Supabase network requests)  
**Status:** Preliminary QA Capture (Active UI owner is concurrently updating production components; Vite HMR observed live during test)

---

## 1. Executive Summary

- **Connection & Security:** DevTools automation attached via Chrome DevTools MCP. Isolated tab opened solely for `http://127.0.0.1:5174/tests/fixtures/inventory-preview.html`. No user browser tabs, production credentials, or live databases were accessed.
- **Page Overflow Integrity:** Zero horizontal scroll detected across all 6 tested viewports (`document.documentElement.scrollWidth === window.innerWidth`).
- **Responsive Breakpoint Strategy:**
  - `< 768px (320px, 390px)`: Stock table hidden (`hidden md:block`); renders touch-friendly mobile card view (`md:hidden`) with minimum 44px touch targets.
  - `768px - 1023px (844px landscape, 820px portrait)`: Full tabular `StockTable` rendered; Cart drawer stacks vertically below main content when opened.
  - `≥ 1024px (1180px landscape, 1440px desktop)`: Side-by-side 3-column layout (`lg:grid-cols-3`), with `StockTable` occupying 2 columns and `IssueCartDrawer` occupying 1 column (~367px).
- **Theme Reactivity:** Dynamic CSS variable switching verified on `document.documentElement` (`--theme-main`, `--theme-hover`, `--theme-light`, `--theme-text-light`, `--theme-shadow`) across Violet, Emerald, and Rose.

---

## 2. Viewport Inspection Matrix

| Viewport | Device Profile | Body / Client Width | Scroll Width | Horizontal Overflow | Table / Card View | Tap Controls & Reachability |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **320 × 568** | iPhone SE (1st gen) | 320 px | 320 px | **None (0 px)** | Mobile Cards | Action buttons `min-h-[44px]`; tab bar scrolls internally (`overflow-x: auto`) |
| **390 × 844** | iPhone 12/13/14 (Portrait) | 390 px | 390 px | **None (0 px)** | Mobile Cards | Clean spacing; touch targets 44–50px; drawer scrolls cleanly |
| **844 × 390** | iPhone 12/13/14 (Landscape) | 844 px | 844 px | **None (0 px)** | Stock Table | Seamlessly switches to tabular view (844px ≥ `md:`); full column visibility |
| **820 × 1180** | iPad Air (Portrait) | 820 px | 820 px | **None (0 px)** | Stock Table | Tabular view; drawer stacks below table; scrollIntoView accessible |
| **1180 × 820** | iPad Air (Landscape) | 1180 px | 1180 px | **None (0 px)** | Stock Table | Side-by-side layout (Stock: 757px, Cart: 367px); zero layout shift |
| **1440 × 900** | Desktop (Standard) | 1440 px | 1440 px | **None (0 px)** | Stock Table | Full desktop grid; sticky action bars; zero clipping |

---

## 3. Interactive Component Verification

### 3.1 Stock Table & Filters (`StockTable.jsx`)
- **Filter Tabs:** Categorization tabs ("ทั้งหมด 3", "วัสดุใช้ซ้ำ 2", "สิ้นเปลือง 0", "เครื่องมือ 1") update displayed counts and row states cleanly.
- **Search & Dropdowns:** Text search input (`FL-W-01`, `ทิวลิป`) and Category/Color/Size dropdown filters trigger filtering correctly.
- **Pending Recovery Banner:** Clicking "ตรวจรับ" on the pending recovery alert (90 items) triggers `onNavigateToRecovery` callback and displays top banner feedback (`Navigated to Material Recovery modal`).
- **Tool Serial Selection:** "เพิ่มรหัส" and "พิมพ์ฉลาก QR" buttons render with appropriate tooltips and accessibility attributes.

### 3.2 Issue Cart Drawer (`IssueCartDrawer.jsx`)
- **Layout Behavior:**
  - On desktop (`≥ lg`): Side-by-side layout in grid.
  - On mobile/tablet (`< lg`): Full-width stacked preview below the inventory table.
- **Form Validation & Guardrails:**
  - Confirmation button is disabled (`disabled`) when required fields are missing (e.g. project unselected).
  - Out-of-stock validation actively detects requested quantity exceeding available stock (`ยอดเบิก ... เกินสต็อกพร้อมใช้`) and blocks submission.
- **Fixture Limitation Found:** Clicking "นำออกจากตะกร้า" inside the drawer threw `Uncaught TypeError: onRemoveCartItem is not a function` because the fixture (`inventory-preview.jsx`) did not supply an `onRemoveCartItem` mock prop.

### 3.3 QR Scanner Modal (`QrScanner.jsx`)
- **Responsive Behavior:** Opens as modal dialog (`role="dialog"`).
- **Mobile Adaptive Sizing:** Automatically expands to full viewport width/height (390 × 844 px) on mobile devices.
- **Controls:** Includes mode toggle ("กล้องสแกน" / "พิมพ์รหัส / บาร์โค้ด"), manual input fallback, and safe close buttons.

### 3.4 QR Label Print Modal (`QrLabelPrint.jsx`)
- **Responsive Behavior:** Adapts to mobile and desktop dialog containers.
- **Functionality:** Features actual-size label preview, sticker sheet format selectors (A4 sheet, Roll, scissor handle 18×24mm, standard 30×40mm, custom 35×35mm), and millimeter scale calibration print trigger.

---

## 4. Theme Switching Verification

Theme buttons set CSS custom properties on `document.documentElement`:

1. **Violet (`#8b5cf6`):**
   - `--theme-main: #8b5cf6`
   - `--theme-hover: #7c3aed`
   - `--theme-light: #f5f3ff`
   - `--theme-text-light: #8b5cf6`
   - `--theme-shadow: rgba(139, 92, 246, 0.35)`
2. **Emerald (`#10b981`):**
   - `--theme-main: #10b981`
   - `--theme-hover: #059669`
   - `--theme-light: #ecfdf5`
   - `--theme-text-light: #10b981`
   - `--theme-shadow: rgba(16, 185, 129, 0.35)`
3. **Rose (`#f43f5e`):**
   - `--theme-main: #f43f5e`
   - `--theme-hover: #e11d48`
   - `--theme-light: #fff1f2`
   - `--theme-text-light: #f43f5e`
   - `--theme-shadow: rgba(244, 63, 94, 0.35)`

Components successfully react to theme variable updates in real-time (buttons, badges, active tabs, and highlights).

---

## 5. Screenshot Evidence

All screenshots captured directly via `chrome-devtools` MCP server and persisted to `docs/inventory-plan-c-screenshots/`:

| Viewport / Component | Screenshot File Path |
| :--- | :--- |
| **320 × 568 Stock View** | `docs/inventory-plan-c-screenshots/viewport-320x568-stock.png` |
| **320 × 568 Cart View** | `docs/inventory-plan-c-screenshots/viewport-320x568-cart.png` |
| **390 × 844 Stock View** | `docs/inventory-plan-c-screenshots/viewport-390x844-stock.png` |
| **390 × 844 Theme Emerald** | `docs/inventory-plan-c-screenshots/viewport-390x844-theme-emerald.png` |
| **390 × 844 Cart View** | `docs/inventory-plan-c-screenshots/viewport-390x844-cart.png` |
| **844 × 390 Landscape View** | `docs/inventory-plan-c-screenshots/viewport-844x390-landscape.png` |
| **820 × 1180 Tablet Stock** | `docs/inventory-plan-c-screenshots/viewport-820x1180-tablet-stock.png` |
| **820 × 1180 Tablet Cart** | `docs/inventory-plan-c-screenshots/viewport-820x1180-tablet-cart.png` |
| **1180 × 820 Landscape Stock** | `docs/inventory-plan-c-screenshots/viewport-1180x820-landscape-stock.png` |
| **1440 × 900 Desktop Stock** | `docs/inventory-plan-c-screenshots/viewport-1440x900-desktop-stock.png` |
| **1440 × 900 Desktop Cart** | `docs/inventory-plan-c-screenshots/viewport-1440x900-desktop-cart.png` |
| **Modal: QR Scanner** | `docs/inventory-plan-c-screenshots/modal-qr-scanner.png` |
| **Modal: QR Label Print** | `docs/inventory-plan-c-screenshots/modal-qr-label-print.png` |

---

## 6. Observations & Residual Recommendations

1. **Active UI Owner Updates:** During inspection, Vite HMR events (`css hot updated: /src/index.css` and component updates) were actively received. The captures reflect the current state as of 2026-11-10T11:32:00+07:00 and are preliminary.
2. **Fixture Callback Coverage:** For future automated fixture runs, `tests/fixtures/inventory-preview.jsx` should add empty mock handlers for `onRemoveCartItem` and `onUpdateQuantity` to avoid runtime TypeErrors when testers click the remove button in the mock drawer.
3. **Touch Targets Compliance:** All mobile action buttons in `md:hidden` card view meet the recommended 44px minimum touch target height guideline.
