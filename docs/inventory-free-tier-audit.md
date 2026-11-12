# Supabase Free Tier Inventory Performance & Egress Audit

**Auditor:** Gemini (Read-only Codex Auditor)  
**Target:** Supabase Free Tier (5 GB/month uncached egress quota)  
**Scope:** Inventory System (Plan C + Production Hub migrations)  
**Status:** Read-only Pre-Refactor Findings (No schema/code mutations executed)

---

## 1. Executive Summary & Egress Budget

Supabase Free includes **5 GB/month of uncached egress** and a separate 5 GB cached allowance. The uncached monthly allowance is equivalent to roughly 166 MB/day averaged across a 30-day month; there is no daily quota implied here. All application traffic shares the allowance. [Supabase egress documentation](https://supabase.com/docs/guides/platform/manage-your-usage/egress).

> **Important Architecture Clarification:**  
> The 22 tables created across `inventory_plan_c.sql` and `inventory_production_hub.sql` do **not** inherently inflate egress on their own (table definitions consume disk, not network bandwidth). However, **monolithic RPC aggregations, unpaginated JSON arrays, full-board Realtime re-fetches, and duplicate boot-time downloads** directly threaten the 5 GB threshold. Consolidating tables is helpful for database management, but bandwidth survival strictly depends on limiting query size, bounding payloads, and eliminating duplicate network transfers.

---

## 2. Top 5 Ranked Findings & Concrete Zero-Cost Fixes

### Finding 1: Unconditional App Boot Preload Duplication
- **Affected Files & Functions:** `src/App.jsx` (`fetchProjects`), `src/services/syncService.js` (`loadInventoryLocalFirst`, `loadAssetLoansLocalFirst`).
- **Issue:** On every application boot or hard refresh, `fetchProjects()` immediately queries `inventory_items` and `asset_loans` from Supabase into IndexedDB (`db.inventory_items`), regardless of whether the user visits the Inventory tab. When the user later enters Inventory, `useWarehouseData` executes `warehouse_get_summary`, pulling the entire catalog a second time over the wire.
- **Fix:** Remove inventory and loan loaders from `fetchProjects()`. Lazy-load warehouse catalog only when the user first activates the Inventory tab (`activeTab === 'Inventory'`).

### Finding 2: Unbounded Monolithic Summary RPC Over-fetching
- **Affected Files & Functions:** `database_scripts/inventory_plan_c.sql` (`warehouse_get_summary`), `src/hooks/useWarehouseData.js` (`fetchSummary`), `src/Inventory.jsx` (14+ `refreshSummary()` calls).
- **Issue:** `warehouse_get_summary()` executes unbounded `jsonb_agg` across all active items, all individual `asset_units` (with custody joins), legacy borrowed units, recipients, teams, and rounds. Every inventory tab open or single action (adjust stock, borrow tool, return item) re-transfers thousands of serial objects across the wire.
- **Fix:** Split into:
  1. A lightweight **Metadata RPC** (~2–5 KB) for active rounds, category IDs, and summary counter stats.
  2. **Paginated Item Catalog** (`limit: 50`, `offset`).
  3. **Lazy-loaded Units**: Fetch `asset_units` only on modal expand or single-item barcode scan.
  4. Update mutated items locally in React state rather than re-fetching full summaries.

### Finding 3: Realtime Stampede: Full Board Refetch on Single Task Event
- **Affected Files & Functions:** `src/services/productionService.js` (`subscribeProductionProject`), `src/components/inventory/ProductionHubView.jsx` (`useEffect`, `fetchProjectBoard`), `database_scripts/inventory_production_hub.sql` (`warehouse_load_production_project`).
- **Issue:** `subscribeProductionProject` triggers a debounced `fetchProjectBoard(true)` on any Postgres change. This invokes `warehouse_load_production_project` (`limit: 100`), which aggregates a 4-level deep JSON tree (assignments → lines → submissions → submission lines + inspections). A single checkmark in the field prompts all connected clients to re-download the entire project board.
- **Fix:** Update only the affected task/line in component state using `payload.new`. Paginate the production board to **25 tasks/page**. Maintain subscriptions strictly while the Production tab is active and unbind immediately on unmount.

### Finding 4: Silent Auth Token Refresh Triggers Refetch Storms
- **Affected Files & Functions:** `src/services/warehouseService.js` (`initWarehouseAuthListener`), `src/hooks/useWarehouseData.js` (`useEffect` on `authSessionVersion`).
- **Issue:** `client.auth.onAuthStateChange` listens unconditionally. Supabase periodically emits `TOKEN_REFRESHED` (~hourly or on window focus). The listener increments `currentAuthEpoch`, bumping `authSessionVersion` and triggering an unprompted `fetchSummary(false)` even for idle users.
- **Fix:** Filter auth events in `initWarehouseAuthListener`. Only increment epoch and refresh data on explicit session changes (`SIGNED_IN`, `SIGNED_OUT`, `USER_UPDATED`). Ignore `TOKEN_REFRESHED`.

### Finding 5: Legacy Banknote Leakage into IndexedDB Cache
- **Affected Files & Functions:** `src/services/syncService.js` (`loadInventoryLocalFirst`), `src/services/db.js` (`inventory_items`).
- **Issue:** While Plan C enforces memory-only cash state, `syncService.js` line 1711 queries `inventory_items` without filtering out `item_type = 'banknote'`, saving legacy banknote records into persistent browser IndexedDB.
- **Fix:** Add `.neq('item_type', 'banknote')` to `syncService.loadInventoryLocalFirst`. Purge legacy banknote rows from IndexedDB on logout. Keep cash vault entirely in memory with zero offline caching.

---

## 3. Network Egress Scenario Comparison

*(The following figures are illustrative calculations using assumed response sizes and request counts. No response-size benchmark or production telemetry was collected for this table. They are not measured savings or a quota guarantee.)*

| Metric / Scenario | Current Implementation (*ESTIMATES*) | Target Optimized Architecture (*ESTIMATES*) | Egress Reduction |
| :--- | :--- | :--- | :--- |
| **App Boot (50 sessions/day)** | ~350 KB × 50 = **17.5 MB/day** (Full items + loans) | **0 KB** (Deferred until Inventory tab activated) | **-100%** |
| **Inventory View (20 visits/day)** | ~650 KB × 20 = **13.0 MB/day** (Unbounded summary) | ~8 KB (Metadata) + 35 KB (50 items) = **0.86 MB/day** | **-93%** |
| **Action Refreshes (80 actions/day)** | ~650 KB × 80 = **52.0 MB/day** (`refreshSummary`) | ~1.5 KB payload reply = **0.12 MB/day** (Local state patch) | **-99%** |
| **Realtime Production (120 events/day)** | ~250 KB × 120 = **30.0 MB/day** (Full board refetch) | ~0.8 KB × 120 = **0.096 MB/day** (Patch affected task) | **-99%** |
| **Estimated Total Daily Egress** | **~112.5 MB/day** | **~1.1 MB/day** | **~99% Reduction** |
| **Illustrative Monthly Footprint** | **~3.38 GB / month** under the stated assumptions | **~33 MB / month** under the stated assumptions | **Not a measured result** |

---

## 4. Architectural Target Spec (No Paid Infra / No Cache Tables)

1. **Pagination Standards:**
   - Catalog: **50 items/page**
   - Units: **Lazy on demand** (per-item modal or barcode search)
   - Audit History (`warehouse_get_history`): **20 items/page**
   - Production Tasks (`warehouse_load_production_project`): **25 tasks/page**
   - People / Helpers (`warehouse_list_people`): **20 people/page**
2. **Local QR Generation:** Keep 100% offline via client-side `qrcode` in `src/utils/qrLabels.js` (verified: 0 external egress).
3. **Confirmed Writes & Offline Policy:** Keep transactional warehouse commands fail-closed (throw on connection loss; no optimistic writes for stock or money).
4. **Cash Isolation:** Memory-only, wipe on sign-out or session switch.
