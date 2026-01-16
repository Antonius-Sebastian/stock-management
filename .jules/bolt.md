## 2024-05-20 - Stock Calculation Optimization
**Learning:** Calculating historical stock by summing all past movements (O(N)) is a scalability bottleneck.
**Action:** Use "Reverse Calculation" strategy: `CurrentStock - NetMovements(SinceDate)`. This is O(Recent) and much faster for typical "recent date" queries. Ensure to verify both "Current Stock" fetching and "Future Movement" reversal in tests.
