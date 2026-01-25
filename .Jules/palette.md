## 2025-02-14 - Radix UI Tooltip Testing Strategies
**Learning:** Visual verification of Radix UI Tooltips using `happy-dom` is unreliable due to hover/focus timing quirks and missing browser APIs (ResizeObserver).
**Action:** Instead of fighting the environment, mock the Tooltip primitives in unit tests to verify that the correct content is passed to them.

## 2025-02-14 - Accessible Tooltips on Badges
**Learning:** The `Badge` component does not natively support ref forwarding, so it cannot be used directly as a `TooltipTrigger` child via `asChild`.
**Action:** Wrap non-interactive elements like Badges in a focusable element (e.g., `<span tabIndex={0}>`) within the trigger to ensure keyboard accessibility and proper event handling.
