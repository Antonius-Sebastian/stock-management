## 2026-01-24 - Radix UI Tooltip Testing Quirk
**Learning:** Radix UI Tooltip renders content twice (once visible, once for screen readers?) which causes `getByText` to fail with "multiple elements found".
**Action:** Use `findAllByText` or `getAllByText` when testing Radix Tooltips, or select by specific role/attribute if needed.
