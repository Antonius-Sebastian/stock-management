## 2024-05-22 - Unused Rate Limit Definitions
**Vulnerability:** Rate limiting configurations (e.g., `USER_CREATION`, `BATCH_CREATION`) were defined in `src/lib/rate-limit.ts` but not actually used in the corresponding API routes.
**Learning:** Security controls defined in libraries do not automatically apply themselves. There is a disconnect between the security library and the API implementation.
**Prevention:** When defining security policies, immediately grep for their usage to ensure they are implemented. Future audits should verify that all exported members of `RateLimits` are referenced in the codebase.
