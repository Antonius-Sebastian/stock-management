## 2026-01-20 - Accessible Tooltips on Static Badges
**Learning:** Shadcn/UI Badges are rendered as `div` or `span` elements and lack native keyboard focus. To make them accessible trigger elements for Tooltips, they must be wrapped in a focusable container (e.g., `<span tabIndex={0}>`) with appropriate `role` and `aria-label` attributes.
**Action:** Always wrap non-interactive tooltip triggers in a focusable element and ensure the tooltip content is accessible via screen readers (or duplicate critical info in `aria-label`).
