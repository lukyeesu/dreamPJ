# Inventory navigation, layout and egress review

Changes on 12 November 2026 use the existing schema and dependencies.

## Navigation and layout

Main application pages remain mounted to preserve drafts, but unrelated hidden pages no longer rerender when another page changes. Their latest props are applied when they become active. Page mounting and activation now share one transition rather than mounting a hidden destination first.

Inventory has five direct destinations: stock, issue/return, production, cash, and history. Production no longer requires finding a nested switch inside issue/return. Search and stock filters survive navigation. Catalog maintenance and QR printing live under **จัดการคลัง**; scan and receive remain prominent. The catalog takes full width before items are selected, and the issue panel appears with a selection.

Below 1024 CSS pixels, the cart uses a portal above the app navigation. Desktop uses the side panel. The mobile cart button sits above the bottom navigation, and changing between tablet portrait and landscape preserves entered notes. The cart's scroll lock and focus cleanup now follow its actual responsive mode. Accent colors use existing theme variables; printed QR content stays black on white.

## Unnecessary requests corrected

| Source | Correction and freshness |
| --- | --- |
| Reentering Inventory | Reuse a confirmed summary in memory for 30 seconds. Explicit refresh bypasses it; confirmed warehouse writes and auth changes invalidate cached data. |
| Quick main-page changes | Preserve the filtered stock page instead of replacing it with summary page one. Default stock reads reuse the summary's first page. |
| Rapid browser-window focus events | One background sync within a 30-second window. Initial loading establishes the first window. |
| Customer/artist/location lists | Silent sync reuses lists for five minutes. Explicit refresh bypasses this delay. Small project aggregates and deletion sync continue separately. |

Functional regression tests exercise real source code. They reproduced an inactive page rerender, two summary RPCs for two immediate reads, and three sync calls from three rapid focus events. The fixes keep unrelated hidden render counts unchanged, use one summary RPC, and run one focus sync. A separate test proves master-list freshness expiry and explicit refresh. These are call-count observations, not production latency or monthly-byte measurements.

Summary and stock cache entries also carry a catalog revision. Confirmed writes and explicit summary refreshes advance it, so an older in-flight result cannot overwrite a post-save summary or its default stock page. A regression test reproduces this ordering and verifies the stale result is discarded.

Cash is still server-verified on entry and is not stored in IndexedDB. History, people, work, and unit reads remain bounded. Production realtime is project-scoped, debounced, and uses targeted work-card reads; hidden production views unsubscribe. QR SVG creation and preview are local, with print data loaded only on request. These existing safeguards were reviewed and retained rather than replacing them with broad polling or full-catalog reads.

## Verification and limits

DOM integration covers the five destinations, preserved search text, forced refresh of the current filter, quick main-page reentry without a new summary download, QR printing controls, and tablet/desktop cart transitions without losing notes. Existing project-save, deleted-record, auth, cash-cache, and mutation retry tests remain part of the affected test run.

Verification: the affected frontend/service group passed **107/107** tests. After adding the stale-summary race protection, the final navigation/sync/warehouse/full-page rerun passed **48/48**, including that new regression. Production build and targeted inventory/common-component lint pass. No SQL or live database changes were made for this task. Design-detector warnings remain confined to the QR camera target's four intentional corner marks.

The MCP computer/browser inventory returned `browser access host unavailable` and `native pipe unavailable`. Final visual inspection and performance tracing in a real browser could not be completed through MCP. DOM tests do not certify physical viewport overflow or smooth frame timing; earlier screenshots predate this layout.

Actual Supabase dashboard usage was not accessed. Existing large application bundle warnings remain. Fewer requests reduce avoidable traffic but do not guarantee the 5 GB monthly allowance: user count, catalog size, actual realtime volume, and other app/storage traffic still matter. This change adds no tables, subscriptions, polling timers, or paid infrastructure.
