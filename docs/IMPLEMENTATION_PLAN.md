# Stock Movement Logic Fixes - Implementation Plan

**Status:** Plan Mode - Awaiting Approval  
**Date:** 2025-01-XX

## Overview

This plan details the specific code changes required to fix all critical issues identified in the stock movement logic. All changes must be implemented atomically within transactions to ensure data integrity.

---

## Phase 1: Critical Validation Fixes

### 1.1 Add Future Date Validation

**File:** `src/lib/validations/stock-movement.ts`

**Changes:**

- Add future date validation to `stockMovementSchemaAPI`
- Add future date validation to `updateStockMovementSchema`
- Use `getWIBDate()` from timezone utils to get current date in WIB

**Logic:**

```typescript
// In stockMovementSchemaAPI, after date transform:
.refine(
  (data) => {
    const today = getWIBDate()
    const movementDate = data.date
    // Compare dates (ignore time)
    return movementDate <= today
  },
  {
    message: 'Movement date cannot be in the future',
    path: ['date'],
  }
)

// Similar for updateStockMovementSchema
```

**Lines to modify:** After line 44 (stockMovementSchemaAPI) and after line 140 (updateStockMovementSchema)

---

### 1.2 Add Zero Quantity Validation

**File:** `src/lib/validations/stock-movement.ts`

**Changes:**

- Update `stockMovementSchemaAPI` to reject zero quantity for IN/OUT
- Update `updateStockMovementSchema` to reject zero quantity

**Logic:**

```typescript
// Already partially done in superRefine, but ensure it's strict:
// For IN/OUT: quantity > 0 (not >= 0)
// For ADJUSTMENT: quantity != 0 (can be negative)

// Update line 71-77 to be more explicit:
if (data.type !== 'ADJUSTMENT') {
  if (data.quantity === undefined || data.quantity <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Quantity must be greater than zero for IN and OUT movements',
      path: ['quantity'],
    })
  }
}
```

**Lines to modify:** Lines 59-79 (superRefine section)

---

### 1.3 Fix ADJUSTMENT to Prioritize newStock

**File:** `src/app/api/stock-movements/route.ts`

**Changes:**

- Update ADJUSTMENT handling to prioritize `newStock` over `quantity`
- Calculate `adjustmentQuantity` from `newStock` when provided
- Only use `quantity` if `newStock` is not provided

**Logic:**

```typescript
// Replace lines 123-192 with:
let adjustmentQuantity = validatedData.quantity

if (validatedData.type === 'ADJUSTMENT') {
  // Priority: newStock > quantity
  if (validatedData.newStock !== undefined) {
    // Calculate from newStock (primary method)
    const { prisma } = await import('@/lib/db')

    let currentStock = 0
    if (validatedData.rawMaterialId && validatedData.drumId) {
      const drum = await prisma.drum.findUnique({
        where: { id: validatedData.drumId },
        select: { currentQuantity: true },
      })
      if (!drum) {
        return NextResponse.json({ error: 'Drum not found' }, { status: 404 })
      }
      currentStock = drum.currentQuantity
    } else if (validatedData.finishedGoodId) {
      if (!body.locationId) {
        return NextResponse.json(
          { error: 'Location is required for finished good adjustments' },
          { status: 400 }
        )
      }
      const stock = await prisma.finishedGoodStock.findUnique({
        where: {
          finishedGoodId_locationId: {
            finishedGoodId: validatedData.finishedGoodId,
            locationId: body.locationId,
          },
        },
        select: { quantity: true },
      })
      currentStock = stock?.quantity || 0
    }

    // Calculate adjustment: newStock - currentStock
    adjustmentQuantity = validatedData.newStock - currentStock

    // Validate that adjustment doesn't result in negative stock
    if (adjustmentQuantity < 0 && currentStock + adjustmentQuantity < 0) {
      return NextResponse.json(
        {
          error: `Cannot adjust: would result in negative stock. Current: ${currentStock}, New: ${validatedData.newStock}`,
        },
        { status: 400 }
      )
    }
  } else if (validatedData.quantity === undefined) {
    // Neither newStock nor quantity provided (should be caught by schema, but double-check)
    return NextResponse.json(
      { error: 'Either newStock or quantity must be provided for ADJUSTMENT' },
      { status: 400 }
    )
  }
  // If quantity is provided but newStock is not, use quantity as-is
}
```

**Lines to modify:** Lines 123-192

---

## Phase 2: Chronological Stock Calculation

### 2.1 Fix calculateStockAtDate to Handle Same-Day Movements

**File:** `src/lib/services/stock-movement.service.ts`

**Changes:**

- Add `excludeMovementId` parameter to exclude a movement from calculation (for edit operations)
- Add `movementCreatedAt` parameter to handle same-day movements chronologically
- Query movements on same day that were created before the current movement

**Logic:**

```typescript
// Update function signature (line 84):
export async function calculateStockAtDate(
  itemId: string,
  itemType: 'raw-material' | 'finished-good',
  date: Date,
  locationId?: string | null,
  drumId?: string | null,
  excludeMovementId?: string | null,
  movementCreatedAt?: Date | null
): Promise<number> {
  const queryDate = parseToWIB(toWIBISOString(date))
  const startOfDay = startOfDayWIB(queryDate)

  // Get all movements BEFORE the given date
  const movementsBefore = await prisma.stockMovement.findMany({
    where: {
      date: { lt: startOfDay },
      ...(itemType === 'raw-material'
        ? {
            rawMaterialId: itemId,
            ...(drumId ? { drumId } : {}),
          }
        : {
            finishedGoodId: itemId,
            ...(locationId ? { locationId } : {}),
          }),
      ...(excludeMovementId ? { id: { not: excludeMovementId } } : {}),
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })

  // Get movements ON the same day that were created BEFORE this movement
  const sameDayMovements = movementCreatedAt
    ? await prisma.stockMovement.findMany({
        where: {
          date: {
            gte: startOfDay,
            lte: endOfDayWIB(queryDate),
          },
          createdAt: { lt: movementCreatedAt },
          ...(itemType === 'raw-material'
            ? {
                rawMaterialId: itemId,
                ...(drumId ? { drumId } : {}),
              }
            : {
                finishedGoodId: itemId,
                ...(locationId ? { locationId } : {}),
              }),
          ...(excludeMovementId ? { id: { not: excludeMovementId } } : {}),
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      })
    : []

  // Combine and sort all movements chronologically
  const allMovements = [...movementsBefore, ...sameDayMovements].sort(
    (a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime()
      if (dateDiff !== 0) return dateDiff
      return a.createdAt.getTime() - b.createdAt.getTime()
    }
  )

  // Calculate stock by summing all movements
  let stock = 0
  for (const movement of allMovements) {
    if (movement.type === 'IN') {
      stock += movement.quantity
    } else if (movement.type === 'OUT') {
      stock -= movement.quantity
    } else if (movement.type === 'ADJUSTMENT') {
      stock += movement.quantity
    }
  }

  return Math.max(0, stock)
}
```

**Lines to modify:** Lines 84-129

---

### 2.2 Update createStockMovement to Use Chronological Validation

**File:** `src/lib/services/stock-movement.service.ts`

**Changes:**

- Update stock validation to use chronological calculation
- Pass `createdAt` to `calculateStockAtDate` for same-day movement handling
- Remove reliance on cached `currentStock` fields

**Logic:**

```typescript
// In createStockMovement function, replace lines 135-174:
// Date validation: For OUT or negative ADJUSTMENT, check stock BEFORE the movement date
if (data.type === 'OUT' || (data.type === 'ADJUSTMENT' && data.quantity < 0)) {
  const itemId = data.rawMaterialId || data.finishedGoodId!
  const itemType = data.rawMaterialId ? 'raw-material' : 'finished-good'

  // Calculate stock at the movement date (before the movement) chronologically
  // We'll pass createdAt after creating the movement, but for validation we need to
  // get the current timestamp to compare against same-day movements
  const now = new Date()

  const stockAtDate = await calculateStockAtDate(
    itemId,
    itemType,
    data.date,
    itemType === 'finished-good' ? data.locationId : null,
    itemType === 'raw-material' ? data.drumId : null,
    null, // excludeMovementId (not created yet)
    now // movementCreatedAt (will be created now, so compare against current time)
  )

  const quantityToCheck =
    data.type === 'ADJUSTMENT' ? Math.abs(data.quantity) : data.quantity

  if (stockAtDate < quantityToCheck) {
    const itemName = data.rawMaterialId
      ? (
          await tx.rawMaterial.findUnique({
            where: { id: data.rawMaterialId },
            select: { name: true },
          })
        )?.name
      : (
          await tx.finishedGood.findUnique({
            where: { id: data.finishedGoodId! },
            select: { name: true },
          })
        )?.name

    throw new Error(
      `Insufficient stock on ${data.date.toLocaleDateString()}. Available: ${stockAtDate.toFixed(2)}, Requested: ${quantityToCheck.toFixed(2)}`
    )
  }
}

// Remove the duplicate validation block (lines 176-269) that uses currentStock
// Keep only the chronological validation above
```

**Lines to modify:** Lines 135-269 (replace entire validation section)

---

### 2.3 Update updateStockMovement to Use Chronological Validation

**File:** `src/lib/services/stock-movement.service.ts`

**Changes:**

- Update date validation to use chronological calculation
- Pass `excludeMovementId` and `movementCreatedAt` to `calculateStockAtDate`
- Remove reliance on cached stock

**Logic:**

```typescript
// In updateStockMovement function, replace lines 734-762:
// Date validation: For OUT or negative ADJUSTMENT, check stock BEFORE the new date
if (
  (existingMovement.type === 'OUT' ||
    (existingMovement.type === 'ADJUSTMENT' && newQuantity < 0)) &&
  newQuantity > 0
) {
  // Calculate stock chronologically, excluding this movement
  const stockAtDate = await calculateStockAtDate(
    itemId,
    itemType,
    newDate,
    itemType === 'finished-good' ? newLocationId : null,
    itemType === 'raw-material' ? existingMovement.drumId : null,
    movementId, // Exclude this movement from calculation
    newDate.getTime() === oldDate.getTime() ? existingMovement.createdAt : null // Only use createdAt if date hasn't changed
  )

  const quantityToCheck =
    existingMovement.type === 'ADJUSTMENT' ? Math.abs(newQuantity) : newQuantity

  if (stockAtDate < quantityToCheck) {
    const itemName =
      itemType === 'raw-material'
        ? existingMovement.rawMaterial?.name
        : existingMovement.finishedGood?.name
    throw new Error(
      `Insufficient stock on ${newDate.toLocaleDateString()}. Available: ${stockAtDate.toFixed(2)}, Requested: ${quantityToCheck.toFixed(2)}`
    )
  }
}
```

**Lines to modify:** Lines 734-762

---

## Phase 3: Remove Finished Good Global Stock Updates

### 3.1 Remove currentStock Updates for Finished Goods

**File:** `src/lib/services/stock-movement.service.ts`

**Changes:**

- Remove all `finishedGood.currentStock` updates
- Only update `FinishedGoodStock.quantity` at specific locations

**Locations to modify:**

1. **createStockMovement function (lines 314-348):**

```typescript
// Replace lines 314-348 with:
// Update Finished Good Stock (Location Aware)
if (data.finishedGoodId) {
  if (!data.locationId) throw new Error('Location required')

  // Update upsert: Create if not exists (for IN), update if exists
  await tx.finishedGoodStock.upsert({
    where: {
      finishedGoodId_locationId: {
        finishedGoodId: data.finishedGoodId,
        locationId: data.locationId,
      },
    },
    update: {
      quantity: { increment: quantityChange },
    },
    create: {
      finishedGoodId: data.finishedGoodId,
      locationId: data.locationId,
      quantity: quantityChange < 0 ? 0 : quantityChange,
    },
  })

  // REMOVED: Update global aggregate (no longer needed)
}
```

2. **updateStockMovement function (lines 803-831 and 862-893):**

```typescript
// Replace lines 803-831 (reverse old location stock):
if (existingMovement.finishedGoodId) {
  // Reverse old location stock
  if (oldLocationId) {
    await tx.finishedGoodStock
      .update({
        where: {
          finishedGoodId_locationId: {
            finishedGoodId: existingMovement.finishedGoodId,
            locationId: oldLocationId,
          },
        },
        data: {
          quantity: { increment: -oldQuantityChange },
        },
      })
      .catch(() => {
        // If stock doesn't exist, ignore (shouldn't happen, but safe)
      })
  }

  // REMOVED: Update global aggregate
}

// Replace lines 862-893 (apply new location stock):
if (existingMovement.finishedGoodId) {
  if (!newLocationId) {
    throw new Error('Location is required for finished good movements')
  }

  // Update new location stock
  await tx.finishedGoodStock.upsert({
    where: {
      finishedGoodId_locationId: {
        finishedGoodId: existingMovement.finishedGoodId,
        locationId: newLocationId,
      },
    },
    update: {
      quantity: { increment: newQuantityChange },
    },
    create: {
      finishedGoodId: existingMovement.finishedGoodId,
      locationId: newLocationId,
      quantity: newQuantityChange > 0 ? newQuantityChange : 0,
    },
  })

  // REMOVED: Update global aggregate
}
```

3. **deleteStockMovement function (lines 1016-1085):**

```typescript
// Replace lines 1016-1085 with:
if (existingMovement.finishedGoodId) {
  if (!existingMovement.locationId) {
    throw new Error('Location is required for finished good movements')
  }

  const stocks = await tx.$queryRaw<Array<{ quantity: number }>>`
    SELECT quantity
    FROM finished_good_stocks
    WHERE "finishedGoodId" = ${existingMovement.finishedGoodId}
      AND "locationId" = ${existingMovement.locationId}
    FOR UPDATE
  `

  if (stocks.length === 0) {
    // Stock doesn't exist, but we'll still try to delete the movement
    // This shouldn't happen, but handle gracefully
  } else {
    const stock = stocks[0]
    const newQuantity = stock.quantity + reverseChange

    if (newQuantity < 0) {
      throw new Error(
        `Cannot delete movement: would result in negative stock at location (${newQuantity.toFixed(2)})`
      )
    }

    await tx.finishedGoodStock.update({
      where: {
        finishedGoodId_locationId: {
          finishedGoodId: existingMovement.finishedGoodId,
          locationId: existingMovement.locationId,
        },
      },
      data: {
        quantity: { increment: reverseChange },
      },
    })
  }

  // REMOVED: Update global aggregate
}
```

4. **deleteStockMovementsByDate function (lines 445-476):**

```typescript
// Replace lines 445-476 with:
// For finished goods, we need locationId to update specific location stock
// This function doesn't have locationId, so we need to handle it differently
// OR: This function should require locationId for finished goods

// Actually, this function is used for bulk deletion by date
// We should update it to require locationId for finished goods, or
// update all locations that have movements on that date

// For now, keep the currentStock update but add a TODO comment
// TODO: This function should be updated to handle location-specific stock
// For now, keeping currentStock update for backward compatibility
// In future, this should iterate through all locations with movements
```

**Note:** The `deleteStockMovementsByDate` function needs locationId for finished goods. We should either:

- Require locationId parameter for finished goods
- Or iterate through all locations that have movements on that date

**Lines to modify:**

- Lines 314-348 (createStockMovement)
- Lines 803-831, 862-893 (updateStockMovement)
- Lines 1016-1085 (deleteStockMovement)
- Lines 445-476 (deleteStockMovementsByDate) - needs design decision

---

## Phase 4: Allow Batch Movement Editing

### 4.1 Remove Batch Movement Edit Restrictions

**File:** `src/lib/services/stock-movement.service.ts`

**Changes:**

- Remove check that prevents editing batch movements
- Update batch usage records when batch movement quantity changes
- Handle batch deletion when all movements are deleted

**Logic:**

1. **updateStockMovement function (lines 696-701):**

```typescript
// REMOVE these lines:
// Prevent editing batch movements
if (existingMovement.batchId) {
  throw new Error('This movement is part of a batch. Edit the batch instead.')
}

// REPLACE with:
// If movement is linked to batch, update batch usage
if (existingMovement.batchId && data.quantity !== undefined) {
  // Find batch usage for this movement
  const batchUsage = await tx.batchUsage.findFirst({
    where: {
      batchId: existingMovement.batchId,
      rawMaterialId: existingMovement.rawMaterialId || undefined,
      drumId: existingMovement.drumId || undefined,
    },
  })

  if (batchUsage) {
    // Update batch usage quantity
    await tx.batchUsage.update({
      where: { id: batchUsage.id },
      data: {
        quantity: newQuantity,
      },
    })
  }
}
```

2. **deleteStockMovement function (lines 935-940):**

```typescript
// REMOVE these lines:
// Prevent deleting batch movements
if (existingMovement.batchId) {
  throw new Error('This movement is part of a batch. Delete the batch instead.')
}

// REPLACE with:
// If movement is linked to batch, delete batch usage and optionally batch
if (existingMovement.batchId) {
  // Delete batch usage
  await tx.batchUsage.deleteMany({
    where: {
      batchId: existingMovement.batchId,
      rawMaterialId: existingMovement.rawMaterialId || undefined,
      drumId: existingMovement.drumId || undefined,
    },
  })

  // Check if batch has any remaining movements
  const remainingMovements = await tx.stockMovement.count({
    where: { batchId: existingMovement.batchId },
  })

  // If no movements remain, optionally delete the batch
  // For now, we'll leave the batch (orphaned batches can be cleaned up separately)
  // If you want to auto-delete, uncomment:
  // if (remainingMovements === 0) {
  //   await tx.batch.delete({
  //     where: { id: existingMovement.batchId },
  //   })
  // }
}
```

**Lines to modify:**

- Lines 696-701 (updateStockMovement - remove restriction)
- Lines 935-940 (deleteStockMovement - remove restriction)
- Add batch usage update logic after line 779 (updateStockMovement)
- Add batch usage delete logic after line 940 (deleteStockMovement)

---

## Phase 5: Add Pagination to Movement History

### 5.1 Add Pagination to getRawMaterialMovements

**File:** `src/lib/services/raw-material.service.ts`

**Changes:**

- Add `page` and `limit` parameters
- Return pagination metadata
- Default: `page=1`, `limit=50`
- Max: `limit=500`

**Logic:**

```typescript
// Update function signature (line 221):
export async function getRawMaterialMovements(
  id: string,
  options?: {
    page?: number
    limit?: number
  }
): Promise<{
  material: Pick<RawMaterial, 'id' | 'kode' | 'name' | 'currentStock' | 'moq'>
  movements: Array<{...}>
  pagination?: PaginationMetadata
}> {
  // ... existing material fetch code ...

  // Pagination logic
  const page = options?.page ? Math.max(1, options.page) : 1
  const limit = options?.limit
    ? Math.min(500, Math.max(1, options.limit))
    : 50
  const skip = (page - 1) * limit

  // Get total count
  const total = await prisma.stockMovement.count({
    where: { rawMaterialId: id },
  })

  // Fetch movements with pagination
  const movements = await prisma.stockMovement.findMany({
    where: { rawMaterialId: id },
    include: {
      batch: { select: { id: true, code: true } },
      drum: { select: { label: true } },
    },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' },
    ],
    skip,
    take: limit,
  })

  // Calculate running balance (same as before)
  // ...

  return {
    material,
    movements: movementsWithBalance,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + movements.length < total,
    },
  }
}
```

**Lines to modify:** Lines 221-318

---

### 5.2 Add Pagination to getFinishedGoodMovements

**File:** `src/lib/services/finished-good.service.ts`

**Changes:**

- Add `page` and `limit` parameters
- Return pagination metadata
- Default: `page=1`, `limit=50`
- Max: `limit=500`

**Logic:**

```typescript
// Update function signature (line 248):
export async function getFinishedGoodMovements(
  id: string,
  options?: {
    locationId?: string | null
    page?: number
    limit?: number
  }
): Promise<{
  finishedGood: Pick<FinishedGood, 'id' | 'name' | 'currentStock'>
  movements: Array<{...}>
  pagination?: PaginationMetadata
}> {
  // ... existing finished good fetch code ...

  const locationId = options?.locationId
  const page = options?.page ? Math.max(1, options.page) : 1
  const limit = options?.limit
    ? Math.min(500, Math.max(1, options.limit))
    : 50
  const skip = (page - 1) * limit

  // Get total count
  const total = await prisma.stockMovement.count({
    where: {
      finishedGoodId: id,
      ...(locationId ? { locationId } : {}),
    },
  })

  // Fetch movements with pagination
  const movements = await prisma.stockMovement.findMany({
    where: {
      finishedGoodId: id,
      ...(locationId ? { locationId } : {}),
    },
    include: {
      batch: { select: { id: true, code: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' },
    ],
    skip,
    take: limit,
  })

  // Calculate running balance (same as before)
  // ...

  return {
    finishedGood: { ...finishedGood, currentStock },
    movements: movementsWithBalance,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + movements.length < total,
    },
  }
}
```

**Lines to modify:** Lines 248-364

---

### 5.3 Update API Routes to Accept Pagination Parameters

**Files to check:**

- `src/app/api/raw-materials/[id]/movements/route.ts` (if exists)
- `src/app/api/finished-goods/[id]/movements/route.ts` (if exists)

**Changes:**

- Add `page` and `limit` query parameters
- Pass to service functions
- Return pagination metadata in response

**Note:** Need to check if these routes exist first.

---

## Phase 6: Ensure Raw Material Aggregate = Sum of Drums

### 6.1 Add Validation Helper Function

**File:** `src/lib/services/stock-movement.service.ts`

**Changes:**

- Add helper function to ensure aggregate stock equals sum of drums
- Call after every drum stock update

**Logic:**

```typescript
// Add new helper function after calculateStockAtDate:
/**
 * Ensure raw material aggregate stock equals sum of drum stocks
 *
 * @param rawMaterialId - Raw material ID
 * @param tx - Prisma transaction client
 * @returns void
 * @throws {Error} If aggregate doesn't match sum of drums
 */
async function validateRawMaterialStockConsistency(
  rawMaterialId: string,
  tx: any
): Promise<void> {
  // Get sum of all drum stocks
  const drumSum = await tx.drum.aggregate({
    where: { rawMaterialId },
    _sum: { currentQuantity: true },
  })

  const totalDrumStock = drumSum._sum.currentQuantity || 0

  // Get aggregate stock
  const rawMaterial = await tx.rawMaterial.findUnique({
    where: { id: rawMaterialId },
    select: { currentStock: true },
  })

  if (
    rawMaterial &&
    Math.abs(rawMaterial.currentStock - totalDrumStock) > 0.01
  ) {
    // Allow small floating point differences
    throw new Error(
      `Stock inconsistency detected for raw material. Aggregate: ${rawMaterial.currentStock}, Sum of drums: ${totalDrumStock}`
    )
  }
}
```

**Note:** This is a validation function. We should call it in development/staging, but may want to make it optional in production for performance.

**Lines to add:** After line 129 (after calculateStockAtDate function)

---

## Testing Requirements

### Unit Tests to Add/Update

1. **Chronological Stock Calculation:**
   - Test same-day movements in different creation order
   - Test backdated movements
   - Test future date rejection

2. **ADJUSTMENT with newStock:**
   - Test newStock as primary method
   - Test quantity as fallback
   - Test negative stock prevention

3. **Batch Movement Editing:**
   - Test editing batch-linked movement
   - Test deleting batch-linked movement
   - Test batch usage update

4. **Finished Good Location-Only:**
   - Test no global stock updates
   - Test location-specific stock updates

5. **Pagination:**
   - Test pagination parameters
   - Test default values
   - Test max limit

### Integration Tests

1. **Complex Scenarios:**
   - Multiple same-day movements
   - Batch operations with movement edits
   - Location transfers (OUT + IN)

2. **Edge Cases:**
   - Zero quantity rejection
   - Future date rejection
   - Negative stock prevention

---

## Migration Notes

### Database Changes

No schema changes required. All changes are logic-level.

### Data Migration

1. **Reconciliation Function:**
   - Create a one-time script to recalculate all stock from movements
   - Run before deploying changes
   - Verify no drift exists

2. **Finished Good Stock:**
   - Existing `currentStock` values will remain but won't be updated
   - Can be safely ignored or removed in future migration

---

## Rollback Plan

If issues occur:

1. **Revert code changes** (git revert)
2. **Run reconciliation script** to fix any stock drift
3. **Verify stock values** match movement history

---

## Implementation Order

1. **Phase 1:** Validation fixes (low risk, high impact)
2. **Phase 2:** Chronological calculation (core logic)
3. **Phase 3:** Remove finished good global stock (data integrity)
4. **Phase 4:** Batch movement editing (feature enhancement)
5. **Phase 5:** Pagination (performance)
6. **Phase 6:** Consistency validation (safety net)

---

## Files Summary

### Files to Modify:

1. `src/lib/validations/stock-movement.ts` - Validation schemas
2. `src/app/api/stock-movements/route.ts` - API route (ADJUSTMENT handling)
3. `src/lib/services/stock-movement.service.ts` - Core service logic (major changes)
4. `src/lib/services/raw-material.service.ts` - Add pagination
5. `src/lib/services/finished-good.service.ts` - Add pagination

### Files to Review (may need changes):

1. `src/app/api/stock-movements/by-date/route.ts` - May need locationId for finished goods
2. `src/app/api/raw-materials/[id]/movements/route.ts` - Add pagination params (if exists)
3. `src/app/api/finished-goods/[id]/movements/route.ts` - Add pagination params (if exists)

---

## Approval Required

**Status:** ⏳ Awaiting approval with keyword "ACT"

Once approved, implementation will proceed in the order specified above, with thorough testing at each phase.

---

**End of Implementation Plan**
