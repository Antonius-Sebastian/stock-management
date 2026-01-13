## 2026-01-13 - Replace Native Confirm with AlertDialog
**Learning:** Native `confirm()` dialogs are blocking and inaccessible. Replacing them with Shadcn/UI `AlertDialog` provides a consistent, accessible experience but requires managing additional state (`dialogOpen`, `selectedItem`).
**Action:** When implementing destructive actions, always wrap the logic in a handler that opens an `AlertDialog`, and move the actual API call to the dialog's confirmation action. Use existing `selectedItem` state if available to minimize state variables.
