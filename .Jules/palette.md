## 2024-05-24 - Radix UI Tooltip Accessibility on Badges
**Learning:** Radix UI Tooltip triggers must be focusable for keyboard users. When adding tooltips to non-interactive elements like `Badge`, wrap them in a `span` with `tabIndex={0}` and appropriate ARIA attributes (e.g., `role="status"`, `aria-label`).
**Action:** Always wrap non-interactive tooltip triggers in a focusable element and ensure they have a visible focus indicator.
