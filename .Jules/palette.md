## 2026-01-17 - Inconsistent Select Components in Data Tables
**Learning:** The `DataTable` component used a native HTML `<select>` for pagination, breaking visual consistency with the rest of the application which uses Shadcn/UI components.
**Action:** Replace native elements with Shadcn/UI equivalents (e.g., `<Select>`) to ensure accessibility and design consistency.
