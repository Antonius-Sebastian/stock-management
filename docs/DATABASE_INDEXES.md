# Database Indexes - Production Deployment Guide

**Status**: ⏳ Pending Manual Application
**Priority**: High
**Impact**: Performance improvement on queries

---

## Overview

The following indexes are already defined in `prisma/schema.prisma` but need to be manually applied to the production database due to Supabase pooler blocking Prisma migrations.

**Important**: These indexes are **purely additive** and will not affect existing functionality. They only improve query performance.

---

## Indexes to Apply

### 1. StockMovement Indexes

**Purpose**: Speed up date-based queries and stock movement filtering

```sql
-- Index on date column for time-based queries
CREATE INDEX IF NOT EXISTS "stock_movements_date_idx" ON "stock_movements"("date");

-- Composite index for raw material movements by date
CREATE INDEX IF NOT EXISTS "stock_movements_rawMaterialId_date_idx"
ON "stock_movements"("rawMaterialId", "date");

-- Composite index for finished good movements by date
CREATE INDEX IF NOT EXISTS "stock_movements_finishedGoodId_date_idx"
ON "stock_movements"("finishedGoodId", "date");

-- Index on movement type and date
CREATE INDEX IF NOT EXISTS "stock_movements_type_date_idx"
ON "stock_movements"("type", "date");
```

**Queries Improved**:
- Monthly stock reports (`/api/reports/stock`)
- Movement history by material (`/api/raw-materials/[id]/movements`)
- Stock movements by date (`/api/stock-movements/by-date`)
- Batch movement lookups

**Expected Impact**: 50-80% faster query times on large datasets

---

### 2. Batch Indexes

**Purpose**: Speed up batch lookups and filtering

```sql
-- Index on batch date for chronological queries
CREATE INDEX IF NOT EXISTS "batches_date_idx" ON "batches"("date");

-- Index on finished good ID for batch filtering
CREATE INDEX IF NOT EXISTS "batches_finishedGoodId_idx" ON "batches"("finishedGoodId");

-- Index on batch code for duplicate checks (if not already created by @unique)
CREATE INDEX IF NOT EXISTS "batches_code_idx" ON "batches"("code");
```

**Queries Improved**:
- Batch listing (`/api/batches`)
- Batch filtering by product
- Batch code duplicate checks
- Date-based batch queries

**Expected Impact**: 30-50% faster query times

---

## Verification

After applying indexes, verify they were created:

```sql
-- Check all indexes on stock_movements table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'stock_movements'
ORDER BY indexname;

-- Check all indexes on batches table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'batches'
ORDER BY indexname;
```

Expected output should include all the indexes listed above.

---

## Performance Testing

Before and after applying indexes, run these queries to measure improvement:

### Test 1: Stock Report Query
```sql
-- Query monthly stock movements
EXPLAIN ANALYZE
SELECT * FROM stock_movements
WHERE date >= '2025-01-01' AND date < '2025-02-01'
ORDER BY date ASC;
```

**Before**: Sequential scan
**After**: Index scan on `stock_movements_date_idx`

---

### Test 2: Material Movement History
```sql
-- Query movements for specific material
EXPLAIN ANALYZE
SELECT * FROM stock_movements
WHERE "rawMaterialId" = 'some-id'
ORDER BY date ASC;
```

**Before**: Sequential scan + filter
**After**: Index scan on `stock_movements_rawMaterialId_date_idx`

---

### Test 3: Batch Listing
```sql
-- Query batches ordered by date
EXPLAIN ANALYZE
SELECT * FROM batches
ORDER BY date DESC
LIMIT 50;
```

**Before**: Sequential scan + sort
**After**: Index scan on `batches_date_idx`

---

## Deployment Steps

### Option 1: Via Supabase Dashboard

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste all CREATE INDEX statements
3. Execute the SQL
4. Verify indexes were created
5. Run performance tests

### Option 2: Via psql Command Line

```bash
# Connect to database
psql "postgresql://user:password@host:port/database"

# Run index creation script
\i create_indexes.sql

# Verify
\di stock_movements*
\di batches*
```

### Option 3: Via Prisma (if migrations are enabled)

```bash
# Create migration file
npx prisma migrate dev --name add_performance_indexes

# Apply to production
npx prisma migrate deploy
```

**Note**: This may fail due to pooler restrictions. Use Option 1 or 2 instead.

---

## Rollback Plan

If indexes cause issues (unlikely), they can be safely removed:

```sql
-- Remove stock movement indexes
DROP INDEX IF EXISTS "stock_movements_date_idx";
DROP INDEX IF EXISTS "stock_movements_rawMaterialId_date_idx";
DROP INDEX IF EXISTS "stock_movements_finishedGoodId_date_idx";
DROP INDEX IF EXISTS "stock_movements_type_date_idx";

-- Remove batch indexes
DROP INDEX IF EXISTS "batches_date_idx";
DROP INDEX IF EXISTS "batches_finishedGoodId_idx";
DROP INDEX IF EXISTS "batches_code_idx";
```

---

## Monitoring

After applying indexes, monitor:

1. **Query Performance**: Check slow query logs
2. **Database Size**: Indexes add ~5-10% to table size
3. **Write Performance**: Minimal impact on INSERT/UPDATE operations

Expected metrics:
- Database size increase: ~2-5 MB (negligible)
- Read query improvement: 30-80% faster
- Write query impact: <5% slower (acceptable)

---

## Notes

- All indexes already defined in `prisma/schema.prisma`
- Indexes are **not required** for application to function
- Indexes become more beneficial as data grows (>1000 records)
- No code changes needed after applying indexes
- Safe to apply in production without downtime

---

## Current Schema Reference

From `prisma/schema.prisma`:

```prisma
model StockMovement {
  // ... fields ...

  @@index([date])
  @@index([rawMaterialId, date])
  @@index([finishedGoodId, date])
  @@index([type, date])
  @@map("stock_movements")
}

model Batch {
  // ... fields ...

  @@index([date])
  @@index([finishedGoodId])
  @@map("batches")
}
```

---

**Last Updated**: 2025-10-05
**Status**: Ready for production deployment
**Risk Level**: Low (additive only)
