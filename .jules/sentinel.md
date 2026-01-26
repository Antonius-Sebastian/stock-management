## 2025-02-18 - Unprotected Locations API
**Vulnerability:** The `/api/locations` endpoints (GET, POST, PUT, DELETE) were completely public, allowing unauthenticated users to view, create, update, and delete warehouse locations.
**Learning:** Next.js App Router API handlers are public by default. Unlike some frameworks that might default to secure, Next.js requires explicit `await auth()` checks at the beginning of every route handler.
**Prevention:** Always verify authentication and RBAC permissions at the very start of every `route.ts` export function. Use automated tests to verify 401/403 responses for unauthenticated requests.
