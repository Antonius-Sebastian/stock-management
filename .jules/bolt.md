## 2024-05-23 - Batch Optimizations with createManyAndReturn
**Learning:** Prisma's `createManyAndReturn` (available in v5.14+) is a game-changer for batch optimizations where the created IDs are needed for subsequent related records. It eliminates the need for loop-based single inserts or the complex "createMany then findMany" pattern.
**Action:** When identifying N+1 insertion loops, check if the created record's ID is used immediately. If so, use `createManyAndReturn` to batch the operation into a single query while retaining the necessary return data.
