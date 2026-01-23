## 2025-05-18 - Tooltips on Non-Interactive Elements
**Learning:** Shadcn/UI Tooltip triggers must be focusable (tabIndex={0}) if wrapping non-interactive elements like Badges, otherwise keyboard users can't access them.
**Action:** Always wrap non-interactive children in `<span tabIndex={0}>` when using `TooltipTrigger`.
