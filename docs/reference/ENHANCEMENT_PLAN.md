# Enhancement Plan: Batch & Material Detail Features

**Status:** Planning Phase
**Priority:** Optional Enhancements
**Dependencies:** Batch Detail Modal & Material Detail Page (Completed)

---

## Overview

This document outlines potential enhancements to the newly implemented Batch Detail and Material Detail features. These enhancements are categorized by priority and complexity to help guide future development decisions.

---

## Priority Levels

- **🔴 High Priority** - High user value, relatively easy to implement
- **🟡 Medium Priority** - Good user value, moderate complexity
- **🟢 Low Priority** - Nice to have, lower urgency

---

## Enhancement Categories

### 1. Cross-Linking & Navigation (🔴 High Priority)

#### 1.1 Clickable Batch Codes in Movement History

**Current State:**
- Batch codes displayed as plain text in movement history table
- Users cannot navigate from material detail to batch detail

**Proposed Enhancement:**
- Make batch codes clickable in the movement history table
- Click opens batch detail modal (same modal used in batch list)
- Provides seamless navigation between related entities

**Implementation:**
```tsx
// In movement-history-table.tsx
{
  id: "batch",
  header: "Batch",
  cell: ({ row }) => {
    const batch = row.original.batch
    if (!batch) return <span className="text-muted-foreground">-</span>

    return (
      <button
        onClick={() => onBatchClick?.(batch.id)}
        className="font-medium text-primary hover:underline cursor-pointer"
      >
        {batch.code}
      </button>
    )
  },
}
```

**Files to Modify:**
- `src/components/raw-materials/movement-history-table.tsx` - Add click handler
- `src/app/raw-materials/[id]/page.tsx` - Add batch detail modal and state

**Effort:** 1-2 hours

**User Value:**
- Quickly verify which materials were used in a batch
- Audit trail: "This material was used in which batches?"
- Reduced navigation friction

---

#### 1.2 Clickable Material Names in Batch Detail Modal

**Current State:**
- Material names in batch detail modal are plain text
- No way to navigate from batch to material detail

**Proposed Enhancement:**
- Make material names clickable (use Next.js Link)
- Navigates to `/raw-materials/[id]`
- Shows material detail with full movement history

**Implementation:**
```tsx
// In batch-detail-dialog.tsx
import Link from "next/link"

<TableCell>
  <Link
    href={`/raw-materials/${usage.rawMaterial.id}`}
    className="text-primary hover:underline"
  >
    {usage.rawMaterial.name}
  </Link>
</TableCell>
```

**Files to Modify:**
- `src/components/batches/batch-detail-dialog.tsx`

**Effort:** 30 minutes

**User Value:**
- Quick access to material details from batch view
- "Where else was this material used?"
- Streamlined workflow

---

### 2. Finished Goods Detail Page (🟡 Medium Priority)

#### 2.1 Mirror Material Detail for Finished Goods

**Current State:**
- Only raw materials have detail pages
- Finished goods lack movement history visibility

**Proposed Enhancement:**
- Create `/finished-goods/[id]` page (copy pattern from raw materials)
- Show movement history for finished goods
- Include batch references (which batches produced this item)

**Implementation Steps:**

1. **Create API Endpoint:**
   ```
   src/app/api/finished-goods/[id]/movements/route.ts
   ```
   - Same logic as raw material movements
   - Replace `rawMaterialId` with `finishedGoodId`

2. **Create Detail Page:**
   ```
   src/app/finished-goods/[id]/page.tsx
   ```
   - Similar structure to raw material detail
   - Summary cards: Current Stock, Total Movements
   - Movement history table

3. **Make Names Clickable:**
   ```
   src/components/finished-goods/finished-goods-table.tsx
   ```
   - Convert name column to Link

**Files to Create:**
- `src/app/api/finished-goods/[id]/movements/route.ts`
- `src/app/finished-goods/[id]/page.tsx`

**Files to Modify:**
- `src/components/finished-goods/finished-goods-table.tsx`

**Reusable Components:**
- Can reuse `MovementHistoryTable` with minor adjustments
- Or create generic `<ItemDetailPage>` component

**Effort:** 2-3 hours

**User Value:**
- Complete visibility into finished goods movements
- Audit production outputs
- Track sales/shipments

---

### 3. Export & Reporting (🟡 Medium Priority)

#### 3.1 Export Movement History to CSV/Excel

**Current State:**
- Movement history only viewable on screen
- No way to export for external analysis

**Proposed Enhancement:**
- Add "Export" button above movement history table
- Generate CSV with all movement data
- Include: Date, Type, Quantity, Description, Batch, Running Balance

**Implementation:**
```tsx
// Export function
const exportToCSV = () => {
  const headers = ['Date', 'Type', 'Quantity', 'Description', 'Batch', 'Running Balance']
  const rows = movements.map(m => [
    format(new Date(m.date), 'yyyy-MM-dd'),
    m.type,
    m.quantity,
    m.description || '',
    m.batch?.code || '',
    m.runningBalance
  ])

  const csv = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `material-${material.kode}-movements.csv`
  a.click()
}
```

**Files to Modify:**
- `src/app/raw-materials/[id]/page.tsx` - Add export button
- Consider adding to finished goods detail too

**Libraries Needed:**
- None (pure JavaScript)
- Or use `papaparse` for better CSV handling

**Effort:** 1-2 hours

**User Value:**
- Create custom reports in Excel
- Share data with accounting
- Offline analysis

---

#### 3.2 Print-Friendly Batch Detail

**Current State:**
- Batch detail modal not optimized for printing
- Users might want physical records

**Proposed Enhancement:**
- Add "Print" button in batch detail modal
- CSS print styles for clean output
- Include batch info and materials list

**Implementation:**
```css
/* Add to batch-detail-dialog.tsx or global CSS */
@media print {
  .no-print { display: none; }
  .batch-detail { page-break-inside: avoid; }
  /* Hide modal backdrop, show content */
}
```

```tsx
// Add print button
<Button onClick={() => window.print()} className="no-print">
  <Printer className="mr-2 h-4 w-4" />
  Print
</Button>
```

**Files to Modify:**
- `src/components/batches/batch-detail-dialog.tsx`
- Add print CSS

**Effort:** 1 hour

**User Value:**
- Physical batch records for production floor
- Archive batch information
- Share with non-digital stakeholders

---

### 4. Advanced Filtering (🟢 Low Priority)

#### 4.1 Date Range Filter for Movement History

**Current State:**
- All movements shown at once
- No way to focus on specific time period

**Proposed Enhancement:**
- Add date range picker above movement history table
- Filter movements by start and end date
- Preserve search and sort functionality

**Implementation:**
```tsx
// Add date range state
const [dateRange, setDateRange] = useState<{
  from: Date | undefined
  to: Date | undefined
}>({ from: undefined, to: undefined })

// Filter movements
const filteredMovements = movements.filter(m => {
  const movementDate = new Date(m.date)
  if (dateRange.from && movementDate < dateRange.from) return false
  if (dateRange.to && movementDate > dateRange.to) return false
  return true
})
```

**UI Component:**
- Use shadcn date range picker
- Or simple two date inputs

**Files to Modify:**
- `src/app/raw-materials/[id]/page.tsx`
- `src/components/raw-materials/movement-history-table.tsx`

**Effort:** 2-3 hours

**User Value:**
- Focus on specific months/quarters
- Analyze seasonal patterns
- Reduce visual clutter for materials with many movements

---

#### 4.2 Movement Type Filter

**Current State:**
- All movement types (IN/OUT) shown together

**Proposed Enhancement:**
- Add filter buttons: "All", "In Only", "Out Only"
- Toggle between viewing all movements or specific type
- Useful for analyzing just purchases or just consumption

**Implementation:**
```tsx
const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL')

const filteredMovements = movements.filter(m => {
  if (typeFilter === 'ALL') return true
  return m.type === typeFilter
})
```

**UI:**
```tsx
<div className="flex gap-2">
  <Button
    variant={typeFilter === 'ALL' ? 'default' : 'outline'}
    onClick={() => setTypeFilter('ALL')}
  >
    All
  </Button>
  <Button
    variant={typeFilter === 'IN' ? 'default' : 'outline'}
    onClick={() => setTypeFilter('IN')}
  >
    In Only
  </Button>
  <Button
    variant={typeFilter === 'OUT' ? 'default' : 'outline'}
    onClick={() => setTypeFilter('OUT')}
  >
    Out Only
  </Button>
</div>
```

**Files to Modify:**
- `src/app/raw-materials/[id]/page.tsx`

**Effort:** 1 hour

**User Value:**
- Analyze purchasing patterns (IN only)
- Analyze consumption patterns (OUT only)
- Simpler focused views

---

### 5. UI/UX Enhancements (🟢 Low Priority)

#### 5.1 Batch Detail Modal - Expand/Collapse Materials

**Current State:**
- All materials always visible
- For batches with many materials, takes up space

**Proposed Enhancement:**
- Add expand/collapse toggle for materials section
- Default: collapsed (show count only)
- Click to expand and see full list

**Implementation:**
```tsx
const [materialsExpanded, setMaterialsExpanded] = useState(true)

<div className="space-y-3">
  <button
    onClick={() => setMaterialsExpanded(!materialsExpanded)}
    className="flex items-center justify-between w-full"
  >
    <h3>Raw Materials Used</h3>
    <div className="flex items-center gap-2">
      <Badge>{batch.batchUsages.length} materials</Badge>
      {materialsExpanded ? <ChevronUp /> : <ChevronDown />}
    </div>
  </button>

  {materialsExpanded && (
    <div className="border rounded-lg">
      <Table>...</Table>
    </div>
  )}
</div>
```

**Files to Modify:**
- `src/components/batches/batch-detail-dialog.tsx`

**Effort:** 30 minutes

**User Value:**
- Cleaner UI for batches with many materials
- Faster overview of batch info
- Progressive disclosure pattern

---

#### 5.2 Loading Skeletons

**Current State:**
- "Loading..." text during data fetch
- Not very polished

**Proposed Enhancement:**
- Add skeleton loaders for material detail page
- Show card outlines and table skeleton while fetching
- Better perceived performance

**Implementation:**
```tsx
// Use shadcn skeleton component
import { Skeleton } from "@/components/ui/skeleton"

{isLoading ? (
  <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-12 w-32 mt-2" />
        </CardContent>
      </Card>
      {/* Repeat for other cards */}
    </div>

    <Card>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  </div>
) : (
  // Actual content
)}
```

**Files to Modify:**
- `src/app/raw-materials/[id]/page.tsx`
- Consider adding to finished goods detail too

**Effort:** 1 hour

**User Value:**
- More professional appearance
- Better loading experience
- Reduced perceived wait time

---

### 6. Analytics & Insights (🟢 Low Priority)

#### 6.1 Movement Statistics

**Current State:**
- Only count of total movements shown
- No summary statistics

**Proposed Enhancement:**
- Add statistics cards:
  - Total IN quantity (all time)
  - Total OUT quantity (all time)
  - Average monthly turnover
  - Days since last movement

**Implementation:**
```tsx
// Calculate statistics
const totalIn = movements
  .filter(m => m.type === 'IN')
  .reduce((sum, m) => sum + m.quantity, 0)

const totalOut = movements
  .filter(m => m.type === 'OUT')
  .reduce((sum, m) => sum + m.quantity, 0)

const lastMovement = movements[0] // Assuming sorted newest first
const daysSinceLastMovement = differenceInDays(
  new Date(),
  new Date(lastMovement.date)
)
```

**Files to Modify:**
- `src/app/raw-materials/[id]/page.tsx` - Add stat cards

**Effort:** 2 hours

**User Value:**
- Quick insights at a glance
- Identify slow-moving materials
- Understand usage patterns

---

#### 6.2 Movement Chart/Graph

**Current State:**
- Only tabular view of movements
- Hard to spot trends visually

**Proposed Enhancement:**
- Add line chart showing running balance over time
- Bar chart showing IN vs OUT by month
- Toggle between table and chart view

**Libraries:**
- Recharts (React charting library)
- Or Chart.js

**Implementation:**
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

const chartData = movements.map(m => ({
  date: format(new Date(m.date), 'MMM dd'),
  balance: m.runningBalance,
  quantity: m.type === 'IN' ? m.quantity : -m.quantity
}))

<LineChart data={chartData} width={600} height={300}>
  <XAxis dataKey="date" />
  <YAxis />
  <CartesianGrid strokeDasharray="3 3" />
  <Tooltip />
  <Line type="monotone" dataKey="balance" stroke="#8884d8" />
</LineChart>
```

**Files to Modify:**
- `src/app/raw-materials/[id]/page.tsx`
- Add recharts dependency

**Effort:** 3-4 hours

**User Value:**
- Visual trend analysis
- Spot patterns easily
- Better data storytelling

---

## Implementation Roadmap

### Phase 1: High-Value Quick Wins (🔴 High Priority)
**Estimated Time:** 4-5 hours

1. ✅ Clickable material names in batch detail modal (30 min)
2. ✅ Clickable batch codes in movement history (2 hours)
3. ✅ Export movement history to CSV (2 hours)

**Deliverables:**
- Complete cross-linking between batches and materials
- Basic export functionality

---

### Phase 2: Feature Parity (🟡 Medium Priority)
**Estimated Time:** 5-6 hours

1. ✅ Finished goods detail page (3 hours)
2. ✅ Print-friendly batch detail (1 hour)
3. ✅ Date range filter for movements (2 hours)

**Deliverables:**
- All entity types have detail pages
- Basic filtering and export

---

### Phase 3: Polish & Analytics (🟢 Low Priority)
**Estimated Time:** 7-9 hours

1. ✅ Movement type filter (1 hour)
2. ✅ Loading skeletons (1 hour)
3. ✅ Expand/collapse materials in batch modal (30 min)
4. ✅ Movement statistics (2 hours)
5. ✅ Movement charts (4 hours)

**Deliverables:**
- Polished UI/UX
- Data visualization
- Advanced insights

---

## Technical Considerations

### State Management
- Currently using local state (useState)
- For more complex features (charts, filters), consider:
  - URL parameters for filter state (shareable links)
  - React Query for caching API responses

### Performance
- Large movement histories (>1000 records):
  - Add pagination to API
  - Limit client-side rendering
  - Consider virtual scrolling

### Caching
- Material detail data doesn't change frequently
- Consider:
  - Client-side caching with SWR or React Query
  - Cache invalidation on stock movements

---

## Success Metrics

For each enhancement, measure:

1. **Usage Metrics:**
   - How often is the feature used?
   - Which features are most popular?

2. **Performance Metrics:**
   - Page load time
   - API response time
   - Client-side rendering time

3. **User Feedback:**
   - User satisfaction surveys
   - Feature requests
   - Bug reports

---

## Decision Framework

**When to implement an enhancement:**

✅ **Implement if:**
- High user demand
- Relatively low effort (< 4 hours)
- Clear user value
- No technical debt introduced

⏸️ **Defer if:**
- Low user demand
- High complexity (> 8 hours)
- Requires new dependencies
- Better alternatives exist

❌ **Skip if:**
- Very low value
- Conflicts with existing features
- Significant maintenance burden

---

## Conclusion

This enhancement plan provides a structured approach to improving the batch and material detail features. The prioritization helps focus development efforts on high-value, low-effort improvements first.

**Recommended Next Steps:**

1. **Phase 1 Implementation** - Quick wins with high user value
2. **User Feedback Collection** - Validate enhancement priorities
3. **Phase 2 Planning** - Based on feedback, refine roadmap
4. **Iterative Development** - Ship small, gather feedback, iterate

---

**Plan Created By:** Claude Code Assistant
**Date:** October 3, 2025
**Status:** Ready for Review
