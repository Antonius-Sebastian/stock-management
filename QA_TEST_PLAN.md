# QA Test Plan - Stock Management System

**Date**: 2025-10-05
**Version**: 1.0.0
**Tester**: Automated QA
**Environment**: Development/Staging

---

## Test Overview

This document provides a comprehensive test plan for verifying all functionality, security, and performance improvements implemented across Phases 1-3.

---

## Test Categories

1. [Authentication & Authorization](#1-authentication--authorization)
2. [API Endpoints](#2-api-endpoints)
3. [Data Validation](#3-data-validation)
4. [Pagination](#4-pagination)
5. [Business Logic](#5-business-logic)
6. [Security](#6-security)
7. [Performance](#7-performance)
8. [Error Handling](#8-error-handling)
9. [UI/UX](#9-uiux)
10. [Database Integrity](#10-database-integrity)

---

## 1. Authentication & Authorization

### 1.1 Login Tests

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| AUTH-001 | Valid login (admin) | 1. Navigate to /login<br>2. Enter admin credentials<br>3. Submit | Redirected to dashboard | ⏳ |
| AUTH-002 | Valid login (manager) | 1. Enter manager credentials<br>2. Submit | Redirected to dashboard | ⏳ |
| AUTH-003 | Valid login (factory) | 1. Enter factory credentials<br>2. Submit | Redirected to dashboard | ⏳ |
| AUTH-004 | Invalid password | 1. Enter wrong password<br>2. Submit | Error message shown | ⏳ |
| AUTH-005 | Non-existent user | 1. Enter fake username<br>2. Submit | Error message shown | ⏳ |
| AUTH-006 | Logout | 1. Click logout<br>2. Verify | Redirected to login | ⏳ |

### 1.2 Session Tests

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| AUTH-007 | Session persistence | 1. Login<br>2. Refresh page | Still logged in | ⏳ |
| AUTH-008 | Unauthenticated access | 1. Logout<br>2. Try to access /batches | Redirected to login | ⏳ |
| AUTH-009 | API without auth | `curl /api/raw-materials` | 401 Unauthorized | ⏳ |

### 1.3 RBAC Tests

| Test ID | Test Case | Role | Expected Result | Status |
|---------|-----------|------|-----------------|--------|
| RBAC-001 | Admin can manage users | ADMIN | Access granted | ⏳ |
| RBAC-002 | Manager cannot manage users | MANAGER | 403 Forbidden | ⏳ |
| RBAC-003 | Factory cannot manage users | FACTORY | 403 Forbidden | ⏳ |
| RBAC-004 | Admin can create batches | ADMIN | Success | ⏳ |
| RBAC-005 | Factory can create batches | FACTORY | Success | ⏳ |
| RBAC-006 | Manager cannot create batches | MANAGER | 403 Forbidden | ⏳ |
| RBAC-007 | All roles can view reports | ALL | Access granted | ⏳ |
| RBAC-008 | Admin cannot delete self | ADMIN | 400 Bad Request | ⏳ |

---

## 2. API Endpoints

### 2.1 Raw Materials API

| Test ID | Endpoint | Method | Body | Expected Status | Expected Response | Status |
|---------|----------|--------|------|-----------------|-------------------|--------|
| API-001 | `/api/raw-materials` | GET | - | 200 | Array of materials | ⏳ |
| API-002 | `/api/raw-materials` | POST | Valid data | 201 | Created material | ⏳ |
| API-003 | `/api/raw-materials` | POST | Duplicate kode | 400 | Error message | ⏳ |
| API-004 | `/api/raw-materials` | POST | Missing name | 400 | Validation error | ⏳ |
| API-005 | `/api/raw-materials/[id]` | GET | - | 200 | Material object | ⏳ |
| API-006 | `/api/raw-materials/[id]` | GET | Invalid ID | 404 | Not found | ⏳ |
| API-007 | `/api/raw-materials/[id]` | PUT | Valid data | 200 | Updated material | ⏳ |
| API-008 | `/api/raw-materials/[id]` | PUT | Duplicate name | 400 | Error message | ⏳ |
| API-009 | `/api/raw-materials/[id]` | DELETE | - | 200 | Success message | ⏳ |
| API-010 | `/api/raw-materials/[id]/movements` | GET | - | 200 | Movement history | ⏳ |

### 2.2 Finished Goods API

| Test ID | Endpoint | Method | Expected Status | Status |
|---------|----------|--------|-----------------|--------|
| API-011 | `/api/finished-goods` | GET | 200 | ⏳ |
| API-012 | `/api/finished-goods` | POST | 201 | ⏳ |
| API-013 | `/api/finished-goods` | POST (duplicate) | 400 | ⏳ |
| API-014 | `/api/finished-goods/[id]` | GET | 200 | ⏳ |
| API-015 | `/api/finished-goods/[id]` | PUT | 200 | ⏳ |
| API-016 | `/api/finished-goods/[id]` | PUT (duplicate) | 400 | ⏳ |
| API-017 | `/api/finished-goods/[id]` | DELETE | 200 | ⏳ |

### 2.3 Batches API

| Test ID | Endpoint | Method | Expected Status | Status |
|---------|----------|--------|-----------------|--------|
| API-018 | `/api/batches` | GET | 200 | ⏳ |
| API-019 | `/api/batches` | POST | 201 | ⏳ |
| API-020 | `/api/batches` | POST (insufficient stock) | 400 | ⏳ |
| API-021 | `/api/batches` | POST (duplicate materials) | 400 | ⏳ |
| API-022 | `/api/batches/[id]` | GET | 200 | ⏳ |
| API-023 | `/api/batches/[id]` | PUT | 200 | ⏳ |
| API-024 | `/api/batches/[id]` | DELETE | 200 | ⏳ |

### 2.4 Users API

| Test ID | Endpoint | Method | Expected Status | Status |
|---------|----------|--------|-----------------|--------|
| API-025 | `/api/users` | GET (as ADMIN) | 200 | ⏳ |
| API-026 | `/api/users` | GET (as MANAGER) | 403 | ⏳ |
| API-027 | `/api/users` | POST | 201 | ⏳ |
| API-028 | `/api/users` | POST (weak password) | 400 | ⏳ |
| API-029 | `/api/users/[id]` | PUT | 200 | ⏳ |
| API-030 | `/api/users/[id]` | DELETE (self) | 400 | ⏳ |
| API-031 | `/api/users/[id]` | DELETE (last admin) | 400 | ⏳ |

---

## 3. Data Validation

### 3.1 Raw Material Validation

| Test ID | Field | Invalid Value | Expected Error | Status |
|---------|-------|---------------|----------------|--------|
| VAL-001 | kode | Empty string | "Code is required" | ⏳ |
| VAL-002 | name | Empty string | "Name is required" | ⏳ |
| VAL-003 | moq | 0 | "MOQ must be at least 1" | ⏳ |
| VAL-004 | moq | -5 | "MOQ must be at least 1" | ⏳ |
| VAL-005 | moq | "abc" | Type error | ⏳ |

### 3.2 Batch Validation

| Test ID | Field | Invalid Value | Expected Error | Status |
|---------|-------|---------------|----------------|--------|
| VAL-006 | code | Empty string | "Batch code is required" | ⏳ |
| VAL-007 | materials | Empty array | "At least one raw material is required" | ⏳ |
| VAL-008 | materials | Duplicate IDs | "Duplicate materials found in batch" | ⏳ |
| VAL-009 | quantity | 0 | "Quantity must be positive" | ⏳ |
| VAL-010 | quantity | -10 | "Quantity must be positive" | ⏳ |

### 3.3 User Validation

| Test ID | Field | Invalid Value | Expected Error | Status |
|---------|-------|---------------|----------------|--------|
| VAL-011 | username | "ab" | "Username must be at least 3 characters" | ⏳ |
| VAL-012 | password | "short" | "Password must be at least 8 characters" | ⏳ |
| VAL-013 | password | "lowercase123" | "Password must contain uppercase letter" | ⏳ |
| VAL-014 | password | "UPPERCASE123" | "Password must contain lowercase letter" | ⏳ |
| VAL-015 | password | "NoNumbers" | "Password must contain number" | ⏳ |
| VAL-016 | email | "notanemail" | "Invalid email" | ⏳ |

---

## 4. Pagination

### 4.1 Raw Materials Pagination

| Test ID | Query Params | Expected Behavior | Status |
|---------|--------------|-------------------|--------|
| PAG-001 | None | Returns all materials (array) | ⏳ |
| PAG-002 | `?page=1&limit=10` | Returns paginated object with 10 items | ⏳ |
| PAG-003 | `?page=2&limit=10` | Returns next 10 items | ⏳ |
| PAG-004 | `?page=1&limit=1000` | Limit capped at 100 | ⏳ |
| PAG-005 | `?page=-1&limit=10` | Page defaults to 1 | ⏳ |
| PAG-006 | `?page=1&limit=0` | Limit defaults to 1 | ⏳ |

### 4.2 Pagination Metadata

| Test ID | Field | Expected | Status |
|---------|-------|----------|--------|
| PAG-007 | pagination.page | Current page number | ⏳ |
| PAG-008 | pagination.limit | Items per page | ⏳ |
| PAG-009 | pagination.total | Total count from DB | ⏳ |
| PAG-010 | pagination.totalPages | Math.ceil(total/limit) | ⏳ |
| PAG-011 | pagination.hasMore | True if more pages | ⏳ |

---

## 5. Business Logic

### 5.1 Batch Creation (Stock Deduction)

| Test ID | Scenario | Expected Result | Status |
|---------|----------|-----------------|--------|
| BIZ-001 | Create batch with sufficient stock | Stock deducted, batch created | ⏳ |
| BIZ-002 | Create batch with insufficient stock | Error, no changes | ⏳ |
| BIZ-003 | Concurrent batch creation | Only one succeeds (row locking) | ⏳ |
| BIZ-004 | Batch with multiple materials | All materials deducted | ⏳ |
| BIZ-005 | Verify stock movements created | One OUT movement per material | ⏳ |

### 5.2 Batch Deletion (Stock Restoration)

| Test ID | Scenario | Expected Result | Status |
|---------|----------|-----------------|--------|
| BIZ-006 | Delete batch | Stock restored | ⏳ |
| BIZ-007 | Verify movements deleted | Movements removed | ⏳ |
| BIZ-008 | Verify stock matches | currentStock equals calculated | ⏳ |

### 5.3 Stock Calculations

| Test ID | Scenario | Expected Result | Status |
|---------|----------|-----------------|--------|
| BIZ-009 | Stock IN movement | currentStock increases | ⏳ |
| BIZ-010 | Stock OUT movement | currentStock decreases | ⏳ |
| BIZ-011 | OUT movement > current stock | Error, no changes | ⏳ |
| BIZ-012 | Movement history running balance | Accurate cumulative totals | ⏳ |

### 5.4 Monthly Reports

| Test ID | Scenario | Expected Result | Status |
|---------|----------|-----------------|--------|
| BIZ-013 | Generate current month | Shows accurate data | ⏳ |
| BIZ-014 | Generate past month | Historical data correct | ⏳ |
| BIZ-015 | Stok Awal calculation | Previous month's stok sisa | ⏳ |
| BIZ-016 | Stok Masuk aggregation | Sum of IN movements | ⏳ |
| BIZ-017 | Stok Keluar aggregation | Sum of OUT movements | ⏳ |
| BIZ-018 | Stok Sisa calculation | Awal + Masuk - Keluar | ⏳ |

---

## 6. Security

### 6.1 SQL Injection Prevention

| Test ID | Attack Vector | Expected Result | Status |
|---------|---------------|-----------------|--------|
| SEC-001 | `' OR '1'='1` in ID | Validation error or 404 | ⏳ |
| SEC-002 | `'; DROP TABLE users--` | Validation error | ⏳ |
| SEC-003 | `<script>alert(1)</script>` | Escaped or rejected | ⏳ |

### 6.2 Authentication Bypass

| Test ID | Attack Vector | Expected Result | Status |
|---------|---------------|-----------------|--------|
| SEC-004 | Direct API call without cookie | 401 Unauthorized | ⏳ |
| SEC-005 | Expired JWT token | 401 Unauthorized | ⏳ |
| SEC-006 | Modified JWT token | 401 Unauthorized | ⏳ |

### 6.3 Authorization Bypass

| Test ID | Attack Vector | Expected Result | Status |
|---------|---------------|-----------------|--------|
| SEC-007 | FACTORY deletes user | 403 Forbidden | ⏳ |
| SEC-008 | MANAGER creates batch | 403 Forbidden | ⏳ |
| SEC-009 | Manipulate other user's data | 403 or 404 | ⏳ |

### 6.4 Password Security

| Test ID | Scenario | Expected Result | Status |
|---------|----------|-----------------|--------|
| SEC-010 | Password stored in DB | Bcrypt hashed | ⏳ |
| SEC-011 | Password in API response | Never exposed | ⏳ |
| SEC-012 | Weak password submission | Rejected | ⏳ |

---

## 7. Performance

### 7.1 Query Performance

| Test ID | Query | Without Index | With Index | Target | Status |
|---------|-------|---------------|------------|--------|--------|
| PERF-001 | Monthly stock report | N/A | <200ms | <200ms | ⏳ |
| PERF-002 | Material movement history | N/A | <100ms | <100ms | ⏳ |
| PERF-003 | Batch listing (50 items) | N/A | <150ms | <150ms | ⏳ |
| PERF-004 | Stock movements by date | N/A | <100ms | <100ms | ⏳ |

### 7.2 Bundle Size

| Test ID | Metric | Current | Target | Status |
|---------|--------|---------|--------|--------|
| PERF-005 | First Load JS | 163 KB | <200 KB | ✅ |
| PERF-006 | Middleware | 162 KB | <200 KB | ✅ |
| PERF-007 | Largest page | 306 KB | <400 KB | ✅ |

### 7.3 N+1 Queries

| Test ID | Endpoint | Queries | Expected | Status |
|---------|----------|---------|----------|--------|
| PERF-008 | `/api/batches` | N/A | 2 queries max | ⏳ |
| PERF-009 | `/api/batches?page=1` | N/A | 2 queries (data + count) | ⏳ |

---

## 8. Error Handling

### 8.1 API Error Responses

| Test ID | Error Type | Expected Format | Status |
|---------|-----------|-----------------|--------|
| ERR-001 | Validation error | `{error: string}` with 400 | ⏳ |
| ERR-002 | Not found | `{error: string}` with 404 | ⏳ |
| ERR-003 | Unauthorized | `{error: string}` with 401 | ⏳ |
| ERR-004 | Forbidden | `{error: string}` with 403 | ⏳ |
| ERR-005 | Server error | `{error: string}` with 500 | ⏳ |

### 8.2 Frontend Error Handling

| Test ID | Scenario | Expected Result | Status |
|---------|----------|-----------------|--------|
| ERR-006 | Component throws error | Error boundary catches | ⏳ |
| ERR-007 | Network error | Toast notification shown | ⏳ |
| ERR-008 | Validation error | Form shows error message | ⏳ |

### 8.3 Memory Leaks

| Test ID | Scenario | Expected Result | Status |
|---------|----------|-----------------|--------|
| ERR-009 | Open/close dialog 10x | No memory increase | ⏳ |
| ERR-010 | Navigate between pages | Cleanup executed | ⏳ |
| ERR-011 | Abort fetch on unmount | No setState warnings | ⏳ |

---

## 9. UI/UX

### 9.1 Navigation

| Test ID | From | To | Expected | Status |
|---------|------|-----|----------|--------|
| UI-001 | Login | Dashboard | Successful | ⏳ |
| UI-002 | Dashboard | Raw Materials | Navigation works | ⏳ |
| UI-003 | Sidebar | Reports | Loads correctly | ⏳ |
| UI-004 | Logout | Login | Redirected | ⏳ |

### 9.2 Forms

| Test ID | Form | Action | Expected | Status |
|---------|------|--------|----------|--------|
| UI-005 | Add Material | Submit valid | Success toast | ⏳ |
| UI-006 | Add Material | Submit invalid | Error message | ⏳ |
| UI-007 | Edit Batch | Cancel | Dialog closes | ⏳ |
| UI-008 | Stock Entry | Select item | Dropdown works | ⏳ |

### 9.3 Tables

| Test ID | Table | Action | Expected | Status |
|---------|-------|--------|----------|--------|
| UI-009 | Materials | Sort by name | Sorted correctly | ⏳ |
| UI-010 | Batches | View details | Dialog opens | ⏳ |
| UI-011 | Reports | Change tab | Data updates | ⏳ |

---

## 10. Database Integrity

### 10.1 Constraints

| Test ID | Constraint | Test | Expected | Status |
|---------|-----------|------|----------|--------|
| DB-001 | Unique kode | Insert duplicate | Database error | ⏳ |
| DB-002 | Unique batch code | Insert duplicate | Database error | ⏳ |
| DB-003 | Unique [batchId, materialId] | Insert duplicate | Database error | ⏳ |
| DB-004 | Required fields | Insert NULL | Database error | ⏳ |

### 10.2 Transactions

| Test ID | Scenario | Expected | Status |
|---------|----------|----------|--------|
| DB-005 | Batch creation fails | No partial data | ⏳ |
| DB-006 | Stock movement fails | Rollback | ⏳ |
| DB-007 | Delete batch | All related data handled | ⏳ |

---

## Test Execution

### Prerequisites
- [ ] Database seeded with test data
- [ ] All users created (admin, manager, factory)
- [ ] Development server running
- [ ] Postman/curl ready for API tests

### Execution Order
1. Authentication & Authorization (RBAC)
2. API Endpoints (CRUD operations)
3. Data Validation
4. Pagination
5. Business Logic
6. Security
7. Performance
8. Error Handling
9. UI/UX
10. Database Integrity

### Test Data Setup

```sql
-- Create test users
INSERT INTO users (username, password, role) VALUES
  ('admin_test', 'hashed_password', 'ADMIN'),
  ('manager_test', 'hashed_password', 'MANAGER'),
  ('factory_test', 'hashed_password', 'FACTORY');

-- Create test materials
INSERT INTO raw_materials (kode, name, moq, currentStock) VALUES
  ('RM001', 'Test Material 1', 100, 1000),
  ('RM002', 'Test Material 2', 50, 500);

-- Create test finished goods
INSERT INTO finished_goods (name, currentStock) VALUES
  ('Test Product 1', 100),
  ('Test Product 2', 200);
```

---

## Bug Tracking

| Bug ID | Severity | Description | Status | Fixed In |
|--------|----------|-------------|--------|----------|
| - | - | - | - | - |

---

## Test Results Summary

**Total Tests**: 100+
**Passed**: ⏳
**Failed**: ⏳
**Skipped**: ⏳
**Pass Rate**: ⏳

---

## Sign-off

- [ ] All critical tests passed
- [ ] All high priority tests passed
- [ ] Performance benchmarks met
- [ ] Security tests passed
- [ ] No critical bugs remaining
- [ ] Documentation updated
- [ ] Ready for production deployment

**QA Lead**: _________________
**Date**: _________________
**Approval**: _________________

---

**Last Updated**: 2025-10-05
**Version**: 1.0.0
**Next Review**: After production deployment
