# 📋 User Story Documentation - Stock Management System

**Version:** 1.0.0  
**Purpose:** Functional requirements documentation for the soap factory inventory management system.

---

## 👥 User Roles (Actors)

Based on the Role-Based Access Control (RBAC) implemented in the system:

- **ADMIN**: Manager or owner with full access to all system features.
- **FACTORY**: Production staff responsible for recording batches and production results.
- **OFFICE**: Office staff handling raw material purchases and finished goods distribution.

---

## 📦 1. Raw Materials Management

| ID         | User Story                                                                                         | Acceptance Criteria                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **US-1.1** | As an OFFICE/ADMIN, I want to add new raw materials so that I can track their stock levels.        | • Input includes unique Code, Name, and MOQ.<br>• System rejects duplicate codes.                  |
| **US-1.2** | As an OFFICE/ADMIN, I want to record stock IN for raw materials when purchasing from suppliers.    | • Input includes date (WIB timezone), quantity, and description.<br>• Raw material stock increases automatically. |
| **US-1.5** | As an ADMIN, I want to adjust stock levels manually for corrections. | • Can increase or decrease stock with positive or negative quantities.<br>• Requires reason/description for audit trail.<br>• Prevents negative stock levels.<br>• Only ADMIN has access to this feature. |
| **US-1.3** | As a User, I want to see color indicators for raw material stock levels so I know when to reorder. | • Red: Stock < MOQ.<br>• Yellow: Stock near MOQ.<br>• Green: Healthy stock level.                  |
| **US-1.4** | As a User, I want to view the movement history (Audit Trail) of a raw material.                    | • Displays IN/OUT history, descriptions, batch references, and running balance.                    |

---

## 🧪 2. Production & Batches

| ID         | User Story                                                                                                          | Acceptance Criteria                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **US-2.1** | As a FACTORY/ADMIN, I want to create a production Batch so that raw material consumption and finished good production are recorded automatically. | • Select multiple finished goods with quantities (for size variants) and multiple raw materials with quantities.<br>• System creates automatic OUT movements for each raw material.<br>• System creates automatic IN movements for each finished good.<br>• All dates use WIB timezone (GMT+7). |
| **US-2.2** | As a System, I must reject batch creation if raw material stock is insufficient.                                    | • Stock validation occurs before the batch is saved.<br>• Displays a specific error message for missing items.                    |
| **US-2.3** | As an ADMIN, I want to delete a mistakenly entered production batch.                                                | • Used raw material stock must be restored automatically.<br>• Associated stock movements must be cleaned up.                     |

---

## 🧴 3. Finished Goods Management

| ID         | User Story                                                                                     | Acceptance Criteria                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **US-3.1** | As a FACTORY/ADMIN, I want to record finished goods production results directly in the batch creation workflow. | • Factory staff inputs produced quantities for each finished good when creating a batch.<br>• System automatically creates finished good IN movements.<br>• Multiple finished goods can be produced in a single batch (for size variants).<br>• ADMIN can still manually create finished good IN for corrections. |
| **US-3.2** | As an OFFICE/ADMIN, I want to record stock OUT for finished goods during distribution.         | • Automatically reduces finished good stock.<br>• Prevents stock from becoming negative. |

---

## 📊 4. Reporting

| ID         | User Story                                                                   | Acceptance Criteria                                                                                     |
| ---------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **US-4.1** | As a User, I want to view stock reports in a monthly pivot table format.     | • Items as rows, dates (1-31) as columns.<br>• View types: Opening Stock, IN, OUT, and Remaining Stock. |
| **US-4.2** | As an ADMIN, I want to correct stock data directly through the report table. | • Double-click a cell to edit the quantity.<br>• Automatically updates movements and balances.          |
| **US-4.3** | As a User, I want to export reports to Excel for archiving purposes.         | • Excel file includes comprehensive movement history for the selected month.                            |

---

## 🔐 5. Security & User Management

| ID         | User Story                                                         | Acceptance Criteria                                                                                          |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **US-5.1** | As an ADMIN, I want to manage user accounts (Add/Edit/Deactivate). | • Users assigned specific roles (ADMIN/FACTORY/OFFICE).<br>• Passwords stored securely using bcrypt hashing. |
| **US-5.2** | As a System, I must restrict feature access based on user roles.   | • FACTORY cannot record material purchases or manually create finished good IN (only via batch).<br>• OFFICE cannot create production batches.<br>• Only ADMIN can adjust stock and manually create finished good IN for corrections. |
