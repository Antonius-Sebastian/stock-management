# Sentinel's Journal

## 2025-02-18 - Unprotected API Routes
**Vulnerability:** The `/api/locations` endpoint (both GET and POST) was completely unprotected, allowing unauthenticated users to list and create locations.
**Learning:** New API routes in the Next.js App Router are accessible by default. Unlike some frameworks where routes are secure by default, Next.js route handlers require explicit `auth()` checks.
**Prevention:**
1.  Always audit new API routes for `await auth()` checks.
2.  Implement a middleware or linter rule to flag route handlers that do not import/use `auth`.
3.  Ensure integration tests explicitly check for 401/403 responses.
