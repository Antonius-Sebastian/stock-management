### **User Stories & Functional Specifications**

#### **1. Drum & Raw Material Management**

- **User Story:** _As a Warehouse Operator, I want to register specific drums when receiving raw materials, so that I can track the exact stock levels of each physical container._
- **Specifications:**
- **Batch Registration:** Users can input multiple drums in a single "Stock In" session.
- **Drum Identity:** Each drum must have a **unique ID** (inputted by user) and be linked to exactly one Raw Material.
- **Storage Logic:** The `RawMaterial` model should act as a parent, while the `Drum` model stores the actual weight/volume (e.g., 200 Liters per drum).
- **Global Stock:** The `currentStock` in `RawMaterial` should be the sum of `currentQuantity` from all its associated active drums.

#### **2. Production Batch (Material Usage Only)**

- **User Story:** _As a Production Staff, I want to record material usage by selecting specific drums, so that the system knows exactly which container was used for which batch._
- **Specifications:**
- **Decoupling:** Remove the automatic link between `Batch` and `FinishedGood`. Creating a batch no longer increments finished good stock.
- **Multi-Drum Selection:** Users can pick one or more drums if a single drum’s quantity is insufficient for the production requirements.
- **Usage Logic:** The system must decrement the `currentQuantity` of each selected drum and the global `currentStock` of the raw material.
- **Traceability:** `BatchUsage` must record the `drumId` instead of just the `rawMaterialId`.

#### **3. Manual Finished Good Stock-In**

- **User Story:** _As a Production Supervisor, I want a dedicated button to manually input finished good stock, so that production output can be recorded independently of the raw material batch process._
- **Specifications:**
- **Direct Entry:** Add a "Stock In" action/button on the Finished Goods page.
- **No Batch Requirement:** Users do not need to link this stock-in to a specific Batch ID.
- **Movement Record:** Every manual entry must still create a `StockMovement` (Type: IN) for audit trail purposes.

#### **4. Data Correction & Reversals**

- **User Story:** _As an Admin, I want to adjust drum stock or delete batches, so that the physical and digital inventory stay synchronized in case of errors._
- **Specifications:**
- **Batch Deletion Reversal:** If a batch is deleted, the quantity used must be returned specifically to the **original drums** it was taken from.
- **Drum Adjustments:** Users can perform manual adjustments (ADJUSTMENT type) on a per-drum basis for spills, leaks, or evaporation.

#### **5. Inventory Reporting**

- **User Story:** _As an Inventory Manager, I want to see a report of stock movements filtered by Drum ID, so that I can investigate discrepancies in specific containers._
- **Specifications:**
- **Enhanced History:** The `StockMovement` history should display the `drumId` (if applicable) alongside the material name and description.
