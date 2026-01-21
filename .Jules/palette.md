## 2024-05-22 - Tooltips on Static Badges
**Learning:** Shadcn/UI `Badge` components do not forward refs and are not interactive by default. To make them accessible tooltip triggers, they must be wrapped in a focusable element (e.g., `span` with `tabIndex={0}`) that accepts the `TooltipTrigger` ref.
**Action:** When adding tooltips to status indicators, wrap the indicator in a focusable, semantic container to ensure screen reader and keyboard accessibility.
