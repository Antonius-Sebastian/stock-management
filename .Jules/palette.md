## 2024-05-22 - Tooltips on Disabled Buttons
**Learning:** To show tooltips on disabled buttons, the button must be wrapped in a container (like `div` or `span`) that can receive pointer events, as disabled elements often swallow them.
**Action:** Use a wrapper with `tabIndex={0}` or `cursor-not-allowed` class if needed, but ensure the tooltip trigger works.
