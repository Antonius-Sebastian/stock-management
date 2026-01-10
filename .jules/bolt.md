## 2024-05-22 - [Prisma N+1 with Row Locking]
**Learning:** Prisma's `findUnique` or `findMany` does not support `FOR UPDATE` natively. Using `$queryRaw` inside a loop for locking rows causes N+1 queries.
**Action:** Use `WHERE id IN (...)` with `$queryRaw` to lock multiple rows in a single query, then Map them in memory.
