# .Jules/palette.md

## 2024-05-22 - Tooltips on Non-Interactive Elements

**Learning:** When attaching a Radix UI Tooltip to a non-interactive element like a Badge (that doesn't forward ref or handle events), you MUST wrap the element in a focusable container (e.g., `span` with `tabIndex={0}`) to ensure it works for both mouse and keyboard users.

**Action:** Always wrap `Badge` or similar components in `<span tabIndex={0}>` when using them as a `TooltipTrigger`.
