# Compact Inventory Schema & Lossless Migration Specification (v2)

Run the complete `database_scripts/inventory_compact.sql` installer. The three `database_scripts/drafts/compact_*.sql.part` files are source modules, not standalone SQL scripts.

---

## 1. Executive Summary & Design Constraints

* **Supabase Free usage**: Eight tables simplify the model; table count does not determine egress. Bounded read projections, pagination, lazy unit/history loading, and shared frontend requests reduce bytes transferred. Actual monthly usage still depends on users, data size, and activity; no promise of staying below 5 GB is possible from local fixtures.
* **Exact 8 Canonical Physical Tables**: Exactly 8 owned inventory tables exist after migration. No extra permanent archive tables, private schemas, or dummy tables are created.
* **Validated data preservation**: Every ID, timestamp, quantity, note, and financial reference from the previous 22 tables (11 from Plan C, 7 from Production Hub, and 4 Legacy tables) is mapped to canonical columns or stored in structured `metadata` JSONB.
* **Fail-Closed Single-Transaction Assembly**: Guarded by `current_setting('flower.compact_build', true) IS DISTINCT FROM 'v2'`, preventing partial execution.
* **Concurrent writes**: Before copying, existing source and destination tables are locked in sorted order with `ACCESS EXCLUSIVE` until commit. A five-second lock timeout aborts a busy migration safely. Local PGlite tests validate the SQL and rollback behavior but cannot simulate separate concurrent database sessions.
* **Zero Cascade Dropping**: All 22 retired tables are dropped using `RESTRICT` semantics. If any unknown external table or trigger references them, the drop aborts immediately and rolls back the entire transaction.
* **Idempotent Reruns & Fresh Install Support**: Running the script a second time creates no duplicate rows. Fresh databases running only base master schemas install cleanly without requiring obsolete 22-table historical scripts.

---

## 2. The 8 Canonical Inventory Tables

| # | Table Name | Purpose / Responsibility |
|---|---|---|
| 1 | `inventory_categories` | Material & tool classification (asset, consumable, reusable_material) with canonical `is_active BOOLEAN NOT NULL DEFAULT true` |
| 2 | `inventory_items` | Master catalog, variants, minimum alert thresholds, and canonical `current_stock NUMERIC(10,2)` (no shadow columns). Historical banknote catalog items retained without affecting cash balance |
| 3 | `asset_units` | Serialized individual tools/assets (`unit_code`), current status (`AVAILABLE`, `BORROWED`, `LOST`, `BROKEN`), and active custody links |
| 4 | `inventory_recipients` | Unified person and team registry. Merges individual staff, casual helpers, and team receiver metadata (`primary_recipient_id`, `primary_receiver_name`, `member_names`, `team_is_active`) |
| 5 | `inventory_documents` | Polymorphic business document headers for warehouse issues, field rounds, material recoveries, cash reservations/batches/prepared sets, work assignments, submissions, inspections, incidents, legacy loans, procurements, disposals, checklists, and idempotency commands |
| 6 | `inventory_document_lines` | Polymorphic detail lines for material items, tool custody history (preserving `recipient_id` and `due_at`), round projects, material recovery inspection lines, work output targets, submission items, inspection details, cash counts, and checklist items |
| 7 | `inventory_movements` | Immutable audit log for stock deltas, cash handovers/vault deposits, and production workflow status transition events. Audit lineage FKs enforce `ON DELETE RESTRICT` |
| 8 | `cash_vault_denominations` | Five physical cash vault rows (20, 50, 100, 500, 1000 Baht) with integer note constraints, physical/reserved counts, thresholds, and initialization flags |

*Shared non-inventory tables (`projects`, `staff_users`, `roles`, `vendors`, `financial_transactions`) are untouched.*

---

## 3. Mapping of the 22 Retired Tables

The 22 legacy tables are retired in bottom-up dependency order without `CASCADE`:

| Legacy / Source Table | Target Compact Table | Target Record Type (`doc_type` / `line_type` / `movement_type`) | ID & Data Preservation Details |
|---|---|---|---|
| `inventory_recipient_teams` | `inventory_recipients` | Table merge | In-place update matching `id = team_recipient_id`. Preserves `primary_recipient_id`, `primary_receiver_name`, `member_names`, `team_is_active`. |
| `inventory_field_rounds` | `inventory_documents` | `doc_type = 'FIELD_ROUND'` | Preserves round ID as `id`, `doc_number = round_code`, title, recipient snapshot, team members, `expected_return_at` -> `due_at`. |
| `inventory_field_round_projects` | `inventory_document_lines` | `line_type = 'ROUND_PROJECT'` | Linked to `round_id`, with `project_id` foreign key and `sort_order` in `metadata`. |
| `inventory_material_recoveries` | `inventory_document_lines` | `line_type = 'RECOVERY'` | Preserves old recovery ID as `id`, `source_issue_movement_id`, `quantity = recovered_qty`, `accepted_qty = inspected_good_qty`, `rejected_qty = inspected_damaged_qty`. |
| `asset_unit_custody` | `inventory_document_lines` & `asset_units` | `line_type = 'TOOL_CUSTODY'` | Preserves old custody ID as `id`, unit_code, recipient snapshot, timestamps. Updates active unit on `asset_units` (`active_custody_line_id`, `active_recipient_id`, `due_at`, `status = 'BORROWED'`). |
| `inventory_incidents` | `inventory_documents` & `inventory_document_lines` | `doc_type = 'INCIDENT'`, `line_type = 'INCIDENT'` | Preserves incident ID, unit code, severity, resolution status, notes. |
| `cash_job_reservations` | `inventory_documents` & `inventory_document_lines` | `doc_type = 'CASH_RESERVATION'`, `line_type = 'CASH_RESERVATION'` | Preserves reservation ID, `denomination`, `quantity = reserved_count`, `is_cash = true`. |
| `cash_helper_batches` | `inventory_documents` & `inventory_document_lines` | `doc_type = 'CASH_BATCH'`, `line_type = 'CASH_BATCH'` | Preserves batch ID as `id`, `doc_number = batch_code`, `quantity = issued_count`, `accepted_qty = prepared_count`, `returned_qty = returned_raw_count`, `handed_over_qty = handed_over_count`. |
| `cash_prepared_sets` | `inventory_documents` & `inventory_document_lines` | `doc_type = 'CASH_PREPARED'`, `line_type = 'CASH_PREPARED'` | Preserves prepared set ID, `denomination`, `quantity = prepared_count`, `delivered_qty = delivered_count`. |
| `cash_movements` | `inventory_movements` | `movement_type = action_type` | Preserves old cash movement ID as `id`, `document_id = batch_id`, `quantity = note_count`, `delta_stock = 0`, `is_cash = true`, denomination, locations. |
| `inventory_idempotency_records` | `inventory_documents` | In-place update or `doc_type = 'COMMAND'` | Attaches response payload and hash to existing document if `idempotency_key` matches; generates `COMMAND` document for standalone legacy keys. |
| `production_assignments` | `inventory_documents` | `doc_type = 'WORK'` | Preserves assignment ID as `id`, title, recipient snapshot, `due_at`, status, `version`, `is_cash = cash_only`, `source_document_id`. |
| `production_assignment_lines` | `inventory_document_lines` | `line_type = 'WORK_OUTPUT'` | Preserves assignment line ID as `id`, `document_id = assignment_id`, `required_qty`, `quantity = required_qty`, `submitted_qty`, `accepted_qty`, `rejected_qty`, `pending_qty`. |
| `production_submissions` | `inventory_documents` | `doc_type = 'SUBMISSION'` | Preserves submission ID as `id`, `parent_document_id = assignment_id`, submitted_by, notes. |
| `production_submission_lines` | `inventory_document_lines` | `line_type = 'SUBMISSION'` | Preserves submission line ID as `id`, `source_line_id = line_id`, `quantity`, `accepted_qty`, `rejected_qty`, `pending_qty`. |
| `production_inspections` | `inventory_documents` | `doc_type = 'INSPECTION'` | Preserves inspection ID as `id`, `parent_document_id = submission_id`, inspector name, notes. |
| `production_inspection_lines` | `inventory_document_lines` | `line_type = 'INSPECTION'` | Preserves inspection line ID as `id`, `source_line_id = submission_line_id`, accepted and rejected quantities. |
| `production_assignment_events` | `inventory_movements` | `movement_type = event_type` | Preserves event ID as `id`, `document_id = assignment_id`, actor, reason, event details JSONB. |
| `asset_loans` | `inventory_documents` & `inventory_document_lines` | `doc_type = 'LEGACY_LOAN'`, `line_type = 'LEGACY_DETAIL'` | Preserves loan ID as `id`, borrower snapshot, dates, condition out/in notes. |
| `inventory_procurements` | `inventory_documents` & `inventory_document_lines` | `doc_type = 'PROCUREMENT'`, `line_type = 'ITEM'` | Preserves procurement ID as `id`, item, quantity, unit price, total cost, vendor reference. |
| `inventory_disposals` | `inventory_documents` & `inventory_document_lines` | `doc_type = 'DISPOSAL'`, `line_type = 'ITEM'` | Preserves disposal ID as `id`, item, quantity, reason type, financial loss, salvage value. |
| `project_checklist_items` | `inventory_documents` & `inventory_document_lines` | `doc_type = 'CHECKLIST'`, `line_type = 'CHECKLIST'` | Grouped by project into `CHECKLIST` document; UUID IDs remain unchanged. TEXT IDs containing canonical UUIDs retain that UUID; other TEXT keys map deterministically to UUIDs. Every source key is retained in `metadata.legacy_id`. Item refs, quantities, and checklist state are preserved. |

---

## 4. Verification Assertions Executed Prior to Dropping Tables

Before dropping any legacy tables, `compact_schema.sql.part` executes automated invariant checks:
1. **ID Coverage**: Asserts that every record from all 22 source tables exists in target tables (`inventory_documents`, `inventory_document_lines`, or `inventory_movements`).
2. **Denomination Batch Totals**: Per-denomination sums of issued, prepared, returned raw, and handed over cash counts in `inventory_document_lines` match source `cash_helper_batches` using 4 dedicated verification accumulators (`v_target_issued`, `v_target_prepared`, `v_target_returned`, `v_target_handed`).
3. **Cash Job Reservations & Prepared Sets Invariants**: Asserts cash reservations (`reserved_count`) and prepared sets (`remaining_count` + `delivered_count`) match source counts.
4. **Physical Stock Integrity**: Physical inventory item stock quantities are completely unchanged.
5. **Active Custody Preservation**: Count of active custody records matches count of asset units with active custody lines.
6. **Work Output Accepted & Pending Totals**: Sum of accepted and pending quantities across `production_assignment_lines` matches `WORK_OUTPUT` document lines.
7. **Foreign Key Integrity**: `inventory_documents.round_id` foreign key validation is delayed until after all `FIELD_ROUND` records are safely migrated into documents, enforcing `ON DELETE RESTRICT`. History audit foreign keys (`document_id`, `project_id`, `source_line_id`, `source_issue_movement_id`) enforce `ON DELETE RESTRICT` to prevent silent deletion.

If any check fails, the script raises an exception, aborting the drop and restoring all original data.

---

## 5. Assembly & Execution Lifecycle

`compact_schema.sql.part` is designed as part 1 of the 3-part unified deployment:
```sql
BEGIN;
SELECT set_config('flower.compact_build', 'v2', true);

-- 1. database_scripts/drafts/compact_schema.sql.part
-- 2. database_scripts/drafts/compact_core.sql.part
-- 3. database_scripts/drafts/compact_production.sql.part

COMMIT;
```

### Automated Test Suite (`tests/inventoryCompactMigration.test.cjs`)
Verification covers:
* Full data import and ID coverage from realistic multi-batch production fixtures
* Rerun idempotency (running twice produces 0 duplicate records)
* Schema compatibility with `staff_users.id` as either `UUID` or `TEXT`
* Fail-closed rollback when an unknown foreign key depends on a legacy table without cascade
* Fresh installation on clean master schema without obsolete 22-table scripts
* Fail-closed guard triggering on missing or incorrect `flower.compact_build` setting

## Installation

Compatibility fix (12 November 2026): the installer accepts both UUID and TEXT checklist primary keys. One transaction-local mapping is reused by collision checks, copying, and post-copy verification. It creates no permanent mapping table. Ambiguous keys resolving to the same UUID abort the transaction instead of discarding a row.

Legacy loan and disposal actors use a separate identity conversion: `asset_loans.borrower_user_id` and `inventory_disposals.disposed_by_user_id` reference `staff_users.id`, which may be a UUID or a staff code. The installer resolves these to the matching `staff_users.auth_user_id`; it also accepts a direct known auth UUID. It retains original borrower/disposer/approver keys in document metadata. If no matching account exists, the actor UUID remains NULL while the original identifier and available name snapshot remain traceable. Staff codes are never cast into fabricated login UUIDs.

1. Keep a database backup before a schema change.
2. Run the entire `database_scripts/inventory_compact.sql` file once in Supabase SQL Editor with the database owner role. It includes `BEGIN`, validation, and `COMMIT`. Do not execute selected fragments.
3. If it reports a lock timeout or unknown external dependency, the transaction must roll back; resolve the reported condition before retrying. Do not remove the validation or add `CASCADE`.
4. Use the matching frontend version after installation. Do not run the superseded `inventory_plan_c.sql` or `inventory_production_hub.sql` afterward, because those scripts recreate retired tables.

Local verification covers seeded legacy migration, UUID/text staff identifiers, exact eight physical tables, cash/stock invariants, unknown-dependency rollback, the actual master schema, complete installer reruns, production workflows, and cash RLS. It does not access or certify the user's live Supabase data.
