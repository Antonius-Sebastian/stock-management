## 2026-01-28 - Accessible Status Badges
**Learning:** Status badges (like StockLevelBadge) convey semantic meaning but often lack precision. Adding a tooltip provides necessary detail. Crucially, non-interactive elements like Badges must be wrapped in a focusable element (span with tabIndex=0) to be accessible to keyboard users.
**Action:** When adding tooltips to non-interactive components, always wrap them in a focusable container with `tabIndex={0}` and proper focus ring styles.
