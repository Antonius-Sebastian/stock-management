## 2026-01-24 - Transaction Bypass in Service Layer
**Learning:** The `calculateStockAtDate` helper function in `stock-movement.service.ts` imports and uses the global `prisma` client directly, bypassing the `tx` (transaction client) passed to parent functions like `createStockMovement`. This has two critical consequences:
1.  **Read Consistency:** Calculations do not see uncommitted changes from the current transaction, which might be intentional for "stock at start of day" but dangerous if "stock *after* this operation" is needed.
2.  **Testing Difficulty:** Unit tests mocking `prisma.$transaction` must *also* mock the global `prisma` client separately, as they are distinct objects in the execution flow. Mocks set on `tx` will be ignored by the helper.

**Action:** When refactoring service methods that participate in transactions, ensure helpers accept `tx` as an optional argument (e.g., `tx: Prisma.TransactionClient = prisma`). For testing, always ensure global `prisma` mocks are set up alongside transaction mocks if the code mixes scopes.
