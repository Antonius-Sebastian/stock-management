# Product Requirements Document: Inventory Management System (MVP)

**Version**: 1.0  
**Status**: Inception  
**Date**: 2 October 2025

## 1. Project Overview

This project aims to develop a focused, web-based Inventory Management System for a freelance client in the soap manufacturing industry. The core objective of this Minimum Viable Product (MVP) is to replace the client's current, cumbersome, and error-prone workflow of tracking stock using complex Excel spreadsheets (Stok Opname Bahan Baku.xlsx, AGUSTUS 2025.xlsx).

The application will provide a centralized, intuitive interface for managing raw material inventory, tracking finished goods, logging material usage for production, and generating dynamic, easy-to-understand daily stock reports.

## 2. Target User & Problem Statement

### Target Users

- **Pabrik Staff (Factory Staff)**: Responsible for recording the use of raw materials and the manual input of finished goods.
- **Kantor Pusat Staff (Central Office Staff)**: Responsible for overseeing stock levels, generating reports, and adding new materials/products to the system.

### Problem Statement

The current Excel-based system is inefficient and lacks real-time visibility. It is difficult to get an accurate, at-a-glance view of daily stock movements, leading to potential errors in purchasing and production planning.

**User Story**: "As a stock manager, I need a simple, centralized way to view daily stock changes for all my items without navigating multiple complex spreadsheets, so I can make faster, more accurate decisions about inventory."

## 3. MVP Scope & Key Features

The scope of the MVP is strictly limited to core inventory tracking and reporting functionalities. All other features (e.g., RBAC, supplier management) are considered out of scope.

### Milestone 1: Core Data Management & Manual Tracking

This milestone focuses on establishing the digital catalog and enabling manual stock updates.

#### Feature 1.1: Raw Material Master Management

**Description**: A dedicated page to view a list of all raw materials. Users can add new materials to the system.

**UI**: A data table displaying Kode, Nama Material, Stok Saat Ini, and MOQ.

**Acceptance Criteria**:

- Users can view all raw materials.
- A visual badge (red/yellow/green) must indicate the stock level relative to the MOQ.
- A button opens a modal with a form to add a new raw material.

#### Feature 1.2: Finished Goods Master Management

**Description**: A dedicated page to view a list of all finished goods. Users can add new products.

**UI**: A data table displaying SKU, Nama Produk, and Stok Saat Ini.

**Acceptance Criteria**:

- Users can view all finished goods.
- A button opens a modal to add a new product.

#### Feature 1.3: Manual Stock Entry

**Description**: The ability to manually record stock coming in or going out for both raw materials and finished goods.

**UI**: Action buttons ("Input Stok Masuk", "Input Stok Keluar") on the respective master pages that open a modal.

**Acceptance Criteria**:

- The modal form must allow selecting an item, entering a quantity, and setting a date.
- Submitting the form creates the corresponding stock movement record.

### Milestone 2: Production Logic & Interactive Reporting

This milestone delivers the core value proposition: simplified production logging and a powerful, familiar reporting tool.

#### Feature 2.1: Simplified Batch Usage Logging

**Description**: A streamlined process to record the consumption of raw materials for production. This is the only way raw material stock should decrease automatically.

**UI**: A dedicated page showing a history of past batches. A button opens a modal to create a new "Batch Pemakaian" entry.

**Acceptance Criteria**:

- The form only requires selecting a single raw material and entering the quantity used.
- Upon submission, the system must automatically create a stock OUT transaction for that raw material.

#### Feature 2.2: The Interactive Stock Report Page

**Description**: A comprehensive report page that replaces the main Excel workflow. It must be dynamic and highly interactive.

**UI Layout ("Pivoted View")**:

- The table will be structured with Items (Products or Materials) as ROWS and Days of the Month (1 to 31) as COLUMNS.
- The first column (Item Name) must be sticky ("frozen") to remain visible during horizontal scrolling.

**Interactivity & Filters**:

- **Top-Level Tabs**: Switch the report context between Laporan Bahan Baku and Laporan Produk Jadi.
- **Global Filters**: Dropdowns to select Year and Month.
- **Data Type Tabs**: A set of four tabs (Stok Awal, Stok Masuk, Stok Keluar, Stok Sisa) that dynamically change the numerical values inside the table cells.

**Acceptance Criteria**:

- The table correctly renders data based on all active filters.
- Changing a filter or tab updates the table's content on the client-side without a full page reload.
- The sticky column functions correctly during horizontal scroll.

## 4. Technical Specifications

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI Components**: shadcn/ui (via MCP Server)
- **Styling**: Tailwind CSS
- **ORM**: Prisma
- **Database**: Supabase (PostgreSQL)
- **Validation**: Zod (for forms)

## 5. Success Metrics (for MVP)

- **User Adoption**: Client staff actively use the application for daily stock entries instead of the Excel sheets.
- **Time to Insight**: Time taken for a manager to find the stock sisa for a specific product on a specific day is reduced by at least 75%.
- **Data Accuracy**: Reduction in manual calculation errors, confirmed by monthly stock opname.

## 6. Out of Scope for MVP

- Role-Based Access Control (RBAC) - all users are treated as admins.
- Supplier and customer data management.
- Advanced analytics, dashboards, or forecasting.
- Direct integration with accounting or sales systems.
- Purchase order and invoicing features.
