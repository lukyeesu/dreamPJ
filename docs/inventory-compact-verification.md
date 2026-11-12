# Compact inventory delivery verification — 12 November 2026

## Checklist TEXT-ID compatibility correction

The reported `42804` error was reproduced against the complete installer by converting the legacy checklist primary key from UUID to TEXT and inserting a non-UUID legacy key. The correction uses one transaction-local ID map for preflight, import, and validation; UUID values remain unchanged and original keys are retained in `metadata.legacy_id`. The temporary map is dropped on commit and does not add a permanent inventory table. Ambiguous UUID mappings fail and roll back with the original rows intact. After this correction, all **22 compact SQL tests passed**, including actual-master install, UUID/TEXT checklist IDs, reruns, rollback, stock, cash, and production workflows. No frontend changes or live SQL execution were made for this fix.

## Delivered

### Legacy staff reference correction

The second reported `42804` error was reproduced with a populated TEXT `asset_loans.borrower_user_id`. Legacy borrower/disposer IDs reference `staff_users.id`, not the login UUID. The installer now resolves them through `staff_users.auth_user_id`, preserves original borrower/disposer/approver IDs in metadata, and leaves unmatched actors NULL without fabricating identities. Existing names remain preserved. Direct known auth UUIDs are also supported. All **26 compact SQL tests passed** after this correction, including populated actual-master schemas with UUID staff keys and the real staff-code migration. A separate **2/2** rerun also verified simultaneous TEXT checklist IDs and TEXT borrower references. No live database was accessed.

One installer: `database_scripts/inventory_compact.sql`. It consolidates inventory into eight physical tables, migrates legacy and production records with identifier/count/balance checks, keeps cash and work audit history, and retires the old tables in one transaction. Unknown external dependencies or lock contention abort instead of using `CASCADE`. Install the complete file, then use the matching frontend; do not rerun the two superseded installers. See [installation instructions](inventory-compact-migration.md#installation).

The frontend now uses bounded stock/unit/history/people/work reads, request deduplication, same-user token-refresh guards, lazy QR loading, and scoped production updates. Cash stays outside persistent browser caches. Input materials and output work are separate; partial submission requires inspection, and cancellation does not silently return stock or deduct wages. Helpers and teams are selected through the real person registry.

Responsive changes include mobile stock cards, mobile cart portal, scrollable dialogs and tables, 44px inventory control targets, wrapping QR print controls, and theme-based accents. Primary text colors use tested luminance contrast. The final history review fixed project filtering for both stock and cash, signed stock deltas, late-request guards, and paginated reads of migrated legacy loans.

## Executed checks

- Full Node suite: **175/175 passed** before the final history correction. This includes compact migration/installer/runtime tests, existing project/sync regression tests, production workflows, UI interactions, QR decode/camera lifecycle, and theme tests.
- Final history correction: compact installer/runtime **7/7 passed**, including the new project/cash/legacy-loan test. Final affected UI and warehouse-service rerun **28/28 passed**. The new test adds one case to the prior full-suite total. These focused reruns are reported separately rather than claiming another complete run.
- After adding visible authorized cash movements to the history ledger, the final full-page/UI rerun passed **12/12**, including negative stock deltas, cash transfer locations, and migrated loan retrieval.
- `npm run build`: passed after final source edits. Existing large-chunk and mixed dynamic/static import warnings remain; QR components are separate lazy chunks.
- Targeted ESLint: passed for Inventory, all inventory components, the two inventory hooks/services, and themeManager. Whole-repository lint is not claimed clean.
- Offline full-page fixture: built successfully. Actual DOM integration opens stock, cash, custody, production, history, migrated loans, and the QR workspace; changing theme does not reload the summary. Selection, Escape, and scroll-lock cleanup are tested. No Supabase connection is constructed in this test.
- `npm audit --omit=dev`: zero reported production dependency vulnerabilities at verification time.
- `git diff --check`: passed. No staging, commit, push, deployment, or live SQL execution.
- JavaScript project: no separate TypeScript configuration/check. Coverage percentage was not measured.

Synthetic dataset benchmark (1,000 items and 2,000 tool units): prior full summary **770,602 JSON bytes**, compact first page **17,132 bytes**, separate 20-unit page **7,058 bytes**. These are uncompressed fixture JSON sizes, not actual monthly usage or compressed network measurements. Table count alone does not determine egress; the 5 GB allowance still depends on real traffic.

## Practical limits

The user's live data and true concurrent PostgreSQL sessions were not exercised. PGlite tests validate migration/runtime behavior and rollback, but do not certify every external database customization.

Final visual recapture is blocked by the unavailable browser access host/native pipe. Earlier six-viewport captures are preliminary. Real device cameras, physical labels/printers, short landscape, split windows, and every hardware model remain manual acceptance checks. See [responsive targets and offline preview](inventory-responsive-research.md). The design detector's eight warnings refer to the QR scan target's four corner strokes, which intentionally mark the camera region.
