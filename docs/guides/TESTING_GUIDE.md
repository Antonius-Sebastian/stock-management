# Comprehensive Testing Guide - Stock Management System
**Version:** 1.0
**Date:** October 3, 2025
**Purpose:** Manual testing guide for all application features

---

## 🚀 Pre-Testing Setup

### 1. Start the Development Server
```bash
npm run dev
```

The application should be available at: `http://localhost:3000`

### 2. Ensure Database is Connected
Check the `.env` file has correct database credentials.

### 3. Clear Browser Cache
Start with a fresh browser session.

---

## 📋 Test Plan Overview

### Features to Test:
1. ✅ Raw Materials Management
2. ✅ Finished Goods Management
3. ✅ Stock Entry (IN/OUT)
4. ✅ Batch Usage Logging
5. ✅ Interactive Reports
6. ✅ Movement History
7. ✅ Data Validation & Error Handling

---

## 🧪 TEST SUITE 1: Raw Materials Management

### Test 1.1: Add Raw Material
**Steps:**
1. Navigate to `/raw-materials`
2. Click "Add Raw Material" button
3. Fill in the form:
   - **Code:** `RM-001`
   - **Name:** `Sugar - White Granulated`
   - **MOQ:** `100`
4. Click "Create"

**Expected Results:**
- ✅ Success toast: "Raw material created successfully"
- ✅ Dialog closes
- ✅ Material appears in table with:
  - Code: RM-001
  - Name: Sugar - White Granulated
  - Current Stock: 0 kg
  - MOQ: 100
  - Stock Badge: RED (since stock 0 < MOQ 100)

**Edge Cases to Test:**
- Try duplicate code (should fail with error)
- Try empty name (should show validation error)
- Try negative MOQ (should show validation error)
- Try MOQ = 0 (should show validation error)

---

### Test 1.2: Edit Raw Material
**Steps:**
1. Click the "Edit" button (pencil icon) on RM-001
2. Change name to `Sugar - Premium White`
3. Change MOQ to `150`
4. Click "Update"

**Expected Results:**
- ✅ Success toast: "Raw material updated successfully"
- ✅ Dialog closes
- ✅ Table updates with new values
- ✅ Stock remains 0 (should NOT be editable)

**Important:** Verify that there's NO field to edit "Current Stock" in the edit dialog.

---

### Test 1.3: Stock Level Indicator (MOQ Badge)
**Create these materials to test badges:**

| Code | Name | MOQ | Initial Stock | Expected Badge |
|------|------|-----|---------------|----------------|
| RM-002 | Coconut Oil | 50 | 0 | 🔴 RED (0 < 50) |
| RM-003 | Fragrance | 20 | 0 | 🔴 RED (0 < 20) |

Then add stock and verify badge changes:
- Add 25kg to RM-002 → Should turn 🟡 YELLOW (25 < 50)
- Add 30kg to RM-002 → Should turn 🟢 GREEN (55 >= 50)

---

### Test 1.4: Delete Raw Material (No Usage)
**Steps:**
1. Create a test material: `RM-TEST` / `Test Material` / MOQ: 10
2. Immediately try to delete it (before any stock movements)
3. Confirm deletion

**Expected Results:**
- ✅ Success toast: "Raw material deleted successfully"
- ✅ Material removed from table

---

### Test 1.5: Delete Raw Material (With Usage)
**Steps:**
1. Use RM-001 (Sugar) in a batch (see Test 4.1)
2. Try to delete RM-001
3. Confirm deletion

**Expected Results:**
- ❌ Error toast: "Cannot delete raw material that has stock movements or has been used in batches"
- ✅ Material still exists in table

---

## 🧪 TEST SUITE 2: Finished Goods Management

### Test 2.1: Add Finished Good
**Steps:**
1. Navigate to `/finished-goods`
2. Click "Add Finished Good" button
3. Fill in:
   - **Name:** `Lavender Soap Bar`
4. Click "Create"

**Expected Results:**
- ✅ Success toast: "Finished good created successfully"
- ✅ Product appears in table with Current Stock: 0

---

### Test 2.2: Add More Products
Create these for later testing:

| Name |
|------|
| Rose Soap Bar |
| Mint Soap Bar |
| Charcoal Soap Bar |

---

### Test 2.3: Edit Finished Good
**Steps:**
1. Click "Edit" on "Lavender Soap Bar"
2. Change name to `Premium Lavender Soap Bar`
3. Click "Update"

**Expected Results:**
- ✅ Name updated in table
- ✅ Stock remains 0

---

### Test 2.4: Delete Finished Good
**Steps:**
1. Create test product: `Test Product`
2. Delete it immediately
3. Confirm

**Expected Results:**
- ✅ Product deleted successfully

Then try to delete one used in a batch:
- ❌ Should prevent deletion with error message

---

## 🧪 TEST SUITE 3: Stock Entry (IN/OUT)

### Test 3.1: Stock IN - Raw Material
**Steps:**
1. On Raw Materials page, click "Input Stok Masuk"
2. Fill in:
   - **Item:** `RM-001 - Sugar - Premium White`
   - **Quantity:** `500`
   - **Date:** Today
   - **Description:** `Initial purchase from supplier`
3. Click "Submit"

**Expected Results:**
- ✅ Success toast: "Stock entry created successfully"
- ✅ RM-001 current stock: 0 → 500 kg
- ✅ Stock badge changes to GREEN (500 >= 150)

**Verify:**
- Click on RM-001 to view detail page
- Check movement history shows:
  - Type: IN
  - Quantity: +500
  - Running Balance: 500
  - Description: "Initial purchase from supplier"

---

### Test 3.2: Stock IN - Multiple Materials
Add stock to other materials:

| Material | Quantity | Description |
|----------|----------|-------------|
| RM-002 (Coconut Oil) | 200 | Purchase batch 1 |
| RM-003 (Fragrance) | 50 | Purchase batch 1 |

---

### Test 3.3: Stock OUT - Raw Material
**Steps:**
1. Click "Input Stok Keluar"
2. Fill in:
   - **Item:** `RM-001 - Sugar`
   - **Quantity:** `50`
   - **Date:** Today
   - **Description:** `Sample testing`
3. Click "Submit"

**Expected Results:**
- ✅ Stock updated: 500 → 450 kg
- ✅ Movement history shows OUT -50

---

### Test 3.4: Stock OUT - Insufficient Stock (Error Case)
**Steps:**
1. Try to remove 1000 kg from RM-001 (current: 450 kg)

**Expected Results:**
- ❌ Error toast: "Insufficient stock. Available: 450, Requested: 1000"
- ✅ Stock unchanged

---

### Test 3.5: Stock IN - Finished Good
**Steps:**
1. On Finished Goods page, click "Input Stok Masuk"
2. Fill in:
   - **Item:** `Premium Lavender Soap Bar`
   - **Quantity:** `100`
   - **Date:** Today
   - **Description:** `Production batch completed`
3. Click "Submit"

**Expected Results:**
- ✅ Stock: 0 → 100 units
- ✅ Movement recorded

---

### Test 3.6: Negative Quantity Prevention
**Steps:**
1. Try to enter -50 in quantity field
2. Type should reset to 0 automatically

**Expected Results:**
- ✅ Cannot enter negative values
- ✅ Field auto-corrects to 0

---

## 🧪 TEST SUITE 4: Batch Usage Logging

### Test 4.1: Create Batch - Single Material
**Steps:**
1. Navigate to `/batches`
2. Click "Add Production Batch"
3. Fill in:
   - **Batch Code:** `B-001`
   - **Date:** Today
   - **Description:** `First production run`
   - **Raw Materials:**
     - Material: `RM-001 - Sugar` | Quantity: `100`
   - **Finished Good:** `Premium Lavender Soap Bar`
4. Click "Create Batch"

**Expected Results:**
- ✅ Success toast: "Batch created successfully"
- ✅ Batch appears in table
- ✅ RM-001 stock reduced: 450 → 350 kg
- ✅ Finished Good stock UNCHANGED (manual entry required)

**Verify Movement History:**
1. Go to Raw Materials → RM-001 detail
2. Check movement history shows:
   - Type: OUT
   - Quantity: -100
   - Description: "Batch production: B-001"
   - Batch: B-001 (clickable link)
   - Running Balance: 350

---

### Test 4.2: Create Batch - Multiple Materials
**Steps:**
1. Create batch `B-002` with:
   - Sugar (RM-001): 80 kg
   - Coconut Oil (RM-002): 50 kg
   - Fragrance (RM-003): 5 kg
   - Finished Good: Rose Soap Bar

**Expected Results:**
- ✅ All three materials stock reduced
- ✅ Three separate OUT movements created

**Verify:**
- RM-001: 350 → 270 kg
- RM-002: 200 → 150 kg
- RM-003: 50 → 45 kg

---

### Test 4.3: Batch with Insufficient Stock (Error Case)
**Steps:**
1. Try to create batch using 500 kg of Sugar (only 270 available)

**Expected Results:**
- ❌ Error toast: "Insufficient stock for Sugar - Premium White. Available: 270, Required: 500"
- ✅ No batch created
- ✅ Stock unchanged

---

### Test 4.4: Material Selection UX - Out of Stock
**Steps:**
1. Create a new material with 0 stock: `RM-004 - Colorant` / MOQ: 10
2. Create new batch
3. Open material dropdown

**Expected Results:**
- ✅ Materials WITH stock appear first (green text)
- ✅ Separator: "Out of Stock"
- ✅ Materials with 0 stock are disabled and grayed out
- ✅ Cannot select out-of-stock materials

---

### Test 4.5: View Batch Details
**Steps:**
1. On Batches page, click "View" (eye icon) on B-001

**Expected Results:**
- ✅ Dialog opens showing:
  - Batch Code: B-001
  - Date
  - Description
  - Finished Good: Premium Lavender Soap Bar
  - Raw Materials table:
    - Sugar (RM-001) - 100 kg

---

### Test 4.6: Batch Code is Clickable in Movement History
**Steps:**
1. Go to Raw Materials → RM-001 detail page
2. Find the batch movement (OUT -100)
3. Click on the batch code "B-001"

**Expected Results:**
- ✅ Batch detail dialog opens
- ✅ Shows same information as Test 4.5
- ✅ Material names are clickable links
- ✅ Clicking material name navigates to material detail page

---

### Test 4.7: Edit Batch
**Steps:**
1. Click "Edit" on batch B-001
2. Change:
   - Code: `B-001-UPDATED`
   - Description: `Updated description`
   - Finished Good: `Mint Soap Bar`
3. Click "Update"

**Expected Results:**
- ✅ Batch updated
- ✅ Raw materials section shows as read-only
- ✅ Note: "Raw materials cannot be modified after creation"

---

### Test 4.8: Delete Batch (CRITICAL TEST)
**Steps:**
1. Note current stock of RM-001: 270 kg
2. Delete batch B-001-UPDATED (which used 100 kg)
3. Confirm deletion

**Expected Results:**
- ✅ Success toast: "Batch deleted successfully and stock restored"
- ✅ RM-001 stock restored: 270 → 370 kg
- ✅ Batch removed from table
- ✅ Movement history NO LONGER shows orphaned OUT movement
- ✅ Movement history is clean (CRITICAL - Issue #9 fix)

**Verify Movement History:**
1. Go to RM-001 detail page
2. Verify NO phantom OUT movements exist
3. Running balance should be accurate

---

### Test 4.9: Duplicate Batch Code Prevention
**Steps:**
1. Create batch `B-003`
2. Try to create another batch `B-003`

**Expected Results:**
- ❌ Error toast: "Batch code 'B-003' already exists"
- ✅ No duplicate created

---

### Test 4.10: Duplicate Material in Same Batch Prevention
**Steps:**
1. Start creating a new batch
2. Add Sugar (RM-001): 50 kg
3. Click "Add Material"
4. Try to add Sugar (RM-001) again: 30 kg
5. Submit

**Expected Results:**
- ❌ Database constraint error (should prevent duplicate)
- OR validation error (if implemented in UI)

**Note:** This tests the UNIQUE constraint fix from Issue #3.

---

## 🧪 TEST SUITE 5: Interactive Reports

### Test 5.1: Basic Report Navigation
**Steps:**
1. Navigate to `/reports`
2. Verify filters are present:
   - Year selector (2023, 2024, 2025)
   - Month selector (January - December)
3. Verify tabs:
   - Top: "Laporan Bahan Baku" / "Laporan Produk Jadi"
   - Data Type: "Stok Awal" / "Stok Masuk" / "Stok Keluar" / "Stok Sisa"

---

### Test 5.2: Raw Materials Report - Stok Sisa
**Steps:**
1. Select:
   - Year: 2025
   - Month: October (current month)
   - Tab: "Laporan Bahan Baku"
   - Data Type: "Stok Sisa"
2. View report

**Expected Results:**
- ✅ Table shows materials that had movements this month
- ✅ First column (Item Name) is sticky during horizontal scroll
- ✅ Columns: Days 1-31 (or current day if current month)
- ✅ Values show end-of-day stock for each day
- ✅ Only shows days up to today (if current month)

**Verify:**
- RM-001 shows correct stock progression
- Days with movements show changes
- Days without movements show same value as previous day

---

### Test 5.3: Report Tabs Switch Data
**Steps:**
1. Click "Stok Masuk" tab
2. Observe values change to show IN quantities
3. Click "Stok Keluar" tab
4. Observe values change to show OUT quantities
5. Click "Stok Awal" tab
6. Observe values change to show start-of-day stock

**Expected Results:**
- ✅ Table updates instantly without page reload
- ✅ Values change correctly based on selected data type
- ✅ Sticky column remains functional

---

### Test 5.4: Editable Cells - Stok Masuk
**Steps:**
1. Select "Stok Masuk" tab
2. Find RM-001, Day 1
3. Double-click the cell
4. Enter value: `200`
5. Press Enter

**Expected Results:**
- ✅ Cell saves
- ✅ Success toast: "Stock movement updated successfully"
- ✅ Report refreshes
- ✅ Value persists
- ✅ Creates/updates StockMovement IN for that date

**Verify:**
- Go to RM-001 detail page
- Movement history shows IN 200 on that date
- Description: "Updated via report (IN)"

---

### Test 5.5: Editable Cells - Negative Value Prevention
**Steps:**
1. Try to enter `-50` in an editable cell
2. Press Enter

**Expected Results:**
- ✅ Value auto-corrects to 0
- ✅ Cannot save negative values

---

### Test 5.6: Editable Cells - Delete Movement
**Steps:**
1. Edit a cell with existing value (e.g., 200)
2. Change to `0`
3. Press Enter

**Expected Results:**
- ✅ Movement deleted
- ✅ Stock adjusted accordingly
- ✅ Success toast
- ✅ Report refreshes

---

### Test 5.7: Editable Cells - Insufficient Stock Error
**Steps:**
1. Switch to "Stok Keluar" tab
2. Try to set a value that would make stock negative
3. Press Enter

**Expected Results:**
- ❌ Error toast: "Cannot update movements: would result in negative stock for [material] (-XX.XX)"
- ✅ Value reverts
- ✅ Stock unchanged

---

### Test 5.8: Finished Goods Report
**Steps:**
1. Click "Laporan Produk Jadi" tab
2. View report

**Expected Results:**
- ✅ Shows finished goods instead of raw materials
- ✅ Same functionality as raw materials report
- ✅ Editable cells work

---

### Test 5.9: Report Filtering by Month
**Steps:**
1. Create movements in different months:
   - October: Add 100 kg to RM-001
   - (Change system date or manually create movement for September)
2. View report for October
3. View report for September

**Expected Results:**
- ✅ October report shows October movements only
- ✅ September report shows September movements only
- ✅ Opening stock calculated correctly for each month

---

### Test 5.10: Horizontal Scroll with Sticky Column
**Steps:**
1. View report with many days
2. Scroll horizontally to the right

**Expected Results:**
- ✅ First column (item names) stays visible (frozen/sticky)
- ✅ Day columns scroll normally
- ✅ Headers scroll with columns

---

## 🧪 TEST SUITE 6: Movement History & Detail Pages

### Test 6.1: Raw Material Detail Page
**Steps:**
1. Click on any raw material in the table
2. View detail page

**Expected Results:**
- ✅ URL: `/raw-materials/[id]`
- ✅ Shows:
  - Material code and name
  - Current stock with badge
  - MOQ
  - Statistics card
- ✅ Movement history table with columns:
  - Date
  - Type (IN/OUT with colored badges)
  - Quantity (+ for IN, - for OUT)
  - Description
  - Batch (clickable if from batch)
  - Running Balance
  - Actions (currently none)

---

### Test 6.2: Movement History Sorting
**Steps:**
1. View material with multiple movements
2. Check movement order

**Expected Results:**
- ✅ Newest movements appear first
- ✅ Running balance calculates forward from 0
- ✅ Latest running balance matches current stock

---

### Test 6.3: Excel Export
**Steps:**
1. On material detail page
2. Click "Export to Excel" button

**Expected Results:**
- ✅ Excel file downloads
- ✅ Filename: `[Code]_[Name]_Movement_History.xlsx`
- ✅ Contains columns:
  - Date (YYYY-MM-DD format)
  - Type (Stock In / Stock Out)
  - Quantity (signed: + for IN, - for OUT)
  - Description
  - Batch code
  - Running Balance
- ✅ Column widths auto-sized
- ✅ Data is accurate

---

### Test 6.4: Back Navigation
**Steps:**
1. On detail page, click "Back to Raw Materials" button

**Expected Results:**
- ✅ Returns to `/raw-materials` page
- ✅ No errors

---

## 🧪 TEST SUITE 7: Data Validation & Error Handling

### Test 7.1: Required Field Validation
**Test on all forms:**
- Raw Material: Code, Name, MOQ required
- Finished Good: Name required
- Stock Entry: Item, Quantity, Date required
- Batch: Code, Date, Materials, Finished Good required

**Expected Results:**
- ✅ Submit button shows validation errors
- ✅ Fields show red outline
- ✅ Helpful error messages appear

---

### Test 7.2: Duplicate Prevention
**Test:**
- Duplicate material code
- Duplicate finished good name
- Duplicate batch code

**Expected Results:**
- ✅ API returns 400 error
- ✅ Toast shows: "[Name] already exists"
- ✅ Form doesn't close
- ✅ User can fix and retry

---

### Test 7.3: Network Error Handling
**Test (requires dev tools):**
1. Open browser dev tools
2. Set network to "Offline"
3. Try to create a material

**Expected Results:**
- ✅ Error toast: "Failed to create raw material"
- ✅ Form stays open
- ✅ Data not lost
- ✅ User can retry when online

---

### Test 7.4: Loading States
**Test all forms:**
1. Click submit
2. Observe button state

**Expected Results:**
- ✅ Button shows "Creating..." / "Updating..."
- ✅ Button is disabled
- ✅ Cannot double-submit
- ✅ Spinner or loading indicator present

---

### Test 7.5: Confirmation Dialogs
**Test:**
- Delete raw material
- Delete finished good
- Delete batch

**Expected Results:**
- ✅ Browser confirm dialog appears
- ✅ Shows warning message
- ✅ Cancel keeps data
- ✅ OK proceeds with deletion

---

## 🧪 TEST SUITE 8: Edge Cases & Stress Testing

### Test 8.1: Large Numbers
**Test:**
- Add 1,000,000 kg of material
- Create batch using 999,999 kg

**Expected Results:**
- ✅ Numbers display correctly
- ✅ Calculations accurate
- ✅ No overflow errors

---

### Test 8.2: Decimal Quantities
**Test:**
- Add 123.45 kg
- Remove 67.89 kg
- Verify: 123.45 - 67.89 = 55.56

**Expected Results:**
- ✅ Decimal math is precise
- ✅ No floating point errors
- ✅ Running balance accurate

---

### Test 8.3: Empty States
**Test:**
- View reports with no data
- View material with no movements

**Expected Results:**
- ✅ Graceful empty state messages
- ✅ No errors
- ✅ Helpful guidance

---

### Test 8.4: Many Materials in Batch
**Test:**
- Create batch with 10+ materials

**Expected Results:**
- ✅ All materials added successfully
- ✅ All stock deducted correctly
- ✅ UI handles list well

---

### Test 8.5: Same-Day Multiple Operations
**Test:**
1. Add 500 kg (IN)
2. Remove 100 kg (OUT)
3. Add 200 kg (IN)
4. Create batch using 150 kg (OUT)
All on same day.

**Expected Results:**
- ✅ All movements recorded
- ✅ Running balance: 0 → 500 → 400 → 600 → 450
- ✅ Reports aggregate correctly
- ✅ Daily totals accurate

---

### Test 8.6: Month Boundary
**Test:**
- Create movements on Oct 31
- Create movements on Nov 1
- View October report
- View November report

**Expected Results:**
- ✅ Movements in correct month
- ✅ November opening stock = October closing stock
- ✅ No data leakage between months

---

## 📊 PASS/FAIL CRITERIA

### Critical (Must Pass All)
- ✅ No data loss
- ✅ Stock calculations accurate
- ✅ Batch deletion cleans up properly (Issue #9)
- ✅ Batch detail retrieval works (Issue #11)
- ✅ No negative stock possible
- ✅ Audit trail complete

### High Priority (Must Pass Most)
- ✅ All CRUD operations work
- ✅ Validation prevents invalid data
- ✅ Error messages are helpful
- ✅ Loading states present
- ✅ Reports accurate

### Medium Priority (Nice to Have)
- ✅ Excel export works
- ✅ UI is responsive
- ✅ Navigation smooth
- ✅ Forms user-friendly

---

## 🐛 Bug Reporting Template

If you find issues, report them like this:

```
**Bug Title:** [Short description]

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. Go to...
2. Click...
3. Enter...

**Expected Result:**
What should happen

**Actual Result:**
What actually happened

**Screenshots/Errors:**
[Paste console errors or screenshots]

**Test Environment:**
- Browser: Chrome 120
- OS: Windows 11
- Database: PostgreSQL 15
```

---

## ✅ Test Completion Checklist

After completing all tests:

- [ ] All Test Suite 1 scenarios passed
- [ ] All Test Suite 2 scenarios passed
- [ ] All Test Suite 3 scenarios passed
- [ ] All Test Suite 4 scenarios passed
- [ ] All Test Suite 5 scenarios passed
- [ ] All Test Suite 6 scenarios passed
- [ ] All Test Suite 7 scenarios passed
- [ ] All Test Suite 8 scenarios passed
- [ ] No critical bugs found
- [ ] All high-priority bugs fixed
- [ ] Application ready for production

---

**Total Test Scenarios:** 80+
**Estimated Testing Time:** 3-4 hours
**Recommended:** Test with 2 people for thoroughness

Good luck with testing! 🚀
