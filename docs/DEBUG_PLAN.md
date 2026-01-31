# Stock Movement System - Debugging Plan

**Date:** 2025-01-XX  
**Status:** Planning Phase  
**Objective:** Verify correctness of stock movement backend logic and data integrity

---

## Overview

This plan systematically verifies the correctness of the stock movement system, focusing on:
- Data integrity (stock calculations, consistency)
- Transaction atomicity
- Edge cases and race conditions
- Known issues from documentation

---

## Phase 1: Stock Calculation Verification

### Objective
Verify that stock is calculated chronologically from movement history, not from cached `currentStock` values.

### Test Scenarios

#### 1.1 Basic Chronological Calculation
- **Setup:** Create movements on different dates
- **Test:** Verify `calculateStockAtDate()` returns correct stock at each date
- **Verify:** Stock matches sum of movements up to that date

#### 1.2 Same-Day Movement Ordering
- **Setup:** Create multiple movements on same day with different `createdAt` timestamps
- **Test:** Verify stock calculation respects `createdAt` order
- **Verify:** Stock at end of day matches sum of all movements in creation order

#### 1.3 Backdated Movement Validation
- **Setup:** Create movement on Jan 5, then backdate another movement to Jan 4
- **Test:** Verify stock validation accounts for chronological order
- **Verify:** OUT movement validates against stock BEFORE its date, accounting for same-day movements

### Instrumentation Points
- `calculateStockAtDate()`: Log input params, query results, calculated stock
- `createStockMovement()`: Log stock validation calculations
- Movement queries: Log date ranges and ordering

---

## Phase 2: Raw Material Consistency

### Objective
Verify that `rawMaterial.currentStock` always equals `SUM(drum.currentQuantity)` for that material.

### Test Scenarios

#### 2.1 Stock IN with Drums
- **Setup:** Create drum stock IN movement
- **Test:** Verify drum stock and aggregate stock updated correctly
- **Verify:** `rawMaterial.currentStock == SUM(drum.currentQuantity)`

#### 2.2 Stock OUT from Specific Drum
- **Setup:** Create OUT movement from specific drum
- **Test:** Verify drum stock decremented, aggregate stock decremented
- **Verify:** Consistency maintained after operation

#### 2.3 Batch Operations
- **Setup:** Create batch that uses multiple drums
- **Test:** Verify all drum stocks and aggregate stock updated correctly
- **Verify:** Consistency maintained after batch creation

#### 2.4 Movement Updates
- **Setup:** Update movement quantity
- **Test:** Verify both drum and aggregate stock recalculated correctly
- **Verify:** Consistency maintained after update

### Instrumentation Points
- `validateRawMaterialStockConsistency()`: Log aggregate vs sum of drums
- All raw material stock updates: Log before/after values for drums and aggregate
- Batch operations: Log stock changes for each drum and aggregate

---

## Phase 3: Finished Good Location-Only Stock

### Objective
Verify that finished goods only use location-based stock, no global stock updates.

### Test Scenarios

#### 3.1 Stock IN to Location
- **Setup:** Create IN movement for finished good with location
- **Test:** Verify `FinishedGoodStock.quantity` updated
- **Verify:** `finishedGood.currentStock` NOT updated (or remains 0)

#### 3.2 Stock OUT from Location
- **Setup:** Create OUT movement from location
- **Test:** Verify location stock decremented
- **Verify:** No global stock update

#### 3.3 Multiple Locations
- **Setup:** Create movements to different locations
- **Test:** Verify each location maintains separate stock
- **Verify:** No global aggregation

#### 3.4 Location Transfer (OUT + IN)
- **Setup:** Transfer stock between locations
- **Test:** Verify source location decremented, destination incremented
- **Verify:** No global stock change

### Instrumentation Points
- `createStockMovement()`: Log finished good stock updates (location vs global)
- `updateStockMovement()`: Log location stock changes
- `deleteStockMovement()`: Log location stock restoration

---

## Phase 4: ADJUSTMENT Logic

### Objective
Verify ADJUSTMENT movements prioritize `newStock` over `quantity` and calculate correctly.

### Test Scenarios

#### 4.1 ADJUSTMENT with newStock (Primary)
- **Setup:** Create ADJUSTMENT with `newStock` value
- **Test:** Verify `quantity` calculated as `newStock - currentStock`
- **Verify:** Final stock equals `newStock`

#### 4.2 ADJUSTMENT with quantity (Secondary)
- **Setup:** Create ADJUSTMENT with `quantity` only (no `newStock`)
- **Test:** Verify `quantity` used directly
- **Verify:** Stock updated by `quantity` amount

#### 4.3 ADJUSTMENT Priority
- **Setup:** Create ADJUSTMENT with both `newStock` and `quantity`
- **Test:** Verify `newStock` takes priority
- **Verify:** `quantity` calculated from `newStock`, not used directly

#### 4.4 Negative ADJUSTMENT Validation
- **Setup:** Create ADJUSTMENT with `newStock < currentStock`
- **Test:** Verify stock validation prevents negative stock
- **Verify:** Error thrown if adjustment would cause negative stock

### Instrumentation Points
- API route: Log `newStock` vs `quantity` priority decision
- `createStockMovement()`: Log ADJUSTMENT quantity calculation
- Stock validation: Log stock check for negative ADJUSTMENT

---

## Phase 5: Batch Operations

### Objective
Verify batch creation, update, and deletion maintain stock consistency.

### Test Scenarios

#### 5.1 Batch Creation
- **Setup:** Create batch with multiple materials and drums
- **Test:** Verify stock deducted from correct drums
- **Verify:** Aggregate stock updated correctly
- **Verify:** Stock movements created and linked to batch

#### 5.2 Batch Update
- **Setup:** Update batch to change material quantities
- **Test:** Verify old stock restored, new stock deducted
- **Verify:** Stock movements updated correctly
- **Verify:** BatchUsage records updated

#### 5.3 Batch Deletion
- **Setup:** Delete batch
- **Test:** Verify all stock restored to drums
- **Verify:** Aggregate stock restored
- **Verify:** Stock movements deleted

#### 5.4 Batch Movement Edit
- **Setup:** Edit individual movement linked to batch
- **Test:** Verify BatchUsage updated
- **Verify:** Stock recalculated correctly

### Instrumentation Points
- `createBatch()`: Log stock deductions per drum and aggregate
- `updateBatch()`: Log stock restoration and re-deduction
- `deleteBatch()`: Log stock restoration
- `updateStockMovement()`: Log BatchUsage updates when batch-linked

---

## Phase 6: Negative Stock Prevention

### Objective
Verify all operations prevent negative stock.

### Test Scenarios

#### 6.1 OUT Movement Validation
- **Setup:** Attempt OUT movement with insufficient stock
- **Test:** Verify error thrown before stock update
- **Verify:** Stock not decremented on error

#### 6.2 Negative ADJUSTMENT Validation
- **Setup:** Attempt ADJUSTMENT that would cause negative stock
- **Test:** Verify error thrown
- **Verify:** Stock not updated

#### 6.3 Batch with Insufficient Stock
- **Setup:** Attempt batch creation with insufficient stock
- **Test:** Verify error thrown before any stock deduction
- **Verify:** Transaction rolled back completely

#### 6.4 Movement Update to Negative
- **Setup:** Update movement quantity to cause negative stock
- **Test:** Verify error thrown
- **Verify:** Original stock restored

#### 6.5 Movement Deletion Validation
- **Setup:** Attempt to delete movement that would cause negative stock
- **Test:** Verify error thrown
- **Verify:** Movement not deleted

### Instrumentation Points
- All stock validation checks: Log available stock vs required stock
- Error handling: Log validation failures and rollback behavior
- Transaction boundaries: Log transaction start/commit/rollback

---

## Phase 7: Transaction Atomicity

### Objective
Verify all operations are atomic (all-or-nothing).

### Test Scenarios

#### 7.1 Stock Movement Creation Failure
- **Setup:** Simulate error during stock movement creation
- **Test:** Verify transaction rolled back
- **Verify:** No partial updates (movement not created, stock not updated)

#### 7.2 Batch Creation Failure
- **Setup:** Simulate error during batch creation (e.g., insufficient stock mid-batch)
- **Test:** Verify transaction rolled back
- **Verify:** No partial stock deductions

#### 7.3 Movement Update Failure
- **Setup:** Simulate error during movement update
- **Test:** Verify original state restored
- **Verify:** No partial updates

#### 7.4 Concurrent Operations
- **Setup:** Simulate concurrent stock operations on same item
- **Test:** Verify FOR UPDATE locks prevent race conditions
- **Verify:** Operations complete atomically

### Instrumentation Points
- Transaction boundaries: Log transaction start, commit, rollback
- Error handling: Log error location and rollback behavior
- Lock acquisition: Log FOR UPDATE lock usage

---

## Phase 8: Edge Cases

### Objective
Test edge cases and boundary conditions.

### Test Scenarios

#### 8.1 Zero Quantity Prevention
- **Setup:** Attempt to create movement with quantity = 0
- **Test:** Verify validation rejects zero quantity
- **Verify:** Error message clear

#### 8.2 Future Date Prevention
- **Setup:** Attempt to create movement with future date
- **Test:** Verify validation rejects future dates
- **Verify:** Error message clear

#### 8.3 Missing Drum/Location
- **Setup:** Attempt raw material movement without drumId
- **Test:** Verify validation rejects missing drumId
- **Setup:** Attempt finished good movement without locationId
- **Test:** Verify validation rejects missing locationId

#### 8.4 Same-Day Multiple Movements
- **Setup:** Create multiple IN/OUT movements on same day
- **Test:** Verify stock calculated correctly at each point
- **Verify:** Validation accounts for chronological order

#### 8.5 Movement Date Change
- **Setup:** Update movement to change date
- **Test:** Verify stock recalculated for both old and new dates
- **Verify:** Validation checks stock at new date

#### 8.6 Location Change (Finished Goods)
- **Setup:** Update movement to change locationId
- **Test:** Verify old location stock restored, new location stock updated
- **Verify:** No stock loss or duplication

### Instrumentation Points
- Validation schemas: Log validation failures
- Date handling: Log date transformations and comparisons
- Location/drum changes: Log stock updates for old vs new values

---

## Instrumentation Strategy

### Log Format
All logs will use NDJSON format with:
```json
{
  "sessionId": "debug-session",
  "runId": "run1",
  "hypothesisId": "A",
  "location": "file.ts:123",
  "message": "Description",
  "data": { "key": "value" },
  "timestamp": 1234567890
}
```

### Key Instrumentation Points

1. **Stock Calculation**
   - `calculateStockAtDate()`: Input params, query results, calculated stock
   - Movement queries: Date ranges, filters, ordering

2. **Stock Updates**
   - Before/after values for all stock fields
   - Transaction boundaries
   - Error handling and rollback

3. **Validation**
   - Stock availability checks
   - Date validations
   - Quantity validations

4. **Consistency Checks**
   - Aggregate vs sum of drums
   - Location stock vs global stock

---

## Success Criteria

### Functional Requirements
- ✅ Stock always calculated from movement history (chronological)
- ✅ Negative stock prevented in all scenarios
- ✅ Raw material aggregate = sum of drums (always)
- ✅ Finished goods use location-only stock (no global updates)
- ✅ ADJUSTMENT prioritizes newStock correctly
- ✅ Batch operations maintain stock consistency
- ✅ All operations atomic (transaction rollback on error)

### Data Integrity
- ✅ No stock drift (currentStock matches calculated stock)
- ✅ No orphaned records
- ✅ No partial updates
- ✅ Consistency maintained across all operations

---

## Execution Order

1. **Phase 1** (Stock Calculation) - Foundation for all other tests
2. **Phase 2** (Raw Material Consistency) - Critical data integrity
3. **Phase 3** (Finished Good Location-Only) - Verify architecture compliance
4. **Phase 4** (ADJUSTMENT Logic) - Verify business rule implementation
5. **Phase 5** (Batch Operations) - Complex multi-step operations
6. **Phase 6** (Negative Stock Prevention) - Critical business rule
7. **Phase 7** (Transaction Atomicity) - System reliability
8. **Phase 8** (Edge Cases) - Boundary conditions

---

## Risk Areas

### High Risk
1. **Stock Calculation Chronology** - Complex same-day movement logic
2. **Raw Material Consistency** - Multiple update points (drums + aggregate)
3. **Transaction Rollback** - Partial updates could corrupt data

### Medium Risk
1. **ADJUSTMENT Priority** - Multiple code paths
2. **Batch Operations** - Complex multi-table transactions
3. **Location Changes** - Stock transfer logic

---

## Next Steps

1. Begin with Phase 1 (Stock Calculation Verification)
2. Add instrumentation to key functions
3. Run test scenarios and analyze logs
4. Document findings and fix issues
5. Proceed to next phase

---

**End of Debugging Plan**


