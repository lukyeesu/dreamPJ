# Flower2U Compact Core Transactional Warehouse API Specification

**Version**: `2.0.0` (Compact 8-Table Engine)  
**Maintainer**: Flower2U  
**Target Environment**: Supabase Free with bounded reads and server-enforced permissions  
**Ownership Scope**: `compact_core.sql.part` and Core Transactional Engine  

---

## 1. Executive Summary & Architecture Overview

The Compact Warehouse Core replaces the 22 micro-relational tables with a high-performance, single-ledger architecture constrained to **exactly 8 canonical tables**. It supports the operational flows required by Flower2U (mixed cart issues, 15-project field kits, material recovery inspection, tool custody chains, banknotes vault isolation, and helper cash batches) while eliminating catalog overhead and network egress bloat.

### Physical Table Distribution (8 Canonical Tables)
1. **`inventory_categories`**: Material and tool categories with active status toggles.
2. **`inventory_items`**: Material and tool catalog with real-time stock balances, alert thresholds, and pricing. Banknotes are retained as historical records but segregated from catalog sync.
3. **`asset_units`**: Serialized individual physical tools, storing unit codes, current status, active custody line pointers, and borrower information.
4. **`inventory_recipients`**: Unified people registry covering individual staff, casual helpers, and multi-member teams (`primary_receiver_name`, `member_names[]`).
5. **`inventory_documents`**: Polymorphic document headers managing issues, field rounds, recoveries, cash reservations, helper batches, prepared sets, and audited commands.
6. **`inventory_document_lines`**: Typed item lines, tool custody lines, round site links, recovery lines, cash lines, and checklist items.
7. **`inventory_movements`**: Unified immutable ledger tracking physical stock adjustments, tool movements, and cash note flows.
8. **`cash_vault_denominations`**: Five static rows (THB 20, 50, 100, 500, 1000) enforcing physical and reserved banknote counts.

---

## 2. Security, Anti-Escalation & Cash Isolation

### 2.1 Role-Based Permissions
- **`public.fn_is_admin(p_auth_uid UUID)`**: Strictly verifies whether the authenticated caller has an active `admin` role in `staff_users`. Rejects web caller spoofing.
- **`public.fn_can_access_inventory(p_auth_uid UUID)`**: Grants access if the caller is an Admin, has `"Inventory"` in `allowed_pages`, or has `can_borrow_tools = true`.
- **`public.fn_can_manage_cash(p_auth_uid UUID)`**: Grants access exclusively to `admin` and `accountant` roles.

### 2.2 Anti-Escalation Triggers
- **`trg_guard_staff_users_escalation`**: Prevents non-administrators from elevating their role, modifying `auth_user_id`, toggling `is_active`, or changing permissions.
- **`trg_guard_staff_users_dml`**: Restricts creation and deletion of staff records exclusively to administrators.
- **`trg_guard_roles_dml`**: Locks the `roles` table from modification by non-administrators.

### 2.3 Row Level Security (RLS) & Cash Boundary
Direct DML (`INSERT`, `UPDATE`, `DELETE`) is completely revoked from `PUBLIC`, `anon`, and `authenticated` roles across all 8 tables. All mutations must occur via `warehouse_dispatch`.
- `inventory_documents`, `inventory_document_lines`, and `inventory_movements` enforce cash separation:
  - Non-cash rows (`is_cash = false`, `doc_type NOT LIKE 'CASH_%'`) require `fn_can_access_inventory`.
  - Cash rows (`is_cash = true` or `doc_type LIKE 'CASH_%'`) strictly require `fn_can_manage_cash`.
- Banknote rows inside `inventory_items` are hidden from general inventory callers to prevent cash balances leaking into browser IndexedDB caches.

---

## 3. Shared Request Helpers

Shared between Core and Production runtime engines:

### 3.1 `warehouse_command_lookup`
```sql
warehouse_command_lookup(
    p_action TEXT,
    p_hash TEXT,
    p_key UUID,
    p_is_cash BOOLEAN DEFAULT false
) RETURNS JSONB;
```
- **Advisory Lock**: Acquires a transaction-level advisory lock `pg_advisory_xact_lock(hashtext(p_key::text))` to serialize concurrent duplicate requests.
- **Verification**: Verifies caller authentication and cash/inventory privileges.
- **Match Check**: Checks `public.inventory_documents` for an existing `idempotency_key = p_key`. If found:
  - If action, hash, and actor match, returns the cached `response_payload`.
  - If mismatched, raises an exception preventing key reuse.
- **Miss Check**: If not found, returns `NULL`.
- **Permissions**: Revoked from `PUBLIC`, `anon`, `authenticated`. Definer execution only.

### 3.2 `warehouse_command_finish`
```sql
warehouse_command_finish(
    p_action TEXT,
    p_hash TEXT,
    p_key UUID,
    p_response JSONB,
    p_document_id UUID DEFAULT NULL,
    p_is_cash BOOLEAN DEFAULT false
) RETURNS JSONB;
```
- **Storage Strategy**:
  - If `p_document_id` is supplied: If the document has no key or matches `p_key`, attaches the result directly onto that business document header. If the document already possesses a different creation key, creates a child `COMMAND` document referencing `p_document_id` via `parent_document_id`.
  - If `p_document_id` is `NULL`: Creates a standalone `COMMAND` document with `idempotency_key = p_key`.
- **Permissions**: Revoked from `PUBLIC`, `anon`, `authenticated`. Definer execution only.

---

## 4. `warehouse_dispatch` Business Actions Catalog

All mutations are routed through `public.warehouse_dispatch(p_action TEXT, p_payload JSONB, p_idempotency_key UUID)`.

### 4.1 Mixed Material & Tool Issue (`issue_create`, `material_issue`, `tool_borrow`)
Enforces atomic checkout of consumable/reusable items and serialized tool assets. If any item is out of stock or any tool is unavailable, the entire cart rolls back.
- **Payload**:
  ```json
  {
    "issue_type": "PRODUCTION_ISSUE" | "FIELD_ISSUE",
    "project_id": "P-0309",
    "round_id": "UUID (optional)",
    "round_code": "RN-01 (required if new field round)",
    "round_title": "15-site installation kit",
    "recipient_id": "UUID (optional)",
    "recipient_name": "ป้านิด",
    "team_members": ["ช่างเอก", "ช่างต้อม"],
    "project_ids": ["P-01", "P-02", ...],
    "due_date": "2026-11-15T18:00:00Z",
    "material_lines": [
      { "item_id": "UUID", "quantity": 10.0 }
    ],
    "tool_units": ["SC-01", "DR-15"],
    "notes": "Stage backdrop installation"
  }
  ```
- **Concurrency & Locking**: Deterministically sorts `material_lines` by `item_id` and `tool_units` by `unit_code` before executing `FOR UPDATE` queries to guarantee deadlock-free execution.
- **Tool Custody**: Creates a `TOOL_CUSTODY` line in `inventory_document_lines` and sets `asset_units.status = 'BORROWED'` and `active_custody_line_id = line_id`. Prevents double custody.
- **Field Kit (15 Projects)**: Links up to 15+ project locations via `ROUND_PROJECT` lines without duplicating physical tool checkouts.
- **Selective Refresh Return**:
  ```json
  {
    "success": true,
    "data": {
      "document_id": "UUID",
      "doc_number": "PRD-ISS-20261110-XXXX",
      "round_id": "UUID | null",
      "material_movements": [...],
      "tool_custodies": [...],
      "affected_item_ids": ["UUID"],
      "affected_unit_codes": ["SC-01"],
      "affected_project_ids": ["P-0309"]
    }
  }
  ```

### 4.2 Material Return Unused (`material_return_unused`)
Restores unused materials back to stock against the original issue movement.
- **Payload**:
  ```json
  {
    "project_id": "P-0309",
    "recipient_name": "Shop Return",
    "items": [
      { "source_issue_movement_id": "UUID", "quantity": 3.0 }
    ],
    "notes": "Unused ribbon"
  }
  ```
- **Validation**: Enforces `Cumulative Returns + Cumulative Recoveries + New Return <= Original Issued Quantity`.

### 4.3 Material Recovery & Direct Inspection (`material_recovery`)
Tracks returned reusable materials (e.g., artificial flowers, structures).
- **Payload**:
  ```json
  {
    "project_id": "P-0309",
    "recipient_name": "Recovery Team",
    "items": [
      {
        "source_issue_movement_id": "UUID",
        "recovered_qty": 100.0,
        "inspect_now": true,
        "good_qty": 90.0,
        "damaged_qty": 10.0,
        "notes": "10 flowers damaged by rain"
      }
    ],
    "notes": "Post-event teardown"
  }
  ```
- **Stock Delta**: Only `good_qty` increases stock balance (`RECOVERY_INSPECTED`). `damaged_qty` is recorded as `INSPECTION_REJECT_DAMAGED` with zero stock increment, preventing phantom losses or stock inflation.

### 4.4 Material Inspection (`material_inspect_recovery`)
Inspects previously pending recovery lines.
- **Payload**:
  ```json
  {
    "recovery_id": "UUID (line_id)",
    "good_qty": 90.0,
    "damaged_qty": 10.0
  }
  ```
- **Validation**: Enforces `good_qty + damaged_qty == recovery_line.quantity`. Updates line status to `'INSPECTED'`.

### 4.5 Tool Handover (`tool_handover`)
Explicit, chain-of-custody transfer between technicians without returning tools to the warehouse.
- **Payload**:
  ```json
  {
    "unit_codes": ["SC-01"],
    "to_recipient_id": "UUID (optional)",
    "to_recipient_name": "ช่างสมชาย",
    "accepted": true,
    "notes": "Handover at site B"
  }
  ```
- **Integrity**: Deactivates prior `TOOL_CUSTODY` line (`is_active = false`, `status = 'TRANSFERRED'`), creates a new active custody line referencing `source_line_id`, and updates `asset_units.active_custody_line_id`. Handover must be explicitly `accepted = true`.

### 4.6 Tool Return (`tool_return`)
Returns tools in good condition or reports broken/lost incidents.
- **Payload**:
  ```json
  {
    "returns": [
      { "unit_code": "SC-01", "condition": "good", "notes": "Cleaned" },
      { "unit_code": "DR-15", "condition": "broken", "notes": "Motor burned out" }
    ]
  }
  ```
- **Incident Generation**: Condition `'broken'` sets unit status to `'BROKEN'`, deactivates custody, and creates an `INCIDENT` document and line. Condition `'missing'` sets unit status to `'LOST'`. Recomputes parent `FIELD_ROUND` status automatically.

### 4.7 Legacy Tool Adoption (`tool_legacy_adopt_or_return`)
Supports tools borrowed under legacy schemas without custody records.
- **Payload**: `{ "unit_code": "LEG-01", "action": "return_available" | "adopt_custody" }`.

### 4.8 Catalog Metadata & Adjustment
- `category_create`: `{ "name": "...", "type": "consumable", "is_active": true }`
- `category_rename`: `{ "id": "UUID", "name": "..." }`
- `category_retire`: `{ "id": "UUID", "is_active": false }`
- `item_create`: `{ "code": "...", "name": "...", "category_id": "UUID", "item_type": "...", "unit": "...", "initial_stock": 0 }` (Creates audited `OPENING_STOCK` if `initial_stock > 0`).
- `item_save_metadata`: Modifies name, threshold, cost, color, size. Protects core identity from mutation once transactions exist.
- `stock_adjust`: `{ "item_id": "UUID", "delta_quantity": 5.0, "reason": "Inventory count surplus" }` (Strict reason required, creates `ADJUSTMENT` document and line).
- `unit_add`: `{ "item_id": "UUID", "unit_code": "TOOL-99", "notes": "..." }`

### 4.9 Recipients & Teams
- `recipient_create`: `{ "name": "...", "recipient_type": "individual", "contact_info": "..." }`
- `recipient_update`: `{ "id": "UUID", "name": "...", ... }`
- `team_create`: `{ "name": "ทีม A", "primary_receiver_name": "ช่างเอก", "member_names": ["ช่างเอก", "ช่างต้อม"] }` (Unified into `inventory_recipients`).

### 4.10 Banknote Cash Operations (Strict RBAC `fn_can_manage_cash`)
- `cash_counted_opening`: Recorded once per denomination to set physical baseline.
- `cash_deposit`: Adds physical banknotes to vault.
- `cash_reserve`: Locks banknotes for a specific project without physical removal (`physical_count >= reserved_count + count`).
- `cash_release_reservation`: Unlocks reserved banknotes back to available status.
- `cash_issue_batch`: Issues banknotes to a casual helper/florist for stuffing or bouquet preparation. Supports optional reservation consumption (`use_reservation = true`). Triggers `warehouse_sync_cash_work`.
- `cash_receive_prepared`: Records completed gift sets prepared from batch banknotes. Moves counts from helper custody to prepared status.
- `cash_return_unused_raw`: Returns unprocessed banknotes to the physical vault, with optional reservation retention (`keep_reservation = true`).
- `cash_handover_batch`: Transfers batch custody to another helper with explicit acceptance.
- `cash_deliver_to_customer`: Decrements prepared banknotes upon final customer handover.
- `cash_update_thresholds`: Modifies `low_alert_threshold` and `target_available_count`.
- `cash_adjust_count`: Corrects vault physical counts with a strict mandatory reason.

### 4.11 Quotation Checklist Save (`legacy_checklist_save`)
Saves quotation BOM requirements into `CHECKLIST` documents and lines without double-decrementing stock.

---

## 5. Read & Projection RPCs (Bounded Budgets)

### 5.1 `warehouse_schema_version() RETURNS INT`
Returns integer `2`.

### 5.2 `warehouse_get_summary() RETURNS JSONB`

Also returns `pending_recovery_count` / `pending_recoveries` and `borrowed_tools` record counts, the same bounded `facets` as the stock list, and per-item `tool_total` / `tool_available`. Facets use a maximum of 100 distinct values per field.
Designed for instantaneous dashboard boots without unbounded network payloads:
- `schema_version`: 2
- `categories`: Bounded to 100 active categories.
- `recipients`: Bounded to 100 active recipients.
- `teams`: Bounded to 50 active teams.
- `rounds`: Bounded to 20 active field rounds.
- `items`: Bounded strictly to the **first 50 items** (`lower(item_type) != 'banknote'`).
- `asset_units`: Empty array; loaded on-demand via `warehouse_list_units`.
- Total item and category counts included.

### 5.3 `warehouse_list_stock(p_filters JSONB) RETURNS JSONB`
Server-side pagination and faceted filtering:
- **Filters**: `limit` (default 50, max 100), `offset`, `search`, `item_type`, `category_id`, `color`, `size`, `storage_location` (or `location`), `status`, `availability` (`'in_stock'`, `'out_of_stock'`, `'low_stock'`), `item_ids[]`.
- **Returns**: `items` (including `tool_total` and `tool_available`), `facets` (`colors`, `sizes`, `locations`, `type_counts`), `total_count`, `has_more`, `limit`, `offset`.

### 5.4 `warehouse_list_units(p_filters JSONB) RETURNS JSONB`
On-demand serialized asset reader:
- **Filters**: `limit` (default 20, max 50), `offset`, `item_id`, `unit_code`, `status`, `search`.
- **Item Joining**: Joins parent item details (`id`, `name`, `code`, `unit`) to enable instantaneous QR code lookups for units whose parent items are not on stock page 1.

### 5.5 `warehouse_get_operations(p_filters JSONB) RETURNS JSONB`
Operational task queues (default 20 items per section, max 100):
- `issue_lines`: Outstanding issued items where `(issued - returned - recovered) > 0`.
- `recoveries`: Pending recovery lines waiting for sorting/inspection.
- `custodies`: Active tool custody lines with recipient and due date.
- `incidents`: Open broken/lost tool investigations.
- `has_more`: Boolean indicator.

### 5.6 `warehouse_get_history(p_filters JSONB) RETURNS JSONB`
Audit history (default 20, max 50):
- Excludes internal `COMMAND` records.
- Explicitly omits `metadata`, `response_payload`, and `idempotency_payload_hash` from the output projection to minimize payload size.
- Length-bounds `notes` to 256 characters (`substring(notes, 1, 256) || '...'`) to avoid transmitting massive legacy text payloads.
- Hides cash movements unless the caller has verified `fn_can_manage_cash`.

### 5.7 `warehouse_get_cash_summary() RETURNS JSONB`
Cash dashboard (Admin / Accountant only):
- 5 physical vault denomination rows (`denomination`, `physical_count`, `reserved_count`, `available_count`, `restock_needed`, `total_physical_value`, `total_available_value`).
- First 20 active reservations, first 20 active helper batches, first 20 prepared sets.
- `has_more_batches`, `has_more_reservations`, `has_more_prepared` pagination flags.

### 5.8 `warehouse_list_cash(p_filters JSONB) RETURNS JSONB`
Paginated cash section browser (default 20, max 50):
- **Sections**: `'batches'`, `'reservations'`, `'prepared'`, `'movements'`. Filterable by `project_id`.

### 5.9 `warehouse_get_checklists(p_filters JSONB) RETURNS JSONB`
Checklist reader (default 20, max 100) filterable by `project_id`.

### 5.10 `get_inventory_analytics() RETURNS JSON`
Backward-compatible inventory KPI analytics summary preserving exact PostgreSQL `RETURNS JSON` signature (preventing error 42P13 during live upgrades). Retains all 5 original master keys and adds granular breakdowns:
- `total_items_count`: Count of active catalog items (excluding banknotes).
- `total_asset_value`: Calculated server-side as `SUM(current_stock * average_cost)`.
- `low_stock_count`: Consumable items with stock at or below `min_alert_threshold`.
- `active_loans_count`: Active borrowed tool units queried from `asset_units(status = 'BORROWED')` (replacing retired `asset_loans`).
- `overdue_loans_count`: Overdue borrowed tool units queried from `asset_units(due_at < now())`.
- `total_assets`, `borrowed_assets`, `broken_assets`, `lost_assets`, `low_stock_items`: Extended telemetry without breaking existing callers.

---

## 6. Selective Refresh Client Integration

All mutating actions in `warehouse_dispatch` return affected entity identifiers in their response:
- `affected_item_ids: UUID[]`
- `affected_unit_codes: TEXT[]`
- `affected_project_ids: TEXT[]`

The frontend client uses these identifiers to selectively invalidate memory or query only changed entities via `warehouse_list_stock` and `warehouse_list_units`, completely avoiding full-catalog refetches.

---

## 7. Realtime Publication Strategy

Realtime is registered directly into Supabase's standard `supabase_realtime` publication, avoiding custom publications:
- **Replica identity**: Sets `ALTER TABLE public.inventory_documents REPLICA IDENTITY DEFAULT;`. This reduces OLD-row identity to the primary key; updated NEW rows can still contain the full row. Clients refresh only affected cards rather than assuming notifications are key-only.
- **Conditional Registration**: Registers `inventory_documents` into `supabase_realtime` only if the publication exists and the table is not already a member. In testing environments (such as PGlite) where `supabase_realtime` is absent, execution skips safely with a `NOTICE`.
- **Project Scoping**: Realtime subscribers listen to `inventory_documents` filtered by `project_id = eq.<current_project_id>`. Technical `COMMAND` documents set `project_id = NULL` to avoid broadcasting internal command execution states.
- **Cash Isolation**: Banknote vault counts are not broadcast over general websocket channels.
