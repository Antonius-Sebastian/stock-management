# Decimal Handling for Stock Calculations

**Status**: ⚠️ Requires Schema Migration
**Priority**: Medium
**Impact**: Prevents floating point precision errors in stock calculations

---

## Problem

Currently, stock quantities use JavaScript's `Number` type which can lead to floating point precision errors:

```typescript
// Current schema
model RawMaterial {
  currentStock Float @default(0)  // ❌ Can have precision issues
  moq         Float @default(0)
}

model FinishedGood {
  currentStock Float @default(0)  // ❌ Can have precision issues
}
```

**Examples of Precision Errors**:
```javascript
0.1 + 0.2 === 0.30000000000000004  // JavaScript floating point
10.5 - 10.2 === 0.30000000000000027

// In inventory context:
let stock = 10.1
stock -= 5.05
stock -= 5.05
console.log(stock)  // 0.0000000000000004 instead of 0
```

---

## Solution

### Option 1: Use Prisma Decimal Type (Recommended)

Update the schema to use `Decimal` type:

```prisma
model RawMaterial {
  currentStock Decimal @default(0) @db.Decimal(10, 2)  // 10 digits, 2 decimal places
  moq          Int     @default(0)                      // MOQ is usually whole number
}

model FinishedGood {
  currentStock Decimal @default(0) @db.Decimal(10, 2)
}

model StockMovement {
  quantity Decimal @db.Decimal(10, 2)
}

model BatchUsage {
  quantity Decimal @db.Decimal(10, 2)
}
```

**Advantages**:
- Exact precision for decimal values
- Database-level enforcement
- Prisma automatically handles conversion

**Disadvantages**:
- Requires database migration
- Need to handle `Decimal` type in TypeScript code
- Breaking change (requires data migration)

---

### Option 2: Store as Integers (Cents/Units)

Store all quantities as integers multiplied by 100:

```prisma
model RawMaterial {
  currentStockCents Int @default(0)  // Store 10.50 as 1050
}
```

**Advantages**:
- No floating point errors
- Fast integer arithmetic
- No schema migration complexity

**Disadvantages**:
- Requires conversion in all API/UI layers
- More complex code
- Easy to forget conversion

---

### Option 3: Round on Every Operation (Current Workaround)

Continue using `Float` but round after every calculation:

```typescript
// Example in movement history
runningBalance: Math.round(runningBalance * 100) / 100,
```

**Advantages**:
- No schema changes needed
- Works with current code

**Disadvantages**:
- Must remember to round everywhere
- Rounding can accumulate errors
- Not a true fix

---

## Recommended Implementation

### Step 1: Create Migration

```prisma
// In prisma/schema.prisma

model RawMaterial {
  id           String   @id @default(cuid())
  kode         String   @unique
  name         String
  currentStock Decimal  @default(0) @db.Decimal(10, 2)  // CHANGED
  moq          Int      @default(0)                     // CHANGED
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  stockMovements StockMovement[]
  batchUsages    BatchUsage[]

  @@map("raw_materials")
}

model FinishedGood {
  id           String   @id @default(cuid())
  name         String   @unique
  currentStock Decimal  @default(0) @db.Decimal(10, 2)  // CHANGED
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  batches        Batch[]
  stockMovements StockMovement[]

  @@map("finished_goods")
}

model StockMovement {
  id          String    @id @default(cuid())
  type        String    // 'IN' or 'OUT'
  quantity    Decimal   @db.Decimal(10, 2)              // CHANGED
  date        DateTime
  description String?

  rawMaterialId  String?
  finishedGoodId String?
  batchId        String?

  rawMaterial  RawMaterial?  @relation(fields: [rawMaterialId], references: [id], onDelete: SetNull)
  finishedGood FinishedGood? @relation(fields: [finishedGoodId], references: [id], onDelete: SetNull)
  batch        Batch?        @relation(fields: [batchId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([date])
  @@index([rawMaterialId, date])
  @@index([finishedGoodId, date])
  @@index([type, date])
  @@map("stock_movements")
}

model BatchUsage {
  id        String   @id @default(cuid())
  batchId   String
  rawMaterialId String
  quantity  Decimal  @db.Decimal(10, 2)                  // CHANGED

  batch        Batch        @relation(fields: [batchId], references: [id], onDelete: Cascade)
  rawMaterial  RawMaterial  @relation(fields: [rawMaterialId], references: [id], onDelete: Restrict)

  @@unique([batchId, rawMaterialId])
  @@map("batch_usages")
}
```

---

### Step 2: TypeScript Code Changes

Install decimal.js for TypeScript handling:

```bash
npm install decimal.js
npm install --save-dev @types/decimal.js
```

Update types:

```typescript
// src/types/index.ts
import { Decimal } from 'decimal.js'

export interface RawMaterial {
  id: string
  kode: string
  name: string
  currentStock: Decimal  // Changed from number
  moq: number            // Integer
  createdAt: string
  updatedAt: string
}

export interface StockMovement {
  id: string
  type: 'IN' | 'OUT'
  quantity: Decimal      // Changed from number
  date: string
  description?: string
  // ...
}
```

---

### Step 3: API Layer Changes

```typescript
// src/app/api/raw-materials/route.ts

import { Decimal } from 'decimal.js'

export async function GET() {
  const materials = await prisma.rawMaterial.findMany()

  // Prisma returns Decimal as Decimal.js objects
  // Convert for JSON serialization
  const serialized = materials.map(m => ({
    ...m,
    currentStock: m.currentStock.toString(),  // or .toNumber()
  }))

  return NextResponse.json(serialized)
}

export async function POST(request: NextRequest) {
  const { currentStock, ...data } = await request.json()

  const material = await prisma.rawMaterial.create({
    data: {
      ...data,
      currentStock: new Decimal(currentStock),  // Convert string to Decimal
    },
  })

  return NextResponse.json(material)
}
```

---

### Step 4: Frontend Changes

```typescript
// src/components/raw-materials/raw-materials-table.tsx

interface RawMaterial {
  currentStock: string  // Received as string from API
  // ...
}

function RawMaterialsTable({ materials }: { materials: RawMaterial[] }) {
  return (
    <TableCell>
      {parseFloat(material.currentStock).toFixed(2)}
    </TableCell>
  )
}
```

---

### Step 5: Migration Script

Create data migration to convert existing Float values:

```typescript
// prisma/migrations/convert_to_decimal.ts

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateToDecimal() {
  // Raw materials
  const rawMaterials = await prisma.$queryRaw`
    SELECT id, "currentStock" FROM raw_materials
  `

  for (const material of rawMaterials) {
    await prisma.rawMaterial.update({
      where: { id: material.id },
      data: {
        currentStock: new Prisma.Decimal(material.currentStock),
      },
    })
  }

  // Repeat for other tables...
}

migrateToDecimal()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

---

## Deployment Steps

1. **Backup Database** (Critical!)
   ```bash
   pg_dump -h host -U user -d database > backup_before_decimal.sql
   ```

2. **Test in Development**
   ```bash
   npx prisma migrate dev --name convert_to_decimal
   npm run build
   # Test all stock operations
   ```

3. **Deploy to Staging**
   ```bash
   npx prisma migrate deploy
   # Run migration script
   # Test thoroughly
   ```

4. **Deploy to Production**
   ```bash
   # During maintenance window
   npx prisma migrate deploy
   # Run migration script
   # Verify data integrity
   ```

---

## Testing Checklist

After migration:

- [ ] Create raw material with decimal stock (e.g., 10.5)
- [ ] Create stock IN movement with decimal (e.g., 5.25)
- [ ] Create stock OUT movement
- [ ] Verify currentStock is exact (no .00000001)
- [ ] Create batch with decimal material usage
- [ ] Generate monthly stock report
- [ ] Verify no precision errors in calculations
- [ ] Test edge cases (0.1 + 0.2, etc.)

---

## Current Workaround (Until Migration)

Continue using `Math.round()` but add it consistently:

```typescript
// Helper function
export function roundStock(value: number): number {
  return Math.round(value * 100) / 100
}

// Use in all stock calculations
const newStock = roundStock(currentStock - quantity)
```

Add to `src/lib/utils.ts`:

```typescript
/**
 * Round stock value to 2 decimal places
 * Temporary workaround until Decimal migration
 */
export function roundStock(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Safely add stock values
 */
export function addStock(a: number, b: number): number {
  return roundStock(a + b)
}

/**
 * Safely subtract stock values
 */
export function subtractStock(a: number, b: number): number {
  return roundStock(a - b)
}
```

Use throughout codebase:

```typescript
import { addStock, subtractStock, roundStock } from '@/lib/utils'

// Instead of:
currentStock = currentStock + quantity

// Use:
currentStock = addStock(currentStock, quantity)
```

---

## Risk Assessment

**Migration Risk**: Medium
- Requires downtime
- Data transformation needed
- Breaking API changes

**Not Migrating Risk**: Low-Medium
- Precision errors possible
- Rounding can accumulate
- Audit trail issues

**Recommendation**: Migrate during next major version or maintenance window

---

## Alternative: Keep Float, Add Validation

If migration is too risky:

1. Add validation to prevent values >2 decimals
2. Round at boundaries (API input/output)
3. Document precision limitations
4. Add tests for edge cases

```typescript
// Validation schema
const stockSchema = z.object({
  quantity: z.number()
    .multipleOf(0.01, 'Quantity must have maximum 2 decimal places')
    .min(0.01)
})
```

---

**Last Updated**: 2025-10-05
**Status**: Documented - Requires Decision
**Next Steps**: Decide migration timeline or implement workaround
