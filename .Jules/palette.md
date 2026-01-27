## 2024-05-23 - Status Badges as Actionable Elements
**Learning:** Status badges (e.g., "Critical Stock") are more effective when they explain *why* they are in that state. Users often need to know the underlying numbers (Stock vs MOQ) to take appropriate action.
**Action:** Always wrap status badges in a Tooltip that reveals the calculation (e.g., "Stock: 50 / MOQ: 100 = 50%"). Ensure the trigger is keyboard accessible (tabIndex=0) since Badges are often non-interactive spans.
