# Comprehensive Code Review: Stock Management System

**Date**: 2025-10-05
**Reviewer**: Code Analysis
**Total Issues Found**: 43
**Issues Fixed (Phase 1)**: 10
**Remaining Issues**: 33

---

## Executive Summary

This review identifies **43 distinct issues** across multiple severity levels. Issues range from critical authentication vulnerabilities to performance optimization opportunities. The system shows good architecture in some areas (RBAC implementation, transaction handling) but has significant gaps in API security, error handling, and data integrity.

**Severity Breakdown**:
- 🔴 Critical: 5 issues
- 🟠 High: 13 issues
- 🟡 Medium: 13 issues
- 🟢 Low: 12 issues

---

## 🔴 CRITICAL SEVERITY ISSUES

### 1. Missing Authentication in Finished Goods API ✅ FIXED
**File**: `src/app/api/finished-goods/route.ts:9-22, 24-71`
**Impact**: Unauthenticated users can view and create finished goods
**Status**: ✅ Fixed in Phase 1

**Current Code**:
```typescript
export async function GET() {
  try {
    const finishedGoods = await prisma.finishedGood.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(finishedGoods)
  } catch (error) {
    // ...
  }
}
```

**Fix**:
```typescript
export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // ... rest of code
  }
}
```

---

### 2. Admin Deletion Vulnerability - Can Delete Self
**File**: `src/app/api/users/[id]/route.ts:202-214`
**Impact**: Admin can delete themselves, potentially locking out the system

**Issue**: Code prevents deleting the "last admin" but doesn't prevent an admin from deleting their own account.

**Fix**: Add self-deletion check:
```typescript
if (existingUser.id === session.user.id) {
  return NextResponse.json(
    { error: 'Cannot delete your own account' },
    { status: 400 }
  )
}
```

---

### 3. Race Condition in Batch Creation Stock Check
**File**: `src/app/api/batches/route.ts:78-91`
**Impact**: Concurrent batch creations could result in negative stock

**Issue**: Stock validation happens before the transaction, allowing race conditions:

```typescript
// Verify all raw materials exist and have sufficient stock
for (const material of validatedData.materials) {
  const rawMaterial = await tx.rawMaterial.findUnique({
    where: { id: material.rawMaterialId },
  })

  if (rawMaterial.currentStock < material.quantity) {
    throw new Error(`Insufficient stock...`)
  }
}
```

**Fix**: Use SELECT FOR UPDATE:
```typescript
const rawMaterial = await tx.$queryRaw`
  SELECT * FROM raw_materials
  WHERE id = ${material.rawMaterialId}
  FOR UPDATE
`
```

---

### 4. Missing Negative Stock Prevention in Batch Edit
**File**: `src/app/api/batches/[id]/route.ts:64-154`
**Impact**: Editing batch metadata doesn't validate stock impacts

**Issue**: The PUT endpoint updates batch metadata (code, date, description, finishedGoodId) but doesn't handle changes to raw material usage, yet the related stock movements remain unchanged. This creates data inconsistency.

**Fix**: Either prevent editing material usage or recalculate stock movements in a transaction.

---

### 5. SQL Injection Risk in Raw Material Movement History
**File**: `src/app/api/raw-materials/[id]/movements/route.ts:38-53`
**Impact**: Potential SQL injection if ID parameter is not properly sanitized

**Fix**: Add validation:
```typescript
const { id } = await params
// Add validation
const validId = z.string().cuid().parse(id)
```

---

## 🟠 HIGH SEVERITY ISSUES

### 6. Inconsistent Error Response Formats
**Files**: Multiple API routes
**Impact**: Frontend error handling is fragile

**Issue**: Some endpoints use standardized `errorResponse()`, others return raw objects:
- `src/app/api/finished-goods/route.ts` - uses `{ error: string }`
- `src/app/api/raw-materials/route.ts` - uses `{ error: string }`

**Fix**: Standardize using helpers from `src/lib/api-response.ts`:
```typescript
return ErrorResponses.unauthorized()
return ErrorResponses.badRequest("Invalid data")
```

---

### 7. Missing Input Validation on Update Endpoints
**File**: `src/app/api/finished-goods/[id]/route.ts:45-48`
**Impact**: Can update to duplicate names without validation

**Fix**: Add duplicate check:
```typescript
const duplicate = await prisma.finishedGood.findFirst({
  where: {
    name: validatedData.name,
    id: { not: id },
  },
})
if (duplicate) {
  return NextResponse.json(
    { error: `Product "${validatedData.name}" already exists` },
    { status: 400 }
  )
}
```

---

### 8. No Authorization Checks on Stock Movements
**File**: `src/app/api/stock-movements/route.ts:81-94`
**Impact**: All authenticated users can create stock movements without proper RBAC

**Fix**: Add role-based restrictions:
```typescript
// FACTORY users should only create OUT movements for production
if (session.user.role === 'FACTORY' && validatedData.type === 'IN') {
  return NextResponse.json(
    { error: 'Factory users can only record outgoing stock' },
    { status: 403 }
  )
}
```

---

### 9. Missing Transaction Rollback on Partial Batch Failure
**File**: `src/app/api/batches/route.ts:104-135`
**Impact**: If stock update fails after movements are created, data becomes inconsistent

**Fix**: Ensure all operations are within try-catch inside transaction.

---

### 10. Unvalidated Date Ranges in Report Generation
**File**: `src/app/api/reports/stock/route.ts:40-58`
**Impact**: Can query future dates causing incorrect calculations

**Fix**: Add dynamic year validation:
```typescript
year: z.coerce.number().int().min(2020).max(new Date().getFullYear() + 1),
```

---

### 11. Missing Index on Batch Code Lookup
**File**: `prisma/schema.prisma:74`
**Impact**: Slow duplicate code checks on batch creation

**Fix**: Add explicit index:
```prisma
model Batch {
  code String @unique
  // ...
  @@index([code])  // For fast duplicate checks
}
```

---

### 12. Email Uniqueness Allows Multiple NULL Values
**File**: `prisma/schema.prisma:120`
**Impact**: Multiple users can have NULL email, breaking uniqueness intent

**Issue**: Postgres allows multiple NULL values in unique columns:
```prisma
email String? @unique
```

**Fix Options**:
```prisma
// Option 1: Make email required
email String @unique

// Option 2: Keep optional but document the behavior
email String? @unique  // Note: Multiple NULL values allowed
```

---

### 13-18. Additional High Severity Issues

13. **Missing Cascade Delete Documentation** - `prisma/schema.prisma:58,60,62`
14. **No Logging for Sensitive Operations** - Multiple API routes
15. **Weak Password Validation** - `src/app/api/users/route.ts:11` (only 6 chars)
16. **Missing Rate Limiting** - All API routes
17. **Inconsistent Timestamp Handling** - `src/app/api/stock-movements/by-date/route.ts:40-47`
18. **No Validation on Batch Update Materials** - `src/app/api/batches/[id]/route.ts:84-129`

---

## 🟡 MEDIUM SEVERITY ISSUES

### 19. Memory Leak Risk in Component useEffect
**File**: `src/components/stock/stock-entry-dialog.tsx:135-139`
**Impact**: Potential memory leaks from fetch in useEffect

**Fix**: Add AbortController:
```typescript
useEffect(() => {
  const controller = new AbortController()

  if (open) {
    fetchItems(controller.signal)
  }

  return () => controller.abort()
}, [open, actualItemType])
```

---

### 20. No Error Boundary in Client Components
**Impact**: Unhandled errors crash the entire page

**Fix**: Add error boundary wrapper.

---

### 21. Floating Point Precision Issues in Stock Calculations
**File**: `src/app/api/raw-materials/[id]/movements/route.ts:73`
**Impact**: Rounding errors in stock balances

**Fix**: Use Decimal type:
```prisma
currentStock Decimal @default(0)
```

---

### 22. Missing Unique Constraint Validation on BatchUsage
**File**: `src/app/api/batches/route.ts`
**Impact**: Could create duplicate material entries in same batch

**Fix**: Add validation:
```typescript
const materialIds = validatedData.materials.map(m => m.rawMaterialId)
const uniqueIds = new Set(materialIds)
if (materialIds.length !== uniqueIds.size) {
  return NextResponse.json(
    { error: 'Duplicate materials in batch' },
    { status: 400 }
  )
}
```

---

### 23. No Pagination on List Endpoints
**Files**: `src/app/api/batches/route.ts`, etc.
**Impact**: Performance degradation with large datasets

**Fix**: Add pagination:
```typescript
const page = parseInt(searchParams.get('page') || '1')
const limit = parseInt(searchParams.get('limit') || '50')
const skip = (page - 1) * limit

const [batches, total] = await Promise.all([
  prisma.batch.findMany({ skip, take: limit }),
  prisma.batch.count()
])
```

---

### 24. N+1 Query Problem in Batch Listing
**File**: `src/app/api/batches/route.ts:26-36`
**Impact**: Poor performance with many batches

**Fix**: Use `select` instead of `include` for better performance.

---

### 25. Missing CORS Configuration
**Impact**: Cannot access API from different origins

---

### 26-31. Additional Medium Severity Issues

26. **Console.error Logs in Production** - All API routes
27. **Unused Validation Schemas** - `src/lib/validations/` not used in API routes
28. **Missing JSDoc Comments** - All public functions
29. **Hardcoded Error Messages** - Multiple files
30. **No TypeScript Strict Mode** - `tsconfig.json`
31. **Unused React Query Setup** - `src/lib/queries/raw-materials.ts` never used

---

## 🟢 LOW SEVERITY ISSUES

### 32. No Loading States in Tables
**Impact**: Poor UX during data fetching

---

### 33. Missing Empty States in Components
**Impact**: Confusing UX when no data

---

### 34. Inconsistent Date Formatting
**Impact**: Confusing date displays across UI

---

### 35. No Optimistic Updates
**Impact**: Slow perceived performance

---

### 36. Large Bundle Size from Unused Exports
**File**: `src/lib/api-client.ts`
**Impact**: Larger JS bundle

---

### 37. No Confirmation Dialogs for Destructive Actions
**Impact**: Accidental data loss

---

### 38. Missing Accessibility Attributes
**Impact**: Poor accessibility for screen readers

---

### 39. No Keyboard Navigation Support
**Impact**: Poor keyboard accessibility

---

### 40. Seed File Security Issue
**File**: `prisma/seed.ts:10`
**Impact**: Weak default credentials (`password123`)

**Fix**:
```typescript
const defaultPassword = await bcrypt.hash(
  process.env.SEED_PASSWORD || crypto.randomBytes(32).toString('hex'),
  10
)
```

---

### 41. No Request Timeout Configuration
**Impact**: Hanging requests

---

### 42. No Database Connection Pooling Configuration
**File**: `src/lib/db.ts`
**Impact**: Potential connection exhaustion

---

### 43. Missing CSP Headers
**Impact**: XSS vulnerability

---

## Summary by Category

### Authentication & Authorization (6 issues)
- 🔴 Missing auth in finished goods API
- 🔴 Admin can delete self
- 🟠 No authorization checks on stock movements
- 🟠 No audit logging
- 🟠 Weak password validation
- 🟢 Weak seed credentials

### Data Integrity (11 issues)
- 🔴 Race condition in batch creation
- 🔴 Missing negative stock prevention
- 🟠 Duplicate name validation missing
- 🟠 No validation on batch material updates
- 🟡 Floating point precision issues
- 🟡 Missing unique constraint validation
- 🟠 Inconsistent timestamp handling
- 🟠 Missing cascade delete docs
- 🟠 Email uniqueness allows NULL
- 🟠 Unvalidated date ranges
- 🟠 No transaction rollback handling

### Performance (6 issues)
- 🟠 Missing indexes on lookups
- 🟡 No pagination on lists
- 🟡 N+1 queries in batch listing
- 🟢 No optimistic updates
- 🟢 Large bundle size
- 🟢 No connection pooling config

### Security (8 issues)
- 🔴 SQL injection risk
- 🟠 Missing rate limiting
- 🟠 No audit logging
- 🟡 Console.error in production
- 🟡 Missing CORS config
- 🟢 Seed file weak credentials
- 🟢 Missing CSP headers
- 🟢 No request timeout

### Code Quality (10 issues)
- 🟠 Inconsistent error response formats
- 🟡 Missing error boundaries
- 🟡 Memory leak risks in useEffect
- 🟡 Unused React Query code
- 🟡 Missing JSDoc comments
- 🟡 Hardcoded error messages
- 🟡 No TypeScript strict mode
- 🟡 Unused validation schemas
- 🟢 Inconsistent date formatting
- 🟢 Large bundle size

### UX/Accessibility (8 issues)
- 🟢 No loading states
- 🟢 Inconsistent empty states
- 🟢 No confirmation dialogs
- 🟢 Missing accessibility attributes
- 🟢 No keyboard navigation
- 🟢 No optimistic updates
- 🟢 Inconsistent date formatting

---

## Recommended Remediation Priority

### Phase 1: Critical Security Fixes (Week 1)
**Must Fix Before Production**

1. ✅ Add authentication to finished goods API (`src/app/api/finished-goods/route.ts`)
2. ✅ Fix admin self-deletion vulnerability (`src/app/api/users/[id]/route.ts`)
3. ✅ Add stock validation with proper locking (`src/app/api/batches/route.ts`)
4. ✅ Add input sanitization (`src/app/api/raw-materials/[id]/movements/route.ts`)
5. ✅ Prevent batch material inconsistency (`src/app/api/batches/[id]/route.ts`)

**Estimated Effort**: 8-12 hours

---

### Phase 2: High Priority Fixes (Week 2)
**Should Fix Before Production**

6. ✅ Standardize error response formats (all API routes)
7. ✅ Add duplicate validation on updates (`src/app/api/finished-goods/[id]/route.ts`)
8. ✅ Implement rate limiting (middleware)
9. ✅ Add authorization checks on stock movements (`src/app/api/stock-movements/route.ts`)
10. ✅ Fix timestamp handling (`src/app/api/stock-movements/by-date/route.ts`)
11. ✅ Add audit logging for sensitive operations
12. ✅ Strengthen password validation (`src/app/api/users/route.ts`)

**Estimated Effort**: 12-16 hours

---

### Phase 3: Medium Priority Improvements (Week 3-4)
**Important for Scalability**

13. ✅ Add error boundaries to components
14. ✅ Fix memory leaks in useEffect (`src/components/stock/stock-entry-dialog.tsx`)
15. ✅ Implement pagination (all list endpoints)
16. ✅ Fix N+1 query problems (`src/app/api/batches/route.ts`)
17. ✅ Add batch duplicate material validation
18. ✅ Improve decimal handling for stock calculations
19. ✅ Add CORS configuration
20. ✅ Replace console.error with proper logging

**Estimated Effort**: 16-24 hours

---

### Phase 4: Low Priority Polish (Ongoing)
**Nice to Have**

21. ✅ Add loading states to tables
22. ✅ Add empty states to components
23. ✅ Add confirmation dialogs for destructive actions
24. ✅ Improve accessibility (ARIA labels, keyboard navigation)
25. ✅ Add optimistic updates with React Query
26. ✅ Standardize date formatting
27. ✅ Add JSDoc comments
28. ✅ Enable TypeScript strict mode
29. ✅ Add CSP headers
30. ✅ Add request timeouts

**Estimated Effort**: 24-40 hours

---

## Testing Recommendations

### 1. Security Testing
- [ ] Penetration testing for authentication bypass
- [ ] Race condition testing for concurrent batch creation
- [ ] SQL injection testing on all endpoints
- [ ] Test RBAC enforcement on all operations
- [ ] Test admin self-deletion prevention

### 2. Integration Testing
- [ ] Test stock calculations across all operations
- [ ] Test cascade deletes and data integrity
- [ ] Test timezone handling in reports
- [ ] Test duplicate validation on all entities
- [ ] Test transaction rollback scenarios

### 3. Performance Testing
- [ ] Load test with 10,000+ records
- [ ] Test pagination performance
- [ ] Monitor N+1 query fixes
- [ ] Test connection pool under load
- [ ] Measure bundle size improvements

### 4. Accessibility Testing
- [ ] Screen reader testing
- [ ] Keyboard navigation testing
- [ ] WCAG 2.1 compliance audit
- [ ] Color contrast validation

---

## Architecture Recommendations

### 1. API Layer Abstraction
- Migrate all components to use React Query instead of `fetch` + `useEffect`
- Use centralized validation schemas from `src/lib/validations/`
- Implement consistent error handling across all endpoints

### 2. Logging & Monitoring
- Replace `console.error` with structured logging (Winston, Pino)
- Add audit trail for all mutations
- Implement error tracking (Sentry, LogRocket)
- Add performance monitoring

### 3. Database Optimizations
- Apply all documented indexes to production database
- Use database views for complex reports
- Consider read replicas for reporting
- Implement connection pooling properly

### 4. Security Enhancements
- Implement rate limiting on all endpoints
- Add CSRF protection
- Add API versioning for future changes
- Implement proper CORS policies
- Add security headers (CSP, HSTS, etc.)

---

## Notes

- **Unused Code**: React Query infrastructure is installed but not used. Consider either migrating components to use it (recommended) or removing it.
- **Validation Schemas**: Centralized validation schemas exist in `src/lib/validations/` but API routes define their own inline. Should consolidate.
- **Database Indexes**: Documented in schema but not applied due to Supabase pooler blocking migrations. Need to apply manually in production.

---

**Total Estimated Remediation Effort**: 60-92 hours (1.5 - 2.3 weeks)

**Risk Assessment**: The application has **critical security issues** that must be addressed before production deployment. The data integrity issues could lead to inventory discrepancies.

**Recommendation**: Complete Phase 1 and Phase 2 before any production deployment.
