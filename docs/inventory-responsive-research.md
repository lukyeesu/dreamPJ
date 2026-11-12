# Inventory responsive layout and verification

The 12 November navigation refinement uses five direct inventory tabs, grouped maintenance actions, a full-width catalog before selection, and a portal cart below 1024 CSS pixels. DOM tests cover 820→1180→820 transitions with preserved draft notes and balanced body scroll locks; these are functional checks rather than new viewport screenshots. See [navigation and egress review](inventory-navigation-egress-review.md).

The layout follows available CSS window width and height, including rotation and split windows. Physical screen pixel counts are not CSS viewport sizes. Android's [adaptive window size guidance](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes) distinguishes compact widths below 600dp, medium widths from 600dp to 840dp, and compact heights below 480dp; these informed the short landscape and split-window targets rather than device-specific detection.

Older and newer hardware provide a range of aspect ratios: [iPhone SE specifications](https://support.apple.com/en-us/111866), [iPad mini specifications](https://www.apple.com/ipad-mini/specs/), and [Samsung tablet emulator profiles](https://developer.samsung.com/galaxy-emulator-skin/galaxy-tab.html). Their physical resolution must not be treated as a browser viewport measurement.

Target CSS viewport matrix (acceptance targets, not a claim that every row has been visually retested):

| Use | Portrait / window targets | Landscape / short targets |
| --- | --- | --- |
| Narrow and standard phones | 320×568, 360×640, 375×667, 390×844, 412×915, 430×932 | 568×320, 667×375, 844×390 |
| Tablets | 600×960, 768×1024, 800×1280, 820×1180, 834×1194, 1024×1366 | Corresponding rotated sizes |
| Split windows | 320×1024, 480×1024, 600×1024 | Resize without losing form values |
| Desktop | 1024×768, 1280×720, 1440×900, 1920×1080 | 200% zoom and keyboard navigation |

Current source uses mobile stock cards, internally scrolling wide tables, a mobile cart portal above navigation, desktop cart columns, dynamic viewport dialog bounds, and theme variables. QR printing uses a wrapping header and a single mobile scroll region so presets cannot permanently hide selection or preview. Printed QR codes remain black on white; their physical millimeter size is controlled by print output, not screen preview scale. Color helpers are tested for at least 4.5:1 text contrast on primary buttons and white surfaces.

Earlier screenshots cover stock/cart at 320×568, 390×844, 844×390, 820×1180, 1180×820, and 1440×900. They predate the final compact integration and are preliminary. Current checks include real DOM interaction tests, camera start/close race tests with mocked devices, QR encoding/ZXing decoding, and production builds. A browser access host/native pipe is unavailable in the current session, so final all-page visual coverage, device cameras, actual printers, and all hardware models are not certified.

## Isolated full-page preview

Run `npx vite --config tests/fixtures/inventory-offline.config.js`, then visit `http://127.0.0.1:5175/tests/fixtures/inventory-full-preview.html`.

This separate configuration replaces both the Supabase client and IndexedDB module with test-only memory implementations. The page is visibly marked TEST DATA. The stock, issue/return, cash, history, production hub, dialogs, and theme switch use the actual UI. Mutations return a read-only fixture error rather than claiming to save. Normal app builds continue to use real modules. The earlier `inventory-preview.html` is a historical component fixture and is not the full integration preview.
