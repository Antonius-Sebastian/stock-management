## 2024-02-05 - Prisma Aggregation Optimization
**Learning:** optimizing `findMany` loops with `groupBy` requires updating mocks in ALL consumers.
**Action:** When replacing `findMany` with `groupBy`, `aggregate`, or `count`, immediately grep for all usages of the service function and check their tests. Add `groupBy` (or relevant method) to the global Prisma mock and update individual test mocks to return aggregated data structures instead of entity arrays.
