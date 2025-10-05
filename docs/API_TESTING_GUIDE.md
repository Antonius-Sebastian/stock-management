# API Testing Guide

**Version**: 1.0.0
**Last Updated**: 2025-10-05

---

## Overview

This guide provides curl commands and examples for testing all API endpoints.

---

## Prerequisites

1. **Start the dev server**:
   ```bash
   npm run dev
   ```

2. **Get authentication token**:
   You'll need to login first and extract the session cookie.

---

## Health Check (Public)

### Check System Health

```bash
curl http://localhost:3001/api/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-05T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "development",
  "uptime": 123.456,
  "database": {
    "status": "connected",
    "responseTime": "15ms"
  },
  "stats": {
    "users": 3,
    "rawMaterials": 10,
    "batches": 5
  },
  "performance": {
    "totalResponseTime": "45ms"
  }
}
```

---

## Authentication

### Login

```bash
# Login request (get session cookie)
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type": application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }' \
  -c cookies.txt
```

### Using Session Cookie

For all subsequent requests:
```bash
curl http://localhost:3001/api/raw-materials \
  -b cookies.txt
```

---

## Raw Materials API

### List All Raw Materials

```bash
# Without pagination
curl http://localhost:3001/api/raw-materials \
  -b cookies.txt

# With pagination
curl "http://localhost:3001/api/raw-materials?page=1&limit=10" \
  -b cookies.txt
```

**Response (without pagination)**:
```json
[
  {
    "id": "clxxxx",
    "kode": "RM001",
    "name": "Material 1",
    "currentStock": 100,
    "moq": 50,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

**Response (with pagination)**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasMore": true
  }
}
```

### Create Raw Material

```bash
curl -X POST http://localhost:3001/api/raw-materials \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "kode": "RM999",
    "name": "Test Material",
    "moq": 100
  }'
```

**Success Response** (201):
```json
{
  "id": "clxxxx",
  "kode": "RM999",
  "name": "Test Material",
  "currentStock": 0,
  "moq": 100,
  "createdAt": "2025-10-05T00:00:00.000Z",
  "updatedAt": "2025-10-05T00:00:00.000Z"
}
```

**Error Response** (400):
```json
{
  "error": "Material code \"RM999\" already exists"
}
```

### Get Single Raw Material

```bash
curl http://localhost:3001/api/raw-materials/clxxxx \
  -b cookies.txt
```

### Update Raw Material

```bash
curl -X PUT http://localhost:3001/api/raw-materials/clxxxx \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Material Name",
    "moq": 200
  }'
```

### Delete Raw Material

```bash
curl -X DELETE http://localhost:3001/api/raw-materials/clxxxx \
  -b cookies.txt
```

### Get Movement History

```bash
curl http://localhost:3001/api/raw-materials/clxxxx/movements \
  -b cookies.txt
```

**Response**:
```json
{
  "material": {
    "id": "clxxxx",
    "kode": "RM001",
    "name": "Material 1",
    "currentStock": 100,
    "moq": 50
  },
  "movements": [
    {
      "id": "clxxxx",
      "type": "IN",
      "quantity": 100,
      "date": "2025-01-01T00:00:00.000Z",
      "description": "Initial stock",
      "runningBalance": 100,
      "batch": null
    }
  ]
}
```

---

## Finished Goods API

### List All Finished Goods

```bash
# Without pagination
curl http://localhost:3001/api/finished-goods \
  -b cookies.txt

# With pagination
curl "http://localhost:3001/api/finished-goods?page=1&limit=10" \
  -b cookies.txt
```

### Create Finished Good

```bash
curl -X POST http://localhost:3001/api/finished-goods \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Test Product"
  }'
```

### Update Finished Good

```bash
curl -X PUT http://localhost:3001/api/finished-goods/clxxxx \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Product Name"
  }'
```

### Delete Finished Good

```bash
curl -X DELETE http://localhost:3001/api/finished-goods/clxxxx \
  -b cookies.txt
```

---

## Batches API

### List All Batches

```bash
# Without pagination
curl http://localhost:3001/api/batches \
  -b cookies.txt

# With pagination
curl "http://localhost:3001/api/batches?page=1&limit=10" \
  -b cookies.txt
```

### Create Batch

```bash
curl -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "code": "BATCH001",
    "date": "2025-10-05T00:00:00.000Z",
    "description": "Test batch",
    "finishedGoodId": "clxxxx",
    "materials": [
      {
        "rawMaterialId": "clxxxx",
        "quantity": 10
      },
      {
        "rawMaterialId": "clyyyy",
        "quantity": 5
      }
    ]
  }'
```

**Success Response** (201):
```json
{
  "id": "clxxxx",
  "code": "BATCH001",
  "date": "2025-10-05T00:00:00.000Z",
  "description": "Test batch",
  "finishedGoodId": "clxxxx",
  "createdAt": "2025-10-05T00:00:00.000Z",
  "updatedAt": "2025-10-05T00:00:00.000Z"
}
```

**Error Response - Insufficient Stock** (400):
```json
{
  "error": "Insufficient stock for Material 1. Available: 5, Required: 10"
}
```

**Error Response - Duplicate Materials** (400):
```json
{
  "error": "Duplicate materials found in batch. Each material can only be used once per batch."
}
```

### Update Batch

```bash
curl -X PUT http://localhost:3001/api/batches/clxxxx \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "code": "BATCH001-UPDATED",
    "date": "2025-10-05T00:00:00.000Z",
    "description": "Updated description",
    "finishedGoodId": "clxxxx"
  }'
```

**Note**: Material usage cannot be updated after batch creation.

### Delete Batch

```bash
curl -X DELETE http://localhost:3001/api/batches/clxxxx \
  -b cookies.txt
```

**Note**: Stock will be restored when batch is deleted.

---

## Stock Movements API

### Create Stock Movement

```bash
curl -X POST http://localhost:3001/api/stock-movements \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "type": "IN",
    "quantity": 50,
    "date": "2025-10-05T00:00:00.000Z",
    "description": "Stock received",
    "rawMaterialId": "clxxxx"
  }'
```

**For finished goods**:
```json
{
  "type": "OUT",
  "quantity": 10,
  "date": "2025-10-05T00:00:00.000Z",
  "description": "Sold to customer",
  "finishedGoodId": "clxxxx"
}
```

---

## Reports API

### Generate Stock Report

```bash
curl "http://localhost:3001/api/reports/stock?year=2025&month=10&type=raw-materials" \
  -b cookies.txt
```

**Parameters**:
- `year`: Year (e.g., 2025)
- `month`: Month (1-12)
- `type`: `raw-materials` or `finished-goods`

**Response**:
```json
{
  "items": [
    {
      "id": "clxxxx",
      "kode": "RM001",
      "name": "Material 1",
      "dailyData": {
        "1": { "stokAwal": 100, "stokMasuk": 50, "stokKeluar": 20, "stokSisa": 130 },
        "2": { "stokAwal": 130, "stokMasuk": 0, "stokKeluar": 10, "stokSisa": 120 },
        ...
      }
    }
  ],
  "metadata": {
    "year": "2025",
    "month": "10",
    "type": "raw-materials",
    "daysInMonth": 31
  }
}
```

### Export to Excel

```bash
curl "http://localhost:3001/api/reports/export?year=2025&month=10&type=raw-materials" \
  -b cookies.txt \
  --output report.xlsx
```

**Opens in Excel** with color-coded sheets for each data type.

---

## Users API (Admin Only)

### List Users

```bash
curl http://localhost:3001/api/users \
  -b cookies.txt
```

### Create User

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "username": "newuser",
    "password": "SecurePass123",
    "name": "New User",
    "email": "user@example.com",
    "role": "MANAGER"
  }'
```

**Roles**: `ADMIN`, `MANAGER`, `FACTORY`

**Password Requirements**:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Update User

```bash
curl -X PUT http://localhost:3001/api/users/clxxxx \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Name",
    "role": "ADMIN",
    "isActive": true
  }'
```

### Delete User

```bash
curl -X DELETE http://localhost:3001/api/users/clxxxx \
  -b cookies.txt
```

**Restrictions**:
- Cannot delete self
- Cannot delete last admin

---

## Testing Scenarios

### Test Pagination

```bash
# Get total count
TOTAL=$(curl -s "http://localhost:3001/api/raw-materials?page=1&limit=10" -b cookies.txt | jq '.pagination.total')

# Calculate pages
PAGES=$(echo "($TOTAL + 9) / 10" | bc)

# Fetch all pages
for i in $(seq 1 $PAGES); do
  echo "Fetching page $i..."
  curl -s "http://localhost:3001/api/raw-materials?page=$i&limit=10" -b cookies.txt | jq '.data | length'
done
```

### Test Race Condition

```bash
# Create two batches simultaneously
curl -X POST http://localhost:3001/api/batches -b cookies.txt -d '{...}' &
curl -X POST http://localhost:3001/api/batches -b cookies.txt -d '{...}' &
wait

# One should succeed, one should fail with insufficient stock
```

### Test Validation

```bash
# Test weak password
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "username": "test",
    "password": "weak",
    "name": "Test",
    "role": "MANAGER"
  }'
# Expected: 400 with password validation error

# Test duplicate material in batch
curl -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "code": "TEST",
    "finishedGoodId": "clxxxx",
    "materials": [
      {"rawMaterialId": "clxxxx", "quantity": 10},
      {"rawMaterialId": "clxxxx", "quantity": 5}
    ]
  }'
# Expected: 400 with duplicate materials error
```

---

## Automated Testing Script

Save as `test-api.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3001"
COOKIE_FILE="cookies.txt"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Test counter
PASSED=0
FAILED=0

test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local expected_status=$4
  local data=$5

  echo -n "Testing $name... "

  if [ "$method" = "POST" ] || [ "$method" = "PUT" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -b $COOKIE_FILE \
      -d "$data")
  else
    status=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$endpoint" \
      -b $COOKIE_FILE)
  fi

  if [ "$status" -eq "$expected_status" ]; then
    echo -e "${GREEN}PASS${NC} ($status)"
    ((PASSED++))
  else
    echo -e "${RED}FAIL${NC} (expected $expected_status, got $status)"
    ((FAILED++))
  fi
}

# Run tests
echo "=== API Tests ==="
echo

test_endpoint "Health check" "GET" "/api/health" 200
test_endpoint "Raw materials list" "GET" "/api/raw-materials" 200
test_endpoint "Finished goods list" "GET" "/api/finished-goods" 200
test_endpoint "Batches list" "GET" "/api/batches" 200

echo
echo "=== Results ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
```

Run with:
```bash
chmod +x test-api.sh
./test-api.sh
```

---

## Troubleshooting

### 401 Unauthorized
- Check if you're logged in
- Verify cookie file exists
- Try logging in again

### 403 Forbidden
- Check user role permissions
- Verify RBAC rules

### 500 Internal Server Error
- Check server logs
- Verify database connection
- Check for missing environment variables

---

**Last Updated**: 2025-10-05
**Version**: 1.0.0
