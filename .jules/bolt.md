## 2024-05-22 - Optimizing Historical Stock Calculation
**Learning:** `calculateStockAtDate` was summing all history (O(N)) to find past stock. This is inefficient as data grows.
**Action:** Implemented Reverse Calculation Strategy: `Stock(Date) = CurrentStock - NetMovements(>= Date)`. This leverages the current state (O(1)) and only scans recent history, making it O(1) for "today" queries.
**Learning:** Integration tests mocked `prisma` globally but relied on `findMany` returning `undefined` (implicit empty array behavior in loop?) or specific mocks. Changing the query structure (from `< date` to `>= date`) broke tests because mocks weren't returning data for the new query conditions, causing 0 results.
**Action:** Always verify test mocks cover the *new* query logic when changing data access patterns.
