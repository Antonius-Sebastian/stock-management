# Excel Export Testing Guide

**Feature**: Stock Report Excel Export
**Version**: 1.0
**Date**: October 4, 2025

---

## Test Prerequisites

**Required**:
- ✅ Application running at http://localhost:3000
- ✅ Database seeded with test data
- ✅ User account (admin/password123)
- ✅ Microsoft Excel or compatible spreadsheet software

**Test Data Needed**:
- At least 5 raw materials with movements
- At least 3 finished goods with movements
- Movements in current month (October 2025)
- Movements in past month (September 2025)
- At least 1 item with zero stock
- At least 1 item with no movements

---

## Test Suite 1: Basic Export Functionality

### Test 1.1: Export Current Month (October 2025)
**Objective**: Verify export shows only days up to today

**Steps**:
1. Login to application
2. Navigate to **Reports** page
3. Select filters:
   - Year: **2025**
   - Month: **October**
   - Report Type: **Laporan Bahan Baku**
4. Click **Export to Excel** button

**Expected Results**:
- ✅ Button changes to "Exporting..."
- ✅ File downloads: `Laporan_Bahan_Baku_October_2025.xlsx`
- ✅ File opens successfully in Excel
- ✅ Contains 4 sheets: "Stok Awal", "Stok Masuk", "Stok Keluar", "Stok Sisa"
- ✅ Each sheet has columns: Kode, Nama, 1, 2, 3, 4 (only 4 day columns!)
- ✅ First 2 columns (Kode, Nama) are frozen
- ✅ Header row is frozen
- ✅ All items listed (even those with no movements)

**Pass Criteria**: All checkboxes ✅

---

### Test 1.2: Export Past Month (September 2025)
**Objective**: Verify export shows all days for past month

**Steps**:
1. On Reports page, change filters:
   - Month: **September**
2. Click **Export to Excel**

**Expected Results**:
- ✅ File downloads: `Laporan_Bahan_Baku_September_2025.xlsx`
- ✅ Each sheet has columns: Kode, Nama, 1, 2, ..., 30 (all 30 days)
- ✅ Data populated for days with movements
- ✅ Empty cells or zeros for days without movements

**Pass Criteria**: September has 30 day columns

---

### Test 1.3: Export Future Month (December 2025)
**Objective**: Verify graceful handling of future months

**Steps**:
1. Change filters:
   - Month: **December**
2. Click **Export to Excel**

**Expected Results**:
- ✅ File downloads: `Laporan_Bahan_Baku_December_2025.xlsx`
- ✅ Contains 1 sheet: "No Data"
- ✅ Shows message: "No data available for future months"
- ✅ Shows message: "Please select current or past month to export data"

**Pass Criteria**: Clear message, no errors

---

### Test 1.4: Export Finished Goods
**Objective**: Verify finished goods export works

**Steps**:
1. Change filters:
   - Month: **October**
   - Report Type: **Laporan Produk Jadi**
2. Click **Export to Excel**

**Expected Results**:
- ✅ File downloads: `Laporan_Produk_Jadi_October_2025.xlsx`
- ✅ 4 sheets created
- ✅ **Kode column is empty** (expected - no SKU field)
- ✅ Nama column populated
- ✅ Data shows correctly

**Pass Criteria**: Works despite empty Kode column

---

## Test Suite 2: Data Accuracy

### Test 2.1: Verify Stock Calculations
**Objective**: Manually verify stock calculations are accurate

**Steps**:
1. Pick one item from the export (e.g., "Bahan A")
2. Note values for Day 1:
   - Stok Awal: ___
   - Stok Masuk: ___
   - Stok Keluar: ___
   - Stok Sisa: ___
3. Verify formula: **Stok Sisa = Stok Awal + Masuk - Keluar**
4. Note Stok Sisa for Day 1: ___
5. Compare with Stok Awal for Day 2: ___ (should match!)
6. Repeat for Days 2-4

**Expected Results**:
- ✅ Stok Sisa (Day N) = Stok Awal (Day N+1)
- ✅ All calculations correct

**Example**:
```
Item: Bahan A

Day 1:
  Stok Awal: 100
  Masuk: 50
  Keluar: 20
  Sisa: 130 ✅ (100 + 50 - 20)

Day 2:
  Stok Awal: 130 ✅ (matches Day 1 Sisa)
  Masuk: 0
  Keluar: 10
  Sisa: 120 ✅ (130 + 0 - 10)
```

**Pass Criteria**: All calculations verified correct

---

### Test 2.2: Verify Zero Handling
**Objective**: Verify zeros show correctly in different sheets

**Steps**:
1. Find an item with zero stock on Day 1
2. Check all 4 sheets for this item:

**Expected Results**:
- ✅ **Stok Awal** sheet: Shows `0` (not empty)
- ✅ **Stok Masuk** sheet: Empty cell (if no movement)
- ✅ **Stok Keluar** sheet: Empty cell (if no movement)
- ✅ **Stok Sisa** sheet: Shows `0` (not empty)

**Pass Criteria**: Zeros visible in Awal/Sisa, empty in Masuk/Keluar

---

### Test 2.3: Verify Items with No Movements
**Objective**: Verify all items included, even without movements

**Steps**:
1. Count items in database (use raw-materials page)
2. Count rows in Excel export (subtract 1 for header)
3. Compare counts

**Expected Results**:
- ✅ All items from database appear in export
- ✅ Items with no movements show all empty/zero cells
- ✅ No items missing

**Pass Criteria**: Item count matches

---

## Test Suite 3: Excel Features

### Test 3.1: Frozen Panes
**Objective**: Verify frozen columns and header work

**Steps**:
1. Open exported Excel file
2. Click on cell C2 (first day column, second row)
3. Scroll right to day columns 10, 20, 30

**Expected Results**:
- ✅ Kode column stays visible while scrolling right
- ✅ Nama column stays visible while scrolling right
- ✅ Header row stays visible

4. Scroll down to row 20, 30

**Expected Results**:
- ✅ Header row stays visible while scrolling down

**Pass Criteria**: Frozen panes work correctly

---

### Test 3.2: Column Widths
**Objective**: Verify columns are readable

**Expected Results**:
- ✅ Kode column: ~15 characters wide
- ✅ Nama column: ~30 characters wide
- ✅ Day columns: ~10 characters wide
- ✅ All text readable without expanding

**Pass Criteria**: No need to resize columns

---

### Test 3.3: Cell Borders
**Objective**: Verify professional formatting

**Expected Results**:
- ✅ All cells have borders
- ✅ Grid is easy to read
- ✅ Header row has gray background
- ✅ Header text is bold and centered

**Pass Criteria**: Professional appearance

---

## Test Suite 4: Edge Cases

### Test 4.1: Empty Database
**Objective**: Handle no items gracefully

**Steps**:
1. (Requires empty database - skip if not possible)
2. Try to export

**Expected Results**:
- ✅ File downloads
- ✅ Contains sheet "No Items"
- ✅ Shows message: "No items found in the system"
- ✅ No errors

**Pass Criteria**: Graceful handling

---

### Test 4.2: Item with Negative Stock
**Objective**: Verify negative values show correctly

**Steps**:
1. Find or create item with more OUT than IN
2. Export and check

**Expected Results**:
- ✅ Negative values show as negative numbers (e.g., -10)
- ✅ No errors or weird formatting

**Pass Criteria**: Negatives handled correctly

---

### Test 4.3: Large Numbers
**Objective**: Verify large quantities display correctly

**Steps**:
1. Find or create movement with quantity > 1000
2. Export and check

**Expected Results**:
- ✅ Large numbers show completely
- ✅ No scientific notation (e.g., 1E+4)
- ✅ Numbers readable

**Pass Criteria**: Large numbers displayed correctly

---

### Test 4.4: Special Characters in Names
**Objective**: Verify names with special chars work

**Steps**:
1. Check items with names containing: / , . & - ( )
2. Verify export handles them

**Expected Results**:
- ✅ Special characters display correctly
- ✅ No encoding issues
- ✅ Filename handles special chars

**Pass Criteria**: No corruption

---

## Test Suite 5: Performance

### Test 5.1: Export Speed
**Objective**: Verify export completes in reasonable time

**Steps**:
1. Click Export button
2. Time how long until download starts

**Expected Results**:
- ✅ Small dataset (< 50 items): < 2 seconds
- ✅ Medium dataset (50-200 items): < 5 seconds
- ✅ Large dataset (200-500 items): < 10 seconds

**Pass Criteria**: Completes within time limits

---

### Test 5.2: File Size
**Objective**: Verify file size is reasonable

**Steps**:
1. Check downloaded file size

**Expected Results**:
- ✅ < 100 KB for small dataset
- ✅ < 500 KB for medium dataset
- ✅ < 2 MB for large dataset

**Pass Criteria**: File size reasonable

---

## Test Suite 6: Integration

### Test 6.1: Matches Table View
**Objective**: Verify export matches what's shown in table

**Steps**:
1. On Reports page, view "Stok Sisa" for October
2. Note value for Item A, Day 3: ___
3. Export to Excel
4. Find same cell in "Stok Sisa" sheet
5. Compare values

**Expected Results**:
- ✅ Values match exactly
- ✅ No discrepancies

**Pass Criteria**: Perfect match

---

### Test 6.2: Authentication Required
**Objective**: Verify export requires login

**Steps**:
1. Logout
2. Try to access export URL directly:
   `http://localhost:3000/api/reports/export?year=2025&month=10&type=raw-materials`

**Expected Results**:
- ✅ Redirects to login page
- ✅ OR returns 401 Unauthorized
- ✅ Export does not download

**Pass Criteria**: Cannot export without auth

---

## Test Suite 7: Browser Compatibility

### Test 7.1: Chrome
- ✅ Export button works
- ✅ File downloads
- ✅ Loading state shows

### Test 7.2: Firefox
- ✅ Export button works
- ✅ File downloads
- ✅ Loading state shows

### Test 7.3: Safari (if available)
- ✅ Export button works
- ✅ File downloads
- ✅ Loading state shows

---

## Test Results Template

**Tester**: ___________________
**Date**: ___________________
**Browser**: ___________________
**OS**: ___________________

| Test ID | Test Name | Pass/Fail | Notes |
|---------|-----------|-----------|-------|
| 1.1 | Export Current Month | ⬜ | |
| 1.2 | Export Past Month | ⬜ | |
| 1.3 | Export Future Month | ⬜ | |
| 1.4 | Export Finished Goods | ⬜ | |
| 2.1 | Verify Calculations | ⬜ | |
| 2.2 | Verify Zero Handling | ⬜ | |
| 2.3 | Items with No Movements | ⬜ | |
| 3.1 | Frozen Panes | ⬜ | |
| 3.2 | Column Widths | ⬜ | |
| 3.3 | Cell Borders | ⬜ | |
| 4.1 | Empty Database | ⬜ | |
| 4.2 | Negative Stock | ⬜ | |
| 4.3 | Large Numbers | ⬜ | |
| 4.4 | Special Characters | ⬜ | |
| 5.1 | Export Speed | ⬜ | |
| 5.2 | File Size | ⬜ | |
| 6.1 | Matches Table View | ⬜ | |
| 6.2 | Authentication | ⬜ | |
| 7.x | Browser Compatibility | ⬜ | |

**Overall Result**: PASS / FAIL

**Critical Issues Found**: ___________________

**Recommendation**: APPROVE FOR PRODUCTION / NEEDS FIXES

---

**Sign-off**: ___________________
**Date**: ___________________
