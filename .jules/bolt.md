## 2024-05-23 - Stock Calculation Optimization
**Learning:** Optimizing historical stock calculations by reversing from current stock (O(M)) instead of summing history (O(N)) significantly improves performance for recent dates.
**Action:** When calculating historical states in ledger-based systems, always prefer "reverse from current" over "replay from zero" for recent queries. Ensure to use transactions to snapshot both current state and the "delta" movements atomically.
