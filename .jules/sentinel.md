## 2024-02-23 - [Missing Security Headers]
**Vulnerability:** Missing standard HTTP security headers (HSTS, X-Frame-Options, etc.) in a Next.js application.
**Learning:** Default Next.js configuration does not include these strict headers; they must be explicitly configured in `next.config.ts`.
**Prevention:** Always verify `next.config.ts` includes a `headers()` function with HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.
