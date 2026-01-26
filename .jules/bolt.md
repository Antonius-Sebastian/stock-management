## 2024-05-24 - Database Aggregation for Stock Calculation
**Learning:** `prisma.findMany` with large result sets (e.g. historical stock movements) is significantly slower than using database-native aggregation (`prisma.groupBy` with `_sum`). The JS-side processing is `O(N)` while DB aggregation is `O(1)` in terms of data transfer and application memory.
**Action:** When calculating running totals or aggregates over time-series data, always prefer `groupBy` or `aggregate` over fetching and summing in application code, especially when historical data grows indefinitely.
