## 2024-05-22 - Missing Authorization on Locations API
**Vulnerability:** The `/api/locations` endpoint was completely public, allowing unauthenticated users to list and create locations.
**Learning:** Adding a new API route without copying the authorization boilerplate from existing routes is a common oversight. There is no global middleware enforcing auth on `/api/*` by default in this Next.js App Router setup.
**Prevention:** Implement a middleware that denies access to `/api/*` by default unless explicitly public, or use a linter rule to ensure `auth()` is called in every exported route handler.
