# ShadCN Components Research for Inventory Management System

## Executive Summary

This document provides comprehensive research on the shadcn/ui components needed for the Inventory Management System MVP. Based on the PRD analysis, we've identified the core UI components required to build all features across the two milestones.

## Required Components Overview

The following shadcn components are essential for implementing the MVP:

```bash
npx shadcn@latest add @shadcn/table @shadcn/dialog @shadcn/form @shadcn/badge @shadcn/tabs @shadcn/select @shadcn/button @shadcn/input @shadcn/card @shadcn/label
```

## Feature-to-Component Mapping

### Milestone 1: Core Data Management & Manual Tracking

#### Feature 1.1 & 1.2: Master Data Management (Raw Materials & Finished Goods)
**Components Needed:**
- **Table** - Data tables for displaying materials/products with sorting and pagination
- **Badge** - Visual indicators for stock levels (red/yellow/green)
- **Button** - Action buttons for "Add New Material" and stock operations
- **Card** - Organize content sections

#### Feature 1.3: Manual Stock Entry
**Components Needed:**
- **Dialog** - Modal windows for forms
- **Form** - Form validation with react-hook-form integration
- **Input** - Text inputs for quantities, names, dates
- **Select** - Dropdown for selecting items
- **Label** - Form field labels
- **Button** - Submit and cancel actions

### Milestone 2: Production Logic & Interactive Reporting

#### Feature 2.1: Simplified Batch Usage Logging
**Components Needed:**
- **Table** - Display batch history
- **Dialog** - Modal for new batch entry
- **Form** + **Select** + **Input** - Batch creation form

#### Feature 2.2: Interactive Stock Report Page
**Components Needed:**
- **Tabs** - Context switching (Raw Materials vs Finished Goods) and data type tabs
- **Select** - Year/Month filter dropdowns
- **Table** - The main pivoted data table with sticky columns
- **Card** - Organize different report sections

## Detailed Component Analysis

### 1. Table Component
**Purpose:** Core data display for all master pages and reports

**Key Features:**
- Built on @tanstack/react-table
- Sorting, filtering, pagination
- Column visibility controls
- Row selection capabilities
- Responsive design

**Implementation Considerations:**
- For the interactive report, we'll need custom implementation for sticky columns
- Data table supports server-side pagination for large datasets
- Built-in search/filter functionality

**Code Structure:**
```tsx
// Column definitions with custom cell renderers for badges
const columns: ColumnDef<Material>[] = [
  {
    accessorKey: "name",
    header: "Material Name",
  },
  {
    accessorKey: "stock",
    header: "Current Stock",
    cell: ({ row }) => {
      const stock = row.getValue("stock") as number
      const moq = row.original.moq
      return (
        <div className="flex items-center gap-2">
          {stock}
          <StockLevelBadge stock={stock} moq={moq} />
        </div>
      )
    }
  }
]
```

### 2. Dialog Component
**Purpose:** Modal windows for all form interactions

**Key Features:**
- Accessible modal implementation
- Trigger-based opening
- Form integration support
- Responsive sizing
- Close handling with escape key

**Implementation Patterns:**
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Add New Material</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add Raw Material</DialogTitle>
    </DialogHeader>
    <MaterialForm />
  </DialogContent>
</Dialog>
```

### 3. Form Component
**Purpose:** All user input with validation

**Key Features:**
- React Hook Form integration
- Zod validation schema support
- Automatic error handling
- Field-level validation
- Form state management

**Implementation Pattern:**
```tsx
const formSchema = z.object({
  name: z.string().min(1, "Material name is required"),
  stock: z.number().min(0, "Stock cannot be negative"),
  moq: z.number().min(1, "MOQ must be at least 1")
})

// Usage in forms for adding materials, stock entries, batch logging
```

### 4. Badge Component
**Purpose:** Visual stock level indicators

**Key Features:**
- Multiple variants (default, secondary, destructive, outline)
- Custom styling support
- Icon integration

**Stock Level Implementation:**
```tsx
function StockLevelBadge({ stock, moq }: { stock: number; moq: number }) {
  const ratio = stock / moq

  if (ratio >= 1) {
    return <Badge className="bg-green-500">Good</Badge>
  } else if (ratio >= 0.5) {
    return <Badge variant="secondary" className="bg-yellow-500">Low</Badge>
  } else {
    return <Badge variant="destructive">Critical</Badge>
  }
}
```

### 5. Tabs Component
**Purpose:** Navigation for report page contexts and data types

**Key Features:**
- Controlled and uncontrolled modes
- Keyboard navigation
- Custom styling
- Content switching

**Report Page Implementation:**
```tsx
<Tabs value={reportType} onValueChange={setReportType}>
  <TabsList>
    <TabsTrigger value="materials">Raw Materials</TabsTrigger>
    <TabsTrigger value="products">Finished Goods</TabsTrigger>
  </TabsList>
  <TabsContent value="materials">
    <DataTypeTabs />
  </TabsContent>
</Tabs>
```

### 6. Select Component
**Purpose:** Dropdowns for filters and item selection

**Key Features:**
- Searchable options
- Grouped options
- Form integration
- Controlled values
- Custom trigger styling

**Filter Implementation:**
```tsx
<Select value={selectedYear} onValueChange={setSelectedYear}>
  <SelectTrigger>
    <SelectValue placeholder="Select Year" />
  </SelectTrigger>
  <SelectContent>
    {years.map(year => (
      <SelectItem key={year} value={year}>{year}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 7. Button Component
**Purpose:** All user actions throughout the application

**Key Features:**
- Multiple variants (default, destructive, outline, secondary, ghost, link)
- Size variants (default, sm, lg, icon)
- Loading states
- Icon support

**Usage Patterns:**
- Primary actions: Add New, Submit, Save
- Secondary actions: Cancel, Close
- Icon buttons: Menu triggers, action dropdowns

### 8. Input Component
**Purpose:** Text input for all forms

**Key Features:**
- Form integration
- Validation state styling
- Placeholder support
- Type support (text, number, email, password)
- Disabled states

### 9. Card Component
**Purpose:** Content organization and grouping

**Key Features:**
- Header, content, footer sections
- Responsive design
- Shadow and border styling
- Flexible layout

**Usage:**
- Wrapping forms in dialogs
- Organizing report sections
- Dashboard-style layouts

### 10. Label Component
**Purpose:** Accessible form field labels

**Key Features:**
- Automatic association with form controls
- Required indicator support
- Error state styling
- Consistent typography

## Advanced Implementation Considerations

### Interactive Stock Report Table
The pivoted stock report requires special consideration:

**Sticky Column Implementation:**
```css
.sticky-column {
  position: sticky;
  left: 0;
  z-index: 10;
  background: white;
  box-shadow: 2px 0 4px rgba(0,0,0,0.1);
}
```

**Dynamic Data Structure:**
```tsx
// Transform data for pivoted view
const pivotedData = materials.map(material => ({
  name: material.name,
  ...days.reduce((acc, day) => ({
    ...acc,
    [day]: getStockForDay(material.id, selectedMonth, day, dataType)
  }), {})
}))
```

### Form Patterns

**Standard Form Pattern:**
All forms will follow this consistent pattern for user experience:

```tsx
function MaterialForm() {
  const form = useForm<MaterialFormData>({
    resolver: zodResolver(materialSchema),
    defaultValues: { name: "", stock: 0, moq: 1 }
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Material Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit">Save</Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
```

## Component Dependencies

**Required Peer Dependencies:**
- `@tanstack/react-table` - For advanced table functionality
- `react-hook-form` - Form state management
- `@hookform/resolvers` - Zod integration
- `zod` - Schema validation
- `date-fns` - Date formatting (for date inputs)
- `lucide-react` - Icons

**Installation Commands:**
```bash
npm install @tanstack/react-table react-hook-form @hookform/resolvers zod date-fns lucide-react
```

## Performance Considerations

1. **Table Virtualization:** For large datasets, consider implementing virtual scrolling
2. **Form Optimization:** Use React.memo for form components to prevent unnecessary re-renders
3. **Data Fetching:** Implement proper loading states with skeleton components
4. **Search Debouncing:** Implement search debouncing for real-time filtering

## Accessibility Features

All components include:
- ARIA labels and descriptions
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- High contrast support

## Next Steps

1. Install all required components using the provided command
2. Set up the basic page layouts using Card components
3. Implement the data tables for master pages
4. Create reusable form patterns
5. Build the interactive report page with tabs and filters
6. Implement the stock level badge system
7. Add responsive design considerations

This component research provides the foundation for implementing a professional, accessible, and user-friendly inventory management system using shadcn/ui components.