# Known Issues & Limitations

**Last Updated:** October 4, 2025
**Version:** MVP 1.0

---

## Overview

This document tracks known issues, limitations, and workarounds for the Stock Management System. All items are categorized by severity and include workarounds where available.

---

## 🟡 Active Issues

### Issue #10: Batch Materials Cannot Be Edited After Creation

**Severity:** Medium
**Impact:** User Experience & Flexibility
**Status:** Documented as Design Limitation (MVP)
**Affects:** Batch editing functionality

#### Description

When editing a batch, the raw materials list is displayed as **read-only**. Users cannot:
- Add new materials to an existing batch
- Remove materials from an existing batch
- Change quantities of materials used

The edit dialog shows the message:
> "Raw materials cannot be modified after creation"

#### Why This Limitation Exists

This is an **intentional design decision** for the MVP to:
1. **Preserve audit trail integrity** - Material usage is locked after batch creation
2. **Prevent stock calculation errors** - Changing materials after creation would require complex stock reconciliation
3. **Simplify initial implementation** - Full edit capability would require:
   - Calculate stock differences
   - Restore old material quantities
   - Deduct new material quantities
   - Handle concurrent edits
   - Risk of data inconsistency

#### User Impact

If a user makes a mistake when creating a batch, they must:
1. Delete the entire batch
2. Stock is automatically restored for all materials
3. Create a new batch with correct materials
4. Risk losing description, date, or other metadata if not documented

#### Workarounds

**Option A: Delete and Recreate**
```
1. Document batch details (code, date, description, finished good)
2. Delete the incorrect batch
3. Create new batch with correct materials
4. Re-enter batch details
```

**Option B: Manual Stock Adjustment**
```
1. Keep the incorrect batch as-is (for audit trail)
2. Create compensating stock movements:
   - If material X was recorded with 100kg but should be 80kg
   - Create manual stock OUT for 20kg with description: "Correction for Batch XYZ"
3. Update batch description to note the correction
```

#### Future Enhancement

**Planned for:** Post-MVP (Phase 1)

**Proposed Solution:** "Clone Batch" Feature
- Add "Clone This Batch" button in edit dialog
- Creates new batch with same materials pre-filled
- User can modify materials before saving
- Simpler and safer than in-place editing

**Alternative Solution:** Full Edit Capability
- Allow material modifications with automatic stock reconciliation
- Calculate stock differences and apply corrections
- Higher complexity, more testing required

#### Related Files
- `src/components/batches/edit-batch-dialog.tsx:95-116` - Read-only materials display
- `src/app/api/batches/[id]/route.ts` - Batch update endpoint (doesn't allow material changes)

---

## ⚠️ Minor Warnings

### ESLint Warning: Missing useEffect Dependencies

**Severity:** Low
**Impact:** None (intentional)
**Status:** Expected Behavior

#### Location
- `src/app/reports/page.tsx:93`
- `src/components/stock/stock-entry-dialog.tsx:139`

#### Description

ESLint warns about missing dependencies in `useEffect` hooks:
```
Warning: React Hook useEffect has a missing dependency: 'fetchReport'.
Either include it or remove the dependency array.
```

#### Why This is Intentional

Including the suggested dependencies would cause **infinite render loops**:
```javascript
useEffect(() => {
  fetchReport() // This function is defined in the component
}, []) // ❌ ESLint wants us to include 'fetchReport'

// If we add 'fetchReport':
useEffect(() => {
  fetchReport()
}, [fetchReport]) // ✅ ESLint happy, but...
// This creates infinite loop: fetchReport changes → useEffect runs → fetchReport changes → ...
```

#### Workarounds

**Current Implementation (Correct):**
```javascript
useEffect(() => {
  fetchReport()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [year, month, type, dataType]) // Only re-run when filters change
```

**No action required** - This is the correct pattern for this use case.

---

## 🔵 Design Limitations (By Design)

---

### No Finished Good Auto-Update from Batch

**Status:** Manual Process Required
**Priority:** Low (By Design)

#### Description

When a batch is created:
- ✅ Raw material stock is **automatically reduced**
- ❌ Finished good stock is **NOT automatically increased**

Users must manually record finished good stock via "Input Stok Masuk".

#### Rationale

This is intentional because:
1. Production yield may vary (not 1:1 ratio)
2. Quality control may reject some output
3. Packaging/processing may cause waste
4. Manual verification ensures accuracy

#### Workaround

**Standard Workflow:**
```
1. Create batch (raw materials reduced automatically)
2. Complete production
3. Count finished goods
4. Go to Finished Goods page
5. Click "Input Stok Masuk"
6. Enter actual quantity produced
7. Add description: "From Batch B-001"
```

---

### No Multi-Location Support

**Status:** Single Location Only
**Priority:** Low (Future Enhancement)

#### Description

The system assumes a single warehouse/location. There's no:
- Location tracking for materials
- Transfer between locations
- Per-location stock levels

#### Impact

If the business has multiple warehouses, they must:
- Run separate instances of the application
- Or manually track location in descriptions

#### Future Enhancement

Planned for Phase 3 (Enterprise Features):
- Add Location entity
- Track stock per location
- Support inter-location transfers

---

## 🟢 Expected Behaviors (Not Bugs)

### Report Shows Only Days Up to Today

**Status:** Expected Behavior

#### Description

When viewing reports for the **current month**, the table only shows columns up to today's date.

**Example:**
- Today is October 10
- Report shows columns: Day 1, 2, 3... 10
- Days 11-31 are not shown

#### Why

This prevents confusion about future dates and keeps the report focused on actual data.

#### For Past Months

All days (1-31/30/28) are shown because the month is complete.

---

### Running Balance Starts from 0

**Status:** Expected Behavior

#### Description

In the material detail page, the running balance calculation starts from 0, not from the initial stock value.

**Example:**
```
Material: Sugar
Current Stock: 500 kg

Movement History:
- Oct 3: IN +500 → Balance: 500 ✅
- Oct 2: OUT -100 → Balance: 0 (if this was the only movement)
```

#### Rationale

This is the correct accounting approach:
1. All stock must have a corresponding IN movement
2. Running balance = sum of all movements from time 0
3. Ensures complete audit trail

If you see balance ≠ current stock, it means there's a movement not shown in the history.

---

### Batch Deletion Removes Movements

**Status:** Expected Behavior

#### Description

When a batch is deleted:
- ✅ Batch record is removed
- ✅ BatchUsage records are removed
- ✅ **StockMovement records are removed**
- ✅ Material stock is restored

#### Why

This maintains data consistency. If we kept the stock movements after deleting the batch:
- Movement history would show phantom OUT transactions
- Running balance would be incorrect
- Reports would show incorrect data

This is the **correct** behavior as of October 3, 2025 fixes.

---

## 🔄 Resolved Issues

### ~~Issue #1: Unprotected User Management APIs~~ ✅ FIXED

**Fixed:** October 4, 2025
**Details:** `AUTH_FIXES_APPLIED.md`

All user management endpoints now require authentication.

---

### ~~Issue #2: Incorrect Adapter Configuration~~ ✅ FIXED

**Fixed:** October 4, 2025
**Details:** `AUTH_FIXES_APPLIED.md`

PrismaAdapter removed, using pure JWT sessions.

---

### ~~Issue #5: Direct Stock Manipulation via Edit~~ ✅ FIXED

**Fixed:** October 3, 2025
**Details:** `QA_FIXES_APPLIED.md`

Stock can no longer be modified via edit dialog.

---

### ~~Issue #9: Orphaned StockMovements on Batch Delete~~ ✅ FIXED

**Fixed:** October 3, 2025
**Details:** `QA_FIXES_APPLIED.md`

StockMovements are now deleted when batch is deleted.

---

### ~~User Management UI Missing~~ ✅ IMPLEMENTED

**Implemented:** October 5, 2025

Full user management UI now available at `/users` with:
- User list table with search and sorting
- Add user dialog
- Edit user dialog (name, role, active status)
- Only visible to ADMIN users (RBAC enforced)

**Location:** `src/app/users/page.tsx` and `src/components/users/*`

---

### ~~RBAC Not Enforced~~ ✅ IMPLEMENTED

**Implemented:** October 5, 2025

Role-Based Access Control now fully enforced:

**Server-side:** All API endpoints check permissions and return 403 if unauthorized
- Raw materials: ADMIN/OFFICE only
- Finished goods: ADMIN/OFFICE only
- Batches: Create/Edit (ADMIN/FACTORY), Delete (ADMIN only)
- Users: ADMIN only

**Client-side:** UI elements hidden based on role
- Sidebar navigation filtered by role
- Action buttons (Edit/Delete) shown only if permitted
- Forms disabled for unauthorized users

**Helper functions:** `src/lib/rbac.ts` with full permission matrix

**Verification:** Login as different roles to see different access levels

---

## 📝 Reporting New Issues

### How to Report

1. **Check this document first** - Issue may already be known
2. **Gather information:**
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/error messages
   - Browser/OS version
3. **Submit via:**
   - GitHub Issues: `https://github.com/your-repo/issues`
   - Email: `support@yourdomain.com`

### Issue Template

```markdown
**Title:** [Short description]

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. Go to...
2. Click on...
3. Enter...

**Expected Result:**
What should happen

**Actual Result:**
What actually happened

**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- Version: 1.0

**Screenshots:**
[Paste screenshots]

**Console Errors:**
[Paste any errors from browser console]
```

---

## 🔍 Known Browser Compatibility

### Supported Browsers

✅ **Fully Supported:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

⚠️ **Partial Support:**
- Internet Explorer: NOT SUPPORTED
- Opera: Should work but untested

### Known Issues by Browser

**Safari < 14:**
- Date picker may show different format
- Some CSS animations may not work

**Firefox < 88:**
- File export may prompt for location

---

## 📊 Performance Limitations

### Large Datasets

**Known Threshold:**
- Materials: Tested up to 500 items
- Movements per material: Tested up to 1,000 movements
- Report rendering: Tested up to 100 items

**If you exceed these:**
- Page load may slow down
- Consider pagination (future enhancement)
- Database indexes may need optimization

### Export File Size

**Excel Export Limits:**
- Recommended max: 10,000 rows
- Larger exports may timeout or fail
- Consider date range filters for large datasets

---

## 🛠️ Workaround Recipes

### Recipe 1: Bulk Material Creation

**Problem:** Need to add 50+ materials

**Workaround:**
```sql
-- Use database directly (advanced)
INSERT INTO raw_materials (id, kode, name, current_stock, moq, created_at, updated_at)
VALUES
  ('cm...', 'MAT-001', 'Material 1', 0, 100, NOW(), NOW()),
  ('cm...', 'MAT-002', 'Material 2', 0, 100, NOW(), NOW()),
  ...
```

Or use API with script:
```bash
for i in {1..50}; do
  curl -X POST http://localhost:3000/api/raw-materials \
    -H "Content-Type: application/json" \
    -d "{\"kode\":\"MAT-$i\",\"name\":\"Material $i\",\"moq\":100}"
done
```

---

### Recipe 2: Export All Data

**Problem:** Need complete data backup

**Workaround:**
```bash
# Export database
pg_dump -U user database_name > backup.sql

# Or use Prisma
npx prisma db pull
```

---

## 📞 Support

**Documentation:**
- `STATUS.md` - Current project status
- `DEPLOYMENT.md` - Deployment guide
- `TESTING_GUIDE.md` - Testing procedures
- `API.md` - API reference

**Contact:**
- GitHub Issues: For bug reports
- Email: For support requests

---

**Last Updated:** October 4, 2025
**Version:** 1.0
**Next Review:** After first production deployment
