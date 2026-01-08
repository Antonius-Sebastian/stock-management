### **User Requirements Specification: Multi-Location Finished Goods**

#### **1. Location/City Management**

- **User Story:** _As an Admin, I want to define different storage locations (cities), so that I can organize my finished good inventory by region._
- **Functional Requirements:**
- The system shall support multiple locations (e.g., Jakarta, Surabaya, Pontianak).
- Each location will act as a "tenant" or a separate bucket for finished good stocks.

#### **2. Multi-Location Stock Structure**

- **User Story:** _As a Logistics Manager, I want to see the specific stock balance of a product in each city, so that I can manage distribution and fulfillment accurately._
- **Functional Requirements:**
- **Stock Separation:** Finished Good stock shall no longer be a single global value. It must be tracked per location.
- **Independent Balances:** Adding stock in Jakarta must not affect the stock balance in Surabaya.
- **Manual Entry:** Every "Stock In" or "Stock Out" transaction for finished goods must require the user to select a target Location.

#### **3. Decoupled Production Workflow**

- **User Story:** _As a Production Supervisor, I want to manually record the completion of products after a batch is done, so that I can decide which warehouse/city receives the new stock._
- **Functional Requirements:**
- **Manual Stock-In:** The "Stock In" button on the Finished Goods page will be the primary way to add inventory.
- **Optional Reference:** When performing a manual Stock-In, the user may (optionally) type a Batch Code as a note/description, but no hard database relationship is required.
- **Audit Trail:** Every manual entry must generate a `StockMovement` record that includes the Location ID.

#### **4. Location-Based Reporting**

- **User Story:** _As a Business Owner, I want to filter inventory reports by location, so that I can monitor stock levels across the country._
- **Functional Requirements:**
- The inventory dashboard must allow filtering by City/Location.
- Stock movement history must clearly show which location was involved in each transaction.
