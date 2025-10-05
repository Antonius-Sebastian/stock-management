# API Reference - Stock Management System

**Version:** 1.0
**Base URL:** `http://localhost:3000/api` (development)
**Last Updated:** October 4, 2025

---

## Table of Contents

1. [Authentication](#authentication)
2. [Raw Materials](#raw-materials)
3. [Finished Goods](#finished-goods)
4. [Stock Movements](#stock-movements)
5. [Batches](#batches)
6. [Reports](#reports)
7. [Users](#users)
8. [Error Handling](#error-handling)

---

## Authentication

All API endpoints (except `/api/auth/*`) require authentication. Use NextAuth.js session-based authentication.

### Login

```http
POST /api/auth/signin
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

**Response (Success):**
```http
HTTP/1.1 200 OK
Set-Cookie: authjs.session-token=...

{
  "url": "/"
}
```

**Response (Error):**
```http
HTTP/1.1 401 Unauthorized

{
  "error": "Invalid credentials"
}
```

---

### Logout

```http
POST /api/auth/signout
```

**Response:**
```http
HTTP/1.1 200 OK

{
  "url": "/login"
}
```

---

### Get Session

```http
GET /api/auth/session
```

**Response:**
```json
{
  "user": {
    "id": "cm123...",
    "username": "admin",
    "name": "Administrator",
    "email": "admin@example.com",
    "role": "ADMIN"
  },
  "expires": "2025-11-04T00:00:00.000Z"
}
```

---

## Raw Materials

### List All Raw Materials

```http
GET /api/raw-materials
Authorization: Required (session cookie)
```

**Response:**
```json
[
  {
    "id": "cm123...",
    "kode": "200HP01",
    "name": "HPMC",
    "currentStock": 500.0,
    "moq": 1000,
    "createdAt": "2025-10-02T00:00:00.000Z",
    "updatedAt": "2025-10-03T00:00:00.000Z"
  }
]
```

---

### Get Single Raw Material

```http
GET /api/raw-materials/{id}
Authorization: Required
```

**Response:**
```json
{
  "id": "cm123...",
  "kode": "200HP01",
  "name": "HPMC",
  "currentStock": 500.0,
  "moq": 1000,
  "createdAt": "2025-10-02T00:00:00.000Z",
  "updatedAt": "2025-10-03T00:00:00.000Z"
}
```

**Error Responses:**
- `404` - Material not found

---

### Create Raw Material

```http
POST /api/raw-materials
Authorization: Required
Content-Type: application/json

{
  "kode": "200HP01",
  "name": "HPMC",
  "moq": 1000
}
```

**Validation Rules:**
- `kode`: Required, must be unique
- `name`: Required, min 1 character
- `moq`: Required, must be >= 1

**Response:**
```json
{
  "id": "cm123...",
  "kode": "200HP01",
  "name": "HPMC",
  "currentStock": 0,
  "moq": 1000,
  "createdAt": "2025-10-02T00:00:00.000Z",
  "updatedAt": "2025-10-02T00:00:00.000Z"
}
```

**Error Responses:**
- `400` - Validation error or duplicate code
- `500` - Server error

---

### Update Raw Material

```http
PUT /api/raw-materials/{id}
Authorization: Required
Content-Type: application/json

{
  "kode": "200HP01-NEW",
  "name": "HPMC Premium",
  "moq": 1500
}
```

**Note:** `currentStock` cannot be updated via this endpoint. Use stock movements instead.

**Response:**
```json
{
  "id": "cm123...",
  "kode": "200HP01-NEW",
  "name": "HPMC Premium",
  "currentStock": 500.0,
  "moq": 1500,
  "createdAt": "2025-10-02T00:00:00.000Z",
  "updatedAt": "2025-10-04T00:00:00.000Z"
}
```

**Error Responses:**
- `400` - Validation error
- `404` - Material not found

---

### Delete Raw Material

```http
DELETE /api/raw-materials/{id}
Authorization: Required
```

**Response:**
```json
{
  "message": "Raw material deleted successfully"
}
```

**Error Responses:**
- `400` - Cannot delete: material has stock movements or is used in batches
- `404` - Material not found

---

### Get Material Movement History

```http
GET /api/raw-materials/{id}/movements
Authorization: Required
```

**Response:**
```json
{
  "material": {
    "id": "cm123...",
    "kode": "200HP01",
    "name": "HPMC",
    "currentStock": 500.0,
    "moq": 1000
  },
  "movements": [
    {
      "id": "cm456...",
      "type": "IN",
      "quantity": 100.0,
      "date": "2025-10-03T00:00:00.000Z",
      "description": "Purchase from supplier",
      "batch": null,
      "runningBalance": 600.0,
      "createdAt": "2025-10-03T05:30:00.000Z"
    },
    {
      "id": "cm789...",
      "type": "OUT",
      "quantity": 50.0,
      "date": "2025-10-02T00:00:00.000Z",
      "description": "Batch production: B-001",
      "batch": {
        "id": "cm999...",
        "code": "B-001"
      },
      "runningBalance": 500.0,
      "createdAt": "2025-10-02T08:00:00.000Z"
    }
  ]
}
```

**Notes:**
- Movements ordered by date DESC (newest first)
- `runningBalance` shows cumulative stock after each movement
- `batch` is null for manual stock entries

---

## Finished Goods

### List All Finished Goods

```http
GET /api/finished-goods
Authorization: Required
```

**Response:**
```json
[
  {
    "id": "cm123...",
    "name": "Lavender Soap Bar",
    "currentStock": 100.0,
    "createdAt": "2025-10-02T00:00:00.000Z",
    "updatedAt": "2025-10-03T00:00:00.000Z"
  }
]
```

---

### Get Single Finished Good

```http
GET /api/finished-goods/{id}
Authorization: Required
```

**Response:**
```json
{
  "id": "cm123...",
  "name": "Lavender Soap Bar",
  "currentStock": 100.0,
  "createdAt": "2025-10-02T00:00:00.000Z",
  "updatedAt": "2025-10-03T00:00:00.000Z"
}
```

---

### Create Finished Good

```http
POST /api/finished-goods
Authorization: Required
Content-Type: application/json

{
  "name": "Rose Soap Bar"
}
```

**Response:**
```json
{
  "id": "cm456...",
  "name": "Rose Soap Bar",
  "currentStock": 0,
  "createdAt": "2025-10-04T00:00:00.000Z",
  "updatedAt": "2025-10-04T00:00:00.000Z"
}
```

---

### Update Finished Good

```http
PUT /api/finished-goods/{id}
Authorization: Required
Content-Type: application/json

{
  "name": "Premium Rose Soap Bar"
}
```

**Response:**
```json
{
  "id": "cm456...",
  "name": "Premium Rose Soap Bar",
  "currentStock": 0,
  "createdAt": "2025-10-04T00:00:00.000Z",
  "updatedAt": "2025-10-04T00:00:00.000Z"
}
```

---

### Delete Finished Good

```http
DELETE /api/finished-goods/{id}
Authorization: Required
```

**Response:**
```json
{
  "message": "Finished good deleted successfully"
}
```

**Error Responses:**
- `400` - Cannot delete: has stock movements or referenced in batches

---

## Stock Movements

### Create Stock Movement

```http
POST /api/stock-movements
Authorization: Required
Content-Type: application/json

{
  "type": "IN",
  "itemType": "raw-material",
  "itemId": "cm123...",
  "quantity": 500,
  "date": "2025-10-04T00:00:00.000Z",
  "description": "Purchase from supplier"
}
```

**Parameters:**
- `type`: "IN" or "OUT"
- `itemType`: "raw-material" or "finished-good"
- `itemId`: ID of the material or product
- `quantity`: Positive number
- `date`: ISO 8601 date string
- `description`: Optional string

**Response:**
```json
{
  "movement": {
    "id": "cm789...",
    "type": "IN",
    "quantity": 500.0,
    "date": "2025-10-04T00:00:00.000Z",
    "description": "Purchase from supplier",
    "rawMaterialId": "cm123...",
    "finishedGoodId": null,
    "batchId": null,
    "createdAt": "2025-10-04T10:00:00.000Z"
  },
  "updatedStock": 500.0
}
```

**Error Responses:**
- `400` - Validation error or insufficient stock (for OUT movements)

---

### Query Stock Movements

```http
GET /api/stock-movements?itemId={id}&date={date}&itemType={type}&movementType={type}
Authorization: Required
```

**Query Parameters:**
- `itemId`: Required - Material or product ID
- `date`: Required - ISO 8601 date
- `itemType`: Required - "raw-material" or "finished-good"
- `movementType`: Required - "IN" or "OUT"

**Response:**
```json
{
  "movements": [
    {
      "id": "cm123...",
      "type": "IN",
      "quantity": 100.0,
      "date": "2025-10-04T00:00:00.000Z",
      "description": "..."
    }
  ],
  "totalQuantity": 100.0
}
```

---

### Update Movements by Date

```http
PUT /api/stock-movements/by-date
Authorization: Required
Content-Type: application/json

{
  "itemId": "cm123...",
  "date": "2025-10-04T00:00:00.000Z",
  "itemType": "raw-material",
  "movementType": "IN",
  "quantity": 150
}
```

**Behavior:**
1. Deletes all existing movements for that item/date/type
2. Creates single new movement with specified quantity
3. Updates item stock based on difference

**Response:**
```json
{
  "message": "Stock movement updated successfully",
  "oldTotal": 100.0,
  "newTotal": 150.0,
  "difference": 50.0
}
```

**Error Responses:**
- `400` - Would result in negative stock

---

### Delete Movements by Date

```http
DELETE /api/stock-movements/by-date?itemId={id}&date={date}&itemType={type}&movementType={type}
Authorization: Required
```

**Response:**
```json
{
  "message": "Stock movements deleted successfully",
  "deletedCount": 1,
  "restoredQuantity": 100.0
}
```

**Error Responses:**
- `400` - Would result in negative stock

---

## Batches

### List All Batches

```http
GET /api/batches
Authorization: Required
```

**Response:**
```json
[
  {
    "id": "cm123...",
    "code": "B-001",
    "date": "2025-10-03T00:00:00.000Z",
    "description": "Regular production",
    "finishedGoodId": "cm456...",
    "createdAt": "2025-10-03T00:00:00.000Z",
    "updatedAt": "2025-10-03T00:00:00.000Z",
    "finishedGood": {
      "id": "cm456...",
      "name": "Lavender Soap Bar"
    },
    "batchUsages": [
      {
        "id": "cm789...",
        "quantity": 100.0,
        "rawMaterial": {
          "id": "cm111...",
          "kode": "200HP01",
          "name": "HPMC"
        }
      }
    ]
  }
]
```

---

### Get Single Batch

```http
GET /api/batches/{id}
Authorization: Required
```

**Response:**
```json
{
  "id": "cm123...",
  "code": "B-001",
  "date": "2025-10-03T00:00:00.000Z",
  "description": "Regular production",
  "finishedGoodId": "cm456...",
  "createdAt": "2025-10-03T00:00:00.000Z",
  "updatedAt": "2025-10-03T00:00:00.000Z",
  "finishedGood": {
    "id": "cm456...",
    "name": "Lavender Soap Bar",
    "currentStock": 100.0
  },
  "batchUsages": [
    {
      "id": "cm789...",
      "quantity": 100.0,
      "rawMaterial": {
        "id": "cm111...",
        "kode": "200HP01",
        "name": "HPMC",
        "currentStock": 400.0
      }
    }
  ]
}
```

---

### Create Batch

```http
POST /api/batches
Authorization: Required
Content-Type: application/json

{
  "code": "B-001",
  "date": "2025-10-04T00:00:00.000Z",
  "description": "Regular production",
  "finishedGoodId": "cm456...",
  "materials": [
    {
      "rawMaterialId": "cm111...",
      "quantity": 100
    },
    {
      "rawMaterialId": "cm222...",
      "quantity": 50
    }
  ]
}
```

**Validation:**
- `code`: Required, must be unique
- `date`: Required
- `finishedGoodId`: Required
- `materials`: Required, at least 1 material
- Each material must have sufficient stock

**Behavior:**
1. Validates all materials have sufficient stock
2. Creates batch record
3. Creates batch usage records
4. Creates stock OUT movements for each material
5. Updates raw material stocks
6. All operations in a transaction (atomic)

**Response:**
```json
{
  "id": "cm123...",
  "code": "B-001",
  "date": "2025-10-04T00:00:00.000Z",
  "description": "Regular production",
  "finishedGoodId": "cm456...",
  "createdAt": "2025-10-04T10:00:00.000Z",
  "updatedAt": "2025-10-04T10:00:00.000Z",
  "finishedGood": {...},
  "batchUsages": [...]
}
```

**Error Responses:**
- `400` - Validation error, duplicate code, or insufficient stock
  ```json
  {
    "error": "Insufficient stock for HPMC. Available: 50, Required: 100"
  }
  ```

---

### Update Batch

```http
PUT /api/batches/{id}
Authorization: Required
Content-Type: application/json

{
  "code": "B-001-UPDATED",
  "date": "2025-10-04T00:00:00.000Z",
  "description": "Updated description",
  "finishedGoodId": "cm789..."
}
```

**Note:** Materials cannot be updated. Only code, date, description, and finished good can be changed.

**Response:**
```json
{
  "id": "cm123...",
  "code": "B-001-UPDATED",
  "date": "2025-10-04T00:00:00.000Z",
  "description": "Updated description",
  "finishedGoodId": "cm789...",
  "createdAt": "2025-10-03T00:00:00.000Z",
  "updatedAt": "2025-10-04T10:00:00.000Z",
  "finishedGood": {...},
  "batchUsages": [...]
}
```

---

### Delete Batch

```http
DELETE /api/batches/{id}
Authorization: Required
```

**Behavior:**
1. Deletes associated stock movements
2. Deletes batch usage records
3. Deletes batch record
4. Restores raw material stocks
5. All operations in a transaction

**Response:**
```json
{
  "message": "Batch deleted successfully and stock restored"
}
```

**Error Responses:**
- `404` - Batch not found

---

## Reports

### Get Stock Report

```http
GET /api/reports/stock?year={year}&month={month}&type={type}&dataType={dataType}
Authorization: Required
```

**Query Parameters:**
- `year`: Required - Integer (e.g., 2025)
- `month`: Required - Integer 1-12
- `type`: Required - "raw-materials" or "finished-goods"
- `dataType`: Required - "stok-awal" | "stok-masuk" | "stok-keluar" | "stok-sisa"

**Example:**
```http
GET /api/reports/stock?year=2025&month=10&type=raw-materials&dataType=stok-masuk
```

**Response:**
```json
{
  "data": [
    {
      "id": "cm123...",
      "code": "200HP01",
      "name": "HPMC",
      "1": 0,
      "2": 500.0,
      "3": 0,
      "4": 200.0,
      "5": 0,
      ...
      "31": 0
    }
  ],
  "meta": {
    "year": 2025,
    "month": 10,
    "type": "raw-materials",
    "dataType": "stok-masuk",
    "daysInMonth": 31,
    "currentDay": 4
  }
}
```

**Data Type Meanings:**
- `stok-awal`: Stock at beginning of day
- `stok-masuk`: Total IN movements for day
- `stok-keluar`: Total OUT movements for day
- `stok-sisa`: Stock at end of day

**Notes:**
- For current month, only shows days up to today
- For past months, shows all days
- Columns are day numbers (1-31)
- Values represent quantities based on data type

---

## Users

⚠️ **All user endpoints require authentication**

### List All Users

```http
GET /api/users
Authorization: Required
```

**Response:**
```json
[
  {
    "id": "cm123...",
    "username": "admin",
    "email": "admin@example.com",
    "name": "Administrator",
    "role": "ADMIN",
    "isActive": true,
    "createdAt": "2025-10-02T00:00:00.000Z"
  }
]
```

**Note:** Password field is never returned in responses.

---

### Get Single User

```http
GET /api/users/{id}
Authorization: Required
```

**Response:**
```json
{
  "id": "cm123...",
  "username": "admin",
  "email": "admin@example.com",
  "name": "Administrator",
  "role": "ADMIN",
  "isActive": true,
  "createdAt": "2025-10-02T00:00:00.000Z"
}
```

---

### Create User

```http
POST /api/users
Authorization: Required
Content-Type: application/json

{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "name": "New User",
  "role": "OFFICE"
}
```

**Validation:**
- `username`: Min 3 characters, must be unique
- `email`: Valid email format, must be unique (optional)
- `password`: Min 6 characters
- `name`: Required
- `role`: "ADMIN" | "FACTORY" | "OFFICE"

**Response:**
```json
{
  "id": "cm456...",
  "username": "newuser",
  "email": "user@example.com",
  "name": "New User",
  "role": "OFFICE",
  "isActive": true,
  "createdAt": "2025-10-04T10:00:00.000Z"
}
```

**Error Responses:**
- `400` - Validation error or duplicate username/email

---

### Update User

```http
PUT /api/users/{id}
Authorization: Required
Content-Type: application/json

{
  "username": "updateduser",
  "email": "updated@example.com",
  "password": "newpassword123",
  "name": "Updated Name",
  "role": "ADMIN",
  "isActive": false
}
```

**Note:** All fields are optional. Only provided fields will be updated.

**Response:**
```json
{
  "id": "cm456...",
  "username": "updateduser",
  "email": "updated@example.com",
  "name": "Updated Name",
  "role": "ADMIN",
  "isActive": false,
  "createdAt": "2025-10-04T10:00:00.000Z"
}
```

---

### Delete User

```http
DELETE /api/users/{id}
Authorization: Required
```

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

**Error Responses:**
- `400` - Cannot delete last admin user
- `404` - User not found

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST (resource created) |
| 400 | Bad Request | Validation errors, business logic errors |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Authenticated but not authorized (future) |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Unexpected server errors |

### Common Error Examples

#### Validation Error
```http
HTTP/1.1 400 Bad Request

{
  "error": "Code is required"
}
```

#### Duplicate Error
```http
HTTP/1.1 400 Bad Request

{
  "error": "Material code '200HP01' already exists"
}
```

#### Not Found
```http
HTTP/1.1 404 Not Found

{
  "error": "Raw material not found"
}
```

#### Insufficient Stock
```http
HTTP/1.1 400 Bad Request

{
  "error": "Insufficient stock. Available: 50, Requested: 100"
}
```

#### Unauthorized
```http
HTTP/1.1 401 Unauthorized

{
  "error": "Unauthorized"
}
```

---

## Rate Limiting

**Current Status:** Not implemented

**Recommended for Production:**
- Implement rate limiting on authentication endpoints
- Suggested: 5 failed login attempts per 15 minutes
- API endpoints: 100 requests per minute per user

---

## CORS

**Current Status:** Same-origin only

For cross-origin requests, configure in `next.config.js`:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
        ],
      },
    ]
  },
}
```

---

## Webhooks

**Status:** Not implemented

**Planned for Future:**
- Webhook support for stock level alerts
- Batch completion notifications
- Low stock warnings

---

## API Versioning

**Current Version:** v1 (implicit)

**URL Structure:** `/api/*` (no version prefix for MVP)

**Future Versioning Strategy:**
- Add version prefix: `/api/v1/*`, `/api/v2/*`
- Maintain backward compatibility for at least 6 months
- Deprecation warnings in response headers

---

## Testing the API

### Using cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' \
  -c cookies.txt

# Create material
curl -X POST http://localhost:3000/api/raw-materials \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"kode":"TEST-001","name":"Test Material","moq":100}'

# List materials
curl http://localhost:3000/api/raw-materials \
  -b cookies.txt
```

### Using Postman

1. Import OpenAPI/Swagger spec (if available)
2. Or create requests manually
3. Set up environment variables
4. Use session cookies for authentication

### Using JavaScript Fetch

```javascript
// Login
const response = await fetch('/api/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'password123'
  }),
  credentials: 'include'
})

// Create material
const material = await fetch('/api/raw-materials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    kode: 'TEST-001',
    name: 'Test Material',
    moq: 100
  })
})
```

---

## Support

**Documentation:**
- `STATUS.md` - Project status
- `DEPLOYMENT.md` - Deployment guide
- `KNOWN_ISSUES.md` - Known issues
- `TESTING_GUIDE.md` - Testing procedures

**Contact:**
- GitHub Issues: Bug reports and feature requests
- Email: support@yourdomain.com

---

**Last Updated:** October 4, 2025
**API Version:** 1.0
**Base URL:** `/api`
