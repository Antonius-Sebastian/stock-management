# Stock Movement Logic - Technical Specification

**Version:** 1.0  
**Date:** 2025-01-XX  
**Status:** Draft for Review

## Executive Summary

This document specifies the correct implementation of stock movement logic for both **Raw Materials** and **Finished Goods** in the stock management system. The specification addresses critical business rules, data integrity constraints, and architectural patterns to ensure accurate stock tracking and prevent data drift.

---

## 1. Core Principles

### 1.1 Stock Calculation Method

- **Stock MUST be calculated by summing movements chronologically**
- The `currentStock` field in `RawMaterial` and `FinishedGood` tables is a **cache/denormalized field**, NOT the source of truth
- Stock calculations must always query and sum `StockMovement` records in chronological order
- Stock must never drift from movement history - this must be prevented at the database level

### 1.2 Movement Chronology

- Movements are ordered by: `date` (ascending), then `createdAt` (ascending)
- Same-day movements must be processed in creation order
- Date validation must account for chronological ordering of same-day movements

### 1.3 Negative Stock Prevention

- **Negative stock is NEVER allowed**
- All OUT and negative ADJUSTMENT operations must validate sufficient stock exists
- Validation must check stock BEFORE the movement date, accounting for chronological ordering

---

## 2. Raw Materials & Drums

### 2.1 Drum Requirements

- **ALL raw material stock operations MUST be drum-tracked**
- `drumId` is REQUIRED for all raw material movements (IN, OUT, ADJUSTMENT)
- Raw materials cannot have stock without drums

### 2.2 Stock Consistency Rules

- **Aggregate stock MUST equal sum of drum stocks**: `rawMaterial.currentStock = SUM(drum.currentQuantity)`
- This must be enforced at the database level (triggers or computed fields)
- When updating drum stock, aggregate stock must be updated atomically
- When updating aggregate stock, drum stocks must be updated atomically

### 2.3 Drum Active Status

- `isActive = true`: Drum has stock (`currentQuantity > 0`)
- `isActive = false`: Drum is empty (`currentQuantity = 0`)
- `isActive` must be automatically updated when `currentQuantity` changes

### 2.4 Batch Operations

- Batch operations MUST deduct from specific drums
- Aggregate stock must be updated to match drum stock changes
- Batch movements are editable/deletable (see Section 4.3)

---

## 3. Finished Goods & Locations

### 3.1 Location Requirements

- **ALL finished good stock operations MUST be location-tracked**
- `locationId` is REQUIRED for all finished good movements (IN, OUT, ADJUSTMENT)
- Finished goods cannot have stock without locations

### 3.2 Stock Storage Model

- **NO global stock for finished goods**
- The `finishedGood.currentStock` field should be **deprecated or removed**
- Stock is ONLY stored in `FinishedGoodStock` table (location-specific)
- All queries must use `FinishedGoodStock.quantity` for stock values

### 3.3 Location Transfers

- Transfers between locations are implemented as two movements:
  1. OUT movement from source location
  2. IN movement to destination location
- No special TRANSFER movement type needed

---

## 4. Movement Types & Operations

### 4.1 Movement Types

#### IN Movement

- Increases stock by `quantity`
- For raw materials: Updates drum `currentQuantity` and aggregate `currentStock`
- For finished goods: Updates `FinishedGoodStock.quantity` at specified location
- No validation needed (always allowed)

#### OUT Movement

- Decreases stock by `quantity`
- Must validate sufficient stock exists BEFORE the movement date
- Must account for chronological ordering of same-day movements
- Prevents negative stock

#### ADJUSTMENT Movement

- **Primary method: `newStock`** (target stock level)
- Secondary method: `quantity` (signed delta)
- When `newStock` is provided:
  - Calculate: `adjustmentQuantity = newStock - currentStock`
  - If `adjustmentQuantity < 0`: Validate sufficient stock exists
- When `quantity` is provided:
  - If `quantity < 0`: Validate sufficient stock exists
- Used for stock opname (physical inventory) corrections

### 4.2 Movement Validation Rules

#### Date Validation

- **Future dates are NOT allowed**
- Movement date must be <= current date (in WIB timezone)
- For OUT/negative ADJUSTMENT: Check stock BEFORE the movement date
- Stock calculation must include all movements with `date < movementDate` OR (`date = movementDate` AND `createdAt < movementCreatedAt`)

#### Quantity Validation

- **Zero quantity is NOT allowed** (`quantity > 0` for IN/OUT, `quantity != 0` for ADJUSTMENT)
- Maximum quantity: 1,000,000 (configurable)

#### Stock Availability Validation

- For OUT movements: `stockBeforeDate >= quantity`
- For negative ADJUSTMENT: `stockBeforeDate >= |quantity|`
- Validation must use chronological movement calculation, not cached `currentStock`

### 4.3 Movement Editability

#### General Rules

- **All movements are editable/deletable by ADMIN only**
- Editing/deleting movements must recalculate all affected stock values
- Must prevent negative stock after edit/delete

#### Batch-Linked Movements

- Movements linked to batches (`batchId != null`) are editable/deletable
- Editing batch movement must update:
  - The movement record
  - Related drum/aggregate stock
  - Batch usage record (if quantity changed)
- Deleting batch movement must:
  - Restore stock
  - Delete batch usage record
  - Optionally delete batch if no movements remain

#### Edit Constraints

- Cannot change `rawMaterialId` or `finishedGoodId` (would be a different item)
- Cannot change `type` (would require different validation logic)
- Can change: `quantity`, `date`, `description`, `locationId` (finished goods), `drumId` (raw materials)

---

## 5. Date Validation Logic

### 5.1 Chronological Stock Calculation

When validating stock for a movement on date `D`:

1. **Get all movements BEFORE date D:**

   ```sql
   WHERE date < D
   ORDER BY date ASC, createdAt ASC
   ```

2. **Get all movements ON date D that were created BEFORE this movement:**

   ```sql
   WHERE date = D AND createdAt < currentMovementCreatedAt
   ORDER BY date ASC, createdAt ASC
   ```

3. **Sum all movements chronologically:**
   - IN: `+quantity`
   - OUT: `-quantity`
   - ADJUSTMENT: `+quantity` (signed)

4. **Validate:** `calculatedStock >= requiredQuantity`

### 5.2 Example Scenario

**Scenario:** User creates movements in this order:

1. Jan 5, 10:00 AM: IN 100 units
2. Jan 5, 11:00 AM: OUT 50 units
3. Jan 5, 9:00 AM (backdated): OUT 60 units

**Validation for movement #3:**

- Stock before Jan 5: 0
- Stock on Jan 5 before 9:00 AM: 0 (no movements yet)
- Movement #3 would result in: 0 - 60 = -40 ❌ **REJECTED**

**If movement #3 was created first:**

- Stock before Jan 5: 0
- Movement #3: 0 - 60 = -40 ❌ **REJECTED**

**Correct order:**

1. Jan 5, 9:00 AM: IN 100 units → Stock: 100
2. Jan 5, 10:00 AM: OUT 60 units → Stock: 40 ✅
3. Jan 5, 11:00 AM: OUT 50 units → Stock: 40 - 50 = -10 ❌ **REJECTED**

---

## 6. Data Integrity & Consistency

### 6.1 Stock Drift Prevention

**Problem:** `currentStock` fields can drift from actual movement history.

**Solution:** Make it impossible for stock to drift:

1. **Remove direct updates to `currentStock` fields**
   - Only update via stock movement operations
   - Use database triggers or computed columns if possible

2. **Reconciliation Function**
   - Create a function to recalculate stock from movements
   - Run periodically (cron job) to detect and fix drift
   - Alert if drift is detected

3. **Transaction Atomicity**
   - All stock updates must be in the same transaction as movement creation
   - Use database transactions with proper isolation levels

### 6.2 Raw Material Consistency

**Enforce:** `rawMaterial.currentStock = SUM(drum.currentQuantity WHERE rawMaterialId = X)`

**Implementation:**

- Update aggregate when drum stock changes
- Update drums when aggregate changes (distribute proportionally or use FIFO)
- Add database constraint or trigger if possible

### 6.3 Finished Good Consistency

**Enforce:** `finishedGood.currentStock = SUM(finishedGoodStock.quantity WHERE finishedGoodId = X)`

**Implementation:**

- Since we're deprecating `currentStock`, this becomes less critical
- Still maintain for backward compatibility if needed
- All queries should use `FinishedGoodStock` table

---

## 7. API & Service Layer Changes

### 7.1 Stock Movement Service

#### `createStockMovement()`

- ✅ Validate future dates (reject)
- ✅ Validate zero quantity (reject)
- ✅ Validate drumId for raw materials (require)
- ✅ Validate locationId for finished goods (require)
- ✅ Calculate stock chronologically before date
- ✅ Update stock atomically in transaction
- ✅ For raw materials: Update drum + aggregate
- ✅ For finished goods: Update location stock only (no global)

#### `updateStockMovement()`

- ✅ Allow editing batch-linked movements
- ✅ Recalculate stock from movements (don't use cached values)
- ✅ Validate new date/quantity won't cause negative stock
- ✅ Update batch usage if quantity changed
- ✅ Prevent changing item type or movement type

#### `deleteStockMovement()`

- ✅ Allow deleting batch-linked movements
- ✅ Restore stock atomically
- ✅ Delete batch usage if movement was batch-linked
- ✅ Optionally delete batch if empty

#### `calculateStockAtDate()`

- ✅ Sum movements chronologically (date, then createdAt)
- ✅ Filter by drumId for raw materials
- ✅ Filter by locationId for finished goods
- ✅ Return calculated stock (not cached)

### 7.2 Movement History Queries

#### `getRawMaterialMovements()`

- ✅ Add pagination support (page, limit)
- ✅ Default limit: 500 (keep for backward compatibility)
- ✅ Calculate running balance from movements (not cached stock)

#### `getFinishedGoodMovements()`

- ✅ Add pagination support (page, limit)
- ✅ Filter by locationId
- ✅ Calculate running balance from movements (not cached stock)

### 7.3 Batch Service

#### `createBatch()`

- ✅ Validate stock chronologically before batch date
- ✅ Update drum stock + aggregate stock
- ✅ Create batch usage records
- ✅ Create stock movement records (linked to batch)

#### `updateBatch()`

- ✅ Allow editing batch movements
- ✅ Restore old stock, apply new stock changes
- ✅ Update batch usage records
- ✅ Update stock movement records

#### `deleteBatch()`

- ✅ Restore all stock from batch movements
- ✅ Delete batch usage records
- ✅ Delete stock movement records
- ✅ Delete batch record

---

## 8. Database Schema Changes

### 8.1 Required Changes

#### RawMaterial Table

- Keep `currentStock` for backward compatibility (deprecated)
- Add database trigger to maintain: `currentStock = SUM(drum.currentQuantity)`
- Or: Make `currentStock` a computed column

#### FinishedGood Table

- **Deprecate `currentStock`** (mark as unused)
- All queries should use `FinishedGoodStock` table
- Consider removing in future migration

#### StockMovement Table

- ✅ Already supports all required fields
- Ensure indexes: `[date, createdAt]`, `[rawMaterialId, date, createdAt]`, `[finishedGoodId, locationId, date, createdAt]`

### 8.2 Validation Constraints

Add database-level constraints:

- `quantity > 0` for IN/OUT movements
- `quantity != 0` for ADJUSTMENT movements
- `date <= CURRENT_DATE` (prevent future dates)
- `drumId IS NOT NULL` when `rawMaterialId IS NOT NULL`
- `locationId IS NOT NULL` when `finishedGoodId IS NOT NULL`

---

## 9. Validation Schema Updates

### 9.1 Stock Movement API Schema

```typescript
stockMovementSchemaAPI
  - type: 'IN' | 'OUT' | 'ADJUSTMENT'
  - quantity?: number (optional for ADJUSTMENT with newStock)
  - newStock?: number (primary for ADJUSTMENT)
  - date: string (must be <= today, transform to WIB)
  - rawMaterialId?: string (require drumId if provided)
  - finishedGoodId?: string (require locationId if provided)
  - drumId?: string (required if rawMaterialId)
  - locationId?: string (required if finishedGoodId)

Validations:
  - Future dates: REJECT
  - Zero quantity: REJECT
  - Missing drumId for raw materials: REJECT
  - Missing locationId for finished goods: REJECT
  - ADJUSTMENT: require newStock OR quantity
```

### 9.2 Update Movement Schema

```typescript
updateStockMovementSchema
  - quantity?: number (must be > 0)
  - date?: string (must be <= today)
  - description?: string
  - locationId?: string (for finished goods)
  - drumId?: string (for raw materials, cannot change item)

Validations:
  - Cannot change rawMaterialId/finishedGoodId
  - Cannot change type
  - New date/quantity must not cause negative stock
```

---

## 10. Performance Optimizations

### 10.1 Stock Calculation Optimization

**Current:** `calculateStockAtDate()` sums all movements before date (O(n))

**Optimization Options:**

1. **Materialized View:** Pre-calculate stock at end of each day
2. **Cached Stock Snapshot:** Store stock level at end of each day
3. **Index Optimization:** Ensure proper indexes on `[date, createdAt]`

**Recommended:** Start with index optimization, add caching if needed

### 10.2 Movement History Pagination

**Current:** Limited to 500 records

**Changes:**

- Add `page` and `limit` parameters
- Default: `page=1`, `limit=50`
- Max: `limit=500`
- Return pagination metadata: `{ page, limit, total, totalPages, hasMore }`

---

## 11. Security & Permissions

### 11.1 Role-Based Access Control

**ADMIN:**

- ✅ Create all movement types (IN, OUT, ADJUSTMENT)
- ✅ Edit all movements
- ✅ Delete all movements
- ✅ Create/Edit/Delete batches

**OFFICE_PURCHASING:**

- ✅ Create: Raw Material IN, Finished Good IN
- ❌ Create: Raw Material OUT, Finished Good OUT, ADJUSTMENT
- ❌ Edit/Delete movements

**OFFICE_WAREHOUSE:**

- ✅ Create: Raw Material OUT, Finished Good OUT
- ❌ Create: Raw Material IN, Finished Good IN, ADJUSTMENT
- ❌ Edit/Delete movements

### 11.2 Audit Trail

**Required:**

- Log who created/edited/deleted each movement
- Store: `userId`, `action`, `timestamp`, `oldValues`, `newValues`
- Use existing audit system if available

---

## 12. Testing Requirements

### 12.1 Unit Tests

**Stock Calculation:**

- ✅ Calculate stock from empty history
- ✅ Calculate stock with IN movements
- ✅ Calculate stock with OUT movements
- ✅ Calculate stock with ADJUSTMENT movements
- ✅ Calculate stock with same-day movements (chronological order)
- ✅ Calculate stock for specific drum
- ✅ Calculate stock for specific location

**Date Validation:**

- ✅ Reject future dates
- ✅ Accept past dates
- ✅ Validate stock before date (chronological)
- ✅ Handle same-day movements correctly

**Stock Updates:**

- ✅ Update drum stock + aggregate stock atomically
- ✅ Update location stock (no global update)
- ✅ Prevent negative stock
- ✅ Handle zero quantity rejection

### 12.2 Integration Tests

**Batch Operations:**

- ✅ Create batch with multiple materials/drums
- ✅ Update batch (restore + reapply stock)
- ✅ Delete batch (restore all stock)
- ✅ Edit batch-linked movement
- ✅ Delete batch-linked movement

**Movement Operations:**

- ✅ Create IN movement
- ✅ Create OUT movement (with validation)
- ✅ Create ADJUSTMENT with newStock
- ✅ Create ADJUSTMENT with quantity
- ✅ Edit movement (date/quantity change)
- ✅ Delete movement (restore stock)

**Edge Cases:**

- ✅ Multiple movements on same day (chronological)
- ✅ Backdated movements
- ✅ Movement that would cause negative stock
- ✅ Zero quantity movement
- ✅ Future-dated movement

---

## 13. Migration Plan

### 13.1 Phase 1: Validation & Constraints

1. Add validation for future dates
2. Add validation for zero quantity
3. Add validation for required drumId/locationId
4. Update ADJUSTMENT to prioritize newStock

### 13.2 Phase 2: Stock Calculation Fix

1. Update `calculateStockAtDate()` to use chronological ordering
2. Update all stock calculations to use movement history
3. Add reconciliation function to detect drift

### 13.3 Phase 3: Batch Movement Editability

1. Allow editing batch-linked movements
2. Update batch service to handle movement edits
3. Update batch deletion to handle movement deletion

### 13.4 Phase 4: Finished Good Location-Only

1. Deprecate `finishedGood.currentStock` usage
2. Update all queries to use `FinishedGoodStock`
3. Remove `currentStock` updates for finished goods

### 13.5 Phase 5: Performance & Pagination

1. Add pagination to movement history queries
2. Optimize stock calculation queries
3. Add indexes if needed

---

## 14. Risk Assessment

### 14.1 High Risk Areas

1. **Stock Drift:** Current code updates `currentStock` directly - risk of drift
   - **Mitigation:** Remove direct updates, use movement history only

2. **Date Validation:** Chronological ordering is complex
   - **Mitigation:** Thorough testing, clear documentation

3. **Batch Movement Edits:** Complex transaction logic
   - **Mitigation:** Comprehensive integration tests

### 14.2 Medium Risk Areas

1. **Performance:** Large movement history may slow calculations
   - **Mitigation:** Add caching, optimize queries

2. **Data Migration:** Existing data may have inconsistencies
   - **Mitigation:** Run reconciliation before migration

---

## 15. Success Criteria

### 15.1 Functional Requirements

- ✅ Stock always calculated from movement history
- ✅ Negative stock prevented
- ✅ Future dates rejected
- ✅ Zero quantity rejected
- ✅ Drum/location required for all operations
- ✅ Batch movements editable/deletable
- ✅ ADJUSTMENT uses newStock as primary method

### 15.2 Non-Functional Requirements

- ✅ Stock drift impossible (prevented at DB level)
- ✅ Movement history paginated
- ✅ Stock calculation optimized
- ✅ All operations atomic (transactions)

---

## 16. Open Questions

1. **Reconciliation Frequency:** How often should we run stock reconciliation?
2. **Batch Deletion:** Should deleting all batch movements auto-delete the batch?
3. **Audit Logging:** Should we log all movement edits/deletes?
4. **Performance Threshold:** At what point should we add caching for stock calculations?

---

## Appendix A: Code Examples

### A.1 Chronological Stock Calculation

```typescript
async function calculateStockAtDate(
  itemId: string,
  itemType: 'raw-material' | 'finished-good',
  date: Date,
  locationId?: string | null,
  drumId?: string | null,
  excludeMovementId?: string // For edit operations
): Promise<number> {
  const queryDate = parseToWIB(toWIBISOString(date))
  const startOfDay = startOfDayWIB(queryDate)

  // Get all movements BEFORE the date
  const movementsBefore = await prisma.stockMovement.findMany({
    where: {
      date: { lt: startOfDay },
      ...(itemType === 'raw-material'
        ? { rawMaterialId: itemId, ...(drumId ? { drumId } : {}) }
        : { finishedGoodId: itemId, ...(locationId ? { locationId } : {}) }),
      ...(excludeMovementId ? { id: { not: excludeMovementId } } : {}),
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })

  // Sum movements chronologically
  let stock = 0
  for (const movement of movementsBefore) {
    if (movement.type === 'IN') stock += movement.quantity
    else if (movement.type === 'OUT') stock -= movement.quantity
    else if (movement.type === 'ADJUSTMENT') stock += movement.quantity
  }

  return Math.max(0, stock) // Never negative
}
```

### A.2 Same-Day Movement Validation

```typescript
async function validateStockForMovement(
  movement: StockMovementInput,
  excludeMovementId?: string
): Promise<void> {
  if (
    movement.type === 'OUT' ||
    (movement.type === 'ADJUSTMENT' && movement.quantity < 0)
  ) {
    const stockBefore = await calculateStockAtDate(
      movement.rawMaterialId || movement.finishedGoodId!,
      movement.rawMaterialId ? 'raw-material' : 'finished-good',
      movement.date,
      movement.locationId,
      movement.drumId,
      excludeMovementId
    )

    // Get same-day movements created before this one
    const sameDayMovements = await getSameDayMovementsBefore(
      movement,
      excludeMovementId
    )

    // Apply same-day movements to stock
    let adjustedStock = stockBefore
    for (const m of sameDayMovements) {
      if (m.type === 'IN') adjustedStock += m.quantity
      else if (m.type === 'OUT') adjustedStock -= m.quantity
      else if (m.type === 'ADJUSTMENT') adjustedStock += m.quantity
    }

    const requiredQuantity =
      movement.type === 'ADJUSTMENT'
        ? Math.abs(movement.quantity)
        : movement.quantity

    if (adjustedStock < requiredQuantity) {
      throw new Error(
        `Insufficient stock. Available: ${adjustedStock}, Required: ${requiredQuantity}`
      )
    }
  }
}
```

---

## Document History

| Version | Date       | Author       | Changes                                               |
| ------- | ---------- | ------------ | ----------------------------------------------------- |
| 1.0     | 2025-01-XX | AI Assistant | Initial specification based on requirements interview |

---

**End of Technical Specification**
