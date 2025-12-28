# Technical API Documentation

**Version:** 1.0.0  
**Last Updated:** 2025-01-06  
**Base URL:** `/api`

This document provides comprehensive technical documentation for all API endpoints in the Stock Management System. All endpoints require authentication unless otherwise specified.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Raw Materials](#raw-materials)
3. [Finished Goods](#finished-goods)
4. [Batches](#batches)
5. [Stock Movements](#stock-movements)
6. [Reports](#reports)
7. [Users](#users)
8. [Health Check](#health-check)

---

## Authentication

### POST /api/auth/[...nextauth]

**Purpose:** NextAuth.js authentication endpoint handling login, session management, and JWT token generation.

**RBAC Requirements:** Public endpoint (no authentication required for initial login)

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Data Logic:**
- Validates credentials against database
- Uses bcrypt for password verification
- Generates JWT session tokens
- Stores session in database (Session model)

**Response:** JWT session token with user information

---

## Raw Materials

### GET /api/raw-materials

**Purpose:** Retrieve all raw materials with optional pagination support.

**RBAC Requirements:** All authenticated users (ADMIN, FACTORY, OFFICE)

**Query Parameters:**
- `page` (optional): Page number (default: returns all if not provided)
- `limit` (optional): Items per page (default: 50, max: 100)

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "kode": "string",
      "name": "string",
      "currentStock": "number",
      "moq": "number",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number",
    "hasMore": "boolean"
  }
}
```

**Data Logic:**
- Simple database query with optional pagination
- Orders by `createdAt` descending
- Returns all items if pagination params not provided (backward compatible)

---

### POST /api/raw-materials

**Purpose:** Create a new raw material entry.

**RBAC Requirements:** ADMIN, OFFICE only (`canManageMaterials`)

**Request Body:**
```json
{
  "kode": "string (required, unique)",
  "name": "string (required)",
  "moq": "number (required, min: 1)"
}
```

**Validation Schema:**
```typescript
z.object({
  kode: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  moq: z.number().min(1, 'MOQ must be at least 1'),
})
```

**Data Logic:**
- Validates unique `kode` constraint
- Sets `currentStock` to 0 for new materials
- Creates record in `raw_materials` table

**Stock Integrity:** N/A (new material starts with 0 stock)

**Response:** Created raw material object (201 status)

---

### PUT /api/raw-materials/[id]

**Purpose:** Update an existing raw material's metadata (code, name, MOQ).

**RBAC Requirements:** ADMIN, OFFICE only (`canManageMaterials`)

**Path Parameters:**
- `id`: Raw material ID (CUID)

**Request Body:**
```json
{
  "kode": "string (required)",
  "name": "string (required)",
  "moq": "number (required, min: 1)"
}
```

**Data Logic:**
- Validates material exists
- Checks for duplicate `kode` (excluding current material)
- Updates metadata only (does not modify `currentStock`)

**Stock Integrity:** N/A (stock level not modified)

**Response:** Updated raw material object

---

### DELETE /api/raw-materials/[id]

**Purpose:** Delete a raw material and all associated records.

**RBAC Requirements:** ADMIN only (`canDeleteMaterials`)

**Path Parameters:**
- `id`: Raw material ID (CUID)

**Data Logic:**
- Validates material exists
- Cascading delete removes:
  - All `StockMovement` records (via `onDelete: SetNull`)
  - All `BatchUsage` records (via `onDelete: Cascade`)

**Stock Integrity:** N/A (material deletion)

**Response:** Success message

---

### GET /api/raw-materials/[id]/movements

**Purpose:** Retrieve complete movement history for a raw material with running balance calculations.

**RBAC Requirements:** All authenticated users

**Path Parameters:**
- `id`: Raw material ID (CUID)

**Data Logic:**
- Fetches material with all stock movements
- Includes batch references for movements
- Calculates running balance chronologically:
  1. Starts from 0
  2. Processes movements in ascending date order
  3. IN movements add to balance, OUT movements subtract
  4. Returns results in reverse order (newest first)

**Response:**
```json
{
  "material": {
    "id": "string",
    "kode": "string",
    "name": "string",
    "currentStock": "number",
    "moq": "number"
  },
  "movements": [
    {
      "id": "string",
      "type": "IN" | "OUT" | "ADJUSTMENT",
      "quantity": "number",
      "date": "ISO8601",
      "description": "string",
      "batch": {
        "id": "string",
        "code": "string"
      } | null,
      "runningBalance": "number",
      "createdAt": "ISO8601"
    }
  ]
}
```

---

## Finished Goods

### GET /api/finished-goods

**Purpose:** Retrieve all finished goods with optional pagination support.

**RBAC Requirements:** All authenticated users

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page (default: 50, max: 100)

**Response:** Same structure as raw materials endpoint

**Data Logic:** Similar to raw materials GET endpoint

---

### POST /api/finished-goods

**Purpose:** Create a new finished good entry.

**RBAC Requirements:** ADMIN, OFFICE only (`canManageFinishedGoods`)

**Request Body:**
```json
{
  "name": "string (required, unique)"
}
```

**Validation Schema:**
```typescript
z.object({
  name: z.string().min(1, 'Name is required'),
})
```

**Data Logic:**
- Validates unique `name` constraint
- Sets `currentStock` to 0 for new products
- Creates record in `finished_goods` table

**Stock Integrity:** N/A (new product starts with 0 stock)

**Response:** Created finished good object (201 status)

---

### PUT /api/finished-goods/[id]

**Purpose:** Update an existing finished good's name.

**RBAC Requirements:** ADMIN, OFFICE only (`canManageFinishedGoods`)

**Path Parameters:**
- `id`: Finished good ID (CUID)

**Request Body:**
```json
{
  "name": "string (required)"
}
```

**Data Logic:**
- Validates product exists
- Checks for duplicate `name` (excluding current product)
- Updates name only (does not modify `currentStock`)

**Stock Integrity:** N/A (stock level not modified)

**Response:** Updated finished good object

---

### DELETE /api/finished-goods/[id]

**Purpose:** Delete a finished good if it has no transaction history.

**RBAC Requirements:** ADMIN only (`canDeleteFinishedGoods`)

**Path Parameters:**
- `id`: Finished good ID (CUID)

**Data Logic:**
- Validates product exists
- Checks for associated records:
  - `stockMovements` count
  - `batches` count (via `batchFinishedGoods`)
- Prevents deletion if product has been used in transactions

**Stock Integrity:** N/A (product deletion with validation)

**Response:** Success message or error if product has history

---

## Batches

### GET /api/batches

**Purpose:** Retrieve all production batches with optional pagination.

**RBAC Requirements:** All authenticated users

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page (default: 50, max: 100)

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "code": "string",
      "date": "ISO8601 (WIB timezone)",
      "description": "string | null",
      "batchFinishedGoods": [
        {
          "id": "string",
          "quantity": "number",
          "finishedGood": {
            "id": "string",
            "name": "string"
          }
        }
      ],
      "batchUsages": [
        {
          "id": "string",
          "quantity": "number",
          "rawMaterial": {
            "id": "string",
            "kode": "string",
            "name": "string"
          }
        }
      ],
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "pagination": { ... }
}
```

**Data Logic:**
- Includes related `batchFinishedGoods` and `batchUsages` with nested product/material data
- Orders by `createdAt` descending

---

### POST /api/batches

**Purpose:** Create a new production batch with automatic stock movements.

**RBAC Requirements:** ADMIN, FACTORY only (`canCreateBatches`)

**Request Body:**
```json
{
  "code": "string (required, unique)",
  "date": "ISO8601 string (converted to WIB timezone)",
  "description": "string (optional)",
  "finishedGoods": [
    {
      "finishedGoodId": "string (required)",
      "quantity": "number (required, positive)"
    }
  ],
  "materials": [
    {
      "rawMaterialId": "string (required)",
      "quantity": "number (required, positive)"
    }
  ]
}
```

**Validation Schema:**
```typescript
z.object({
  code: z.string().min(1, 'Batch code is required'),
  date: z.string().transform((str) => parseToWIB(new Date(str).toISOString())),
  description: z.string().optional(),
  finishedGoods: z.array(z.object({
    finishedGoodId: z.string().min(1, 'Finished good is required'),
    quantity: z.number().positive('Quantity must be positive'),
  })).min(1, 'At least one finished good is required'),
  materials: z.array(z.object({
    rawMaterialId: z.string().min(1, 'Raw material is required'),
    quantity: z.number().positive('Quantity must be positive'),
  })).min(1, 'At least one raw material is required'),
})
```

**Data Logic & Transactions:**
Uses `prisma.$transaction` with the following steps:

1. **Stock Validation (with Row Locking):**
   - For each raw material, uses `SELECT FOR UPDATE` to lock rows and prevent race conditions
   - Validates sufficient stock before proceeding
   - Throws error if any material has insufficient stock

2. **Duplicate Validation:**
   - Checks for duplicate batch code
   - Validates no duplicate materials in same batch
   - Validates no duplicate finished goods in same batch
   - Verifies all finished goods exist

3. **Batch Creation:**
   - Creates `Batch` record

4. **Raw Material Processing:**
   - Creates `BatchUsage` records
   - Creates `StockMovement` records (type: OUT)
   - Decrements `rawMaterial.currentStock` using Prisma increment

5. **Finished Good Processing:**
   - Creates `BatchFinishedGood` records
   - Creates `StockMovement` records (type: IN)
   - Increments `finishedGood.currentStock` using Prisma increment

**Stock Integrity:**
- **Prevents Negative Stock:** Validates stock levels before transaction using `FOR UPDATE` locks
- **Atomic Operations:** All stock updates happen within a single transaction
- **Race Condition Prevention:** Row-level locking ensures concurrent requests don't cause stock inconsistencies
- **Automatic Stock Updates:** Raw materials decrease, finished goods increase automatically

**Response:** Created batch object with relations (201 status)

---

### GET /api/batches/[id]

**Purpose:** Retrieve a single batch with all related data.

**RBAC Requirements:** All authenticated users

**Path Parameters:**
- `id`: Batch ID (CUID)

**Response:**
```json
{
  "id": "string",
  "code": "string",
  "date": "ISO8601",
  "description": "string | null",
  "batchFinishedGoods": [
    {
      "id": "string",
      "quantity": "number",
      "finishedGood": {
        "id": "string",
        "name": "string"
      }
    }
  ],
  "batchUsages": [
    {
      "id": "string",
      "quantity": "number",
      "rawMaterial": {
        "id": "string",
        "kode": "string",
        "name": "string"
      }
    }
  ]
}
```

---

### PUT /api/batches/[id]

**Purpose:** Update an existing batch, restoring old stock and applying new stock changes.

**RBAC Requirements:** ADMIN only (`canEditBatches`)

**Path Parameters:**
- `id`: Batch ID (CUID)

**Request Body:**
```json
{
  "code": "string (required)",
  "date": "ISO8601 string (converted to WIB timezone)",
  "description": "string (optional)",
  "finishedGoods": [
    {
      "finishedGoodId": "string (required)",
      "quantity": "number (required, positive)"
    }
  ],
  "materials": [
    {
      "rawMaterialId": "string (required)",
      "quantity": "number (required, positive)"
    }
  ]
}
```

**Data Logic & Transactions:**
Uses `prisma.$transaction` with the following steps:

1. **Validation:**
   - Checks batch exists
   - Validates duplicate code (excluding current batch)
   - Validates no duplicate materials/finished goods

2. **Restore Old Finished Goods Stock:**
   - For each old `BatchFinishedGood`:
     - Decrements `finishedGood.currentStock` (reversing the IN movement)
     - Deletes old finished good IN stock movements
   - Deletes all old `BatchFinishedGood` records

3. **Restore Old Raw Material Stock:**
   - For each old `BatchUsage`:
     - Increments `rawMaterial.currentStock` (reversing the OUT movement)
     - Deletes old raw material OUT stock movements
   - Deletes all old `BatchUsage` records

4. **Create New Finished Goods:**
   - Creates new `BatchFinishedGood` records
   - Creates new finished good IN stock movements
   - Increments `finishedGood.currentStock`

5. **Create New Raw Materials:**
   - Validates sufficient stock (with `FOR UPDATE` locks)
   - Creates new `BatchUsage` records
   - Creates new raw material OUT stock movements
   - Decrements `rawMaterial.currentStock`

6. **Update Batch Metadata:**
   - Updates code, date, description

**Stock Integrity:**
- **Full Restoration:** Old stock is completely restored before applying new changes
- **Prevents Negative Stock:** Validates new material quantities before applying
- **Atomic Operations:** All changes happen in a single transaction
- **Movement Cleanup:** Old stock movements are deleted to maintain audit trail accuracy

**Response:** Updated batch object with relations

---

### DELETE /api/batches/[id]

**Purpose:** Delete a batch and restore all associated stock.

**RBAC Requirements:** ADMIN only (`canDeleteBatches`)

**Path Parameters:**
- `id`: Batch ID (CUID)

**Data Logic & Transactions:**
Uses `prisma.$transaction` with the following steps:

1. **Fetch Batch Data:**
   - Retrieves batch with `batchFinishedGoods` and `batchUsages`

2. **Restore Finished Good Stock:**
   - For each `BatchFinishedGood`:
     - Decrements `finishedGood.currentStock` (reversing IN movement)

3. **Restore Raw Material Stock:**
   - For each `BatchUsage`:
     - Increments `rawMaterial.currentStock` (reversing OUT movement)

4. **Delete Related Records:**
   - Deletes all `StockMovement` records (prevents orphaned records)
   - Deletes all `BatchFinishedGood` records
   - Deletes all `BatchUsage` records
   - Deletes the `Batch` record

**Stock Integrity:**
- **Complete Restoration:** All stock is restored to pre-batch state
- **Atomic Operations:** All deletions and restorations happen in single transaction
- **Audit Trail:** Stock movements are deleted to maintain data consistency

**Response:** Success message

---

## Stock Movements

### GET /api/stock-movements

**Purpose:** Query stock movements for a specific item on a specific date.

**RBAC Requirements:** All authenticated users

**Query Parameters:**
- `itemId`: Item ID (CUID, required)
- `date`: Date string (ISO8601, required)
- `itemType`: `"raw-material"` | `"finished-good"` (required)

**Data Logic:**
- Converts date to WIB timezone using `parseToWIB()`
- Calculates start and end of day in WIB using `startOfDayWIB()` and `endOfDayWIB()`
- Queries movements within the date range for the specified item
- Orders by `createdAt` ascending

**Response:**
```json
[
  {
    "id": "string",
    "type": "IN" | "OUT" | "ADJUSTMENT",
    "quantity": "number",
    "date": "ISO8601",
    "description": "string | null",
    "rawMaterialId": "string | null",
    "finishedGoodId": "string | null",
    "batchId": "string | null",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
]
```

---

### POST /api/stock-movements

**Purpose:** Create a new stock movement (IN, OUT, or ADJUSTMENT) with automatic stock updates.

**RBAC Requirements:** 
- **IN/OUT:** Role-based via `canCreateStockMovement(role, itemType, movementType)`
  - Raw material IN: OFFICE, ADMIN
  - Raw material OUT: ADMIN only (normally via batch)
  - Finished good IN: ADMIN only (normally via batch)
  - Finished good OUT: OFFICE, ADMIN
- **ADJUSTMENT:** ADMIN only (`canCreateStockAdjustment`)

**Request Body:**
```json
{
  "type": "IN" | "OUT" | "ADJUSTMENT",
  "quantity": "number (required, non-zero)",
  "date": "ISO8601 string (converted to WIB timezone)",
  "description": "string (optional, required for ADJUSTMENT)",
  "rawMaterialId": "string (required if finishedGoodId not provided)",
  "finishedGoodId": "string (required if rawMaterialId not provided)"
}
```

**Validation Schema:**
```typescript
z.object({
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number()
    .refine((val) => val !== 0, 'Quantity cannot be zero')
    .refine((val, ctx) => {
      // IN and OUT must be positive, ADJUSTMENT can be positive or negative
      if (ctx.parent.type === 'ADJUSTMENT') return true
      return val > 0
    }, 'Quantity must be positive for IN and OUT movements'),
  date: z.string().transform((str) => parseToWIB(new Date(str))),
  description: z.string().optional(),
  rawMaterialId: z.string().optional(),
  finishedGoodId: z.string().optional(),
}).refine(
  (data) => data.rawMaterialId || data.finishedGoodId,
  { message: "Either rawMaterialId or finishedGoodId must be provided" }
)
```

**Data Logic & Transactions:**
Uses `prisma.$transaction` with the following steps:

1. **Permission Check:**
   - ADJUSTMENT: Checks `canCreateStockAdjustment()` (ADMIN only)
   - IN/OUT: Checks `canCreateStockMovement()` with granular permissions

2. **Stock Validation (with Row Locking):**
   - For OUT movements or negative ADJUSTMENT:
     - Uses `SELECT FOR UPDATE` to lock the item row
     - Validates sufficient stock exists
     - For ADJUSTMENT: Checks if adjustment would result in negative stock
     - Throws error if validation fails

3. **Create Stock Movement:**
   - Creates `StockMovement` record

4. **Update Stock:**
   - **IN:** Increments `currentStock` by quantity
   - **OUT:** Decrements `currentStock` by quantity
   - **ADJUSTMENT:** Directly adjusts `currentStock` by quantity (can be positive or negative)

**Stock Integrity:**
- **Prevents Negative Stock:** Validates stock levels before OUT/negative ADJUSTMENT using `FOR UPDATE` locks
- **Race Condition Prevention:** Row-level locking ensures concurrent requests are serialized
- **Atomic Operations:** Movement creation and stock update happen in single transaction
- **ADJUSTMENT Handling:** Allows direct stock correction (admin only) with validation

**Response:** Created stock movement object (201 status)

---

### PUT /api/stock-movements/by-date

**Purpose:** Update or replace stock movements for a specific item on a specific date.

**RBAC Requirements:** ADMIN only (`canEditStockMovements`)

**Query Parameters:**
- `itemId`: Item ID (CUID)
- `date`: Date string (ISO8601)
- `itemType`: `"raw-material"` | `"finished-good"`
- `movementType`: `"IN"` | `"OUT"`

**Request Body:**
```json
{
  "itemId": "string (required)",
  "date": "ISO8601 string (converted to WIB timezone)",
  "itemType": "raw-material" | "finished-good",
  "movementType": "IN" | "OUT",
  "quantity": "number (required, min: 0)"
}
```

**Data Logic & Transactions:**
Uses `prisma.$transaction` with the following steps:

1. **Date Range Calculation:**
   - Converts date to WIB timezone
   - Calculates start and end of day in WIB

2. **Find Existing Movements:**
   - Queries all movements for the item on the specified date
   - Calculates total quantity change from existing movements

3. **Calculate Stock Change:**
   - Old total: Sum of existing movement quantities (IN adds, OUT subtracts)
   - New total: Requested quantity (IN adds, OUT subtracts)
   - Stock change: New total - Old total

4. **Stock Validation (with Row Locking):**
   - Uses `SELECT FOR UPDATE` to lock item row
   - Calculates new stock: `currentStock + stockChange`
   - Validates new stock >= 0
   - Throws error if would result in negative stock

5. **Update Movements:**
   - Deletes all existing movements for the date
   - Creates new movement with requested quantity

6. **Update Stock:**
   - Applies calculated stock change using Prisma increment

**Stock Integrity:**
- **Prevents Negative Stock:** Validates final stock level before applying changes
- **Atomic Operations:** Movement updates and stock changes happen in single transaction
- **Row Locking:** Prevents race conditions during stock calculation

**Response:** Success message

---

### DELETE /api/stock-movements/by-date

**Purpose:** Delete all stock movements for a specific item on a specific date and restore stock.

**RBAC Requirements:** ADMIN only (`canDeleteStockMovements`)

**Query Parameters:**
- `itemId`: Item ID (CUID)
- `date`: Date string (ISO8601)
- `itemType`: `"raw-material"` | `"finished-good"`
- `movementType`: `"IN"` | `"OUT"`

**Data Logic & Transactions:**
Uses `prisma.$transaction` with the following steps:

1. **Date Range Calculation:**
   - Converts date to WIB timezone
   - Calculates start and end of day in WIB

2. **Find Movements to Delete:**
   - Queries movements matching criteria
   - Calculates total stock change to reverse

3. **Stock Validation (with Row Locking):**
   - Uses `SELECT FOR UPDATE` to lock item row
   - Calculates new stock after reversal
   - Validates new stock >= 0
   - Throws error if would result in negative stock

4. **Delete Movements:**
   - Deletes all matching movements

5. **Restore Stock:**
   - Reverses stock change (IN movements subtract, OUT movements add)

**Stock Integrity:**
- **Prevents Negative Stock:** Validates stock level after reversal
- **Atomic Operations:** Deletion and stock restoration happen in single transaction
- **Row Locking:** Prevents race conditions

**Response:** Success message

---

## Reports

### GET /api/reports/stock

**Purpose:** Generate pivot-style stock report for a specific month and year.

**RBAC Requirements:** All authenticated users (`canViewReports`)

**Query Parameters:**
- `year`: Number (2020-2030, required)
- `month`: Number (1-12, required)
- `type`: `"raw-materials"` | `"finished-goods"` (required)
- `dataType`: `"stok-awal"` | `"stok-masuk"` | `"stok-keluar"` | `"stok-sisa"` (required)

**Data Logic:**
1. **Date Range Calculation:**
   - Calculates start and end dates for the month
   - Determines days in month
   - Handles current month (only shows up to current day)
   - Handles future months (returns empty data)

2. **Data Retrieval:**
   - Fetches all items (raw materials or finished goods) with their stock movements
   - Orders movements by date ascending

3. **Opening Stock Calculation:**
   - For each item, calculates opening stock at start of month
   - Sums all movements before the month (IN adds, OUT subtracts)

4. **Daily Stock Calculation:**
   - For each day in the month:
     - Filters movements for that specific day
     - Calculates IN and OUT quantities
     - Updates running balance
     - Sets value based on `dataType`:
       - `stok-awal`: Stock at start of day
       - `stok-masuk`: Total IN during day
       - `stok-keluar`: Total OUT during day
       - `stok-sisa`: Stock at end of day

5. **Filtering:**
   - Includes items with movements in the month OR opening stock > 0
   - Excludes items with no activity and zero opening stock

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "code": "string (for raw materials)",
      "1": "number",
      "2": "number",
      ...
      "31": "number"
    }
  ],
  "meta": {
    "year": "number",
    "month": "number",
    "type": "string",
    "dataType": "string",
    "daysInMonth": "number",
    "currentDay": "number"
  }
}
```

---

### GET /api/reports/export

**Purpose:** Export comprehensive stock report to Excel format with multiple sheets.

**RBAC Requirements:** All authenticated users (`canExportReports`)

**Query Parameters:**
- `year`: Number (2020-2030, required)
- `month`: Number (1-12, required)
- `type`: `"raw-materials"` | `"finished-goods"` (required)

**Data Logic:**
1. **Data Calculation:**
   - Uses same logic as `/api/reports/stock` endpoint
   - Calculates all 4 data types (`stok-awal`, `stok-masuk`, `stok-keluar`, `stok-sisa`)

2. **Excel Generation:**
   - Creates workbook with 4 sheets (one per data type)
   - Applies professional formatting:
     - Color-coded headers per data type
     - Conditional formatting (low stock, high activity)
     - Zebra striping for rows
     - Frozen panes (first 2 columns, header rows)
     - Print settings (landscape, repeat headers)
     - Borders and column widths

3. **Edge Cases:**
   - Future months: Returns Excel with "No Data" message
   - No items: Returns Excel with "No Items" message

**Response:** Excel file (`.xlsx`) with appropriate headers

---

### GET /api/reports/available-years

**Purpose:** Get list of available years for report filtering based on existing stock movement data.

**RBAC Requirements:** All authenticated users (`canViewReports`)

**Data Logic:**
1. Finds earliest and latest stock movement dates
2. Generates year range from earliest to latest
3. Ensures current year is always included if within or after the range

**Response:**
```json
{
  "years": ["2023", "2024", "2025", ...]
}
```

---

## Users

### GET /api/users

**Purpose:** Retrieve all users (admin only).

**RBAC Requirements:** ADMIN only (`canManageUsers`)

**Response:**
```json
[
  {
    "id": "string",
    "username": "string",
    "email": "string | null",
    "name": "string",
    "role": "ADMIN" | "FACTORY" | "OFFICE",
    "isActive": "boolean",
    "createdAt": "ISO8601"
  }
]
```

**Data Logic:**
- Excludes password field from response
- Orders by `createdAt` descending

---

### POST /api/users

**Purpose:** Create a new user account.

**RBAC Requirements:** ADMIN only (`canManageUsers`)

**Request Body:**
```json
{
  "username": "string (required, min: 3, unique)",
  "email": "string (optional, unique if provided)",
  "password": "string (required, min: 8, must contain uppercase, lowercase, number)",
  "name": "string (required)",
  "role": "ADMIN" | "FACTORY" | "OFFICE" (required)
}
```

**Validation Schema:**
```typescript
z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email').optional().nullable(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['ADMIN', 'FACTORY', 'OFFICE']),
})
```

**Data Logic:**
- Validates unique username
- Validates unique email (if provided)
- Hashes password using bcrypt (10 rounds)
- Sets `isActive` to `true` by default
- Creates audit log entry

**Response:** Created user object (password excluded)

---

### GET /api/users/[id]

**Purpose:** Retrieve a single user by ID.

**RBAC Requirements:** ADMIN only (`canManageUsers`)

**Path Parameters:**
- `id`: User ID (CUID)

**Response:** User object (password excluded)

---

### PUT /api/users/[id]

**Purpose:** Update an existing user account.

**RBAC Requirements:** ADMIN only (`canManageUsers`)

**Path Parameters:**
- `id`: User ID (CUID)

**Request Body:** (All fields optional)
```json
{
  "username": "string (min: 3)",
  "email": "string | null",
  "password": "string (min: 8, must contain uppercase, lowercase, number)",
  "name": "string",
  "role": "ADMIN" | "FACTORY" | "OFFICE",
  "isActive": "boolean"
}
```

**Data Logic:**
- Validates user exists
- Checks for duplicate username/email if being changed
- Hashes password if provided
- Updates only provided fields

**Response:** Updated user object (password excluded)

---

### DELETE /api/users/[id]

**Purpose:** Delete a user account.

**RBAC Requirements:** ADMIN only (`canManageUsers`)

**Path Parameters:**
- `id`: User ID (CUID)

**Data Logic:**
- Validates user exists
- Prevents self-deletion
- Prevents deleting the last admin user
- Creates audit log entry

**Response:** Success message

---

## Health Check

### GET /api/health

**Purpose:** System health check endpoint for monitoring (no authentication required).

**RBAC Requirements:** Public endpoint (no authentication)

**Data Logic:**
- Tests database connection with `SELECT 1` query
- Retrieves basic system statistics (user count, material count, batch count)
- Calculates response times

**Response:**
```json
{
  "status": "healthy" | "unhealthy",
  "timestamp": "ISO8601",
  "version": "1.0.0",
  "environment": "development" | "production",
  "uptime": "number (seconds)",
  "database": {
    "status": "connected" | "disconnected",
    "responseTime": "string (ms)",
    "error": "string (if disconnected)"
  },
  "stats": {
    "users": "number",
    "rawMaterials": "number",
    "batches": "number"
  },
  "performance": {
    "totalResponseTime": "string (ms)"
  }
}
```

**Error Response (503):** Returns unhealthy status if database connection fails

---

## Common Patterns

### Timezone Handling

All date operations use **WIB (Waktu Indonesia Barat, GMT+7)** timezone:
- Dates are converted using `parseToWIB()` from `@/lib/timezone`
- Date ranges use `startOfDayWIB()` and `endOfDayWIB()`
- Database stores dates in UTC, but application logic operates in WIB

### Transaction Management

Critical operations use `prisma.$transaction` to ensure atomicity:
- Batch creation/editing
- Stock movement creation/editing/deletion
- All operations that modify stock levels

### Row Locking (FOR UPDATE)

Stock-sensitive operations use `SELECT FOR UPDATE` to prevent race conditions:
- Batch creation (validating raw material stock)
- Stock movement creation (OUT and negative ADJUSTMENT)
- Stock movement updates/deletions

### Stock Integrity Rules

1. **Negative Stock Prevention:**
   - All OUT movements and negative ADJUSTMENTs validate stock before execution
   - Uses row-level locking to prevent concurrent modifications

2. **Atomic Stock Updates:**
   - Stock changes always happen within transactions
   - Movement creation and stock update are atomic

3. **Stock Restoration:**
   - Batch deletion restores all associated stock
   - Batch editing restores old stock before applying new changes
   - Movement deletion restores stock to pre-movement state

### Error Handling

All endpoints follow consistent error handling:
- **400:** Validation errors (Zod schema violations)
- **401:** Unauthorized (not authenticated)
- **403:** Forbidden (insufficient permissions)
- **404:** Resource not found
- **500:** Internal server error

Errors are logged using the logger utility and return user-friendly messages.

---

## RBAC Permission Matrix

| Endpoint | ADMIN | FACTORY | OFFICE |
|----------|-------|---------|--------|
| **Raw Materials** |
| GET /api/raw-materials | ✅ | ✅ | ✅ |
| POST /api/raw-materials | ✅ | ❌ | ✅ |
| PUT /api/raw-materials/[id] | ✅ | ❌ | ✅ |
| DELETE /api/raw-materials/[id] | ✅ | ❌ | ❌ |
| GET /api/raw-materials/[id]/movements | ✅ | ✅ | ✅ |
| **Finished Goods** |
| GET /api/finished-goods | ✅ | ✅ | ✅ |
| POST /api/finished-goods | ✅ | ❌ | ✅ |
| PUT /api/finished-goods/[id] | ✅ | ❌ | ✅ |
| DELETE /api/finished-goods/[id] | ✅ | ❌ | ❌ |
| **Batches** |
| GET /api/batches | ✅ | ✅ | ✅ |
| POST /api/batches | ✅ | ✅ | ❌ |
| GET /api/batches/[id] | ✅ | ✅ | ✅ |
| PUT /api/batches/[id] | ✅ | ❌ | ❌ |
| DELETE /api/batches/[id] | ✅ | ❌ | ❌ |
| **Stock Movements** |
| GET /api/stock-movements | ✅ | ✅ | ✅ |
| POST /api/stock-movements (IN) | ✅* | ❌ | ✅* |
| POST /api/stock-movements (OUT) | ✅* | ❌ | ✅* |
| POST /api/stock-movements (ADJUSTMENT) | ✅ | ❌ | ❌ |
| PUT /api/stock-movements/by-date | ✅ | ❌ | ❌ |
| DELETE /api/stock-movements/by-date | ✅ | ❌ | ❌ |
| **Reports** |
| GET /api/reports/stock | ✅ | ✅ | ✅ |
| GET /api/reports/export | ✅ | ✅ | ✅ |
| GET /api/reports/available-years | ✅ | ✅ | ✅ |
| **Users** |
| GET /api/users | ✅ | ❌ | ❌ |
| POST /api/users | ✅ | ❌ | ❌ |
| GET /api/users/[id] | ✅ | ❌ | ❌ |
| PUT /api/users/[id] | ✅ | ❌ | ❌ |
| DELETE /api/users/[id] | ✅ | ❌ | ❌ |

\* *Granular permissions based on item type (see `canCreateStockMovement` function)*

---

## Notes

- All timestamps are in ISO8601 format
- All IDs use CUID format
- Stock quantities are stored as `Float` in the database
- Date filtering uses WIB timezone for consistency
- Row locking (`FOR UPDATE`) is used to prevent race conditions in high-concurrency scenarios
- Transactions ensure data consistency for multi-step operations

