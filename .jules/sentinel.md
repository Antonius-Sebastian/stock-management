## 2024-05-23 - Manual Rate Limiting Pattern
**Vulnerability:** Missing rate limiting on sensitive API routes (e.g., user creation).
**Learning:** Next.js API routes in this project do not use a global middleware for rate limiting. Instead, they rely on a manual implementation using `checkRateLimit` from `@/lib/rate-limit`.
**Prevention:** Always manually invoke `checkRateLimit` at the beginning of sensitive POST/PUT/DELETE handlers, passing the client IP obtained via `getIpAddress`.
