## 2024-05-24 - Consistent Dropdown Styling
**Learning:** Native `<select>` elements break visual consistency in a design-system-heavy app, and often lack proper accessibility labels by default.
**Action:** Always replace native `<select>` with the project's Shadcn `<Select>` component, ensuring to add `aria-label` to the trigger and handle string-to-number type conversion explicitly.
