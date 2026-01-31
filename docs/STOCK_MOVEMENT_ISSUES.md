# Stock Movement Logic - Critical Issues & Fixes

**Date:** 2025-01-XX  
**Status:** Issues Identified - Awaiting Implementation

## Executive Summary

This document identifies critical issues in the current stock movement implementation that must be fixed to ensure data integrity and correct business logic.

---

## 🔴 Critical Issues

### 1. Stock Calculation Not Chronological

**Issue:** Current code uses `currentStock` field as source of truth, but stock should be calculated from movement history chronologically.

**Location:** `stock-movement.service.ts` - `calculateStockAtDate()`, `createStockMovement()`

**Impact:** Stock values can be incorrect if movements are created out of order or if `currentStock` drifts.

**Fix Required:**

- Always calculate stock by summing movements chronologically
- Use `date` then `createdAt` for ordering
- Never rely on `currentStock` field for validation

---

### 2. Same-Day Movement Validation Missing

**Issue:** When validating stock for a movement, the code doesn't account for other movements on the same day that were created before it.

**Location:** `stock-movement.service.ts` - `createStockMovement()`, `updateStockMovement()`

**Example Problem:**

1. User creates: Jan 5, 10:00 AM - IN 100 units
2. User creates: Jan 5, 11:00 AM - OUT 50 units
3. User creates: Jan 5, 9:00 AM (backdated) - OUT 60 units

Current code would validate #3 against stock before Jan 5 (0), but it should account for movements #1 and #2 that were created before it.

**Fix Required:**

- When validating stock, get all movements on the same day with `createdAt < currentMovementCreatedAt`
- Apply those movements to stock calculation before validating

---

### 3. Finished Good Global Stock Still Used

**Issue:** Code still updates `finishedGood.currentStock`, but according to requirements, finished goods should only have location-based stock.

**Location:** `stock-movement.service.ts` - `createStockMovement()`, `updateStockMovement()`, `deleteStockMovement()`

**Impact:** Creates confusion and potential inconsistency. Global stock field should be deprecated.

**Fix Required:**

- Remove all updates to `finishedGood.currentStock`
- Only update `FinishedGoodStock.quantity` at specific locations
- Update all queries to use location stock, not global stock

---

### 4. ADJUSTMENT Primary Method Incorrect

**Issue:** Code currently uses `quantity` as primary method for ADJUSTMENT, but requirements specify `newStock` should be primary.

**Location:** `stock-movement.service.ts` - `createStockMovement()`, API route validation

**Current Behavior:**

- ADJUSTMENT accepts `quantity` (signed) or `newStock`
- Code prioritizes `quantity` if both provided

**Required Behavior:**

- ADJUSTMENT should prioritize `newStock` (target stock level)
- Calculate `adjustmentQuantity = newStock - currentStock`
- Use `quantity` only if `newStock` not provided

**Fix Required:**

- Update validation schema to prioritize `newStock`
- Update service layer to calculate adjustment from `newStock`
- Update API route to handle `newStock` as primary

---

### 5. Batch Movements Not Editable

**Issue:** Current code prevents editing/deleting movements linked to batches, but requirements state all movements should be editable.

**Location:** `stock-movement.service.ts` - `updateStockMovement()`, `deleteStockMovement()`

**Current Code:**

```typescript
if (existingMovement.batchId) {
  throw new Error('This movement is part of a batch. Edit the batch instead.')
}
```

**Required Behavior:**

- Allow editing batch-linked movements
- Update batch usage record if quantity changes
- Allow deleting batch-linked movements
- Optionally delete batch if all movements deleted

**Fix Required:**

- Remove batch movement edit/delete restrictions
- Update batch service to handle movement edits
- Update batch usage records when movements change

---

### 6. Future Dates Not Validated

**Issue:** Code doesn't prevent creating movements with future dates.

**Location:** Validation schemas, `stock-movement.service.ts`

**Fix Required:**

- Add validation: `date <= CURRENT_DATE` (in WIB timezone)
- Reject movements with future dates

---

### 7. Zero Quantity Not Prevented

**Issue:** Code allows movements with `quantity = 0`, but requirements state zero quantity is not allowed.

**Location:** Validation schemas

**Current:** Schema allows `quantity >= 0`

**Required:** Schema should require `quantity > 0` for IN/OUT, `quantity != 0` for ADJUSTMENT

**Fix Required:**

- Update validation: `quantity > 0` for IN/OUT
- Update validation: `quantity != 0` for ADJUSTMENT

---

### 8. Movement History Not Paginated

**Issue:** Movement history queries are limited to 500 records with no pagination.

**Location:** `raw-material.service.ts` - `getRawMaterialMovements()`, `finished-good.service.ts` - `getFinishedGoodMovements()`

**Fix Required:**

- Add `page` and `limit` parameters
- Return pagination metadata
- Default: `page=1`, `limit=50`
- Max: `limit=500`

---

### 9. Stock Drift Prevention Missing

**Issue:** `currentStock` fields can drift from actual movement history if updated incorrectly.

**Location:** All stock update operations

**Fix Required:**

- Remove direct updates to `currentStock` fields
- Only update via stock movement operations
- Add reconciliation function to detect/fix drift
- Consider database triggers to maintain consistency

---

### 10. Raw Material Aggregate/Drum Consistency

**Issue:** Code updates aggregate stock and drum stock separately, but they must always be equal.

**Location:** `stock-movement.service.ts` - all raw material operations

**Fix Required:**

- Ensure aggregate stock = sum of drum stocks
- Update both atomically in same transaction
- Add validation to ensure consistency
- Consider database trigger to maintain equality

---

## 🟡 Medium Priority Issues

### 11. Performance: Stock Calculation

**Issue:** `calculateStockAtDate()` sums all movements before date - can be slow for large histories.

**Location:** `stock-movement.service.ts` - `calculateStockAtDate()`

**Fix Required:**

- Add indexes on `[date, createdAt]`
- Consider caching stock levels at end of each day
- Optimize query to use indexes efficiently

---

### 12. Error Messages Not User-Friendly

**Issue:** Some error messages are technical and don't explain the business rule violation.

**Location:** All validation errors

**Fix Required:**

- Improve error messages to explain business rules
- Include available stock vs required stock
- Suggest corrective actions when possible

---

## 📋 Implementation Checklist

### Phase 1: Critical Fixes

- [ ] Fix chronological stock calculation
- [ ] Add same-day movement validation
- [ ] Remove finished good global stock updates
- [ ] Fix ADJUSTMENT to prioritize newStock
- [ ] Allow batch movement editing
- [ ] Add future date validation
- [ ] Add zero quantity validation

### Phase 2: Data Integrity

- [ ] Prevent stock drift (remove direct currentStock updates)
- [ ] Ensure raw material aggregate = sum of drums
- [ ] Add reconciliation function

### Phase 3: Performance & UX

- [ ] Add pagination to movement history
- [ ] Optimize stock calculation queries
- [ ] Improve error messages

---

## 🧪 Testing Requirements

### Unit Tests Needed

- [ ] Chronological stock calculation
- [ ] Same-day movement validation
- [ ] Future date rejection
- [ ] Zero quantity rejection
- [ ] ADJUSTMENT with newStock
- [ ] Batch movement editing
- [ ] Location-only stock for finished goods

### Integration Tests Needed

- [ ] Complex same-day movement scenarios
- [ ] Batch operations with movement edits
- [ ] Stock drift prevention
- [ ] Aggregate/drum consistency

---

## 📚 Related Documents

- [Technical Specification](./STOCK_MOVEMENT_TECHNICAL_SPEC.md) - Full specification
- [Database Schema](../prisma/schema.prisma) - Current schema
- [Service Implementation](../src/lib/services/stock-movement.service.ts) - Current code

---

**End of Issues Document**
