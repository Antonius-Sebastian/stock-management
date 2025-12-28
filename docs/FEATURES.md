# Features Documentation - Stock Management System

**Version:** 1.0.0  
**Last Updated:** October 6, 2025

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Application Pages](#application-pages)
3. [Core Features](#core-features)
4. [Role-Based Permissions](#role-based-permissions)
5. [API Endpoints](#api-endpoints)
6. [User Interface Features](#user-interface-features)

---

## Overview

The Stock Management System is a web-based inventory management application designed for soap manufacturing operations. It provides centralized management of raw materials, finished goods, production batches, and comprehensive reporting capabilities.

**Key Purpose:** Replace Excel spreadsheets with a secure, role-based system that prevents data manipulation and ensures transparency in stock movements.

---

## Application Pages

### 1. **Login Page** (`/login`)

**Purpose:** User authentication and access control

**Features:**

- Username and password login
- Session-based authentication (NextAuth.js)
- Automatic redirect to home page after successful login
- Redirect to login if not authenticated

**Access:** Public (no authentication required)

---

### 2. **Home Page** (`/`)

**Purpose:** Default landing page

**Features:**

- Automatic redirect to Raw Materials page (`/raw-materials`)
- Loading state during redirect

**Access:** Authenticated users only

---

### 3. **Raw Materials Page** (`/raw-materials`)

**Purpose:** Manage raw material inventory

**Features:**

- **List View:**
  - Display all raw materials in a sortable, searchable table
  - Columns: Code (Kode), Name, Current Stock, MOQ, Stock Level Badge
  - Stock level indicators (Red/Yellow/Green based on MOQ)
- **Actions:**

  - **Add Raw Material** (OFFICE & ADMIN only)

    - Code (unique identifier)
    - Name
    - MOQ (Minimum Order Quantity)

  - **Edit Raw Material** (OFFICE & ADMIN only)

    - Update name and MOQ
    - Stock cannot be edited directly (only via movements)

  - **Delete Raw Material** (ADMIN only)

    - Protected: Cannot delete if material has transaction history

  - **Input Stock IN** (OFFICE & ADMIN only)

    - Manual stock entry when purchasing from supplier
    - Date, quantity, and description

  - **View Detail** (All roles)
    - Click on material to view detailed movement history

**Access:** All authenticated users (view), OFFICE/ADMIN (manage)

---

### 4. **Raw Material Detail Page** (`/raw-materials/[id]`)

**Purpose:** Detailed view of a single raw material with complete movement history

**Features:**

- **Summary Cards:**
  - Current Stock (with stock level badge)
  - MOQ (Minimum Order Quantity)
  - Total Movements count
- **Movement History Table:**
  - Complete audit trail of all stock movements
  - Columns: Date, Type (IN/OUT), Quantity, Description, Batch Code (clickable), Running Balance
  - Running balance calculated from baseline (0)
  - Sortable and searchable
  - Clickable batch codes to view batch details
- **Navigation:**
  - Back button to return to Raw Materials list

**Access:** All authenticated users

---

### 5. **Finished Goods Page** (`/finished-goods`)

**Purpose:** Manage finished product inventory

**Features:**

- **List View:**
  - Display all finished goods in a sortable, searchable table
  - Columns: Name, Current Stock
  - Stock level indicators
- **Actions:**

  - **Add Finished Good** (OFFICE & ADMIN only)

    - Name (unique identifier)

  - **Edit Finished Good** (OFFICE & ADMIN only)

    - Update name
    - Stock cannot be edited directly (only via movements)

  - **Delete Finished Good** (ADMIN only)

    - Protected: Cannot delete if product has transaction history

  - **Input Stock IN** (FACTORY & ADMIN only)

    - Manual stock entry after batch production
    - Date, quantity, and description
    - Used when production results vary from expected

  - **Input Stock OUT** (OFFICE & ADMIN only)
    - Manual stock entry when sending to distributor
    - Date, quantity, and description

**Access:** All authenticated users (view), role-based actions

---

### 6. **Batches Page** (`/batches`)

**Purpose:** Track production batches and raw material consumption

**Features:**

- **List View:**
  - Display all production batches in a sortable, searchable table
  - Columns: Batch Code, Date, Finished Good, Description, Materials Count
- **Actions:**

  - **Create Batch** (FACTORY & ADMIN only)

    - Batch code (unique identifier)
    - Date
    - Finished good selection
    - Description (optional)
    - Multiple raw materials with quantities
    - **Automatic Features:**
      - Creates raw material OUT movements automatically
      - Deducts raw material stock automatically
      - Validates sufficient stock before creation
      - Prevents duplicate materials in same batch

  - **View Batch Details** (All roles)

    - Modal dialog showing:
      - Batch information
      - Finished good details
      - Complete list of raw materials used with quantities
      - Linked stock movements

  - **Edit Batch** (ADMIN only)

    - Update batch code, date, description, finished good
    - Update raw material usage (restores old stock, deducts new stock)

  - **Delete Batch** (ADMIN only)
    - Restores raw material stock automatically
    - Removes associated stock movements
    - Confirmation dialog required

**Access:** All authenticated users (view), FACTORY/ADMIN (create), ADMIN (edit/delete)

---

### 7. **Reports Page** (`/reports`)

**Purpose:** Interactive stock reports with pivot-style views

**Features:**

- **Report Types:**
  - **Laporan Bahan Baku** (Raw Materials Report)
  - **Laporan Produk Jadi** (Finished Goods Report)
- **Filters:**
  - **Year:** 2023, 2024, 2025
  - **Month:** January through December
  - **Data Type Tabs:**
    - **Stok Awal** (Opening Stock)
    - **Stok Masuk** (Stock IN)
    - **Stok Keluar** (Stock OUT)
    - **Stok Sisa** (Remaining Stock)
- **Table Features:**
  - Pivot-style layout: Items as rows, Days (1-31) as columns
  - Sticky first column (item name) for horizontal scrolling
  - Real-time data updates when filters change
  - Shows only days up to current day for current month
- **Export:**
  - **Excel Export** button
  - Exports comprehensive stock data for selected month
  - Includes all movement history
  - Downloadable file with formatted data

**Access:** All authenticated users

---

### 8. **Users Page** (`/users`)

**Purpose:** User management and role assignment

**Features:**

- **List View:**
  - Display all users in a sortable table
  - Columns: Username, Name, Email, Role, Status (Active/Inactive), Created Date
- **Actions:**

  - **Add User** (ADMIN only)

    - Username (unique)
    - Name
    - Email (optional, unique)
    - Password
    - Role: ADMIN, FACTORY, or OFFICE
    - Active status

  - **Edit User** (ADMIN only)

    - Update name, email, role, password, active status

  - **Delete User** (ADMIN only)

    - Soft delete (set isActive to false)
    - Cannot delete own account

  - **Activate/Deactivate User** (ADMIN only)
    - Toggle user active status

**Access:** ADMIN only

---

## Core Features

### 1. **Stock Movement Management**

**Purpose:** Track all stock IN and OUT movements with complete audit trail

**Types of Movements:**

- **Raw Material IN:** When purchasing from supplier (OFFICE only)
- **Raw Material OUT:** Automatic via batch creation (FACTORY via batch)
- **Finished Good IN:** After batch production (FACTORY only)
- **Finished Good OUT:** When sending to distributor (OFFICE only)

**Features:**

- Automatic stock balance updates
- Running balance calculations
- Date-based filtering
- Batch linking (for raw material OUT movements)
- Description/notes field
- Prevents negative stock

---

### 2. **Production Batch Tracking**

**Purpose:** Log production batches and automatically track raw material consumption

**Workflow:**

1. Factory staff creates a batch
2. Selects finished good being produced
3. Adds raw materials with quantities
4. System automatically:
   - Creates raw material OUT movements
   - Deducts raw material stock
   - Links movements to batch
5. Factory staff manually inputs finished good IN (results vary)

**Features:**

- Multi-material batch support
- Stock validation before creation
- Automatic stock deduction
- Batch detail views
- Stock restoration on deletion
- Edit capability (ADMIN only)

---

### 3. **Stock Level Indicators**

**Purpose:** Visual indicators for stock levels based on MOQ

**Badge Colors:**

- **Red:** Stock below MOQ (low stock)
- **Yellow:** Stock at or slightly above MOQ (warning)
- **Green:** Stock well above MOQ (healthy)

**Calculation:**

- Based on `currentStock` vs `moq` (Minimum Order Quantity)
- Only for raw materials (finished goods don't have MOQ)

---

### 4. **Interactive Reports**

**Purpose:** Excel-like pivot tables for stock analysis

**Features:**

- Pivot-style layout (items × days)
- Four data type views (Opening, IN, OUT, Remaining)
- Real-time filtering (year, month, type)
- Sticky column for horizontal scrolling
- Excel export functionality
- Month-by-month historical data

---

### 5. **Audit Trail**

**Purpose:** Complete history of all stock movements

**Features:**

- Running balance calculations
- Date and time stamps
- User tracking (via session)
- Batch references (clickable links)
- Description/notes
- Searchable and sortable
- Cannot be deleted (ADMIN can edit)

---

### 6. **Data Integrity Protection**

**Purpose:** Prevent data manipulation and ensure accuracy

**Protections:**

- Cannot delete items with transaction history
- Prevents negative stock
- Transaction-safe operations (database transactions)
- Stock can only change via movements (not direct editing)
- Role-based access control
- Server-side validation
- Automatic stock restoration on batch deletion

---

## Role-Based Permissions

### **ADMIN Role**

**Full Access:**

- ✅ Create, edit, delete raw materials
- ✅ Create, edit, delete finished goods
- ✅ Create, edit, delete batches
- ✅ Create all types of stock movements
- ✅ Edit and delete stock movements
- ✅ Manage users (CRUD)
- ✅ View and export reports
- ✅ Access all pages

**Use Case:** Manager/boss with full system access

---

### **FACTORY Role**

**Production-Focused:**

- ❌ Cannot manage raw materials or finished goods
- ✅ Create batches (auto-creates raw material OUT)
- ❌ Cannot edit or delete batches
- ✅ Create finished good IN movements (manual after production)
- ❌ Cannot create raw material IN/OUT manually
- ❌ Cannot create finished good OUT
- ❌ Cannot edit or delete movements
- ✅ View and export reports
- ❌ Cannot access user management

**Use Case:** Factory staff who record production batches and input finished goods

---

### **OFFICE Role**

**Inventory Management:**

- ✅ Create and edit raw materials
- ❌ Cannot delete raw materials
- ✅ Create and edit finished goods
- ❌ Cannot delete finished goods
- ❌ Cannot create batches
- ✅ Create raw material IN movements (purchases)
- ✅ Create finished good OUT movements (distribution)
- ❌ Cannot create raw material OUT (only via batch)
- ❌ Cannot create finished good IN (only FACTORY)
- ❌ Cannot edit or delete movements
- ✅ View and export reports
- ❌ Cannot access user management

**Use Case:** Office staff who handle purchases and distribution

---

## API Endpoints

### Authentication

- `POST /api/auth/signin` - User login
- `POST /api/auth/signout` - User logout
- `GET /api/auth/session` - Get current session

### Raw Materials

- `GET /api/raw-materials` - List all raw materials (with pagination)
- `GET /api/raw-materials/[id]` - Get single raw material
- `POST /api/raw-materials` - Create raw material
- `PUT /api/raw-materials/[id]` - Update raw material
- `DELETE /api/raw-materials/[id]` - Delete raw material
- `GET /api/raw-materials/[id]/movements` - Get movement history

### Finished Goods

- `GET /api/finished-goods` - List all finished goods
- `GET /api/finished-goods/[id]` - Get single finished good
- `POST /api/finished-goods` - Create finished good
- `PUT /api/finished-goods/[id]` - Update finished good
- `DELETE /api/finished-goods/[id]` - Delete finished good

### Batches

- `GET /api/batches` - List all batches (with pagination)
- `GET /api/batches/[id]` - Get single batch with details
- `POST /api/batches` - Create batch (auto-creates movements)
- `PUT /api/batches/[id]` - Update batch
- `DELETE /api/batches/[id]` - Delete batch (restores stock)

### Stock Movements

- `GET /api/stock-movements` - List all movements (with filters)
- `POST /api/stock-movements` - Create movement
- `GET /api/stock-movements/by-date` - Get movements by date range

### Reports

- `GET /api/reports/stock` - Get stock report data (pivot format)
- `GET /api/reports/export` - Export report to Excel

### Users

- `GET /api/users` - List all users
- `GET /api/users/[id]` - Get single user
- `POST /api/users` - Create user
- `PUT /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user (soft delete)

### Health

- `GET /api/health` - System health check (public)

---

## User Interface Features

### 1. **Responsive Design**

- Mobile-friendly layout
- Collapsible sidebar
- Responsive tables with horizontal scrolling
- Touch-friendly buttons and controls

### 2. **Dark Mode Support**

- System preference detection
- Manual theme toggle
- Persistent theme selection

### 3. **Navigation**

- Sidebar navigation with icons
- Active page highlighting
- Collapsible sidebar (desktop)
- Mobile hamburger menu
- Breadcrumb navigation on detail pages

### 4. **Data Tables**

- Sortable columns
- Searchable content
- Pagination support
- Row actions (dropdown menus)
- Empty states with helpful messages

### 5. **Dialogs & Modals**

- Add/Edit dialogs for all entities
- Confirmation dialogs for destructive actions
- Detail view modals
- Stock entry dialogs
- Batch detail dialogs

### 6. **Form Validation**

- Real-time validation
- Error messages
- Required field indicators
- Duplicate prevention
- Stock validation

### 7. **Notifications**

- Toast notifications for success/error
- Loading states
- Progress indicators
- Error boundaries

### 8. **Accessibility**

- Keyboard navigation
- Screen reader support
- ARIA labels
- Focus management
- Semantic HTML

---

## Business Rules Summary

### Stock Movement Rules

1. **Raw Material IN:** Only OFFICE can input (purchases from supplier)
2. **Raw Material OUT:** Only automatic via batch creation (FACTORY creates batch)
3. **Finished Good IN:** Only FACTORY can input (after production, results vary)
4. **Finished Good OUT:** Only OFFICE can input (distribution to customers)

### Data Integrity Rules

1. Stock can only change via movements (not direct editing)
2. Cannot delete items with transaction history
3. Prevents negative stock
4. Batch deletion restores raw material stock
5. All operations are transaction-safe

### Permission Rules

1. ADMIN has full access
2. FACTORY can only create batches and finished good IN
3. OFFICE can manage materials/products and handle purchases/distribution
4. Server-side validation enforces all rules

---

## Technical Features

### Performance

- Optimized database queries
- Indexed foreign keys
- Pagination for large datasets
- Client-side filtering for reports
- Efficient data fetching

### Security

- JWT-based authentication
- HTTP-only session cookies
- Bcrypt password hashing
- Protected API endpoints
- Role-based access control
- Input validation (Zod schemas)
- SQL injection protection (Prisma ORM)

### Data Management

- PostgreSQL database
- Prisma ORM
- Transaction-safe operations
- Audit logging
- Data validation

---

## Future Enhancements (Planned)

### Phase 1

- Dashboard with analytics
- Clone batch feature
- Date range filters for movement history

### Phase 2

- Supplier management
- Purchase order workflow
- Low stock notifications
- Email notifications

### Phase 3

- Multi-location support
- Barcode scanning
- Mobile application
- API integrations

---

**Last Updated:** October 6, 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
