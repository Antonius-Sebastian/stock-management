## 2024-05-22 - Stock Calculation Optimization
**Learning:** The `calculateStockAtDate` function was fetching all historical records into memory (O(N)), causing potential performance issues. Optimizing it to use `groupBy` aggregation (O(1)) significantly reduces database load and processing time.
**Action:** When calculating sums or aggregates, always prefer database-level aggregation (`groupBy`, `aggregate`) over fetching and looping in application code, especially for tables that grow indefinitely like `StockMovement`. Also, ensure unit tests mock these aggregations correctly.
