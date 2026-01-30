## 2024-05-22 - Missing Rate Limiting on Batch Creation
**Vulnerability:** The `POST /api/batches` endpoint, while authenticated, lacked rate limiting. This endpoint performs expensive operations (transactional stock updates, audit logging).
**Learning:** Even in internal tools with authenticated users, resource-intensive endpoints must be rate-limited to prevent accidental or malicious flooding (DoS). The existing `RateLimits.BATCH_CREATION` config was defined but unused.
**Prevention:** Systematically verify that all `POST`/`PUT` endpoints, especially those involving transactions, import and use `@/lib/rate-limit`.
