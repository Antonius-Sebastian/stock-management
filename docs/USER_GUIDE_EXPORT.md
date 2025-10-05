# User Guide: Excel Export Feature

**Feature**: Export Stock Reports to Excel
**Audience**: Factory Staff, Office Staff, Managers
**Version**: 1.0

---

## What is Export Feature?

The Export feature allows you to download your stock reports as Excel files (.xlsx) with all 4 stock movement types in separate sheets.

**Benefits**:
- 📊 Get all data in one file
- 📱 Share reports easily
- 💾 Keep offline backups
- 📈 Analyze data in Excel
- 🖨️ Print professional reports

---

## How to Export Reports

### Step 1: Navigate to Reports Page

1. Login to the system
2. Click **"Reports"** in the sidebar menu
3. You'll see the Stock Reports page

### Step 2: Select What You Want to Export

Choose your filters at the top of the page:

1. **Year**: Select the year (e.g., 2025)
2. **Month**: Select the month (e.g., October)
3. **Report Type**: Choose either:
   - **Laporan Bahan Baku** (Raw Materials Report)
   - **Laporan Produk Jadi** (Finished Goods Report)

### Step 3: Click Export Button

1. Find the **"Export to Excel"** button (top-right corner)
2. Click it
3. Button will change to **"Exporting..."**
4. Wait a few seconds

### Step 4: Open the Downloaded File

1. File will download automatically
2. File name format: `Laporan_Bahan_Baku_October_2025.xlsx`
3. Open with Microsoft Excel, Google Sheets, or LibreOffice

---

## Understanding the Excel File

### The 4 Sheets

Your exported file contains 4 sheets (tabs):

#### 1. **Stok Awal** (Beginning Stock)
- Shows stock at the **start** of each day
- **Before** any movements happen
- Use this to see: "How much did I have at the beginning of the day?"

**Example**:
```
Day 1: 100 units  (You started the day with 100)
Day 2: 150 units  (You started the day with 150)
```

#### 2. **Stok Masuk** (Stock IN)
- Shows stock that **came in** during the day
- Deliveries, purchases, returns
- Use this to see: "How much did I receive today?"

**Example**:
```
Day 1: 50 units   (Received 50 units)
Day 2: (empty)    (Nothing received)
```

#### 3. **Stok Keluar** (Stock OUT)
- Shows stock that **went out** during the day
- Used for production, sold, damaged
- Use this to see: "How much did I use today?"

**Example**:
```
Day 1: (empty)    (Nothing used)
Day 2: 20 units   (Used 20 units)
```

#### 4. **Stok Sisa** (Remaining Stock)
- Shows stock at the **end** of the day
- **After** all movements
- Use this to see: "How much do I have left?"

**Formula**: Sisa = Awal + Masuk - Keluar

**Example**:
```
Day 1: 150 units  (100 + 50 - 0 = 150)
Day 2: 130 units  (150 + 0 - 20 = 130)
```

---

## Reading the Columns

### First Two Columns (Always Visible)

1. **Kode** (Code):
   - Raw materials: Kode number (e.g., A001)
   - Finished goods: Empty (no code)

2. **Nama** (Name):
   - Full item name
   - Example: "Minyak Kelapa", "Sabun Wangi"

### Day Columns (1, 2, 3, ...)

- Each column represents one day of the month
- Only shows days with data (not future days)
- **October 2025** (if today is Oct 4): Shows days 1, 2, 3, 4 only

### Empty Cells vs Zero

**Empty Cell**: No activity
- In Masuk/Keluar sheets: Nothing happened

**Zero (0)**: Actual zero value
- In Awal/Sisa sheets: Item has no stock
- This is important! `0` means "out of stock"

---

## Special Features

### Frozen Panes

The first 2 columns (Kode and Nama) are **frozen**.

**What this means**:
- When you scroll right to see later days
- Kode and Nama columns stay visible
- Easy to know which item you're looking at

**How to use**:
1. Scroll right → Item names stay visible ✅
2. Scroll down → Header row stays visible ✅

### Formatted for Printing

- All cells have borders
- Header row is bold with gray background
- Column widths are pre-set
- Ready to print!

---

## Common Questions

### Q: Why don't I see all 31 days?

**A**: The export only shows days up to today.

**Example**:
- If today is **October 4**
- Export shows days **1, 2, 3, 4** only
- This prevents showing "projected" data

**For past months**: Shows all days (e.g., September shows 30 days)

### Q: Why is Kode column empty for Finished Goods?

**A**: Finished goods don't have codes in the system (only raw materials do).

**What to do**: Use the Nama column to identify products.

### Q: Can I export future months?

**A**: Yes, but the file will say "No data available for future months".

**Why**: Future data doesn't exist yet!

### Q: Why do some items show even though they have no movements?

**A**: The export includes **ALL items** to give you a complete view.

**Example**:
- You have 100 raw materials
- Only 20 had movements in October
- Export shows all 100 (so you know about the 80 that didn't move!)

### Q: I see a negative number in Stok Sisa. Is this an error?

**A**: Negative stock means you used more than you had.

**Possible reasons**:
- Data entry error
- Stock was taken before recording receipt
- Physical inventory doesn't match records

**What to do**: Check the item's movement history and correct the data.

### Q: How long does export take?

**A**: Usually 2-5 seconds depending on data size.

**If it takes longer**:
- Check your internet connection
- Try refreshing the page
- Contact support if problem persists

---

## Tips & Best Practices

### 1. Export Regularly

✅ **Do**: Export at end of each month for archives
✅ **Do**: Keep backup copies
❌ **Don't**: Wait until you need it urgently

### 2. Verify Your Data First

Before exporting:
1. Check the report table on screen
2. Verify a few numbers look correct
3. Then export

### 3. Use Excel Features

You can enhance the export in Excel:
- Add formulas
- Create charts
- Add conditional formatting
- Filter and sort data

### 4. Share Securely

✅ **Do**: Password-protect sensitive Excel files
✅ **Do**: Send via secure channels
❌ **Don't**: Post publicly online

### 5. Compare Months

Export multiple months and compare:
- Month-over-month changes
- Identify trends
- Spot unusual patterns

---

## Troubleshooting

### Export Button Doesn't Work

**Possible Causes**:
1. Not logged in → **Solution**: Log in again
2. Internet connection lost → **Solution**: Check connection
3. Browser issue → **Solution**: Try different browser

### File Won't Open

**Possible Causes**:
1. No Excel software → **Solution**: Use Google Sheets (free)
2. Corrupted download → **Solution**: Export again
3. Old Excel version → **Solution**: Update Excel or use newer software

### Data Looks Wrong

**Possible Causes**:
1. Wrong month selected → **Solution**: Check filters
2. Wrong report type → **Solution**: Check if you selected Raw Materials vs Finished Goods
3. Data entry errors → **Solution**: Fix source data and export again

### File is Too Large

**If file is > 10 MB**:
1. System might have too much historical data
2. Contact support
3. Consider archiving old data

---

## Example Use Cases

### Use Case 1: Monthly Stock Report for Management

**Scenario**: Manager needs month-end stock report

**Steps**:
1. Wait until end of month (Oct 31)
2. Select October 2025
3. Export both Raw Materials and Finished Goods
4. Attach to monthly report
5. Archive for records

### Use Case 2: Verify Physical Inventory

**Scenario**: Doing physical stock count

**Steps**:
1. Export current month report
2. Look at "Stok Sisa" sheet
3. Check last day's values
4. Compare with physical count
5. Investigate any differences

### Use Case 3: Check Usage Patterns

**Scenario**: Want to see which materials are used most

**Steps**:
1. Export last 3 months
2. Look at "Stok Keluar" sheets
3. Compare totals
4. Identify high-usage items

### Use Case 4: Share with External Auditor

**Scenario**: Auditor needs stock records

**Steps**:
1. Export all required months
2. Password-protect the files
3. Send securely
4. Provide explanation of the sheets

---

## Keyboard Shortcuts

While on Reports page:
- **Tab**: Navigate between filters
- **Enter**: Open dropdown menus
- **Esc**: Close dropdown menus
- **Ctrl+F** (Windows) / **Cmd+F** (Mac): Find on page

In Excel:
- **Ctrl+Home**: Go to top-left
- **Ctrl+End**: Go to last cell with data
- **Ctrl+F**: Find
- **Ctrl+P**: Print

---

## Getting Help

**For technical issues**:
- Contact IT support
- Provide screenshot of error
- Mention what you were trying to do

**For data questions**:
- Contact office manager
- Double-check your filters
- Verify data entry

**For training**:
- Ask colleague to demonstrate
- Refer to this guide
- Practice with old month data

---

## Summary

✅ Export gives you complete stock data in Excel
✅ 4 sheets show different aspects of stock movement
✅ Frozen columns make data easy to read
✅ Only shows real data (no projections)
✅ Includes all items for complete picture

**Remember**: The export is a snapshot of your data at the time of export. If you update data later, export again to get updated file.

---

**Questions?** Contact your system administrator.

**Last Updated**: October 4, 2025
