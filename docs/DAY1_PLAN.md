# Day 1 Plan: Foundation & Planning

**Date:** Day 1 of 10-Day Refactoring Plan  
**Focus:** Documentation, Architecture Design, and Testing Strategy  
**Estimated Time:** 4-6 hours

---

## Objectives

1. Map all database operations from API routes to service layer functions
2. Create service layer architecture design document
3. Document validation schema consolidation strategy
4. Create testing strategy with manual verification plan

---

## Task 1: Map Database Operations (2 hours)

### 1.1 Review All API Routes

Analyze all API route files to identify every Prisma query:

**Files to Review:**

- `src/app/api/raw-materials/route.ts` (GET, POST)
- `src/app/api/raw-materials/[id]/route.ts` (PUT, DELETE)
- `src/app/api/raw-materials/[id]/movements/route.ts` (GET)
- `src/app/api/finished-goods/route.ts` (GET, POST)
- `src/app/api/finished-goods/[id]/route.ts` (PUT, DELETE)
- `src/app/api/batches/route.ts` (GET, POST)
- `src/app/api/batches/[id]/route.ts` (GET, PUT, DELETE)
- `src/app/api/stock-movements/route.ts` (GET, POST)
- `src/app/api/stock-movements/by-date/route.ts` (DELETE, PUT)
- `src/app/api/users/route.ts` (GET, POST)
- `src/app/api/users/[id]/route.ts` (GET, PUT, DELETE)
- `src/app/api/health/route.ts` (GET - keep as is, no service needed)

### 1.2 Create Database Operations Mapping Document

Create `docs/ARCHITECTURE/DATABASE_OPERATIONS_MAP.md` with:

**For each API route, document:**

- HTTP method and endpoint
- Current Prisma queries (findMany, findUnique, create, update, delete, $transaction)
- Transaction boundaries
- FOR UPDATE locks used
- Related operations (e.g., batch creation = batch + batchUsages + batchFinishedGoods + stockMovements + stock updates)
- Input validation requirements
- Error cases handled

**Example Structure:**

```markdown
## Raw Materials

### GET /api/raw-materials

- **Operation:** List all raw materials
- **Prisma Query:** `prisma.rawMaterial.findMany()`
- **Pagination:** Optional (page, limit params)
- **Service Function:** `getRawMaterials(options?: PaginationOptions)`
- **Returns:** `RawMaterial[]` or `{ data: RawMaterial[], pagination: {...} }`

### POST /api/raw-materials

- **Operation:** Create raw material
- **Prisma Queries:**
  1. `findFirst({ where: { kode } })` - duplicate check
  2. `create({ data: {...} })` - create material
- **Service Function:** `createRawMaterial(data: RawMaterialInput)`
- **Returns:** `RawMaterial`
- **Errors:** Duplicate code (400)
```

---

## Task 2: Service Layer Architecture Design (1.5 hours)

### 2.1 Create Architecture Document

Create `docs/ARCHITECTURE/SERVICE_LAYER_DESIGN.md` with:

**Service Layer Structure:**

```
src/lib/services/
├── index.ts                    # Export all services
├── raw-material.service.ts    # Raw material operations
├── finished-good.service.ts    # Finished good operations
├── batch.service.ts            # Batch operations (most complex)
├── stock-movement.service.ts   # Stock movement operations
└── user.service.ts             # User operations
```

**Design Principles:**

1. **Separation of Concerns:**
   - Routes handle: Authentication, Authorization, Request/Response formatting
   - Services handle: Business logic, Database operations, Transactions

2. **Error Handling:**
   - Services throw errors (Error instances)
   - Routes catch and format as HTTP responses
   - Services use descriptive error messages

3. **Transaction Management:**
   - All transactions handled inside services
   - Use Prisma `$transaction` for multi-step operations
   - FOR UPDATE locks for stock validation

4. **Type Safety:**
   - All functions strictly typed
   - Use Zod validation types from `src/lib/validations`
   - Return Prisma model types

5. **JSDoc Requirements:**
   - Every service function must have JSDoc
   - Document parameters, return type, throws, and business logic notes

**Service Function Signature Pattern:**

```typescript
/**
 * [Function description]
 *
 * @param paramName - Parameter description
 * @returns Return type description
 * @throws {Error} Error description
 *
 * @remarks
 * - Business logic note 1
 * - Business logic note 2
 */
export async function functionName(param: ParamType): Promise<ReturnType> {
  // Implementation
}
```

**Example Service Function:**

```typescript
/**
 * Create a new raw material
 *
 * @param data - Raw material input data (validated)
 * @returns Created raw material
 * @throws {Error} If material code already exists
 *
 * @remarks
 * - Always starts with currentStock = 0
 * - Validates duplicate code before creation
 */
export async function createRawMaterial(
  data: RawMaterialInput
): Promise<RawMaterial> {
  // Check for duplicate
  const existing = await prisma.rawMaterial.findFirst({
    where: { kode: data.kode },
  })

  if (existing) {
    throw new Error(`Material code "${data.kode}" already exists`)
  }

  // Create material
  return await prisma.rawMaterial.create({
    data: {
      ...data,
      currentStock: 0,
    },
  })
}
```

---

## Task 3: Validation Schema Consolidation Strategy (1 hour)

### 3.1 Create Validation Strategy Document

Create `docs/ARCHITECTURE/VALIDATION_SCHEMA_STRATEGY.md` with:

**Current State Analysis:**

- List all inline schemas in API routes
- Compare with centralized schemas in `src/lib/validations/`
- Identify gaps and differences

**Consolidation Plan:**

**For each schema:**

1. **Raw Materials:**
   - Inline: `createRawMaterialSchema` in `route.ts`
   - Centralized: `rawMaterialSchema` in `validations/raw-material.ts`
   - Action: Use centralized schema, add API-specific transforms if needed

2. **Batches:**
   - Inline: `createBatchSchema` in `route.ts` (supports multiple finished goods, date transform)
   - Centralized: `batchSchema` in `validations/batch.ts` (single finished good, date as Date)
   - Action: Update centralized schema to match API needs

3. **Stock Movements:**
   - Inline: `createStockMovementSchema` in `route.ts` (supports ADJUSTMENT type)
   - Centralized: `stockMovementSchema` in `validations/stock-movement.ts` (only IN/OUT)
   - Action: Update centralized schema to include ADJUSTMENT

4. **Users:**
   - Inline: `createUserSchema`, `updateUserSchema` in routes
   - Centralized: `createUserSchema`, `updateUserSchema` exist
   - Action: Use centralized schemas (may need minor adjustments)

**Schema Enhancement Strategy:**

- Use Zod `.transform()` for date/timezone conversions
- Use Zod `.refine()` for complex validations (e.g., ADJUSTMENT quantity can be negative)
- Keep schemas reusable between frontend and backend
- Export API-specific variants if needed (e.g., `batchSchemaAPI` with transforms)

---

## Task 4: Testing Strategy Document (1.5 hours)

### 4.1 Create Testing Strategy Document

Create `docs/ARCHITECTURE/TESTING_STRATEGY.md` with:

**Testing Approach:**

- Manual testing (per cursorrules requirement)
- Edge case audit checklist
- Build and type checking verification

**Manual Verification Plan:**

**For Each Service Function:**

1. **Raw Material Services:**
   - `getRawMaterials()`: Test pagination, test without pagination
   - `createRawMaterial()`: Test success, test duplicate code, test validation errors
   - `updateRawMaterial()`: Test success, test duplicate code (excluding self), test not found
   - `deleteRawMaterial()`: Test success, test with transaction history (should fail), test not found

2. **Batch Services:**
   - `createBatch()`:
     - Test success with multiple materials and finished goods
     - Test insufficient stock (should fail)
     - Test duplicate materials (should fail)
     - Test duplicate batch code (should fail)
     - Verify stock deduction in Prisma Studio
     - Verify stock movements created
   - `updateBatch()`:
     - Test stock restoration for old materials
     - Test stock deduction for new materials
     - Verify transaction integrity
   - `deleteBatch()`:
     - Test stock restoration
     - Verify all related records deleted

3. **Stock Movement Services:**
   - `createStockMovement()`:
     - Test IN movement (stock increases)
     - Test OUT movement (stock decreases, validate sufficient stock)
     - Test ADJUSTMENT (positive and negative)
     - Test negative stock prevention
     - Test FOR UPDATE lock behavior

**Edge Case Audit Checklist:**

- [ ] Empty states: Empty arrays, null values, undefined
- [ ] Null checks: All database queries handle not found
- [ ] RBAC bypass: Verify routes still check permissions (not moved to services)
- [ ] Input boundaries:
  - [ ] Negative stock quantities
  - [ ] Zero quantities (where applicable)
  - [ ] Extremely long strings (name, description)
  - [ ] Invalid IDs (non-CUID format)
- [ ] Transaction rollback: Verify failed transactions don't leave partial data
- [ ] Race conditions: Test concurrent requests with FOR UPDATE locks
- [ ] Duplicate prevention: All unique constraints tested

**Build and Type Checking:**

After each service implementation:

1. Run `npm run type-check` - must pass with zero errors
2. Run `npm run lint` - must pass with zero warnings
3. Run `npm run format:check` - must pass
4. Run `npm run build` - must succeed

**Verification Workflow:**

1. **After Creating Service:**
   - Type check passes
   - Lint passes
   - Format check passes

2. **After Refactoring Route:**
   - Build succeeds
   - Manual API test (use browser/Postman)
   - Verify database state in Prisma Studio
   - Test error cases

3. **After All Services Complete:**
   - Full manual test suite
   - All edge cases verified
   - Build and type check pass
   - No regressions

**Testing Tools:**

- Browser DevTools for API testing
- Prisma Studio for database verification
- Postman/curl for API endpoint testing
- Next.js dev server for integration testing

---

## Deliverables

By end of Day 1, create:

1. ✅ `docs/ARCHITECTURE/DATABASE_OPERATIONS_MAP.md` - Complete mapping of all database operations
2. ✅ `docs/ARCHITECTURE/SERVICE_LAYER_DESIGN.md` - Service layer architecture and patterns
3. ✅ `docs/ARCHITECTURE/VALIDATION_SCHEMA_STRATEGY.md` - Validation consolidation plan
4. ✅ `docs/ARCHITECTURE/TESTING_STRATEGY.md` - Testing and verification strategy

---

## Success Criteria

- [ ] All API routes analyzed and documented
- [ ] All database operations mapped to service functions
- [ ] Service layer architecture clearly defined
- [ ] Validation schema strategy documented
- [ ] Testing strategy with manual verification plan complete
- [ ] Ready to begin Day 2 (service layer structure design)

---

## Notes

- Keep all documentation in `docs/ARCHITECTURE/` directory
- Use markdown format for all documents
- Include code examples in documentation
- Reference existing code patterns where applicable
- Document decisions and rationale

---

**Next:** Day 2 will use these documents to create the actual service layer structure and begin implementation.
