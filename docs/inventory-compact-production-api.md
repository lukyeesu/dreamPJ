# Compact Inventory Production & People Runtime API Specification

This document defines the production and people runtime architecture, storage contracts, and public/internal RPC specifications for the compact inventory system (Free Supabase 5GB tier, zero permanent compatibility views, unified 8-table physical schema).

---

## 1. Architectural Principles & Storage Contracts

### 1.1 The 8 Physical Tables Foundation
The entire production and people domain maps directly onto the canonical physical tables without auxiliary staging tables or compatibility views:

1. **`inventory_recipients`**: Staff, casual helper, and team registry.
   - Staff users are bridged via `staff_user_id TEXT UNIQUE`. Staff IDs in `staff_users` can be UUID or TEXT; comparison is always type-agnostic `TEXT`.
   - Casual helpers and teams require no login/auth accounts.
   - Team attributes (`primary_receiver_name`, `member_names`, `team_is_active`) are merged directly onto the recipient row.
   - Listing and resolution responses include the names and identifiers needed for selection, and omit phone numbers, email, and credentials.
2. **`inventory_documents`**: Typed business headers:
   - Work tasks: `doc_type = 'WORK'`. Holds `project_id`, `recipient_id`, `title`, `due_at`, `status`, `version`, `is_cash`, and `source_document_id`.
   - Work submissions: `doc_type = 'SUBMISSION'`. Holds `parent_document_id` (pointing to WORK document) and submitter snapshot.
   - Work inspections: `doc_type = 'INSPECTION'`. Holds `parent_document_id` (pointing to SUBMISSION document) and `source_document_id` (pointing to WORK document).
   - Cash work documents have `is_cash = true` and `source_document_id` referencing their canonical `CASH_BATCH` document.
   - Realtime triggers listen on `inventory_documents` filtered by `project_id`. Updating the WORK header `version` on every child state change drives reactive UI updates without polling.
3. **`inventory_document_lines`**: Typed detail deliverables and inspection rows:
   - Output deliverables: `line_type = 'WORK_OUTPUT'`. Counters: `required_qty`, `submitted_qty`, `accepted_qty`, `rejected_qty`, `pending_qty`.
   - Submission lines: `line_type = 'SUBMISSION'`. References `source_line_id` pointing to `WORK_OUTPUT` line.
   - Inspection lines: `line_type = 'INSPECTION'`. References `source_line_id` pointing to `SUBMISSION` line.
4. **`inventory_movements`**: Immutable audit event log:
   - Work lifecycle events: `movement_type = 'WORK_EVENT'`.
   - Zero physical stock delta (`delta_stock = 0`, `quantity = 0`), with structured transition metadata stored in `metadata JSONB`.

### 1.2 Build Piece Guard
`compact_production.sql.part` is a component of the unified installer. It begins with a fail-closed guard:
```sql
DO $$
BEGIN
    IF coalesce(current_setting('flower.compact_build', true), '') <> 'v2' THEN
        RAISE EXCEPTION 'compact_production.sql.part must be executed within inventory_compact installer (flower.compact_build=v2 required)';
    END IF;
END $$;
```
It contains no `BEGIN` or `COMMIT` statements; the root installer concatenates `compact_schema.sql.part`, `compact_core.sql.part`, and `compact_production.sql.part` into a single atomic transaction.

---

## 2. People Registry RPCs

### 2.1 `warehouse_list_people(p_query TEXT DEFAULT '', p_limit INT DEFAULT 20) RETURNS JSONB`
Lists active staff members and casual helpers/teams for dropdown pickers.
- **Access**: `authenticated` role.
- **Boundaries**: `p_limit` bounded between 1 and 100 (default 50).
- **PII Stripping**: Never exposes passwords, citizen IDs, emails, or home addresses.
- **Key Schema**:
  - `staff:<id>` for active staff users.
  - `recipient:<uuid>` for casual helpers and teams.
- **Output Structure**:
  ```json
  [
    {
      "key": "staff:11111111-1111-4111-8111-111111111111",
      "recipient_id": "99999999-9999-4999-8999-999999999999",
      "staff_user_id": "11111111-1111-4111-8111-111111111111",
      "name": "Somchai Jaidee",
      "kind": "staff",
      "code": "11111111-1111-4111-8111-111111111111",
      "primary_receiver_name": "Somchai Jaidee",
      "member_names": []
    },
    {
      "key": "recipient:a1111111-1111-4111-8111-111111111111",
      "recipient_id": "a1111111-1111-4111-8111-111111111111",
      "staff_user_id": null,
      "name": "Panid Dokmaisod",
      "kind": "casual_helper",
      "code": "a1111111",
      "primary_receiver_name": "Panid Dokmaisod",
      "member_names": []
    }
  ]
  ```

### 2.2 `warehouse_resolve_person(p_person_key TEXT) RETURNS JSONB`
Resolves a picker key (`staff:<id>` or `recipient:<uuid>`) into a canonical `inventory_recipients` record.
- **Access**: `authenticated` with inventory or cash permission (`fn_can_access_inventory` or `fn_can_manage_cash`).
- **Staff Bridging**: Automatically creates or updates an `inventory_recipients` row on conflict (`staff_user_id`), returning a stable canonical recipient UUID.

---

## 3. Private Production Integration Helpers

These functions are strictly private to definer functions (`REVOKE ALL FROM PUBLIC, anon, authenticated`).

### 3.1 `warehouse_ensure_production_work(p_issue_document_id UUID) RETURNS UUID`
Called by core issue actions for `PRODUCTION_ISSUE` documents after physical stock/tool custody lines are written.
- Creates a linked `WORK` document (`doc_type = 'WORK'`, `source_document_id = p_issue_document_id`, `version = 1`, `status = 'in_progress'`).
- Seeds default `WORK_OUTPUT` deliverable line (`required_qty = 1.00`, unit `'ชุด'`).
- Logs a `WORK_EVENT` audit record in `inventory_movements`.
- Idempotent: returns existing linked `WORK` document ID if already present.

### 3.2 `warehouse_sync_cash_work(p_batch_document_id UUID) RETURNS VOID`
Called by core cash actions after batch line updates (issuance, handover, return, prepared set verification).
- Synchronizes the cash WORK document (`is_cash = true`, `source_document_id = p_batch_document_id`).
- When `prepared_count` increases:
  - Generates audit receipts (`SUBMISSION` document + line, `INSPECTION` document + line) documenting the verified banknote receipt.
  - Updates `WORK_OUTPUT` line `accepted_qty = prepared_count`.
  - Zero duplicate cash counts or extra physical cash movements created.

---

## 4. Production Issue & Work Creation

### 4.1 `warehouse_create_production_issue(p_issue JSONB, p_work JSONB, p_idempotency_key UUID) RETURNS JSONB`
Atomic composite wrapper that issues materials/tools and customizes work deliverables in a single transaction.
- **Idempotency**: Calculates historical production hash `md5('production_issue_create:' || p_issue::text || ':' || coalesce(p_work::text, '{}'))`.
- **Validation Upfront**: Pre-validates all deliverables in `p_work->'lines'` before invoking core dispatcher, ensuring complete rollback if any deliverable line is malformed.
- **Atomic Dispatch**: Calls `warehouse_dispatch('issue_create', ...)` using the SAME idempotency key.
- **Work Replacement**: Locates the auto-created WORK document from `warehouse_ensure_production_work`, updates title/due_at, and replaces the default 1-unit deliverable with the requested deliverables.
- **Request Cache Override**: Atomically updates the issue document's `action_name`, `idempotency_payload_hash`, and `response_payload` to `production_issue_create`, preventing double-logging or orphaned cache entries.

---

## 5. Production Assignment Lifecycle RPCs

### 5.1 `warehouse_create_assignment(p_payload JSONB, p_idempotency_key UUID) RETURNS JSONB`
Creates a standalone production task without material issues.
- **Payload**: `{ project_id, title, person_key, recipient_id, recipient_name, due_at, lines }`.
- **Outputs**: Seeds `WORK_OUTPUT` lines in `inventory_document_lines`.

### 5.2 `warehouse_update_assignment(p_payload JSONB, p_idempotency_key UUID) RETURNS JSONB`
Modifies title, due date, or remaining deliverable quantities with optimistic locking.
- **Optimistic Concurrency**: `expected_version` (positive integer) is mandatory. Returns error if stale.
- **Row Locking**: Holds `FOR UPDATE` on the parent WORK document.
- **Foreign Line Rejection**: Rejects any line ID not belonging to this assignment.
- **Quantity Bounds**: Cannot reduce `required_qty` below `accepted_qty + pending_qty`.
- **History Meaning Preservation**: If `accepted_qty > 0`, editing `description` or `unit` is rejected.
- **Cash Isolation**: Direct line edits on `is_cash = true` assignments are blocked.

### 5.3 `warehouse_split_assignment(p_payload JSONB, p_idempotency_key UUID) RETURNS JSONB`
Splits unsubmitted remaining deliverables to another person as a child assignment.
- **Child Assignment**: Created with `parent_document_id = parent.id`.
- **Quantity Safety**: Only unsubmitted work (`required_qty - accepted_qty - pending_qty`) can be split.
- **Parent Deduction**: Parent required quantity is reduced by the split amount without duplicating stock or deliverables.
- **Cash Isolation**: Direct split on cash assignment is blocked (must use canonical cash handover).

### 5.4 `warehouse_submit_work(p_payload JSONB, p_idempotency_key UUID) RETURNS JSONB`
Helper or staff submits partial or full work for inspection.
- **Submission Header**: Created in `inventory_documents` (`doc_type = 'SUBMISSION'`, `status = 'pending'`).
- **Submission Lines**: Created in `inventory_document_lines` (`line_type = 'SUBMISSION'`, `source_line_id = work_line.id`).
- **Pending Semantics**: `pending_qty = quantity`.
- **Strict Bounds**: `accepted_qty + pending_qty + submit_qty <= required_qty`.
- **Parent Status**: Transitions WORK status to `'submitted'` if currently `'in_progress'`.
- **Cash Isolation**: Generic submit on cash assignment is blocked.

### 5.5 `warehouse_inspect_work(p_payload JSONB, p_idempotency_key UUID) RETURNS JSONB`
Staff inspects a submission with per-line accept/reject counts.
- **Inspection Header**: Created in `inventory_documents` (`doc_type = 'INSPECTION'`, `status = 'completed'`).
- **Inspection Lines**: Created in `inventory_document_lines` (`line_type = 'INSPECTION'`, `source_line_id = submission_line.id`).
- **Counter Flow**:
  - `accepted_qty` increases on submission line and WORK deliverable.
  - `rejected_qty` increases on submission line and WORK deliverable.
  - `pending_qty` decreases by `accepted_qty + rejected_qty`.
  - Rejection frees unsubmitted work (`required_qty - accepted_qty - pending_qty`) for resubmission.
- **Reversion**: If work remains unaccepted and no other pending submissions exist, WORK status reverts to `'in_progress'`.
- **Cash Isolation**: Generic inspect on cash assignment is blocked.

### 5.6 `warehouse_set_assignment_status(p_payload JSONB, p_idempotency_key UUID) RETURNS JSONB`
Updates assignment status (`in_progress`, `submitted`, `completed`, `problem`, `cancelled`).
- **Completion Check**: Explicit completion requires all deliverables to have `accepted_qty >= required_qty` and `pending_qty = 0`.
- **Reason Required**: Mandatory non-empty reason for `'problem'` and `'cancelled'` statuses. Physical custody and cash balances are preserved.
- **Cash Security**: Changing status of cash assignments requires `fn_can_manage_cash`.

---

## 6. Read Budget & Production Board RPCs

### 6.1 `warehouse_load_production_project(p_project_id TEXT, p_limit INT DEFAULT 25, p_offset INT DEFAULT 0) RETURNS JSONB`
Bounded project board loader designed for strict network budget.
- **Limits**: Default 25, maximum 50 tasks.
- **Bounded Receipt Preview**: Only includes the first 5 submissions per task and latest inspection check info. Sets `has_more_submissions: true` if older submissions exist.
- **Project Readiness**: `ready_for_next_step` is strictly `true` only when `assignment_count > 0`, `completed_count > 0`, and all assignments are resolved (`completed + cancelled = total`). Never true for empty projects or when all tasks are cancelled.
- **Cash Privacy**: Non-cash callers receive no cash assignment rows, and summary counts exclude cash tasks. Generic `has_restricted_work: true` flag is returned without exposing amounts.

### 6.2 `warehouse_get_work_details(p_assignment_id UUID, p_limit INT DEFAULT 20, p_offset INT DEFAULT 0) RETURNS JSONB`
On-demand detailed receipt and inspection history loader for a specific task.
- Loads complete submission records with full inspection details, timestamps, inspector identities, and per-line breakdowns.
- Paginates via `p_limit` (default 20, max 100) and `p_offset`.

### 6.3 `warehouse_get_work_cards(p_project_id TEXT, p_assignment_ids UUID[]) RETURNS JSONB`
Targeted refresh for up to 25 tasks.
- Returns complete work card JSON structures for the requested task IDs.
- Clients subscribe to `inventory_documents` filtered by `project_id`, receive header change notifications, and invoke `warehouse_get_work_cards` for only the modified IDs rather than reloading the entire project board.

### 6.4 `warehouse_inspect_production_cash(p_payload JSONB, p_idempotency_key UUID) RETURNS JSONB`
Canonical single-RPC cash inspection.
- **Access**: Strictly restricted to cash management roles (`fn_can_manage_cash`).
- **Resolution**: Accepts `assignment_id` (or `batch_id`), resolves the linked `CASH_BATCH` document, denomination, and project ID directly inside PostgreSQL without client-side REST queries to retired tables.
- **Core Dispatch**: Calls `warehouse_dispatch('cash_receive_prepared', ...)` to verify prepared banknotes in the physical vault and trigger automatic audit receipts via `warehouse_sync_cash_work`.
