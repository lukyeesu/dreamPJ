# Project Production Hub Backend — Architecture, Database Schema & Frontend Service Contract

> Historical pre-compact schema. Production records now share inventory documents, lines, and movements under the eight-table compact contract. Install only `database_scripts/inventory_compact.sql`; use `inventory-compact-production-api.md` for the current API.

## 1. Overview & Architectural Principles

The Project Production Hub extends Plan C with a unified, real-time tracking engine for project manufacturing and inspection workflows (e.g., project `P-0001`). It provides clear visibility across 10+ helpers, tracking who owns what, required expected outputs, actual submitted quantities, staff inspection results (accepted/rejected/pending), and outstanding work.

### Core Guarantees:
1. **Single Source of Truth & Zero Inventory/Cash Duplication**:
   - Material/tool issues are recorded through the core warehouse ledger. The production hub tracks the *resulting deliverables/outputs*, not the input materials.
   - Cash folding/assembly tasks derive from `cash_helper_batches`. Actual physical banknotes and vault balances are governed by core cash transactions (`cash_receive_prepared`), not arbitrary manual number increments.
2. **Strict Server-Verified RBAC & Anti-Escalation**:
   - Permissions derive from `auth.uid() -> staff_users.auth_user_id -> roles`.
   - Hardened `SECURITY DEFINER` functions prevent non-admin staff from modifying `role_id`, `auth_user_id`, `id`, `is_active`, or permission fields.
   - Fail-closed ternary boolean handling: `fn_is_admin` strictly coerces unknown or unmapped users to `false`. Anonymous callers without a JWT are blocked from gaining administrative privileges.
   - Cash task details, denominations, and values are strictly restricted to `admin` and `accountant` roles. Regular helpers and non-cash staff cannot view cash details.
3. **Non-Destructive Evolution & Audit History**:
   - Edits to expected quantities, splitting remaining unsubmitted work across helpers, or cancellations preserve all previous acceptance receipts, material custody, and cash history.
   - Rejection of submitted work frees remaining quantity for rework/replacement.
   - Foreign key from `production_assignments.project_id` to `projects(id)` uses `ON DELETE RESTRICT` (adjusted idempotently), preventing accidental project deletion from wiping financial and custody audit records.
   - Completed status is blocked until all required outputs are accepted, pending is zero, and staff explicitly confirms completion.
4. **Persisted Idempotency & Concurrency Protection**:
   - Double-clicks and network retries serialize on request UUID via `pg_advisory_xact_lock(hashtext(key))`.
   - Updates, status changes, and work splits enforce optimistic locking via `expectedVersion` to prevent stale overwrites.
5. **Realtime Subscription & Debounced Sync**:
   - Listens to PostgreSQL table events filtered by `project_id`.
   - Debounces bursts by 200ms to eliminate UI reload storms.
   - Memory-safe cleanup on unmount, project change, or session change.

---

## 2. Database Schema (`database_scripts/inventory_production_hub.sql`)

### 2.1 Table Definitions

#### `public.production_assignments`
Tracks task ownership and progress for a specific project.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT` (Strictly protects historical custody & financial records)
- `recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE SET NULL`
- `responsible_name TEXT NOT NULL` (immutable snapshot)
- `team_members_snapshot TEXT[] DEFAULT '{}'` (snapshot of team members)
- `title TEXT NOT NULL`
- `due_at TIMESTAMPTZ`
- `status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'completed', 'problem', 'cancelled'))`
- `source_document_id UUID UNIQUE REFERENCES public.inventory_documents(id) ON DELETE SET NULL`
- `source_cash_batch_id UUID UNIQUE REFERENCES public.cash_helper_batches(id) ON DELETE SET NULL`
- `cash_only BOOLEAN NOT NULL DEFAULT false`
- `version INTEGER NOT NULL DEFAULT 1`
- `created_by_auth_user_id UUID`
- `created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())`
- `updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())`

#### `public.production_assignment_lines`
Defines expected deliverables and tracks progress quantities.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `assignment_id UUID NOT NULL REFERENCES public.production_assignments(id) ON DELETE CASCADE`
- `description TEXT NOT NULL`
- `required_qty NUMERIC(12,2) NOT NULL CHECK (required_qty >= 0)`
- `unit TEXT NOT NULL DEFAULT 'ชุด'`
- `is_active BOOLEAN NOT NULL DEFAULT true`
- `submitted_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (submitted_qty >= 0)`
- `accepted_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0)`
- `rejected_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0)`
- `pending_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pending_qty >= 0)`
- `created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())`
- `updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())`

> **Quantity Semantics**:
> - `remaining_qty = required_qty - accepted_qty` (work not yet passed inspection)
> - `must_submit_qty = required_qty - accepted_qty - pending_qty` (unsubmitted work needing submission or rework)
> - Units are never mixed across different items into a single aggregate total.

#### `public.production_submissions`
Records physical submission attempts by helpers.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `assignment_id UUID NOT NULL REFERENCES public.production_assignments(id) ON DELETE CASCADE`
- `submitted_by_auth_user_id UUID`
- `submitted_by_name TEXT NOT NULL`
- `note TEXT`
- `status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'inspected', 'partially_inspected'))`
- `submitted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())`
- `created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())`

#### `public.production_submission_lines`
Line items within a submission.
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `submission_id UUID NOT NULL REFERENCES public.production_submissions(id) ON DELETE CASCADE`
- `line_id UUID NOT NULL REFERENCES public.production_assignment_lines(id) ON DELETE CASCADE`
- `quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0)`
- `accepted_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0)`
- `rejected_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0)`
- `pending_qty NUMERIC(12,2) GENERATED ALWAYS AS (quantity - accepted_qty - rejected_qty) STORED`
- Constraint: `CHECK (accepted_qty + rejected_qty <= quantity)`

#### `public.production_inspections` & `public.production_inspection_lines`
Immutable audit log of staff inspection decisions.
- `inspector_auth_user_id UUID`, `inspector_name TEXT`, `inspected_at TIMESTAMPTZ`
- Stores exact accepted and rejected counts per submission line.

#### `public.production_assignment_events`
Audit history of lifecycle events (created, edited, split, status_changed, etc.) with reason logging.

### 2.2 People Registry Enhancements
- Adds `staff_user_id TEXT` (nullable, unique where not null) to `public.inventory_recipients`.
- Type-agnostic text reference safely bridges both UUID and TEXT (`staff_code`) schemas of `staff_users.id`.
- `warehouse_list_people(p_query, p_limit)`: Returns combined active staff and recipients, omitting all PII.
- `warehouse_resolve_person(p_person_key)`: Resolves `staff:<id>` or `recipient:<uuid>` into canonical recipient record with stable UUID.

---

## 3. Seamless Inventory & Cash Integration

1. **Automatic Material Issue Trigger**:
   - `AFTER INSERT` trigger on `public.inventory_documents` creates a linked default production assignment (`title: 'งานผลิตตามใบเบิก [DOC]'`) with 1 default output line (`'งานผลิตตามใบเบิก'`, `1.00`, `'ชุด'`).
2. **Unified Issue + Work Creation RPC (`warehouse_create_production_issue`)**:
   - Executes core `warehouse_dispatch('issue_create', ...)` and replaces the default output line with the customized work outputs in the **same transaction**.
   - If work outputs are invalid, all inventory deductions, tool custody records, and issue vouchers roll back completely.
3. **Cash Helper Batch Trigger**:
   - `AFTER INSERT OR UPDATE` trigger on `public.cash_helper_batches` creates or syncs a `cash_only` production assignment.
   - `required_qty = issued_count - returned_raw_count - handed_over_count`
   - `accepted_qty = prepared_count`
   - Handover to another helper automatically reduces source requirement and creates a new assignment for the target recipient.
   - Returning unused raw cash reduces required count.
   - Inspections of cash work call core `cash_receive_prepared`, ensuring no fake vault deposits or double counted banknotes.

---

## 4. Frontend Service API (`src/services/productionService.js`)

### 4.1 People Pickers & Resolution
```js
// 1. List active staff & casual helpers/teams for dropdowns (PII-free)
const { people, has_more } = await listWarehousePeople({ query: 'นิด', limit: 50 });
// Returns: [{ key: 'staff:2611001', recipient_id: 'uuid', staff_user_id: '2611001', name: 'ป้านิด', kind: 'staff', code: '2611001' }]

// 2. Resolve selected person to canonical recipient UUID before submission
const canonicalPerson = await resolveWarehousePerson({ personKey: 'staff:2611001' });
// Returns: { recipient_id: 'uuid', name: 'ป้านิด', recipient_type: 'staff', primary_receiver_name: 'ป้านิด', member_names: [] }
```

### 4.2 Project Production Board Loader
```js
const board = await loadProductionProject({ projectId: 'P-0001', limit: 100, offset: 0 });
/*
Returns:
{
  project: { id: 'P-0001', name: 'งานแต่งคุณมิ้นท์' },
  assignments: [
    {
      id: 'uuid',
      title: 'งานจัดช่อกุหลาบ 10 ช่อ',
      status: 'in_progress', // 'in_progress' | 'submitted' | 'completed' | 'problem' | 'cancelled'
      version: 1,
      recipient_id: 'uuid',
      responsible_name: 'ป้านิด',
      team_members_snapshot: [],
      due_at: '2026-11-15T18:00:00Z',
      source_document_id: 'uuid',
      source_cash_batch_id: null,
      cash_only: false,
      lines: [
        {
          id: 'uuid',
          description: 'ช่อกุหลาบแดงทรงสูง',
          unit: 'ช่อ',
          required_qty: 10,
          submitted_qty: 6,
          accepted_qty: 4,
          rejected_qty: 0,
          pending_qty: 2,
          remaining_qty: 6 // 10 - 4
        }
      ],
      submissions: [
        {
          id: 'uuid',
          submitted_at: '2026-11-12T10:00:00Z',
          submitted_by_name: 'ป้านิด',
          note: 'ส่งมอบรอบแรก 6 ช่อค่ะ',
          status: 'partially_inspected',
          lines: [
            {
              id: 'uuid',
              line_id: 'uuid',
              quantity: 6,
              accepted_qty: 4,
              rejected_qty: 0,
              pending_qty: 2
            }
          ],
          inspections: [
            {
              id: 'uuid',
              inspector_name: 'ช่างสมชาย (QC)',
              inspected_at: '2026-11-12T10:30:00Z',
              notes: 'ตรวจสอบเรียบร้อย ดอกไม้บานสวยงาม',
              lines: [
                {
                  id: 'uuid',
                  submission_line_id: 'uuid',
                  accepted_qty: 4,
                  rejected_qty: 0,
                  notes: 'ผ่านเกณฑ์มาตรฐาน'
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  summary: {
    assignment_count: 5,
    completed_count: 2,
    pending_review_count: 1,
    problem_count: 0,
    cancelled_count: 0,
    ready_for_next_step: false, // Strictly false if assignment_count == 0 or completed_count == 0
    has_restricted_work: false
  },
  permissions: {
    can_check: true,
    can_manage_cash: false
  },
  updated_at: '2026-11-10T12:00:00Z',
  has_more: false
}
*/
```

### 4.3 Issue Creation with Production Work
```js
const result = await createProductionIssue({
  issue: {
    projectId: 'P-0001',
    recipientName: 'ป้านิด',
    recipientId: canonicalPerson.recipient_id,
    dueDate: '2026-11-15T18:00:00Z',
    materialLines: [{ itemId: 'item-uuid', quantity: 15 }],
    toolUnits: ['SC-01']
  },
  work: {
    title: 'ผลิตช่อกุหลาบ 10 ช่อ',
    dueAt: '2026-11-15T18:00:00Z',
    lines: [
      { description: 'ช่อกุหลาบแดงทรงสูง', requiredQty: 10, unit: 'ช่อ' }
    ]
  },
  idempotencyKey: 'optional-uuid'
});
```

### 4.4 Task Lifecycle Operations
```js
// Standalone assignment creation (without material issue)
await createProductionAssignment({
  projectId: 'P-0001',
  title: 'เตรียมโครงซุ้มดอกไม้',
  personKey: 'recipient:uuid',
  dueAt: '2026-11-14T12:00:00Z',
  lines: [{ description: 'โครงเหล็กดัด', requiredQty: 1, unit: 'ชุด' }]
});

// Update title, due date, or remaining quantities
await updateProductionAssignment({
  assignmentId: 'uuid',
  expectedVersion: 1,
  title: 'งานผลิตช่อกุหลาบ 12 ช่อ (เพิ่มพิเศษ)',
  lines: [{ id: 'line-uuid', description: 'ช่อกุหลาบแดงทรงสูง', requiredQty: 12, unit: 'ช่อ' }],
  reason: 'ลูกค้าขอเพิ่ม 2 ช่อ'
});

// Split unsubmitted remaining work to another helper
await splitProductionAssignment({
  assignmentId: 'source-assignment-uuid',
  expectedVersion: 2,
  toPersonKey: 'staff:2611002',
  lineQuantities: [{ lineId: 'line-uuid', quantity: 4 }],
  title: 'งานแบ่งผลิตช่อกุหลาบ 4 ช่อ',
  reason: 'แบ่งให้คุณอ้อมช่วยทำเนื่องจากใกล้เวลาส่งมอบ'
});

// Helper submits work (partial delivery)
await submitProductionWork({
  assignmentId: 'uuid',
  lines: [{ lineId: 'line-uuid', quantity: 4 }],
  note: 'ส่งรอบแรก 4 ช่อเรียบร้อยค่ะ'
});

// Staff inspects submission
await inspectProductionWork({
  submissionId: 'submission-uuid',
  lines: [{ submissionLineId: 'sub-line-uuid', acceptedQty: 4, rejectedQty: 0 }],
  note: 'ตรวจเรียบร้อย ดอกไม้บานสวยงาม'
});

// Explicit staff completion / status transition
await setProductionStatus({
  assignmentId: 'uuid',
  expectedVersion: 2,
  status: 'completed', // Only succeeds if all required lines accepted and pending=0
  reason: 'ตรวจรับผ่านครบถ้วน'
});

// Cash inspection (Requires Admin/Accountant role)
await inspectProductionCash({
  assignmentId: 'cash-assignment-uuid',
  noteCount: 50,
  notes: 'รับธนบัตรพับเสร็จ 50 ใบเข้าชุดงาน'
});
```

### 4.5 Real-Time Project Subscription
```js
const unsubscribe = subscribeProductionProject(
  'P-0001',
  (updatedProjectId) => {
    // Debounced trigger (200ms) - reload project board data
    refreshBoard();
  },
  (status) => {
    // Connection status listener ('CONNECTED' | 'DISCONNECTED')
  }
);

// Cleanup on unmount or project change
unsubscribe();
```

---

## 5. Security Assessment & Base Table Hardening

### 5.1 Direct REST Table Write Bypass Lockdown (`inventory_items`, `asset_units`, Legacy Tables)
- **Closure of REST Table Mutation Bypass**:
  All direct mutations (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`) on `public.inventory_items` and `public.asset_units` are strictly revoked from `PUBLIC`, `anon`, and `authenticated`.
  Even if legacy permissive RLS policies (e.g. `Allow app full access WITH CHECK (true)`) exist on the database, PostgreSQL table-level privilege checks take precedence, completely blocking direct REST client modifications (`.insert()`, `.update()`, `.delete()`).
- **Invoker Trigger Bypass Closure**:
  In legacy schemas (`database_scripts/supabase_master_schema.sql` lines 419 and 524), `process_inventory_disposal` and `auto_update_stock_on_procurement` were declared as `SECURITY INVOKER`. If unauthenticated or technician callers could insert into `inventory_procurements` or `inventory_disposals`, the invoker triggers would have modified `inventory_items.current_stock` behind the scenes. Direct `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` privileges on `inventory_procurements` and `inventory_disposals` (if existing) are revoked from `PUBLIC`, `anon`, and `authenticated`, closing this alternate mutation route entirely.
- **Sole Transactional Mutation Route (`warehouse_dispatch`)**:
  All inventory mutations (issue creation, metadata updates, stock adjustments, tool borrowing/returns, recoveries) are exclusively routed through transactional `SECURITY DEFINER` RPCs (`warehouse_dispatch`). Database owner / superuser maintenance tasks remain fully operational.
- **Legacy Write Exports Deprecation Notice**:
  Legacy direct write exports (`saveInventoryItemSync`, `saveAssetUnitSync`, direct delete exports) have zero active callers in the current frontend UI and are formally deprecated. Old clients must upgrade to the transactional RPC interface (`warehouse_dispatch`). There is no silent fallback to direct table writes; unauthorized direct attempts fail immediately with PostgreSQL error `42501 (permission denied)`.

### 5.2 Legacy Banknote Privacy & Restrictive RLS Architecture
- **Correction of Historical Assumptions**:
  Previous documentation claimed that banknote items in `inventory_items` were purely "static denomination definitions" with zero balance meaning. In reality, legacy banknote rows in `inventory_items` may contain historical real cash counts in their `current_stock` column.
- **Anonymous SELECT Revocation**:
  Anonymous `SELECT` on `public.inventory_items` and `public.asset_units` is revoked from `PUBLIC` and `anon`. Anonymous callers receive a 42501 permission denied error.
- **PostgreSQL Restrictive Row Level Security Policy**:
  A PostgreSQL `AS RESTRICTIVE` policy (`rls_restrict_banknote_inventory_items`) is installed on `public.inventory_items`:
  ```sql
  CREATE POLICY rls_restrict_banknote_inventory_items ON public.inventory_items
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (lower(item_type) <> 'banknote' OR public.fn_can_manage_cash(auth.uid()));
  ```
  Because PostgreSQL evaluates all permissive policies with `OR` and subsequently evaluates restrictive policies with `AND`:
  `[Permissive Conditions] AND [Restrictive Conditions]`
  even if an old permissive policy (such as `"Allow app full access" USING (true)`) is present on `inventory_items`, technician and non-cash staff queries cannot expose legacy banknote rows or their `current_stock`. Technicians and general staff only see regular consumables, assets, and reusable materials.
- **Authoritative Cash Management & Pre-Existing Aggregate RPC Limitation**:
  Authorized cash roles (`admin` and `accountant`) retain visibility into banknote rows. The authoritative physical cash count is provided exclusively via the restricted RPC `warehouse_get_cash_summary()`, which enforces `fn_can_manage_cash(auth.uid())`.
  *Pre-existing limitation note*: Pre-existing server analytics RPCs created in legacy migrations (such as `get_inventory_analytics()`) run as `SECURITY DEFINER` and perform broad mathematical sums across all active items without denomination filtering. In accordance with surgical scope rules, pre-existing financial analytics functions outside this feature are preserved as-is. Therefore, no claim of 100% absolute privacy is made regarding pre-existing legacy aggregate RPC outputs.

### 5.3 Anti-Privilege Escalation Triggers
- **Fail-Closed Boolean Coercion**: `fn_is_admin(p_auth_uid)` strictly evaluates `coalesce(v_role_name = 'admin', false)`. Unknown auth UUIDs evaluate to `false` (avoiding SQL NULL ternary logic bypasses).
- **Session Role Verification**: Distinguishes direct DB owner maintenance (no JWT, session_user not a web role) from unauthenticated web callers (`SET ROLE anon;` or `SET ROLE authenticated;` with empty sub claim).
- **Profile Field Whitelist**: Non-admin staff attempting to update their own record in `staff_users` can only update non-privileged profile fields (`nickname`, `phone`, `profile_image_url`, `address`, `emergency_contact`, `full_name`, `username`, `email`, `updated_at`). Any attempt to alter `role_id`, `auth_user_id`, `id`, `is_active`, or permissions fields is blocked by `trg_guard_staff_users_escalation`.
- **Role Table Lockdown**: `trg_guard_roles_dml` blocks all non-admin INSERT, UPDATE, or DELETE on `public.roles`, regardless of any existing permissive legacy policies.

### 5.4 Backend Review Corrections & Hardened Invariants (Supervisor Audit Fixes)
1. **Universal Definer Write RBAC**:
   - `warehouse_update_assignment`, `warehouse_split_assignment`, `warehouse_submit_work`, `warehouse_inspect_work`, and `warehouse_set_assignment_status` all strictly enforce `fn_can_access_inventory(auth.uid())`.
   - Users with roles lacking inventory permission (such as `driver`) are blocked immediately from modifying assignments even if they have an active staff record.
   - Any modification or status change on a `cash_only` assignment requires `fn_can_manage_cash(auth.uid())`.
2. **Line Integrity & Historical Meaning Preservation**:
   - `warehouse_update_assignment` validates that every updated line belongs to the specified assignment (`WHERE id = v_line_id AND assignment_id = v_assign_id`). Foreign line IDs are rejected.
   - Duplicate line IDs in the update payload are rejected with an explicit error.
   - If a line has `accepted_qty > 0`, altering `description` or `unit` is rejected. Once deliverables have been accepted, their identity cannot be re-interpreted; new outputs must be added as new lines.
   - Required quantity cannot be decreased below `accepted_qty + pending_qty`.
3. **Non-Null Positive Optimistic Locking Version**:
   - `expected_version` is required to be a non-null, positive integer (`>= 1`) in `warehouse_update_assignment`, `warehouse_split_assignment`, and `warehouse_set_assignment_status`.
   - Omitted or null `expected_version` cannot bypass the version check through SQL ternary NULL logic.
4. **Cash Assignment Action Lockdown**:
   - `warehouse_submit_work` and `warehouse_inspect_work` reject generic submissions/inspections on `cash_only` assignments.
   - Prepared banknotes flow strictly through `cash_receive_prepared` and database triggers, preventing double counts or unbacked accepted deliverables.
   - `inspectProductionCash` passes the canonical `{ batch_id, note_count, notes }` payload matching the core warehouse dispatcher.
5. **Idempotent Metadata Backfill**:
   - An idempotent `DO $$` block in Section 6.3 synchronizes pre-existing `PRODUCTION_ISSUE` documents and `cash_helper_batches` created prior to trigger deployment.
   - Backfill is purely metadata synchronization: zero physical movements or balance adjustments occur, and reruns produce zero duplicate assignments or event spam.
6. **Complete Board Audit Payload**:
   - `warehouse_load_production_project` embeds submission `note` and a nested `inspections` array containing `inspector_name`, `inspected_at`, `notes`, and per-line acceptance/rejection breakdown.
   - Enables rich UI display of helper comments, quality inspector verification, and rejection reasons.
