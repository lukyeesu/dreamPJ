# Inventory Plan C — Backend Architecture & UI API Handoff

> Historical pre-compact architecture. The supported installer is `database_scripts/inventory_compact.sql`; the current eight-table contract is `docs/inventory-compact-contract.md`. Do not run the two superseded installers after compact migration.

## 1. Overview & Architectural Principles

Plan C implements a production-grade relational transaction engine for warehouse management in Flower2U. It is designed around the following core guarantees:
- **Zero Local-Only Mutation / Confirmed Online Writes**: Mutations are executed via PostgreSQL `SECURITY DEFINER` RPCs (`warehouse_dispatch`) wrapped in strict database transactions. Writes never silently succeed only in local cache.
- **Transaction Atomicity for Mixed Carts**: A single checkout cart containing consumables, reusables, and serialized tools is locked and committed in **one atomic database transaction** (`issue_create`). If any item stock or tool is unavailable, all lines roll back completely.
- **Strict Server-Verified RBAC**: Permissions are derived on the server from `auth.uid() -> staff_users.auth_user_id -> roles`. Clients cannot forge roles. Unmapped or inactive staff fail closed. Cash vault access is strictly restricted to `admin` and `accountant` roles.
- **Zero Cash Storage on IndexedDB**: Cash vault counts, reservations, and batches remain in memory only, preventing cross-user device leakage. General summary projections exclude banknote items.
- **Persisted Idempotency**: All mutating operations serialize on the client-supplied request UUID via PostgreSQL `pg_advisory_xact_lock` and verify a cryptographic hash of action + payload before replaying cached responses.

---

## 2. Migration & Database Setup

### 2.1 File Location
`database_scripts/inventory_plan_c.sql`

### 2.2 Execution Requirements
- Run within a single database transaction (`BEGIN; ... COMMIT;`).
- Fully rerunnable / idempotent: uses `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and safe constraint drops/re-creations.
- Prerequisite base tables: `public.roles`, `public.staff_users`, `public.projects`, `public.inventory_categories`, `public.inventory_items`, `public.asset_units`.
- Built natively using PostgreSQL standard `gen_random_uuid()` (no dependency on `uuid-ossp` extension).
- Leaves legacy functions and rows intact. Zero loss of legacy data.

### 2.3 Tables Created
1. `public.inventory_recipients`: Person registry (casual helpers, staff, outside contractors) independent of system logins.
2. `public.inventory_recipient_teams`: Teams with named primary receiver and member name snapshots.
3. `public.inventory_field_rounds`: Field installation rounds covering multiple event locations with a single shared kit.
4. `public.inventory_field_round_projects`: Links 15+ project locations to a single field round without multi-issuing tools.
5. `public.inventory_documents`: Master issue, return, recovery, and adjustment transaction vouchers.
6. `public.inventory_movements`: Immutable stock ledger with item variant snapshots (name, color, size, unit).
7. `public.inventory_material_recoveries`: Reusable material recovery records (direct or pending warehouse sorting).
8. `public.asset_unit_custody`: Serialized tool custody ledger (strictly 1 active custody per tool unit).
9. `public.inventory_incidents`: Broken, lost, or discrepancy audit incident logs.
10. `public.cash_vault_denominations`: Physical, reserved, and available banknote counts for 20, 50, 100, 500, 1000 THB.
11. `public.cash_job_reservations`: Project cash reservations.
12. `public.cash_helper_batches`: Cash batches issued to helpers for folding or envelope preparation.
13. `public.cash_prepared_sets`: Completed gift money sets held for customer delivery.
14. `public.cash_movements`: Immutable monetary flow audit trail.
15. `public.inventory_idempotency_records`: Request UUID, action name, payload hash, and response store.

---

## 3. Security, Roles & Server Verification

### 3.1 Permission Helpers
- `public.fn_can_access_inventory(p_auth_user_id UUID)`:
  Returns `TRUE` if caller has active staff mapping with `admin` role OR `roles.allowed_pages` contains `'Inventory'` OR `roles.can_borrow_tools = TRUE`.
- `public.fn_can_manage_cash(p_auth_user_id UUID)`:
  Returns `TRUE` only if caller has active staff mapping with role `admin` or `accountant`.
- **Fail Closed**: If no staff mapping exists in `staff_users` where `auth_user_id = auth.uid()` and `is_active = true`, all calls are immediately rejected with an exception.

### 3.2 Row Level Security (RLS) & Direct Write Revocation
- Direct `INSERT`, `UPDATE`, and `DELETE` on all 15 new tables are revoked from `PUBLIC`, `anon`, and `authenticated`.
- `SELECT` on inventory tables is restricted to authenticated users matching `fn_can_access_inventory`.
- `SELECT` on cash tables is strictly restricted to authenticated users matching `fn_can_manage_cash`.
- Public execution of `SECURITY DEFINER` RPCs is revoked; only `authenticated` role can execute `warehouse_dispatch`, `warehouse_get_summary`, `warehouse_get_cash_summary`, and `warehouse_get_history`.

---

## 4. Frontend Service API (`src/services/warehouseService.js`)

All functions accept an optional `idempotencyKey` (UUID string). If provided by UI, it is preserved; if omitted, a new UUID v4 is automatically generated.

### 4.1 Summary & Projection Loaders

#### `loadWarehouseSummary(onUpdate = null)`
- **Description**: Loads categories, active recipients, active field rounds, items (excluding banknotes), asset units, legacy borrowed units, and active teams.
- **In-flight Deduplication**: Multiple simultaneous calls share a single `{ epoch, promise }` flight. Every joining caller receives the result and has their `onUpdate` callback invoked.
- **Memory-Only Architecture**: Kept completely memory-only (zero IndexedDB writes to eliminate cross-user cache leakage and stale Dexie state).
- **Returns**:
  ```json
  {
    "categories": [{ "id": "uuid", "name": "...", "type": "asset|consumable|reusable", "is_active": true }],
    "recipients": [{ "id": "uuid", "name": "...", "recipient_type": "...", "is_active": true }],
    "teams": [{ "id": "uuid", "name": "...", "primary_receiver_name": "...", "member_names": ["..."] }],
    "rounds": [{ "id": "uuid", "round_code": "RN-...", "title": "...", "status": "IN_PROGRESS|PARTIAL_RETURNED", "project_ids": ["..."] }],
    "items": [{ "id": "uuid", "code": "...", "name": "...", "current_stock": 10, "min_alert_threshold": 0, "color": "...", "size": "..." }],
    "asset_units": [{ "unit_code": "SC-01", "status": "AVAILABLE|BORROWED|BROKEN|LOST", "active_custody_id": "...", "active_recipient": "..." }],
    "legacy_borrowed_units": [{ "unit_code": "...", "status": "BORROWED", "borrowed_by": "..." }]
  }
  ```

#### `loadCashSummary(onUpdate = null)`
- **Description**: Loads cash vault denominations, active job reservations, in-progress helper batches, prepared sets, and legacy banknote references.
- **Access**: Server throws if caller does not have `admin` or `accountant` role.
- **IndexedDB**: Kept completely off IndexedDB (memory-only).
- **Returns**:
  ```json
  {
    "denominations": [
      {
        "denomination": 100,
        "physical_count": 50,
        "reserved_count": 10,
        "available_count": 40,
        "low_alert_threshold": 15,
        "target_available_count": 60,
        "restock_needed": 20,
        "is_initialized": true,
        "total_physical_value": 5000,
        "total_available_value": 4000
      }
    ],
    "reservations": [{ "id": "uuid", "project_id": "P-0309", "denomination": 100, "reserved_count": 10 }],
    "helper_batches": [{ "id": "uuid", "batch_code": "CSH-...", "recipient_name_snapshot": "...", "denomination": 100, "issued_count": 20, "remaining_count": 5, "status": "PARTIAL_PREPARED" }],
    "prepared_sets": [{ "id": "uuid", "project_id": "P-0309", "denomination": 100, "prepared_count": 15, "delivered_count": 0, "ready_for_delivery_count": 15 }],
    "legacy_banknotes": [{ "id": "uuid", "code": "...", "name": "...", "current_stock": 0 }]
  }
  ```

#### `loadWarehouseOperations({ projectId = null, roundId = null, limit = 100, offset = 0 } = {})`
- **Description**: Dedicated operational read projection for material returns, recovery inspections, and tool custody monitoring.
- **Access**: Server-enforced RBAC via `fn_can_access_inventory`.
- **Calculations**: Outstanding issue lines calculate residual `(issued_qty - returned_qty - recovered_qty) AS remaining_qty` and include only outstanding rows (`remaining_qty > 0`).
- **Returns**:
  ```json
  {
    "issue_lines": [
      {
        "id": "uuid",
        "source_issue_movement_id": "uuid",
        "item_id": "uuid",
        "project_id": "P-0309",
        "round_id": null,
        "recipient_name_snapshot": "ช่างบอย",
        "item_name": "ดอกกุหลาบประดิษฐ์แดง",
        "color": "แดง",
        "size": "M",
        "unit": "ก้าน",
        "issued_qty": 20,
        "returned_qty": 5,
        "recovered_qty": 5,
        "remaining_qty": 10,
        "created_at": "2026-11-10T..."
      }
    ],
    "recoveries": [
      {
        "id": "uuid",
        "item_id": "uuid",
        "source_issue_movement_id": "uuid",
        "document_id": "uuid",
        "recovered_qty": 5,
        "status": "PENDING",
        "item_name": "ดอกกุหลาบประดิษฐ์แดง",
        "color": "แดง",
        "size": "M",
        "unit": "ก้าน",
        "project_id": "P-0309"
      }
    ],
    "custodies": [
      {
        "id": "uuid",
        "unit_code": "PLIER-01",
        "project_id": "P-0309",
        "round_id": null,
        "recipient_name_snapshot": "ช่างบอย",
        "due_date": "2026-11-20T18:00:00Z",
        "borrowed_at": "2026-11-10T...",
        "item_name": "คีมตัดลวด",
        "status": "BORROWED"
      }
    ],
    "incidents": [],
    "has_more": false
  }
  ```

#### `loadWarehouseHistory({ projectId, limit, offset, includeCash })`
- **Description**: Loads paginated audit history vouchers, material movements, and cash movements.
- **Access**: Cash movements are automatically omitted if caller lacks cash permissions.

---

### 4.2 Issue Operations (Atomic Mixed Cart)

#### `createIssue(params)`
- **Description**: The primary atomic issue API. Issues consumables, reusables, and borrows tools in **one single database transaction**.
- **Payload**:
  ```js
  await createIssue({
    issueType: 'PRODUCTION_ISSUE', // or 'FIELD_ISSUE'
    projectId: 'P-0309',           // required for PRODUCTION_ISSUE
    projectIds: ['P-01', 'P-02'],  // for FIELD_ISSUE
    roundCode: 'RN-2611-01',       // optional / auto-generated for field issue
    roundTitle: 'Morning Installation',
    recipientId: 'uuid',           // optional
    recipientName: 'ป้านิด',        // required
    teamMembers: ['ช่างเอก', 'ช่างต้อม'],
    dueDate: '2026-11-15T18:00:00Z', // tools due date
    materialLines: [
      { itemId: 'item-uuid-1', quantity: 10 },
      { itemId: 'item-uuid-2', quantity: 5 }
    ],
    toolUnits: ['SC-01', 'DR-02'],
    notes: 'Brief note',
    idempotencyKey: 'optional-uuid'
  });
  ```
- **Returns**: `{ document_id, doc_number, round_id, material_movements, tool_custodies }`

#### `issueMaterials(params)`
- **Description**: Wrapper for `createIssue` with `issueType: 'PRODUCTION_ISSUE'` for material-only requests.

---

### 4.3 Material Returns & Recoveries

#### `returnUnusedMaterials(params)`
- **Description**: Returns unused consumables or reusables back to warehouse stock.
- **Payload**:
  ```js
  await returnUnusedMaterials({
    projectId: 'P-0309',
    recipientName: 'ช่างบอย',
    items: [
      { source_issue_movement_id: 'movement-uuid', itemId: 'item-uuid', quantity: 2 }
    ],
    notes: 'Leftover from stage'
  });
  ```
- **Invariant**: Cumulative returns cannot exceed the original issued quantity on `source_issue_movement_id`.

#### `recoverMaterials(params)`
- **Description**: Recovers reusable materials (e.g. plastic flowers, pedestals) from job sites.
- **Payload**:
  ```js
  await recoverMaterials({
    projectId: 'P-0309',
    recipientName: 'ทีมเก็บงาน',
    items: [
      {
        source_issue_movement_id: 'movement-uuid',
        itemId: 'item-uuid',
        recovered_qty: 90,
        inspect_now: true,      // true: directly add good_qty to available stock
        good_qty: 85,
        damaged_qty: 5,
        notes: '5 stems bent'
      },
      {
        source_issue_movement_id: 'movement-uuid-2',
        itemId: 'item-uuid-2',
        recovered_qty: 50,
        inspect_now: false      // false: creates PENDING recovery lot, stock added later on inspect
      }
    ]
  });
  ```
- **Invariants**:
  - `200 - 100 + 90 = 190`. Missing items (10 flowers) are considered consumed in work and **never trigger an incident or wage deduction**.
  - Damaged items (5 flowers) are isolated in history and **never added to available stock**.

#### `inspectRecovery(params)`
- **Description**: Completes inspection of a pending recovery lot.
- **Payload**:
  ```js
  await inspectRecovery({
    recoveryId: 'recovery-uuid',
    goodQty: 45,
    damagedQty: 5
  });
  ```
- **Effect**: Adds `goodQty` to `inventory_items.current_stock`. Re-inspecting an already inspected lot is rejected.

---

### 4.4 Tool Custody, Returns & Handovers

#### `returnTools(params)`
- **Description**: Returns borrowed tools individually with condition inspection.
- **Payload**:
  ```js
  await returnTools({
    returns: [
      { unitCode: 'SC-01', condition: 'good', notes: 'OK' },
      { unitCode: 'DR-02', condition: 'broken', notes: 'Motor smoked' },
      { unitCode: 'TP-01', condition: 'missing', notes: 'Lost at venue' }
    ]
  });
  ```
- **Status Mapping**:
  - `good` -> `asset_units.status = 'AVAILABLE'`
  - `broken` -> `asset_units.status = 'BROKEN'`, generates row in `inventory_incidents`
  - `missing` -> `asset_units.status = 'LOST'`, generates row in `inventory_incidents`
- **Field Round Status**: Automatically recomputes parent field round status to `PARTIAL_RETURNED` or `RETURNED`.

#### `handoverTools(params)`
- **Description**: Transfers active tool custody from one person to another with explicit acceptance.
- **Payload**:
  ```js
  await handoverTools({
    unitCodes: ['SC-01'],
    toRecipientName: 'ช่างต้อม',
    toRecipientId: 'recipient-uuid',
    accepted: true,
    notes: 'Handover at backstage'
  });
  ```
- **Guarantee**: Closes old custody, opens new custody, links `handed_over_to_custody_id`. Never creates a double loan. Exactly 1 active custody exists per unit.

#### `adoptOrReturnLegacyTool(params)`
- **Description**: Manages legacy units in `asset_units` marked `'BORROWED'` prior to Plan C.
- **Payload**:
  ```js
  await adoptOrReturnLegacyTool({
    unitCode: 'SC-LEGACY',
    action: 'return_available' // or 'adopt_custody'
  });
  ```

---

### 4.5 Item Metadata & Categories CRUD

#### `createCategory({ name, type, is_active })`
#### `renameCategory(id, name)`
#### `retireCategory(id, is_active)`
- Categories can be retired (`is_active = false`) but are never hard-deleted if referenced.

#### `createItem(params)`
- Supports initial registration with optional initial stock and audited `OPENING_STOCK` movement.

#### `saveItemMetadata(params)`
- **Safety**: Updates name, category, unit, thresholds, cost, location, color, size.
- **Protection**: **NEVER overwrites `current_stock`**. Stock balances can only be changed via audited transactions.
- **Type Change Protection**: Disallows changing `item_type` if transaction movements or asset units already exist for the item.

#### `adjustStock({ itemId, deltaQuantity, reason })`
- Explicit, audited stock adjustment with mandatory reason string. Creates movement in `inventory_movements`.

#### `addAssetUnit({ itemId, unitCode, notes })`
- Adds a serialized unit. Fails if parent item `item_type != 'asset'`.

---

### 4.6 Cash Operations (Strict RBAC)

#### `recordCountedOpeningCash({ counts, notes })`
- **Rule**: Denominations can only have counted opening set **once**. Cannot overwrite an existing tracked balance with a stale form. Rejects decimals.

#### `depositCash({ denomination, noteCount, notes })`
- Adds bank-withdrawn cash to vault physical count.

#### `reserveCash({ projectId, denomination, noteCount, notes })`
- Decrements available vault cash (`physical - reserved`), increments `cash_job_reservations`. Fails if insufficient available.

#### `releaseCashReservation({ projectId, denomination, noteCount, notes })`
- Releases reserved notes back to free available vault cash.

#### `issueCashBatch({ projectId, recipientName, denomination, noteCount, useReservation, notes })`
- Issues banknotes to a helper. If `useReservation = true`, deducts both vault reserved and physical count (**no double deduction**).

#### `receivePreparedCash({ batchId, noteCount, notes })`
- When helper finishes folding/stuffing notes, returns prepared notes to the **Job Prepared Set** (`cash_prepared_sets`), **NOT the free vault**.

#### `deliverCashToCustomer({ projectId, denomination, noteCount, notes })`
- Prepared sets delivered to customer. Notes leave shop custody.

#### `returnUnusedRawCash({ batchId, noteCount, keepReservation, notes })`
- Returns raw banknotes to vault. If `keepReservation = true` (default), preserves project reservation. If `false`, notes become available for other jobs.

#### `handoverCashBatch({ batchId, toRecipientId, toRecipientName, noteCount, accepted = false, notes })`
- Transfers custody of remaining notes from one helper to another with explicit ledger entry.
- Requires explicit `accepted: true` (defaults to `false` if omitted) and positive integer count. Conserves remaining notes between source and target batches with no vault change.

#### `adjustCashCount({ denomination, deltaCount, reason })`
- Explicit, audited count adjustment for cash denominations.
- Requires non-zero integer `deltaCount` and mandatory `reason`.
- Verifies physical count does not drop below active `reserved_count`. Records immutable `COUNT_ADJUSTMENT` cash movement.

#### `updateCashThresholds({ denomination, lowAlertThreshold, targetAvailableCount })`
- Configures alert thresholds and target restock level.
- **Restock Formula**: `restock = max(0, target_available - (physical - reserved))`.

---

## 5. Client Lifecycle, Auth & Deduplication

### `resetWarehouseAuthSession()`
Exported from `src/services/warehouseService.js` and `src/services/syncService.js`, and wired into `clearAllLocalDatabase` (`src/services/db.js`). Calling this function:
1. Increments internal auth epoch (`currentAuthEpoch`).
2. Cancels pending in-flight promises from writing to local memory or updating another user's UI.
3. If an auth session change occurs during an active mutation, the response is discarded and rejects with `Auth session expired or changed during command execution`.
4. Failed summary loads properly clear in-flight state so subsequent retry attempts make fresh server requests.
5. Clears memory-only summary and cash flights.

### `onWarehouseAuthSessionChange(callback)` & `initWarehouseAuthListener()`
- UI components can subscribe to session reset events via `onWarehouseAuthSessionChange(cb)`.
- `initWarehouseAuthListener()` attaches a single, idempotent listener to Supabase's `auth.onAuthStateChange`. Guarded against missing client auth; executes zero RPCs inside callback.

---

## 6. Known Boundaries & Non-Goals

1. **No Direct Banking APIs**: Replenishment calculations (`restock_needed`) are strictly mathematical recommendations for staff; the system does not execute automated wire transfers or bank withdrawals.
2. **No Automated Payroll Deductions**: Tool loss, damage, and cash discrepancies generate audit incident records (`inventory_incidents`, `cash_movements`). Under Thai labor regulations (Sections 76-77), damages require written employee consent and willful/gross negligence determination. The software strictly preserves factual evidence without automated salary deductions.
3. **Legacy Banknote Rows**: Legacy rows in `inventory_items` with `item_type = 'banknote'` are excluded from general item projections and must be reconciled using `cash_counted_opening` rather than assumed as stock.

---

## 7. Verification Evidence & Test Suites

The test suite consists of two dedicated test files run via Node's test runner:

### 7.1 Database Transaction Suite (`tests/warehouseSql.test.cjs`)
1. **Migration Cleanliness & Rerunnability**: Reruns `inventory_plan_c.sql` twice in a single transaction; verifies all 15 tables and views exist.
2. **Advisory Lock Idempotency**: Serializes requests on client-supplied UUIDs, verifies action + payload hash, returns cached responses for identical requests, and rejects mismatched actions or payloads.
3. **Mixed Cart Transaction Atomicity**: Executes cart containing consumables, reusables, and tools; verifies atomic rollback when any tool unit is unavailable (`BORROWED`) and clean atomic commit when all items are valid.
4. **Material Issue Restrictions**: Blocks issuance of `asset`, `banknote`, or `task` items via material lines, and rejects duplicate cart lines.
5. **15 Projects One Kit**: Links 15 projects to a single field installation round without multi-issuing tools.
6. **Legacy Borrowed Unit Handling**: Blocks reissue of legacy `BORROWED` units and supports audited adoption or return.
7. **Material Recovery Balance & Caps**: Verifies `200 - 100 + 90 = 190` stock calculation; locks source issue row `FOR UPDATE`; counts damaged recovered items toward the cumulative return cap; allows zero-good/all-damaged receipts without violating `quantity > 0` constraints.
8. **Tool Handover Lineage & Round Status**: Requires explicit `accepted = true`; tracks custody lineage; recomputes parent field round status to `PARTIAL_RETURNED` or `RETURNED`.
9. **Cash Vault Integers, Baselining & Conservation**: Rejects decimal and negative counts; locks baseline permanently once counted; blocks delivery of nonexistent prepared sets; verifies conservation of notes in partial helper handovers.
10. **Security & RLS**: Revokes direct table writes for authenticated/anon; denies anon RPC execution; derives actor strictly from `auth.uid()`, ignoring spoofed payload fields.
11. **Item Registration & Metadata Invariants**: Enforces non-empty name and unit; blocks changes to `item_type`, `unit`, `color`, and `size` once movement history exists; bounds asset unit codes to 64 characters for QR compatibility; validates team member arrays.
12. **Material Recovery & Inspection Safeguards**: Requires non-null `source_issue_movement_id`; validates project context match; enforces single consumption of pending recovery inspections; validates `good + damaged == recovered`.
13. **Operational Read Projection**: Verifies `warehouse_get_operations` returns `{ issue_lines, recoveries, custodies, incidents, has_more }`, calculates residual stock `issued - returned - recovered > 0`, drops completed lines, and rejects unauthenticated/driver access.
14. **Cash Adjust Count**: Verifies audited cash adjustment delta, updates physical count, logs `COUNT_ADJUSTMENT` movement, and enforces reserved floor.

### 7.2 Service Lifecycle Suite (`tests/warehouseService.test.cjs`)
1. **Utility Math**: Verifies vault available cash, restock calculation, and helper remaining note counts.
2. **In-flight Deduplication**: Shares server requests among concurrent callers and invokes all callbacks.
3. **Session Reset Isolation**: Discards in-flight responses across login/logout; prevents stale data from committing.
4. **Stable Idempotency Passthrough**: Confirms callers' idempotency keys are preserved across mutations.
5. **Zero IndexedDB Cash Leak**: Confirms cash denominations and movements remain in memory only.
6. **Remote Error Integrity**: Verifies remote errors strictly throw and never silently update local cache.
7. **Retry on Failed Load**: Ensures failed loads clear in-flight state and subsequent retries succeed.
8. **Reset During RPC Await**: Confirms auth session reset during asynchronous RPC returns null and commits zero stale data.
9. **Old Mutation Response Rejection**: Confirms mutations in-flight when session resets are rejected.
10. **Operations Read API**: Verifies `loadWarehouseOperations` passes filters and maps returned structure.
11. **Cash Count Adjustment & Validation**: Confirms `adjustCashCount` validates denomination and dispatches command.
12. **Cash Handover Default**: Confirms `handoverCashBatch` defaults to `accepted = false`.
13. **Auth Session Change Subscription**: Confirms `onWarehouseAuthSessionChange` notifies subscribers.
14. **SyncService Export Compliance**: Confirms `resetWarehouseAuthSession` is exported from `syncService.js`.
