# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Flower2you manages a flower and event business. The inventory workspace must let staff see what is available in the warehouse, issue supplies, lend equipment, and receive returns without losing track of quantities or individual tools.

## Operating Context

Budget and schema constraint confirmed by the user: Supabase Free only; no paid plan. The user has already applied the two earlier SQL scripts and requires a compact inventory design. Target exactly 8 inventory-owned tables as specified in docs/inventory-compact-contract.md, preserving real data and history. Reduce egress through bounded reads, active-page loading and selective refresh; do not claim that fewer tables alone reduces network usage.

Confirmed by the user:

- Consumables are used up, such as clear tape, hot glue sticks, and paper.
- Reusable materials are tracked by quantity and color. A job can take 100 artificial flowers, damage 10, and return 90 usable pieces to the stock of the same variant.
- Tools such as tape dispensers, scissors, drills, and utility knives are borrowed and returned individually. The user wants QR labels on individual tools to make borrowing and returns easier.
- Finished flower arrangements are prepared at the warehouse; field crews deliver and install them. One outing can visit 15 jobs, using a single set of borrowed tools across those jobs.
- Tool borrowing must support both a single employee and a team, with multiple installation teams in the future.
- A dedicated QR label printing screen is required, including small labels for narrow tools such as scissor handles and labels for individual equipment units.
- Production can involve multiple casual helpers, including friends and relatives who are not permanent staff. Materials and tools may be issued to several different people for the same customer job.
- Field crews take a separate backup kit for delivery/install emergencies after production is complete.
- The business makes flower arrangements, gifts, and backdrops involving real banknotes. It holds banknote reserves by denomination (the user's example is twenty 500-baht notes) and needs low-stock visibility and suggested replenishment quantities to avoid repeated bank trips.
- Real banknotes are also handed to casual helpers for folding or inserting into clear sleeves before assembly into gifts. One job can distribute this preparation among 5–10 or more people; the user's example handover is twenty 50-baht notes.
- User-managed categories are required for filtering, such as artificial flowers and scissors. Tools within a category can have different colors and multiple individually identified units.
- Existing staff, casual helpers, and teams must be searchable choices wherever the user selects a receiver or responsible person; new helpers remain available after saving and reloading.
- Each customer project needs a shared production overview showing each person's responsibility, expected outputs, submissions, accepted quantities, shortages, and status. Staff inspect submitted work and explicitly complete it; one project can have ten or more helpers. Work can be added, changed, split, or cancelled without deleting prior receipts or inventory custody.
- Artificial flowers sent with finished work are often discarded by the client after the event. The business can recover usable materials to reduce future purchasing; recovery is not guaranteed.
- The user asked whether financial responsibility for lost tools could be shared across a team. This is a policy question, not an approved automatic payroll deduction feature.
- Staff need to know which tools remain in the warehouse.
- The user reviewed the inventory directions and approved implementing Plan C, with Codex supervising Gemini through Antigravity CLI (`agy`).
- The inventory screens, issue/return forms, camera scanner, and print workspace must be easy to use on phones. Interface accents follow the selected application theme, including custom colors; semantic status colors and physical material colors remain meaningful. Printed QR labels remain black on white.
- Responsive layouts must also cover tablets, wide and narrow windows, portrait and landscape, and split view. Device research informs representative tests; physical screen pixels are not assumed to equal CSS viewport pixels.

## Capabilities and Constraints

- Existing application: React, Vite, Tailwind, Supabase, and Dexie IndexedDB.
- Retain the existing Flower2you brand and the surrounding application's navigation.
- This design round covers inventory, issue/return flows, tool QR labels, and stock history.
- Demonstration data must be labeled and kept separate from live stock.
- The user reports that `database_scripts/save_project_with_items.sql` has been run. This has not been independently verified against production.

## Open Decisions

- Whether employees confirm their own transactions or a warehouse keeper confirms them.
- Whether consumables use only whole base units or allow fractional quantities.
- Whether recovered materials require a separate inspection/cleaning step before becoming available stock.
- Whether some reusable materials are explicitly lent with a mandatory return, in addition to optional recovery from finished work.
- Whether casual helpers also take materials/tools home or work only at the warehouse.
- Whether banknotes come only from shop reserves or may also be supplied by customers.

## Product Principles

- Distinguish available stock, stock out on jobs, and damaged stock.
- Keep colors and sizes separate when they represent different stock variants.
- Keep handling type, user-defined category, item/model, color/size variant, and individual tool identity distinct; make category filters available wherever users select inventory.
- Preserve an accountable history of who issued or returned what.
- Make routine warehouse work quick on a phone, with readable codes as a fallback to scanning.
- Confirm a movement once, and prevent duplicate scans or submissions from changing stock twice.
- Distinguish warehouse production consumption, field tool custody across multiple jobs, and optional material recovery.
- Model the person receiving goods independently of whether they have a permanent employee account.
- Track real banknotes separately from material stock, including denomination, custody, and any job reservation.
- Track banknotes handed to each helper and banknotes already incorporated into job-specific prepared sets; receiving prepared work back must not recreate free cash reserves.
