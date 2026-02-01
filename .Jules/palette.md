## 2025-02-17 - Testing Radix UI Tooltips
**Learning:** Radix UI Tooltips render content into a portal and may duplicate the content for screen readers, causing Playwright strict mode violations (e.g., "resolved to 2 elements") when using `get_by_text`.
**Action:** When testing tooltips, use `.first` or strict selectors (e.g., `role="tooltip"`) to target the visible tooltip content.

## 2025-02-17 - Accessible Badges
**Learning:** Badges are non-interactive `span` elements by default. To make them accessible tooltip triggers, they must be made focusable (`tabIndex={0}`) and given a semantic role (`role="status"`) to ensure keyboard users can perceive the additional context.
**Action:** Always add `tabIndex` and `role` when wrapping static indicators with interactive tooltips.
